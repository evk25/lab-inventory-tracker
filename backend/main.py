import base64
import uuid
from datetime import date
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from db import UPLOADS_DIR, get_conn, init_db
from seed import seed_database

ROOT_DIR = Path(__file__).resolve().parent.parent
ATTACHMENTS_DIR = ROOT_DIR / "confidential" / "attachments"
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"

app = FastAPI(title="Lab Inventory Tracker API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    seed_database(force=False)


class AllocatePayload(BaseModel):
    project_id: str
    delta: int = 1
    source: str = "Kiosk"


class CreateItemPayload(BaseModel):
    name: str
    category: str
    description: str = ""
    specs: str = ""
    material: str = ""
    quantity: int = 1
    min_quantity: int = 1
    home_bin_tag_id: Optional[str] = None
    home_location_label: str = ""
    purchased_at: str = ""
    added_by: str = ""
    purchase_url: str = ""
    cad_url: str = ""
    slicer_url: str = ""
    source: str = "Wiki (not connected)"


class UpdateItemPayload(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    specs: Optional[str] = None
    material: Optional[str] = None
    quantity: Optional[int] = None
    min_quantity: Optional[int] = None
    home_bin_tag_id: Optional[str] = None
    home_location_label: Optional[str] = None
    purchased_at: Optional[str] = None
    added_by: Optional[str] = None
    purchase_url: Optional[str] = None
    cad_url: Optional[str] = None
    slicer_url: Optional[str] = None
    is_restock: bool = False
    source: str = "Wiki (not connected)"


class CreateProjectPayload(BaseModel):
    name: str
    description: str = ""
    owner: str = ""
    members: str = ""
    color: str = "#2563eb"


class UpdateProjectPayload(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    owner: Optional[str] = None
    members: Optional[str] = None


class ConsumePayload(BaseModel):
    project_id: str
    quantity: int = 1
    source: str = "Kiosk"


class CreateBinTagPayload(BaseModel):
    label: str
    x_pct: float
    y_pct: float
    w_pct: float = 16
    h_pct: float = 14


class CreateStorageUnitPayload(BaseModel):
    name: str
    unit_type: str = "Shelf"
    map_x: float = 38
    map_y: float = 20
    width: float = 22
    height: float = 16
    image_data_url: Optional[str] = None


class UpdateStorageUnitPayload(BaseModel):
    map_x: float
    map_y: float


@app.get("/api/bootstrap")
def bootstrap():
    conn = get_conn()
    items = [dict(r) for r in conn.execute("SELECT * FROM items ORDER BY category, name").fetchall()]
    allocations = [
        dict(r)
        for r in conn.execute(
            "SELECT * FROM project_allocations WHERE quantity > 0"
        ).fetchall()
    ]
    projects = [dict(r) for r in conn.execute("SELECT * FROM project_buckets ORDER BY name").fetchall()]
    storage_units = [dict(r) for r in conn.execute("SELECT * FROM storage_units ORDER BY name").fetchall()]
    shelves = [dict(r) for r in conn.execute("SELECT * FROM shelves ORDER BY label").fetchall()]
    bin_tags = [dict(r) for r in conn.execute("SELECT * FROM bin_tags ORDER BY label").fetchall()]
    journal = [dict(r) for r in conn.execute("SELECT * FROM journal ORDER BY id DESC LIMIT 300").fetchall()]
    conn.close()
    return {
        "items": items,
        "allocations": allocations,
        "projects": projects,
        "storage_units": storage_units,
        "shelves": shelves,
        "bin_tags": bin_tags,
        "journal": journal,
    }


@app.post("/api/items/{item_id}/allocate")
def allocate_item(item_id: str, payload: AllocatePayload):
    if payload.delta == 0:
        raise HTTPException(status_code=400, detail="delta cannot be 0")

    conn = get_conn()
    item = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    if not item:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")

    proj = conn.execute("SELECT * FROM project_buckets WHERE id = ?", (payload.project_id,)).fetchone()
    if not proj:
        conn.close()
        raise HTTPException(status_code=404, detail="Project bucket not found")

    alloc = conn.execute(
        "SELECT quantity FROM project_allocations WHERE item_id = ? AND project_id = ?",
        (item_id, payload.project_id),
    ).fetchone()
    current_alloc = alloc["quantity"] if alloc else 0
    current_stock = item["quantity"]

    if payload.delta > 0:
        move_qty = min(payload.delta, current_stock)
        if move_qty <= 0:
            conn.close()
            raise HTTPException(status_code=400, detail="No spare inventory left in Home Bin")
        new_stock = current_stock - move_qty
        new_alloc = current_alloc + move_qty
        action = "CHECK_OUT"
        from_loc = f"Home Bin ({item['home_location_label'] or 'Unassigned'})"
        to_loc = f"Project: {proj['name']}"
    else:
        return_qty = min(abs(payload.delta), current_alloc)
        if return_qty <= 0:
            conn.close()
            raise HTTPException(status_code=400, detail="No checked-out quantity to return")
        move_qty = return_qty
        new_stock = current_stock + return_qty
        new_alloc = current_alloc - return_qty
        action = "CHECK_IN"
        from_loc = f"Project: {proj['name']}"
        to_loc = f"Home Bin ({item['home_location_label'] or 'Unassigned'})"

    with conn:
        conn.execute("UPDATE items SET quantity = ? WHERE id = ?", (new_stock, item_id))
        if new_alloc > 0:
            conn.execute(
                """INSERT INTO project_allocations (item_id, project_id, quantity)
                   VALUES (?, ?, ?)
                   ON CONFLICT(item_id, project_id) DO UPDATE SET quantity = excluded.quantity""",
                (item_id, payload.project_id, new_alloc),
            )
        else:
            conn.execute(
                "DELETE FROM project_allocations WHERE item_id = ? AND project_id = ?",
                (item_id, payload.project_id),
            )
        conn.execute(
            """INSERT INTO journal (item_id, item_name, action, source, from_location, to_location, quantity)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (item_id, item["name"], action, payload.source, from_loc, to_loc, move_qty),
        )

    updated_item = dict(conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone())
    latest_journal = dict(conn.execute("SELECT * FROM journal ORDER BY id DESC LIMIT 1").fetchone())
    conn.close()
    return {
        "item": updated_item,
        "allocation": {"item_id": item_id, "project_id": payload.project_id, "quantity": new_alloc},
        "journal_entry": latest_journal,
    }


@app.post("/api/items")
def create_item(payload: CreateItemPayload):
    conn = get_conn()
    item_id = f"item-{uuid.uuid4().hex[:10]}"
    restock_total = max(payload.quantity, 1)
    with conn:
        conn.execute(
            """INSERT INTO items (
                id, name, category, description, specs, material, quantity, min_quantity,
                last_restock_total, last_restock_amount,
                home_bin_tag_id, home_location_label,
                purchased_at, last_stocked_at, added_by, purchase_url, cad_url, slicer_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                item_id,
                payload.name,
                payload.category,
                payload.description,
                payload.specs,
                payload.material,
                payload.quantity,
                payload.min_quantity,
                restock_total,
                payload.quantity,
                payload.home_bin_tag_id,
                payload.home_location_label,
                payload.purchased_at,
                payload.purchased_at,
                payload.added_by,
                payload.purchase_url,
                payload.cad_url,
                payload.slicer_url,
            ),
        )
        conn.execute(
            """INSERT INTO journal (item_id, item_name, action, source, from_location, to_location, quantity)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                item_id,
                payload.name,
                "ADDED",
                payload.source,
                payload.added_by or "Catalog",
                f"Home Bin ({payload.home_location_label or 'Unassigned'})",
                payload.quantity,
            ),
        )
    created = dict(conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone())
    latest_journal = dict(conn.execute("SELECT * FROM journal ORDER BY id DESC LIMIT 1").fetchone())
    conn.close()
    return {"item": created, "journal_entry": latest_journal}


@app.patch("/api/items/{item_id}")
def update_item(item_id: str, payload: UpdateItemPayload):
    conn = get_conn()
    item = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    if not item:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")

    updates: dict = {}
    editable_fields = (
        "name",
        "category",
        "description",
        "specs",
        "material",
        "quantity",
        "min_quantity",
        "home_bin_tag_id",
        "home_location_label",
        "purchased_at",
        "added_by",
        "purchase_url",
        "cad_url",
        "slicer_url",
    )
    for field in editable_fields:
        val = getattr(payload, field)
        if val is not None:
            updates[field] = val

    journal_entry = None
    if payload.quantity is not None and payload.quantity != item["quantity"]:
        old_qty = item["quantity"]
        new_qty = payload.quantity
        diff = new_qty - old_qty
        if payload.is_restock and diff > 0:
            updates["last_restock_amount"] = diff
            updates["last_restock_total"] = new_qty
            updates["last_stocked_at"] = date.today().isoformat()
            action = "RESTOCK"
        else:
            action = "MODIFY_QTY"

        with conn:
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            conn.execute(f"UPDATE items SET {set_clause} WHERE id = ?", (*updates.values(), item_id))
            conn.execute(
                """INSERT INTO journal (item_id, item_name, action, source, from_location, to_location, quantity)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    item_id,
                    updates.get("name", item["name"]),
                    action,
                    payload.source,
                    f"Qty: {old_qty}",
                    f"Qty: {new_qty}",
                    abs(diff),
                ),
            )
        journal_entry = dict(conn.execute("SELECT * FROM journal ORDER BY id DESC LIMIT 1").fetchone())
    elif updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        with conn:
            conn.execute(f"UPDATE items SET {set_clause} WHERE id = ?", (*updates.values(), item_id))
            conn.execute(
                """INSERT INTO journal (item_id, item_name, action, source, from_location, to_location, quantity)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    item_id,
                    updates.get("name", item["name"]),
                    "MODIFY",
                    payload.source,
                    "Metadata",
                    ", ".join(updates.keys()),
                    updates.get("quantity", item["quantity"]),
                ),
            )
        journal_entry = dict(conn.execute("SELECT * FROM journal ORDER BY id DESC LIMIT 1").fetchone())

    updated = dict(conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone())
    conn.close()
    return {"item": updated, "journal_entry": journal_entry}


@app.post("/api/projects")
def create_project(payload: CreateProjectPayload):
    conn = get_conn()
    proj_id = f"proj-{uuid.uuid4().hex[:8]}"
    with conn:
        conn.execute(
            "INSERT INTO project_buckets (id, name, description, owner, members, color) VALUES (?, ?, ?, ?, ?, ?)",
            (proj_id, payload.name, payload.description, payload.owner, payload.members, payload.color),
        )
    proj = dict(conn.execute("SELECT * FROM project_buckets WHERE id = ?", (proj_id,)).fetchone())
    conn.close()
    return {"project": proj}


@app.patch("/api/projects/{project_id}")
def update_project(project_id: str, payload: UpdateProjectPayload):
    conn = get_conn()
    proj = conn.execute("SELECT * FROM project_buckets WHERE id = ?", (project_id,)).fetchone()
    if not proj:
        conn.close()
        raise HTTPException(status_code=404, detail="Project bucket not found")
    updates = {}
    for field in ("name", "description", "owner", "members"):
        val = getattr(payload, field)
        if val is not None:
            updates[field] = val
    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        with conn:
            conn.execute(f"UPDATE project_buckets SET {set_clause} WHERE id = ?", (*updates.values(), project_id))
    updated = dict(conn.execute("SELECT * FROM project_buckets WHERE id = ?", (project_id,)).fetchone())
    conn.close()
    return {"project": updated}


@app.post("/api/items/{item_id}/consume")
def consume_item(item_id: str, payload: ConsumePayload):
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be > 0")
    conn = get_conn()
    item = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    proj = conn.execute("SELECT * FROM project_buckets WHERE id = ?", (payload.project_id,)).fetchone()
    alloc = conn.execute(
        "SELECT quantity FROM project_allocations WHERE item_id = ? AND project_id = ?",
        (item_id, payload.project_id),
    ).fetchone()
    if not item or not proj or not alloc or alloc["quantity"] <= 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Allocation not found")

    consume_qty = min(payload.quantity, alloc["quantity"])
    new_alloc = alloc["quantity"] - consume_qty
    with conn:
        if new_alloc > 0:
            conn.execute(
                "UPDATE project_allocations SET quantity = ? WHERE item_id = ? AND project_id = ?",
                (new_alloc, item_id, payload.project_id),
            )
        else:
            conn.execute(
                "DELETE FROM project_allocations WHERE item_id = ? AND project_id = ?",
                (item_id, payload.project_id),
            )
        conn.execute(
            """INSERT INTO journal (item_id, item_name, action, source, from_location, to_location, quantity)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (item_id, item["name"], "CONSUMED", payload.source, f"Project: {proj['name']}", "Consumed / Destroyed", consume_qty),
        )
    latest_journal = dict(conn.execute("SELECT * FROM journal ORDER BY id DESC LIMIT 1").fetchone())
    conn.close()
    return {"item_id": item_id, "project_id": payload.project_id, "remaining_alloc": new_alloc, "journal_entry": latest_journal}


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str, mode: str = "return", source: str = "Wiki (not connected)"):
    if mode not in ("return", "consume"):
        raise HTTPException(status_code=400, detail="mode must be 'return' or 'consume'")

    conn = get_conn()
    proj = conn.execute("SELECT * FROM project_buckets WHERE id = ?", (project_id,)).fetchone()
    if not proj:
        conn.close()
        raise HTTPException(status_code=404, detail="Project bucket not found")

    allocs = conn.execute(
        """SELECT pa.item_id, pa.quantity, i.name AS item_name, i.home_location_label
           FROM project_allocations pa
           JOIN items i ON i.id = pa.item_id
           WHERE pa.project_id = ? AND pa.quantity > 0""",
        (project_id,),
    ).fetchall()

    new_journal_entries = []
    updated_items = []
    with conn:
        for a in allocs:
            if mode == "return":
                conn.execute(
                    "UPDATE items SET quantity = quantity + ? WHERE id = ?",
                    (a["quantity"], a["item_id"]),
                )
                action = "CHECK_IN"
                to_loc = f"Home Bin ({a['home_location_label'] or 'Unassigned'})"
            else:
                action = "CONSUMED"
                to_loc = "Consumed / Integrated"

            conn.execute(
                """INSERT INTO journal (item_id, item_name, action, source, from_location, to_location, quantity)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    a["item_id"],
                    a["item_name"],
                    action,
                    source,
                    f"Project: {proj['name']}",
                    to_loc,
                    a["quantity"],
                ),
            )
            new_journal_entries.append(
                dict(conn.execute("SELECT * FROM journal ORDER BY id DESC LIMIT 1").fetchone())
            )
            updated_items.append(
                dict(conn.execute("SELECT * FROM items WHERE id = ?", (a["item_id"],)).fetchone())
            )

        conn.execute("DELETE FROM project_allocations WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM project_buckets WHERE id = ?", (project_id,))

    conn.close()
    return {
        "deleted_project_id": project_id,
        "updated_items": updated_items,
        "journal_entries": list(reversed(new_journal_entries)),
    }


@app.post("/api/storage-units")
def create_storage_unit(payload: CreateStorageUnitPayload):
    conn = get_conn()
    unit_id = f"unit-{uuid.uuid4().hex[:8]}"
    shelf_id = f"shelf-{unit_id}"
    photo_url: Optional[str] = None

    if payload.image_data_url and "," in payload.image_data_url:
        header, b64 = payload.image_data_url.split(",", 1)
        ext = "png" if "png" in header.lower() else "jpg"
        filename = f"{unit_id}.{ext}"
        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        (UPLOADS_DIR / filename).write_bytes(base64.b64decode(b64))
        photo_url = f"/media/uploads/{filename}"

    with conn:
        conn.execute(
            """INSERT INTO storage_units (id, name, unit_type, map_x, map_y, width, height, photo_url)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (unit_id, payload.name, payload.unit_type, payload.map_x, payload.map_y, payload.width, payload.height, photo_url),
        )
        conn.execute(
            "INSERT INTO shelves (id, storage_unit_id, label, photo_url) VALUES (?, ?, ?, ?)",
            (shelf_id, unit_id, "Overview", photo_url),
        )

    unit = dict(conn.execute("SELECT * FROM storage_units WHERE id = ?", (unit_id,)).fetchone())
    shelf = dict(conn.execute("SELECT * FROM shelves WHERE id = ?", (shelf_id,)).fetchone())
    conn.close()
    return {"storage_unit": unit, "shelf": shelf}


@app.post("/api/shelves/{shelf_id}/bins")
def create_bin_tag(shelf_id: str, payload: CreateBinTagPayload):
    conn = get_conn()
    shelf = conn.execute("SELECT id FROM shelves WHERE id = ?", (shelf_id,)).fetchone()
    if not shelf:
        conn.close()
        raise HTTPException(status_code=404, detail="Shelf not found")
    bin_id = f"bin-{uuid.uuid4().hex[:8]}"
    with conn:
        conn.execute(
            "INSERT INTO bin_tags (id, shelf_id, label, x_pct, y_pct, w_pct, h_pct) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (bin_id, shelf_id, payload.label, payload.x_pct, payload.y_pct, payload.w_pct, payload.h_pct),
        )
    created = dict(conn.execute("SELECT * FROM bin_tags WHERE id = ?", (bin_id,)).fetchone())
    conn.close()
    return {"bin_tag": created}


@app.patch("/api/storage-units/{unit_id}")
def update_storage_unit(unit_id: str, payload: UpdateStorageUnitPayload):
    conn = get_conn()
    with conn:
        conn.execute(
            "UPDATE storage_units SET map_x = ?, map_y = ? WHERE id = ?",
            (payload.map_x, payload.map_y, unit_id),
        )
    updated = dict(conn.execute("SELECT * FROM storage_units WHERE id = ?", (unit_id,)).fetchone())
    conn.close()
    return {"storage_unit": updated}


UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

if ATTACHMENTS_DIR.exists():
    app.mount("/media/attachments", StaticFiles(directory=str(ATTACHMENTS_DIR)), name="attachments")


@app.get("/")
def root_redirect():
    return RedirectResponse(url="/portal/")


if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/kiosk")
    @app.get("/kiosk/")
    @app.get("/portal")
    @app.get("/portal/")
    def serve_spa():
        return FileResponse(str(FRONTEND_DIST / "index.html"))
