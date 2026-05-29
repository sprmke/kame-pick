from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
CANDIDATES_DIR = DATA_DIR / "candidates"
REPORTS_DIR = DATA_DIR / "reports"
MANIFEST_PATH = CANDIDATES_DIR / "manifest.json"
JOB_CRITERIA_PATH = ROOT / "config" / "job-criteria.yaml"
DB_PATH = DATA_DIR / "app.db"
SCRIPTS_DIR = ROOT / "scripts"
