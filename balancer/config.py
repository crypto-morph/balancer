import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

DB_PATH = os.getenv("DB_PATH", str(BASE_DIR / "balancer.db"))
# Support both names for the Coingecko API key
COINGECKO_API_KEY = os.getenv("COINGECKO", "") or os.getenv("COINGECKO_API_KEY", "")
FRED_API_KEY = os.getenv("FRED_API_KEY", "")
DEFAULT_BASE_CCY = os.getenv("BASE_CCY", "USD")
LOG_PATH = os.getenv("LOG_PATH", str(BASE_DIR / "alerts.jsonl"))
INITIAL_TOKENLIST = os.getenv("INITIAL_TOKENLIST", str(BASE_DIR / "docs/initial-data/tokenlist.txt"))
CG_MAPPING_FILE = os.getenv("CG_MAPPING_FILE", str(BASE_DIR / "docs/initial-data/cg-mapping.json"))
COOLOFF_DAYS = float(os.getenv("COOLOFF_DAYS", "1"))

# HTTP and API configuration
HTTP_TIMEOUT = float(os.getenv("HTTP_TIMEOUT", "20"))
HTTP_RETRIES = int(os.getenv("HTTP_RETRIES", "2"))

COINGECKO_BASE_URL = os.getenv("COINGECKO_BASE_URL", "https://api.coingecko.com/api/v3")
FRED_BASE_URL = os.getenv("FRED_BASE_URL", "https://api.stlouisfed.org/fred")
FNG_BASE_URL = os.getenv("FNG_BASE_URL", "https://api.alternative.me")
COINGECKO_THROTTLE_MS = int(os.getenv("COINGECKO_THROTTLE_MS", "800"))
COINGECKO_USE_API_KEY = os.getenv("COINGECKO_USE_API_KEY", "false").strip().lower() == "true"

# Business rule defaults (env-overridable)
DEFAULT_PORTFOLIO_NAME = os.getenv("PORTFOLIO_NAME", "Default")
AVG_COST_DEFAULT_CCY = os.getenv("AVG_COST_CCY", "GBP").upper()

MIN_TRADE_USD_DEFAULT = float(os.getenv("MIN_TRADE_USD", "50"))
DRIFT_BAND_DEFAULT = float(os.getenv("DRIFT_BAND", "0.2"))

_ladder_env = os.getenv("LADDER_VALUE_MULTIPLES", "2,3,5")
try:
    LADDER_VALUE_MULTIPLES = [float(x.strip()) for x in _ladder_env.split(",") if x.strip()]
except Exception:
    LADDER_VALUE_MULTIPLES = [2.0, 3.0, 5.0]

COINGECKO_PER_PAGE = int(os.getenv("COINGECKO_PER_PAGE", "250"))
