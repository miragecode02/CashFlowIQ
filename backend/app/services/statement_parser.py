"""
Bank Statement Parser
Supports: HDFC, SBI, ICICI, Axis Bank
Formats: PDF, CSV, Excel (.xlsx/.xls)
"""

import re
import io
import pandas as pd
from datetime import datetime
from typing import Optional
import pdfplumber


# ── Auto-categorization keywords ─────────────────────────────────────────────
CATEGORY_RULES = {
    "Food & Dining": [
        "swiggy", "zomato", "domino", "pizza", "burger", "cafe", "restaurant",
        "hotel", "food", "kitchen", "biryani", "haldiram", "mcdonald", "kfc",
        "subway", "barbeque", "dining", "eat", "meal", "canteen",
        "eatsure", "faasos", "box8", "chai", "swiggy instamart"
    ],
    "Shopping": [
        "amazon", "flipkart", "myntra", "ajio", "nykaa", "meesho", "snapdeal",
        "shoppers", "mall", "store", "mart", "retail", "fashion", "clothes",
        "decathlon", "ikea", "reliance digital", "croma", "vijay sales",
        # quick-commerce / grocery delivery — no dedicated category, closest fit
        "zepto", "blinkit", "instamart", "bigbasket", "grofers", "dunzo",
        "ekart", "milkbasket", "licious", "grocery"
    ],
    "Transport": [
        "uber", "ola", "rapido", "auto", "taxi", "metro", "irctc", "railway",
        "bus", "petrol", "fuel", "diesel", "fastag", "toll", "indigo", "spicejet",
        "air india", "go air", "vistara", "flight", "train", "redbus", "porter"
    ],
    "Entertainment": [
        "netflix", "amazon prime", "hotstar", "disney", "spotify", "youtube",
        "bookmyshow", "pvr", "inox", "cinepolis", "gaming", "steam", "xbox",
        "playstation", "zee5", "sonyliv", "jiocinema"
    ],
    "Health": [
        "pharmacy", "pharm", "hospital", "clinic", "doctor", "medical", "apollo",
        "1mg", "netmeds", "pharmeasy", "health", "gym", "fitness", "cult.fit",
        "insurance", "diagnostic", "lab", "pathology"
    ],
    "Utilities": [
        "electricity", "water", "gas", "bill", "bses", "tata power", "adani",
        "airtel", "jio", "vi ", "vodafone", "bsnl", "broadband", "internet",
        "recharge", "dth", "tatasky", "dish tv"
    ],
    "Education": [
        "school", "college", "university", "course", "udemy", "coursera",
        "byju", "unacademy", "vedantu", "tuition", "fees", "books", "library"
    ],
    "Investments": [
        "zerodha", "groww", "upstox", "sip", "mutual fund", "nps", "ppf",
        "fd ", "fixed deposit", "rd ", "recurring", "lic", "insurance premium"
    ],
    # "Income" is intentionally not matched here — see looks_like_income() below.
    # Payment-rail terms like neft/imps/rtgs/credit show up in outgoing narration
    # just as often as incoming, so keyword-matching them as "Income" mislabels expenses.
}

# Used only to infer transaction *direction* as a last resort (single signed-amount
# columns with no explicit debit/credit split) — not for category tagging.
INCOME_KEYWORDS = [
    "salary", "credited", "refund", "cashback", "interest earned",
    "dividend", "bonus", "incentive", "reimbursement", "interest credit",
]


def looks_like_income(description: str) -> bool:
    desc_lower = description.lower()
    return any(k in desc_lower for k in INCOME_KEYWORDS)

CATEGORY_ID_MAP = {
    "Food & Dining": 1,
    "Shopping": 2,
    "Transport": 3,
    "Entertainment": 4,
    "Health": 5,
    "Other": 6,
    "Utilities": 7,
    "Education": 8,
    "Investments": 9,
    "Income": 10,
}


