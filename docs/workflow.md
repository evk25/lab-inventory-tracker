# System Workflows

This document outlines how lab members interact with **Lab Inventory Tracker** across its two interfaces: the **Shelf Kiosk (`/kiosk/`)** and the **Lab Wiki Control Panel (`/portal/`)**.

All interactive actions (search, category filtering, drag-and-drop, and quantity adjustments) use an in-memory index and optimistic UI updates to stay under the **400ms Doherty Threshold**.

---

## 1. Shelf Kiosk Workflow (`/kiosk/`)

Designed for an always-on Galaxy Tab or Raspberry Pi touchscreen mounted next to the storage shelves, split into **two tabs** to maximize usable screen space:

1. **Check Out Tab (Spare Inventory → Project Bucket)**:
   - Search by part name, spec, material, or home bin, or filter by category pill and stock status (`All`, `In Stock (>0)`, `Out of Stock (0)`).
   - Every card in **Spare Inventory** always displays its default **Home Bin** location and remaining spare quantity, plus a **Photo** button and (when applicable) a **Checked Out (N)** breakdown button.
   - Drag an item card onto a compact **Project Bucket** tile on the right (or tap an item, then tap a bucket) to transfer **1 unit** from Spare Inventory into that Project Bucket.
2. **Check In / Manage Bucket Tab**:
   - Select a **Project Bucket** to view its full list of checked-out items.
   - Use **`-`** / **`+`** to return 1 unit to Spare Inventory or take 1 more, or click **Consume 1** to permanently remove a broken/integrated unit from part tracking.

---

## 2. Lab Wiki Control Panel Workflow (`/portal/`)

Designed for desktop/workstation use and future embedding inside the **Outline** lab wiki:

1. **Spare Inventory & Modify**:
   - Search and filter the full catalog, inspect provenance (`purchased_at`, `added_by`, `purchase_url`, `cad_url`, `slicer_url`), and see which Project Buckets currently hold checked-out units.
   - Click **Modify** on any row to update its quantity. Increasing stock can be marked as a **Restock**, which updates the item's `last_restock_total` and `last_restock_amount` baseline.
2. **Running Low Prioritization**:
   - The **Running Low** tab ranks items by **depletion relative to their last restock baseline** (`Current Qty / Last Restock Total` ascending).
   - *Example*: An item restocked from `5` to `10` that is now at `4` (`40%` remaining) ranks higher than an item restocked from `2` to `3` that is now at `2` (`67%` remaining).
3. **Lab Floorplan & Shelf Photos**:
   - Click any storage unit on the 2D **Lab Floorplan** to view its shelf photo and bin tags.
   - Click **+ Add Storage Location** to place a new unit on the floorplan and attach an uploaded photo.
   - Click **+ Tag Bin on Photo** to pin a new Bin Tag directly onto a shelf photo.
4. **Project Buckets**:
   - Create new Project Buckets and manage `-` / `+` unit allocations across projects.
   - **Delete Project Bucket**: Deleting a bucket prompts whether checked-out items should be **Removed from Inventory Tracking (Consumed / Integrated)**—e.g., when a part is permanently mounted onto a drone—or **Returned to Home Bins** (restoring spare inventory quantities).
5. **Movement Journal & Source Attribution**:
   - Every `CHECK_OUT`, `CHECK_IN`, `MODIFY_QTY`, `RESTOCK`, `ADDED`, and `IMPORT` event is recorded in the searchable **Movement Journal** with its **Source**:
     - `Kiosk` — action performed on the shelf kiosk.
     - `Wiki (<discord_name>)` — action performed via the Lab Wiki Control Panel (shows `Wiki (not connected)` until Outline Discord SSO is wired).
