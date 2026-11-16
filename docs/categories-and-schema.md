# Inventory Categories & Import Schema

This document defines the public taxonomy and data schema used by the **Quadrotor Control and Perception Lab** inventory system. Actual lab inventory records and shelf photos live in `confidential/` (gitignored) and are never committed to the repository.

---

## Public Part Categories

| Category | Subcategories / Scope |
| --- | --- |
| **Drone Frames** | Carbon fiber main plates, battery plates, arms, structural plates |
| **3D Printing** | **Prints** (custom mounts, landing gear, cages, brackets) & **Filament** (ASA, TPU, PLA, PETG, PA6-CF spools) |
| **NVIDIA Jetson / Compute** | Companion computers, carrier boards, heatsinks, SSDs, Wi-Fi cards, antennas |
| **Avionics** | Flight controllers, ESCs, receivers, telemetry, power regulators |
| **Motors** | Brushless motors and mounting hardware |
| **Propellers** | CW/CCW propellers by size and pitch |
| **Batteries** | LiPo packs, cell configurations, power leads |
| **Cameras / Sensors** | Depth/RGB cameras, LiDAR, IMUs, optical flow sensors |
| **Hardware & Fasteners** | Metric screws, locknuts, standoffs, heatshrink, connectors, vibration dampers |
| **Miscellaneous** | General consumables, adhesives, cables, and shared bench accessories |

---

## Storage Hierarchy

The lab's physical storage maps cleanly to the `ZONE → STORAGE_UNIT → SHELF → BIN_TAG` model:

- **Storage Units**: Racks (e.g., *Upper Rack*, *Lower Rack*), Shelves (e.g., *Middle Shelf*, *Right Shelf*), and portable organizers (e.g., *Hardware Caddy*, *Project Boxes*).
- **Shelves & Photos**: Each storage unit has one or more shelf/drawer photos.
- **Home Bins**: Individual bins, drawers, or labeled containers tagged on a shelf photo serve as each item's `home_bin_tag_id`.

---

## Item Metadata & Legacy Import Mapping

When bootstrapping from the existing Markdown inventory (`confidential/spare-parts-inventory.md`), columns map to the core `ITEM` schema as follows:

| Legacy Markdown Field | Target Domain Field | Notes |
| --- | --- | --- |
| `Name` | `ITEM.name` | Part or component name |
| Section Heading (`## ...`) | `ITEM.category` | Maps to the public categories above |
| `Quantity` | `ITEM.quantity` | Numeric count (notes/status flags extracted separately) |
| `Last Date Stocked` | `ITEM.last_stocked_at` | Preserved as last verified/restocked date |
| `Storage Location` | `ITEM.home_bin_tag_id` | Resolved to a `BIN_TAG` under a `SHELF` / `STORAGE_UNIT` |
| `Material` | `ITEM.material` | Relevant for frames, 3D prints, and fasteners |
| `Link 1` / `Link 2` | `ITEM.purchase_url`, `cad_url`, `slicer_url` | Split into typed links (vendor/purchase vs. CAD/slicer) |
| *(New)* | `ITEM.purchased_at` | Date the item was purchased |
| *(New)* | `ITEM.added_by` | Lab member who logged the item on arrival |
| *(New)* | `ITEM.current_project_id` | Null when in **Home Bin**; set when in a **Project Bucket** |