def auto_categorize(description: str) -> tuple[str, int]:
    """Match description to category using keyword rules."""
    desc_lower = description.lower()
    for category, keywords in CATEGORY_RULES.items():
        for keyword in keywords:
            if keyword in desc_lower:
                return category, CATEGORY_ID_MAP.get(category, 6)
    return "Other", 6


def parse_date(date_val) -> Optional[datetime]:
    """Try multiple date formats used by Indian banks. Also accepts datetime-like
    objects directly (e.g. pandas Timestamp from Excel cells with native date types)."""
    if isinstance(date_val, datetime):
        return date_val
    if hasattr(date_val, "to_pydatetime"):
        try:
            return date_val.to_pydatetime()
        except Exception:
            pass
    if pd.isna(date_val):
        return None

    formats = [
        "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y",
        "%Y-%m-%d", "%d %b %Y", "%d-%b-%Y", "%d/%b/%Y",
        "%d %B %Y", "%d-%b-%y", "%-d %b %Y",
    ]
    date_str = str(date_val).strip()
    # Strip a trailing time component (e.g. from stringified Timestamps: "2026-08-01 00:00:00")
    date_str = re.sub(r"\s+\d{1,2}:\d{2}(:\d{2})?$", "", date_str)
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None


def clean_amount(amount_str) -> Optional[float]:
    """Clean amount string to float."""
    if pd.isna(amount_str) or str(amount_str).strip() in ["", "-", "nan"]:
        return None
    s = str(amount_str).strip()
    # Strip trailing Dr/Cr markers (e.g. "1,200.00 Dr") before parsing
    s = re.sub(r"\s*(dr|cr)\.?$", "", s, flags=re.IGNORECASE)
    # Accounting-style negatives: (1,200.00)
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    cleaned = re.sub(r"[₹,\s]", "", s)
    try:
        return abs(float(cleaned))
    except ValueError:
        return None


def infer_direction_from_raw(raw) -> Optional[str]:
    """Best-effort income/expense direction from a raw amount cell (Dr/Cr suffix, sign, parentheses)."""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    if re.search(r"\bdr\.?$", s, flags=re.IGNORECASE):
        return "expense"
    if re.search(r"\bcr\.?$", s, flags=re.IGNORECASE):
        return "income"
    if s.startswith("-") or (s.startswith("(") and s.endswith(")")):
        return "expense"
    return None


# ── PDF Parsers ───────────────────────────────────────────────────────────────

def detect_bank_from_pdf(text: str) -> str:
    # Only look at the letterhead/header area — scanning the full document risks
    # matching a counterparty's bank name mentioned in transaction narration further down.
    text_lower = text[:1500].lower()
    if "hdfc" in text_lower:
        return "hdfc"
    elif "state bank" in text_lower or "sbi" in text_lower:
        return "sbi"
    elif "icici" in text_lower:
        return "icici"
    elif "axis" in text_lower:
        return "axis"
    return "generic"


def parse_hdfc_pdf(pages) -> list[dict]:
    transactions = []
    for page in pages:
        table = page.extract_table()
        if not table:
            continue
        for row in table[1:]:
            if not row or len(row) < 4:
                continue
            try:
                date_val = row[0]
                narration = row[1] or ""
                withdrawal = clean_amount(row[3]) if len(row) > 3 else None
                deposit = clean_amount(row[4]) if len(row) > 4 else None

                date = parse_date(date_val)
                if not date or not narration:
                    continue

                if withdrawal:
                    cat_name, cat_id = auto_categorize(narration)
                    transactions.append({
                        "date": date, "description": narration[:200],
                        "amount": withdrawal, "type": "expense",
                        "category_name": cat_name, "category_id": cat_id,
                    })
                if deposit:
                    transactions.append({
                        "date": date, "description": narration[:200],
                        "amount": deposit, "type": "income",
                        "category_name": "Income", "category_id": 10,
                    })
            except Exception:
                continue
    return transactions


