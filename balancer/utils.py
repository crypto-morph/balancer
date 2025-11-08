import re

def parse_money_gbp(value: str) -> float:
    if value is None:
        return 0.0
    s = value.strip()
    if s in {"-", ""}:
        return 0.0
    s = s.replace("£", "").replace(",", "").strip()
    try:
        return float(s)
    except ValueError:
        # try to extract numeric via regex
        m = re.search(r"-?\d+(?:\.\d+)?", s)
        return float(m.group(0)) if m else 0.0

def parse_float(value: str) -> float:
    if value is None:
        return 0.0
    s = value.strip()
    if s in {"-", ""}:
        return 0.0
    s = s.replace(",", "").strip()
    try:
        return float(s)
    except ValueError:
        m = re.search(r"-?\d+(?:\.\d+)?", s)
        return float(m.group(0)) if m else 0.0

def clean_name(name: str) -> str:
    return (name or "").replace("*", "").strip()
