import re
import uuid
from pathlib import Path
from db import get_conn, init_db

ROOT_DIR = Path(__file__).resolve().parent.parent
CONFIDENTIAL_MD = ROOT_DIR / "confidential" / "spare-parts-inventory.md"

LINK_RE = re.compile(r"<(https?://[^>]+)>")
IMG_RE = re.compile(r"!\[\]\((attachments/[^)\s]+)")


def slug_id(prefix: str, text: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return f"{prefix}-{cleaned[:40]}" if cleaned else f"{prefix}-{uuid.uuid4().hex[:8]}"


def parse_quantity(raw: str) -> tuple[int, str]:
    raw = raw.strip()
    m = re.match(r"^\s*~?\s*(\d+)", raw)
    qty = int(m.group(1)) if m else 0
    note = raw if raw and not raw.isdigit() else ""
    return qty, note


def classify_link(url: str, header: str = "") -> str:
    lower = url.lower()
    h = header.lower()
    if "slicer" in h or ".gcode" in lower or ".3mf" in lower:
        return "slicer_url"
    if "cad" in h or ".sldprt" in lower or ".step" in lower or "sharepoint" in lower:
        return "cad_url"
    return "purchase_url"


def seed_database(force: bool = False) -> dict:
    init_db()
    conn = get_conn()
    existing = conn.execute("SELECT COUNT(*) AS c FROM items").fetchone()["c"]
    if existing > 0 and not force:
        conn.close()
        return {"status": "already_seeded", "items": existing}

    with conn:
        conn.execute("DELETE FROM journal")
        conn.execute("DELETE FROM project_allocations")
        conn.execute("DELETE FROM items")
        conn.execute("DELETE FROM bin_tags")
        conn.execute("DELETE FROM shelves")
        conn.execute("DELETE FROM storage_units")
        conn.execute("DELETE FROM project_buckets")

        # Starter Project Buckets
        projects = [
            ("proj-eagle-rev-a", "Eagle Rev A Build", "Primary quadrotor airframe & avionics integration", "@evan (not connected)", "@evan, @gli7", "#2563eb"),
            ("proj-perception", "Perception Bench", "Stereo/depth camera & LiDAR calibration rig", "@evan (not connected)", "@evan", "#7c3aed"),
            ("proj-flight-kit", "Flight Test Kit", "Field spares, props, and LiPo packs for flight days", "@evan (not connected)", "@evan", "#059669"),
            ("proj-maintenance", "Bench & Repairs", "Soldering, fasteners, and bench maintenance", "@evan (not connected)", "", "#d97706"),
        ]
        conn.executemany(
            "INSERT INTO project_buckets (id, name, description, owner, members, color) VALUES (?, ?, ?, ?, ?, ?)",
            projects,
        )

        # Default Storage Units (matching lab layout)
        units = [
            ("unit-middle-shelf", "Middle Shelf: Filament & Frames", "Shelf", 10, 14, 24, 18, None),
            ("unit-right-shelf", "Right Shelf: Jetson Parts & Project Boxes", "Shelf", 66, 14, 24, 22, None),
            ("unit-hardware-caddy", "Hardware Caddy", "Caddy", 40, 48, 20, 16, None),
            ("unit-upper-rack", "Upper Rack: Part Bins", "Rack", 10, 44, 24, 20, None),
            ("unit-lower-rack", "Lower Rack: 3D Prints & Tools", "Rack", 10, 68, 24, 20, None),
        ]
        conn.executemany(
            """INSERT INTO storage_units (id, name, unit_type, map_x, map_y, width, height, photo_url)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            units,
        )

        if not CONFIDENTIAL_MD.exists():
            conn.close()
            return {"status": "no_confidential_file", "items": 0}

        lines = CONFIDENTIAL_MD.read_text(encoding="utf-8").splitlines()

        # Pass 1: Extract Locations in Lab photos for storage units
        in_locations = False
        current_loc_unit = None
        for line in lines:
            stripped = line.strip()
            if stripped == "# Locations in Lab":
                in_locations = True
                continue
            if stripped == "---" and in_locations:
                break
            if in_locations:
                if stripped.startswith("## "):
                    heading = stripped[3:].strip().lower()
                    if "middle shelf" in heading:
                        current_loc_unit = "unit-middle-shelf"
                    elif "right shelf" in heading:
                        current_loc_unit = "unit-right-shelf"
                    elif "hardware caddy" in heading:
                        current_loc_unit = "unit-hardware-caddy"
                    elif "upper rack" in heading:
                        current_loc_unit = "unit-upper-rack"
                    elif "lower rack" in heading:
                        current_loc_unit = "unit-lower-rack"
                img_m = IMG_RE.search(stripped)
                if img_m and current_loc_unit:
                    photo_url = f"/media/{img_m.group(1)}"
                    conn.execute(
                        "UPDATE storage_units SET photo_url = ? WHERE id = ?",
                        (photo_url, current_loc_unit),
                    )
                    shelf_id = f"shelf-{current_loc_unit}"
                    conn.execute(
                        "INSERT OR IGNORE INTO shelves (id, storage_unit_id, label, photo_url) VALUES (?, ?, ?, ?)",
                        (shelf_id, current_loc_unit, "Overview", photo_url),
                    )

        # Pass 2: Parse Spare Parts Inventory before "# Locations in Lab"
        category = "Miscellaneous"
        subcategory = ""
        current_location_text = ""
        current_photo_url = None
        table_headers: list[str] = []
        in_table = False

        shelf_map: dict[str, str] = {}
        bin_map: dict[tuple[str, str], str] = {}
        item_count = 0

        def map_unit_id(loc_text: str, cat: str) -> str:
            t = f"{loc_text} {cat}".lower()
            if "caddy" in t or "hardware" in t or "fastener" in t:
                return "unit-hardware-caddy"
            if "middle shelf" in t or "frame" in t or "filament" in t:
                return "unit-middle-shelf"
            if "right shelf" in t or "jetson" in t:
                return "unit-right-shelf"
            if "lower rack" in t or "3d print" in t or "tool" in t:
                return "unit-lower-rack"
            return "unit-upper-rack"

        def ensure_shelf(unit_id: str, label: str, photo: str | None) -> str:
            key = f"{unit_id}:{label}"
            if key in shelf_map:
                return shelf_map[key]
            sid = slug_id("shelf", key)
            conn.execute(
                "INSERT OR IGNORE INTO shelves (id, storage_unit_id, label, photo_url) VALUES (?, ?, ?, ?)",
                (sid, unit_id, label, photo),
            )
            shelf_map[key] = sid
            return sid

        def ensure_bin(shelf_id: str, bin_label: str, idx: int) -> str:
            label = bin_label.strip() or "General Shelf"
            key = (shelf_id, label)
            if key in bin_map:
                return bin_map[key]
            bid = slug_id("bin", f"{shelf_id}-{label}")
            # Spread default bin tag coordinates cleanly across the photo
            x_pct = 20 + (idx * 22) % 65
            y_pct = 25 + ((idx * 17) % 55)
            conn.execute(
                "INSERT OR IGNORE INTO bin_tags (id, shelf_id, label, x_pct, y_pct, w_pct, h_pct) VALUES (?, ?, ?, ?, ?, 18, 16)",
                (bid, shelf_id, label, x_pct, y_pct),
            )
            bin_map[key] = bid
            return bid

        for line in lines:
            stripped = line.strip()
            if stripped == "# Locations in Lab" or stripped == "---":
                break

            if stripped.startswith("## "):
                category = stripped[3:].strip().rstrip("/")
                if category == "Cameras/Sensors":
                    category = "Cameras / Sensors"
                subcategory = ""
                current_location_text = ""
                current_photo_url = None
                in_table = False
                table_headers = []
                continue

            if stripped.startswith("### "):
                subcategory = stripped[4:].strip()
                current_location_text = ""
                current_photo_url = None
                in_table = False
                table_headers = []
                continue

            if stripped.lower().startswith("location"):
                current_location_text = re.sub(r"^locations?\s*[-:]\s*", "", stripped, flags=re.I)
                continue

            img_m = IMG_RE.search(stripped)
            if img_m:
                current_photo_url = f"/media/{img_m.group(1)}"
                continue

            if stripped.startswith("|") and stripped.endswith("|"):
                cells = [c.strip() for c in stripped.strip("|").split("|")]
                if all(re.match(r"^-+$", c.replace(" ", "")) or c == "" for c in cells):
                    in_table = True
                    continue
                if not in_table:
                    table_headers = cells
                    continue

                if not any(cells) or not cells[0]:
                    continue

                row = {
                    table_headers[i]: (cells[i] if i < len(cells) else "")
                    for i in range(len(table_headers))
                }
                name = row.get("Name", "").strip()
                if not name:
                    continue

                qty, qty_note = parse_quantity(row.get("Quantity", "0"))
                last_stocked = row.get("Last Date Stocked", "").strip()
                storage_loc = row.get("Storage Location", "").strip() or current_location_text or category
                material = row.get("Material", "").strip()
                specs = subcategory if subcategory else ""

                purchase_url = ""
                cad_url = ""
                slicer_url = ""
                for h_key, val in row.items():
                    if "link" in h_key.lower() and val:
                        for url in LINK_RE.findall(val):
                            field = classify_link(url, h_key)
                            if field == "slicer_url" and not slicer_url:
                                slicer_url = url
                            elif field == "cad_url" and not cad_url:
                                cad_url = url
                            elif not purchase_url:
                                purchase_url = url

                unit_id = map_unit_id(f"{current_location_text} {storage_loc}", category)
                shelf_label = subcategory or current_location_text or category
                shelf_id = ensure_shelf(unit_id, shelf_label, current_photo_url)
                bin_id = ensure_bin(shelf_id, storage_loc, len(bin_map))

                item_id = f"item-{uuid.uuid4().hex[:10]}"
                restock_total = max(qty, 1)
                conn.execute(
                    """INSERT INTO items (
                        id, name, category, specs, material, quantity, quantity_note,
                        min_quantity, last_restock_total, last_restock_amount,
                        home_bin_tag_id, home_location_label,
                        purchased_at, last_stocked_at, added_by, purchase_url, cad_url, slicer_url
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        item_id,
                        name,
                        category,
                        specs,
                        material,
                        qty,
                        qty_note,
                        1,
                        restock_total,
                        qty,
                        bin_id,
                        storage_loc,
                        last_stocked,
                        last_stocked,
                        "Lab Import",
                        purchase_url,
                        cad_url,
                        slicer_url,
                    ),
                )
                item_count += 1

        conn.execute(
            "INSERT INTO journal (item_id, item_name, action, source, from_location, to_location, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("system", f"{item_count} parts imported", "IMPORT", "Import", "spare-parts-inventory.md", "Home Bins", item_count),
        )

    conn.close()
    return {"status": "seeded", "items": item_count}


if __name__ == "__main__":
    result = seed_database(force=True)
    print(result)
