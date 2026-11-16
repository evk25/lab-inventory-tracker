# Project Requirements

## Functional Requirements (FR)

| ID | Category | Requirement |
| --- | --- | --- |
| **FR-1** | **Visual Floorplan Navigation** | Users can view an interactive 2D map of the lab showing zones, racks, shelves, and caddies, and click any storage unit to inspect its shelves/drawers. |
| **FR-2** | **Annotated Shelf & Bin Photos** | Each shelf, drawer, or rack supports uploaded photos with interactive tagged regions (pins or bounding boxes) linked to specific bins and parts. |
| **FR-3** | **Part Search & Filtering** | Users can search by part name, specification, material, category, or compatible drone platform, and jump directly to its floorplan + shelf photo location. |
| **FR-4** | **Item Provenance & Metadata** | Each item carries provenance and locating tags: **purchase date** (`purchased_at`), **added by** (`added_by` on arrival), **purchase link** (`purchase_url`), **CAD/slicer/datasheet links**, **home location** (`home_bin_tag_id`), **current project assignment** (`current_project_id`), quantity, and low-stock threshold. |
| **FR-5** | **Home Bin & Project Bucket Workflow** | Inventory is organized so every item is either in its **Home Bin** (available/unassigned) or assigned to a specific **Project Bucket** (active drone build or experiment). Check-out moves an item into a project bucket; check-in returns it to its home bin. |
| **FR-6** | **Map & Photo Authoring** | Authorized lab members can place/move storage units on the floorplan, upload new shelf photos, and draw or reposition bin tags when storage is reorganized. |
| **FR-7** | **Bulk Hardware Import** | The system supports importing an existing Markdown/CSV/JSON hardware inventory (including shelf photo attachments) to bootstrap the catalog. |
| **FR-8** | **Central Lab Wiki Control Panel** | A full-featured central control panel accessible through the lab wiki for catalog administration, floorplan/photo authoring, stock auditing, and reorder management. |
| **FR-9** | **Shelf Kiosk Thin Client** | A lightweight, always-on kiosk interface designed to run on a dedicated, plugged-in legacy Galaxy tablet mounted next to the storage shelf for rapid, low-friction item check-out and check-in. |

---

## Non-Functional Requirements (NFR)

- **NFR-1 — Speed to Locate**: A user should be able to go from typing a part query to seeing the exact highlighted bin photo in **≤ 3 interactions**.
- **NFR-2 — Low Maintenance Overhead**: Updating a moved bin, logging a new arrival, or restocking an item should take seconds so lab members actually keep the inventory accurate.
- **NFR-3 — Tech-Agnostic & Portable**: Data models, media assets (floorplan + shelf photos), and application logic are cleanly decoupled so the system can be implemented on any web or local-first stack.
- **NFR-4 — Mobile & Desktop Friendly**: Usable both at a lab workstation (via the lab wiki) and on a phone/tablet while standing in front of a storage rack.
- **NFR-5 — Legacy Tablet Kiosk Performance**: The shelf thin client must be lightweight enough to run reliably 24/7 in a browser or minimal app shell on older Android hardware (e.g., an older Samsung Galaxy tablet) with minimal memory/CPU overhead and touch-first controls.