def parse_sbi_pdf(pages) -> list[dict]:
    transactions = []
    for page in pages:
        table = page.extract_table()
        if not table:
            continue
        for row in table[1:]:
            if not row or len(row) < 5:
                continue
            try:
                date_val = row[0]
                description = (row[1] or "") + " " + (row[2] or "")
                debit = clean_amount(row[3]) if len(row) > 3 else None
                credit = clean_amount(row[4]) if len(row) > 4 else None

                date = parse_date(date_val)
                if not date:
                    continue

                if debit:
                    cat_name, cat_id = auto_categorize(description)
                    transactions.append({
                        "date": date, "description": description.strip()[:200],
                        "amount": debit, "type": "expense",
                        "category_name": cat_name, "category_id": cat_id,
                    })
                if credit:
                    transactions.append({
                        "date": date, "description": description.strip()[:200],
                        "amount": credit, "type": "income",
                        "category_name": "Income", "category_id": 10,
                    })
            except Exception:
                continue
    return transactions


def parse_icici_pdf(pages) -> list[dict]:
    transactions = []
    for page in pages:
        table = page.extract_table()
        if not table:
            continue
        for row in table[1:]:
            if not row or len(row) < 4:
                continue
            try:
                date_val = row[0]
                description = row[2] or row[1] or ""
                debit = clean_amount(row[3]) if len(row) > 3 else None
                credit = clean_amount(row[4]) if len(row) > 4 else None

                date = parse_date(date_val)
                if not date:
                    continue

                if debit:
                    cat_name, cat_id = auto_categorize(description)
                    transactions.append({
                        "date": date, "description": description[:200],
                        "amount": debit, "type": "expense",
                        "category_name": cat_name, "category_id": cat_id,
                    })
                if credit:
                    transactions.append({
                        "date": date, "description": description[:200],
                        "amount": credit, "type": "income",
                        "category_name": "Income", "category_id": 10,
                    })
            except Exception:
                continue
    return transactions


def parse_generic_pdf(pages) -> list[dict]:
    """Fallback: try to extract any table with date + amount columns."""
    transactions = []
    for page in pages:
        table = page.extract_table()
        if not table:
            continue
        for row in table[1:]:
            if not row:
                continue
            row_str = [str(c or "").strip() for c in row]
            # Find date column
            date = None
            for cell in row_str:
                date = parse_date(cell)
                if date:
                    break
            if not date:
                continue
            # Find description and amounts
            description = next((c for c in row_str if len(c) > 5 and not parse_date(c)), "")
            amount_cells = [c for c in row_str if clean_amount(c)]
            if not amount_cells:
                continue
            amount_cell = amount_cells[0]
            amount = clean_amount(amount_cell)

            tx_type = infer_direction_from_raw(amount_cell)
            if tx_type is None:
                tx_type = "income" if looks_like_income(description) else "expense"
            cat_name, cat_id = ("Income", 10) if tx_type == "income" else auto_categorize(description)

            transactions.append({
                "date": date, "description": description[:200],
                "amount": amount, "type": tx_type,
                "category_name": cat_name, "category_id": cat_id,
            })
    return transactions


def parse_pdf(file_bytes: bytes) -> list[dict]:
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        full_text = " ".join(page.extract_text() or "" for page in pdf.pages)
        bank = detect_bank_from_pdf(full_text)
        if bank == "hdfc":
            return parse_hdfc_pdf(pdf.pages)
        elif bank == "sbi":
            return parse_sbi_pdf(pdf.pages)
        elif bank == "icici":
            return parse_icici_pdf(pdf.pages)
        else:
            return parse_generic_pdf(pdf.pages)


# ── CSV / Excel Parsers ───────────────────────────────────────────────────────

