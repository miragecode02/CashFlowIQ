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
        "subway", "barbeque", "dining", "eat", "meal", "canteen"
    ],
    "Shopping": [
        "amazon", "flipkart", "myntra", "ajio", "nykaa", "meesho", "snapdeal",
        "shoppers", "mall", "store", "mart", "retail", "fashion", "clothes",
        "decathlon", "ikea", "reliance digital", "croma", "vijay sales"
    ],
    "Transport": [
        "uber", "ola", "rapido", "auto", "taxi", "metro", "irctc", "railway",
        "bus", "petrol", "fuel", "diesel", "fastag", "toll", "indigo", "spicejet",
        "air india", "go air", "vistara", "flight", "train", "redbus"
    ],
    "Entertainment": [
        "netflix", "amazon prime", "hotstar", "disney", "spotify", "youtube",
        "bookmyshow", "pvr", "inox", "cinepolis", "gaming", "steam", "xbox",
        "playstation", "zee5", "sonyliv", "jiocinema"
    ],
    "Health": [
        "pharmacy", "hospital", "clinic", "doctor", "medical", "apollo",
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
    "Income": [
        "salary", "credit", "neft", "imps", "rtgs", "refund", "cashback",
        "interest", "dividend", "bonus", "incentive", "reimbursement"
    ],
}

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


def parse_date(date_str: str) -> Optional[datetime]:
    """Try multiple date formats used by Indian banks."""
    formats = [
        "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y",
        "%Y-%m-%d", "%d %b %Y", "%d-%b-%Y", "%d/%b/%Y",
        "%d %B %Y", "%d-%b-%y", "%-d %b %Y",
    ]
    date_str = str(date_str).strip()
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
    cleaned = re.sub(r"[₹,\s]", "", str(amount_str))
    try:
        return abs(float(cleaned))
    except ValueError:
        return None


# ── PDF Parsers ───────────────────────────────────────────────────────────────

def detect_bank_from_pdf(text: str) -> str:
    text_lower = text.lower()
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
            amounts = [clean_amount(c) for c in row_str if clean_amount(c)]
            if not amounts:
                continue
            amount = amounts[0]
            cat_name, cat_id = auto_categorize(description)
            transactions.append({
                "date": date, "description": description[:200],
                "amount": amount, "type": "expense",
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
    cols = " ".join(df.columns.astype(str)).lower()
    first_rows = df.head(5).to_string().lower()
    combined = cols + " " + first_rows

    if "hdfc" in combined or "narration" in cols:
        return "hdfc"
    elif "state bank" in combined or "sbi" in combined:
        return "sbi"
    elif "icici" in combined:
        return "icici"
    elif "axis" in combined:
        return "axis"
    return "generic"


def parse_csv_excel(file_bytes: bytes, filename: str) -> list[dict]:
    try:
        if filename.endswith(".csv"):
            # Try multiple encodings
            for enc in ["utf-8", "latin-1", "cp1252"]:
                try:
                    df = pd.read_csv(io.BytesIO(file_bytes), encoding=enc, skiprows=0)
                    break
                except Exception:
                    continue
        else:
            df = pd.read_excel(io.BytesIO(file_bytes))
    except Exception as e:
        raise ValueError(f"Could not read file: {e}")

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
    desc_col = next((col_map[k] for k in col_map if "narration" in k or "description" in k), None)
    debit_col = next((col_map[k] for k in col_map if "debit" in k or "withdrawal" in k), None)
    credit_col = next((col_map[k] for k in col_map if "credit" in k or "deposit" in k), None)

    if not date_col:
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

    if not date_col:
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

    if not date_col:
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

    # Find date column
    date_col = None
    for col in df.columns:
        sample = df[col].dropna().head(5)
        for val in sample:
            if parse_date(str(val)):
                date_col = col
                break
        if date_col:
            break

    if not date_col:
        return []

    # Find description column (longest string column)
    str_cols = df.select_dtypes(include="object").columns.tolist()
    desc_col = max(str_cols, key=lambda c: df[c].astype(str).str.len().mean(), default=None) if str_cols else None

    # Find amount columns
    num_cols = df.select_dtypes(include="number").columns.tolist()

    for _, row in df.iterrows():
        date = parse_date(row[date_col])
        if not date:
            continue
        description = str(row.get(desc_col, "")).strip() if desc_col else "Transaction"
        amounts = [clean_amount(row[c]) for c in num_cols if clean_amount(row[c])]
        if not amounts:
            continue

        amount = amounts[0]
        cat_name, cat_id = auto_categorize(description)
        transactions.append({
            "date": date, "description": description[:200],
            "amount": amount, "type": "expense",
            "category_name": cat_name, "category_id": cat_id,
        })

    return transactions


# ── Main entry point ──────────────────────────────────────────────────────────

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
    return valid
