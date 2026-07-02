import re


def extract_merchant(narration: str) -> str:

    if not narration:
        return "Unknown"

    narration = narration.upper()

    # Remove UPI/NEFT/IMPS prefixes
    narration = re.sub(r"(UPI|NEFT|IMPS|POS|ATM|CARD)-?", "", narration)

    # Remove reference numbers
    narration = re.sub(r"\d{6,}", "", narration)

    # Remove bank codes
    narration = re.sub(r"@[A-Z0-9]+", "", narration)

    # Keep only alphabets and spaces
    narration = re.sub(r"[^A-Z ]", " ", narration)

    # Remove extra spaces
    narration = " ".join(narration.split())

    # Return first 2 words as merchant
    words = narration.split()

    if len(words) >= 2:
        return " ".join(words[:2])

    return narration