def detect_bank_from_df(df: pd.DataFrame) -> str:
    # Only inspect column *headers*, never transaction content — narration text
    # routinely references a counterparty's bank name (e.g. an NEFT to an HDFC
    # account on a non-HDFC statement), which would otherwise cause misdetection.
    cols = " ".join(df.columns.astype(str)).lower()

    if "hdfc" in cols or "narration" in cols:
        return "hdfc"
    elif "state bank" in cols or "sbi" in cols:
        return "sbi"
    elif "icici" in cols:
        return "icici"
    elif "axis" in cols:
        return "axis"
    return "generic"


def find_header_row(raw: pd.DataFrame, max_scan: int = 40) -> Optional[int]:
    """Scan the first `max_scan` rows for the one that looks like the transaction
    table header — needed because many real bank exports (IDFC, etc.) prepend
    a block of account metadata before the actual table starts."""
    date_kw = ("date",)
    amount_kw = ("debit", "credit", "withdrawal", "deposit", "amount")
    for i in range(min(max_scan, len(raw))):
        cells = [str(c).strip().lower() for c in raw.iloc[i].tolist() if pd.notna(c)]
        if not cells:
            continue
        has_date = any(any(k in c for k in date_kw) for c in cells)
        has_amount = any(any(k in c for k in amount_kw) for c in cells)
        if has_date and has_amount:
            return i
    return None


def parse_csv_excel(file_bytes: bytes, filename: str) -> list[dict]:
    try:
        if filename.endswith(".csv"):
            # Try multiple encodings
            raw = None
            for enc in ["utf-8", "latin-1", "cp1252"]:
                try:
                    raw = pd.read_csv(io.BytesIO(file_bytes), encoding=enc, header=None)
                    break
                except Exception:
                    continue
            if raw is None:
                raise ValueError("Could not decode file with any supported encoding")
        else:
            raw = pd.read_excel(io.BytesIO(file_bytes), header=None)
    except Exception as e:
        raise ValueError(f"Could not read file: {e}")

    header_idx = find_header_row(raw)
    if header_idx is not None:
        df = raw.iloc[header_idx + 1:].copy()
        df.columns = [str(c).strip() for c in raw.iloc[header_idx].tolist()]
        df = df.reset_index(drop=True)
    else:
        # No metadata preamble detected — treat the first row as the header (legacy behavior)
        df = raw.iloc[1:].copy()
        df.columns = [str(c).strip() for c in raw.iloc[0].tolist()]
        df = df.reset_index(drop=True)

    # Drop fully empty rows/cols
    df = df.dropna(how="all").reset_index(drop=True)
    df.columns = df.columns.astype(str).str.strip()

    bank = detect_bank_from_df(df)

    if bank == "hdfc":
        return parse_hdfc_csv(df)
    elif bank == "sbi":
        return parse_sbi_csv(df)
    elif bank == "icici":
        return parse_icici_csv(df)
    elif bank == "axis":
        return parse_axis_csv(df)
    else:
        return parse_generic_csv(df)


def parse_hdfc_csv(df: pd.DataFrame) -> list[dict]:
    transactions = []
    col_map = {c.lower(): c for c in df.columns}

    date_col = next((col_map[k] for k in col_map if "date" in k), None)
    desc_col = next((col_map[k] for k in col_map if "narration" in k or "description" in k or "particular" in k), None)
    debit_col = next((col_map[k] for k in col_map if "debit" in k or "withdrawal" in k), None)
    credit_col = next((col_map[k] for k in col_map if "credit" in k or "deposit" in k), None)

    if not date_col or not desc_col:
        return parse_generic_csv(df)

    for _, row in df.iterrows():
        date = parse_date(row[date_col])
        if not date:
            continue
        description = str(row.get(desc_col, "")).strip() if desc_col else ""
        debit = clean_amount(row.get(debit_col)) if debit_col else None
        credit = clean_amount(row.get(credit_col)) if credit_col else None

        if debit:
            cat_name, cat_id = auto_categorize(description)
            transactions.append({"date": date, "description": description[:200], "amount": debit, "type": "expense", "category_name": cat_name, "category_id": cat_id})
        if credit:
            transactions.append({"date": date, "description": description[:200], "amount": credit, "type": "income", "category_name": "Income", "category_id": 10})

    return transactions


