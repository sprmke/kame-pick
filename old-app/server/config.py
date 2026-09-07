from pathlib import Path

APP_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = APP_ROOT.parent
DATA_DIR = REPO_ROOT / "data"
CANDIDATES_DIR = DATA_DIR / "candidates"
REPORTS_DIR = DATA_DIR / "reports"
MANIFEST_PATH = CANDIDATES_DIR / "manifest.json"
JOB_CRITERIA_PATH = APP_ROOT / "config" / "job-criteria.yaml"
DB_PATH = DATA_DIR / "app.db"
SCRIPTS_DIR = APP_ROOT / "scripts"
