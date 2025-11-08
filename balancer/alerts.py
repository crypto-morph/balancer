import json
from datetime import datetime
from pathlib import Path
from .config import LOG_PATH


def log_alert(kind: str, message: str, payload: dict | None = None, severity: str = "info") -> None:
    entry = {
        "at": datetime.utcnow().isoformat() + "Z",
        "type": kind,
        "severity": severity,
        "message": message,
        "payload": payload or {},
    }
    p = Path(LOG_PATH)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