def parse_sbi_csv(df: pd.DataFrame) -> list[dict]:
    transactions = []
    col_map = {c.lower(): c for c in df.columns}

    date_col = next((col_map[k] for k in col_map if "date" in k), None)
    desc_col = next((col_map[k] for k in col_map if "description" in k or "particulars" in k or "narration" in k), None)
    debit_col = next((col_map[k] for k in col_map if "debit" in k), None)
    credit_col = next((col_map[k] for k in col_map if "credit" in k), None)

    if not date_col or not desc_col:
        return parse_generic_csv(df)

    for _, row in df.iterrows():
        date = parse_date(row[date_col])
        if not date:
            continue
        description = str(row.get(desc_col, "")).strip() if desc_col else ""
        debit = clean_amount(row.get(debit_col)) if debit_col else None
        credit = clean_amount(row.get(credit_col)) if credit_col else None

        if debit:
            cat_name, cat_id = auto_categorize(description)
            transactions.append({"date": date, "description": description[:200], "amount": debit, "type": "expense", "category_name": cat_name, "category_id": cat_id})
        if credit:
            transactions.append({"date": date, "description": description[:200], "amount": credit, "type": "income", "category_name": "Income", "category_id": 10})

    return transactions


def parse_icici_csv(df: pd.DataFrame) -> list[dict]:
    return parse_hdfc_csv(df)  # Similar format


def parse_axis_csv(df: pd.DataFrame) -> list[dict]:
    transactions = []
    col_map = {c.lower(): c for c in df.columns}

    date_col = next((col_map[k] for k in col_map if "date" in k or "tran" in k), None)
    desc_col = next((col_map[k] for k in col_map if "particular" in k or "narration" in k or "description" in k), None)
    debit_col = next((col_map[k] for k in col_map if "debit" in k or "dr" == k.strip()), None)
    credit_col = next((col_map[k] for k in col_map if "credit" in k or "cr" == k.strip()), None)

    if not date_col or not desc_col:
        return parse_generic_csv(df)

    for _, row in df.iterrows():
        date = parse_date(row[date_col])
        if not date:
            continue
        description = str(row.get(desc_col, "")).strip() if desc_col else ""
        debit = clean_amount(row.get(debit_col)) if debit_col else None
        credit = clean_amount(row.get(credit_col)) if credit_col else None

        if debit:
            cat_name, cat_id = auto_categorize(description)
            transactions.append({"date": date, "description": description[:200], "amount": debit, "type": "expense", "category_name": cat_name, "category_id": cat_id})
        if credit:
            transactions.append({"date": date, "description": description[:200], "amount": credit, "type": "income", "category_name": "Income", "category_id": 10})

    return transactions


