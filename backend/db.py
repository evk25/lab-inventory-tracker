import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "inventory.db"


def get_conn() -> sqlite3.Connection:
    """Return a SQLite connection with row_factory configured as dict-like rows."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    """Initialize all database tables if they do not exist."""
    conn = get_conn()
    with conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS storage_units (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                unit_type TEXT NOT NULL,
                map_x REAL NOT NULL DEFAULT 10,
                map_y REAL NOT NULL DEFAULT 10,
                width REAL NOT NULL DEFAULT 18,
                height REAL NOT NULL DEFAULT 14,
                photo_url TEXT
            );

            CREATE TABLE IF NOT EXISTS shelves (
                id TEXT PRIMARY KEY,
                storage_unit_id TEXT NOT NULL,
                label TEXT NOT NULL,
                photo_url TEXT,
                FOREIGN KEY (storage_unit_id) REFERENCES storage_units(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS bin_tags (
                id TEXT PRIMARY KEY,
                shelf_id TEXT NOT NULL,
                label TEXT NOT NULL,
                x_pct REAL NOT NULL DEFAULT 50,
                y_pct REAL NOT NULL DEFAULT 50,
                w_pct REAL NOT NULL DEFAULT 18,
                h_pct REAL NOT NULL DEFAULT 18,
                FOREIGN KEY (shelf_id) REFERENCES shelves(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS project_buckets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                owner TEXT DEFAULT '',
                members TEXT DEFAULT '',
                color TEXT NOT NULL DEFAULT '#2563eb'
            );

            CREATE TABLE IF NOT EXISTS items (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT DEFAULT '',
                specs TEXT DEFAULT '',
                material TEXT DEFAULT '',
                quantity INTEGER NOT NULL DEFAULT 0,
                quantity_note TEXT DEFAULT '',
                min_quantity INTEGER NOT NULL DEFAULT 1,
                last_restock_total INTEGER NOT NULL DEFAULT 1,
                last_restock_amount INTEGER NOT NULL DEFAULT 0,
                home_bin_tag_id TEXT,
                home_location_label TEXT DEFAULT '',
                purchased_at TEXT DEFAULT '',
                last_stocked_at TEXT DEFAULT '',
                added_by TEXT DEFAULT '',
                purchase_url TEXT DEFAULT '',
                cad_url TEXT DEFAULT '',
                slicer_url TEXT DEFAULT '',
                FOREIGN KEY (home_bin_tag_id) REFERENCES bin_tags(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS project_allocations (
                item_id TEXT NOT NULL,
                project_id TEXT NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (item_id, project_id),
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
                FOREIGN KEY (project_id) REFERENCES project_buckets(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS journal (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id TEXT NOT NULL,
                item_name TEXT NOT NULL,
                action TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'Kiosk',
                from_location TEXT NOT NULL,
                to_location TEXT NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            """
        )
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(items)").fetchall()}
        if "description" not in cols:
            conn.execute("ALTER TABLE items ADD COLUMN description TEXT DEFAULT ''")
    conn.close()
