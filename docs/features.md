# Features Management System

## Status Legend
- `Planned` — Scoped and prioritized, not yet started.
- `In Progress` — Currently being designed or implemented.
- `Implemented` — Completed and verified.
- `Deferred` — Backlogged for a future milestone.

---

## Feature Roadmap

### Phase 1 — MVP (Visual Locating & Core Catalog)
| ID | Feature | Description | Priority | Status |
| --- | --- | --- | --- | --- |
| **F-01** | Interactive Lab Floorplan | Render lab room/zones with clickable shelves, racks, and caddies, plus adding new storage locations with photos. | P0 | `Implemented` |
| **F-02** | Shelf Photo Viewer & Tagger | Upload shelf/drawer photos and pin/draw bounding boxes for bins. | P0 | `Implemented` |
| **F-03** | Search & Instant Locate | Search parts by name/spec/material/category and highlight floorplan + bin photo (`<400ms` Doherty Threshold). | P0 | `Implemented` |
| **F-04** | Core Item CRUD & Provenance | Add, edit all fields, and adjust quantities with `purchased_at`, `added_by`, `purchase_url`, `home_bin_tag_id`, and `cad_url`/`slicer_url`. | P0 | `Implemented` |
| **F-05** | Legacy Inventory Importer | Bulk-import existing Markdown tables and shelf photo attachments into SQLite. | P0 | `Implemented` |

### Phase 2 — v1.0 (Lab Operations & Dual Clients)
| ID | Feature | Description | Priority | Status |
| --- | --- | --- | --- | --- |
| **F-06** | Running Low Prioritization | Rank items by remaining % against their last restock baseline (`Current Qty / Last Restock Total`) with direct `Buy` links. | P1 | `Implemented` |
| **F-07** | Project Bucket Check-Out / Check-In | Move units between **Home Bins** and **Project Buckets** (`+/-`, Consume/Destroy, Delete Bucket) with full Movement Journal source tracking. | P1 | `Implemented` |
| **F-08** | Drone Platform BOM Linking | Tag parts by compatible quadrotor platform/build for quick kit assembly. | P1 | `Planned` |
| **F-09** | Lab Wiki Control Panel Integration | `/portal/` control panel built (including Quick Move tab, Project Sidebar, and Discord placeholder); pending Outline wiki iframe/SSO embed. | P1 | `In Progress` |
| **F-10** | Always-On Shelf Kiosk Thin Client | Lightweight two-tab `/kiosk/` UI (`Check Out` & `Check In`) for a Galaxy Tab or RPi touchscreen with drag-and-drop and touch support. | P1 | `Implemented` |

### Phase 3 — Future (Smart Lab Extensions)
| ID | Feature | Description | Priority | Status |
| --- | --- | --- | --- | --- |
| **F-11** | QR / Barcode Bin Labels | Printable labels that deep-link directly to a bin or shelf view. | P2 | `Deferred` |
| **F-12** | LiPo Battery Cycle & Health Log | Track cell count, storage voltage, cycle count, and retirement status. | P2 | `Deferred` |
| **F-13** | Datasheet & CAD Attachments | Attach pinouts, STEP/SLDPRT files, slicer profiles, and calibration notes directly to parts. | P2 | `Deferred` |
| **F-14** | Hardware Caddy Bin Matrix Labeling | Label individual cells in a row/column grid overlay for multi-drawer organizers (e.g., Hardware Caddy). | P2 | `Deferred` |