def parse_generic_csv(df: pd.DataFrame) -> list[dict]:
    """Smart fallback — find date, description and amount columns automatically."""
    transactions = []
    col_map = {c.lower(): c for c in df.columns}

    # Find date column
    date_col = None
    for col in df.columns:
        sample = df[col].dropna().head(5)
        for val in sample:
            if parse_date(val):
                date_col = col
                break
        if date_col:
            break

    if not date_col:
        return []

    # Find description column (longest string column)
    str_cols = df.select_dtypes(include="object").columns.tolist()
    desc_col = max(str_cols, key=lambda c: df[c].astype(str).str.len().mean(), default=None) if str_cols else None

    # Separate debit/credit columns take priority when present
    debit_col = next((col_map[k] for k in col_map if "debit" in k or "withdrawal" in k), None)
    credit_col = next((col_map[k] for k in col_map if "credit" in k or "deposit" in k), None)

    # Explicit type/direction column (e.g. "Type", "Cr/Dr")
    type_col = next(
        (col_map[k] for k in col_map if k.strip() in ("type", "transaction type", "cr/dr", "dr/cr", "direction")),
        None,
    )

    # Single amount column fallback
    amount_col = next((col_map[k] for k in col_map if "amount" in k), None)
    if not amount_col:
        num_cols = [c for c in df.select_dtypes(include="number").columns if c not in (debit_col, credit_col)]
        amount_col = num_cols[0] if num_cols else None

    for _, row in df.iterrows():
        date = parse_date(row[date_col])
        if not date:
            continue
        description = str(row.get(desc_col, "")).strip() if desc_col else "Transaction"

        if debit_col or credit_col:
            debit = clean_amount(row.get(debit_col)) if debit_col else None
            credit = clean_amount(row.get(credit_col)) if credit_col else None
            if debit:
                cat_name, cat_id = auto_categorize(description)
                transactions.append({"date": date, "description": description[:200], "amount": debit, "type": "expense", "category_name": cat_name, "category_id": cat_id})
            if credit:
                transactions.append({"date": date, "description": description[:200], "amount": credit, "type": "income", "category_name": "Income", "category_id": 10})
            continue

        if not amount_col:
            continue
        raw = row.get(amount_col)
        amount = clean_amount(raw)
        if not amount:
            continue

        tx_type = None
        if type_col:
            type_val = str(row.get(type_col, "")).strip().lower()
            if type_val in ("income", "credit", "cr", "deposit", "in"):
                tx_type = "income"
            elif type_val in ("expense", "debit", "dr", "withdrawal", "out"):
                tx_type = "expense"
        if tx_type is None:
            tx_type = infer_direction_from_raw(raw)
        if tx_type is None:
            tx_type = "income" if looks_like_income(description) else "expense"
        cat_name, cat_id = ("Income", 10) if tx_type == "income" else auto_categorize(description)

        transactions.append({
            "date": date, "description": description[:200],
            "amount": amount, "type": tx_type,
            "category_name": cat_name, "category_id": cat_id,
        })

    return transactions


# ── Main entry point ──────────────────────────────────────────────────────────

UPI_NOTE_SKIP = {"no remark", "no remarks", "upi", "upiqr", ""}


def clean_upi_description(raw: str) -> tuple[str, Optional[str]]:
    """UPI narrations pack a reference number, payee name, bank code, VPA, and
    remark into one slash-delimited string (e.g. "UPI/DR/1234567890/R K SEN/
    YESB/paytmqr/NO REMARK"). Extract just the payee name for display, keeping
    the full raw string as a note for anyone who wants the technical detail."""
    parts = raw.split("/")
    if len(parts) >= 4 and parts[0].strip().upper() == "UPI":
        name = parts[3].strip()
        remark = parts[-1].strip() if len(parts) >= 5 else ""
        note = remark if remark.lower() not in UPI_NOTE_SKIP else None
        if name:
            return name, note
    return raw, None


def parse_bank_statement(file_bytes: bytes, filename: str) -> list[dict]:
    """
    Main parser — routes to PDF or CSV/Excel based on filename.
    Returns list of transaction dicts ready to save to DB.
    """
    fname = filename.lower()
    if fname.endswith(".pdf"):
        transactions = parse_pdf(file_bytes)
    elif fname.endswith((".csv", ".xlsx", ".xls")):
        transactions = parse_csv_excel(file_bytes, fname)
    else:
        raise ValueError(f"Unsupported file format: {filename}")

    # Filter out invalid entries
    valid = [t for t in transactions if t.get("amount") and t.get("amount") > 0 and t.get("date")]

    for t in valid:
        clean_desc, note = clean_upi_description(t["description"])
        t["description"] = clean_desc
        if note:
            t["note"] = note

    return valid
