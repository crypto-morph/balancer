import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

DB_PATH = os.getenv("DB_PATH", str(BASE_DIR / "balancer.db"))
COINGECKO_API_KEY = os.getenv("COINGECKO", "")
DEFAULT_BASE_CCY = os.getenv("BASE_CCY", "USD")
LOG_PATH = os.getenv("LOG_PATH", str(BASE_DIR / "alerts.jsonl"))
INITIAL_TOKENLIST = os.getenv("INITIAL_TOKENLIST", str(BASE_DIR / "docs/initial-data/tokenlist.txt"))
CG_MAPPING_FILE = os.getenv("CG_MAPPING_FILE", str(BASE_DIR / "docs/initial-data/cg-mapping.txt"))
