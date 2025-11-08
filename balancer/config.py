import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

DB_PATH = os.getenv("DB_PATH", str(BASE_DIR / "balancer.db"))
COINGECKO_API_KEY = os.getenv("COINGECKO", "")
FRED_API_KEY = os.getenv("FRED_API_KEY", "")
DEFAULT_BASE_CCY = os.getenv("BASE_CCY", "USD")
LOG_PATH = os.getenv("LOG_PATH", str(BASE_DIR / "alerts.jsonl"))
INITIAL_TOKENLIST = os.getenv("INITIAL_TOKENLIST", str(BASE_DIR / "docs/initial-data/tokenlist.txt"))
CG_MAPPING_FILE = os.getenv("CG_MAPPING_FILE", str(BASE_DIR / "docs/initial-data/cg-mapping.txt"))
COOLOFF_DAYS = float(os.getenv("COOLOFF_DAYS", "1"))

# HTTP and API configuration
HTTP_TIMEOUT = float(os.getenv("HTTP_TIMEOUT", "20"))
HTTP_RETRIES = int(os.getenv("HTTP_RETRIES", "2"))

COINGECKO_BASE_URL = os.getenv("COINGECKO_BASE_URL", "https://api.coingecko.com/api/v3")
FRED_BASE_URL = os.getenv("FRED_BASE_URL", "https://api.stlouisfed.org/fred")
FNG_BASE_URL = os.getenv("FNG_BASE_URL", "https://api.alternative.me")
