def classify_category(merchant: str) -> str:

    merchant = merchant.upper()

    if any(x in merchant for x in ["SWIGGY", "ZOMATO", "RESTAURANT", "CAFE"]):
        return "Food"

    if any(x in merchant for x in ["IRCTC", "UBER", "OLA", "METRO"]):
        return "Travel"

    if any(x in merchant for x in ["ANGEL", "ZERODHA", "MF", "STOCK"]):
        return "Investments"

    if any(x in merchant for x in ["NETFLIX", "SPOTIFY", "PRIME"]):
        return "Entertainment"

    if any(x in merchant for x in ["ELECTRIC", "WATER", "GAS"]):
        return "Utilities"

    if any(x in merchant for x in ["MR", "TRANSFER", "UPI"]):
        return "Transfers"

    return "Others"