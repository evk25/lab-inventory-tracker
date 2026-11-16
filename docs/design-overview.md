# Design Overview

## High-Level Architecture

The system exposes two tailored client surfaces backed by a single application service, structured data store, and media store:

1. **Central Control Panel (Lab Wiki Integration)**: Full-featured management UI for floorplan editing, shelf photo annotation, catalog administration, provenance logging, and project bucket auditing.
2. **Shelf Kiosk Thin Client (Always-On Galaxy Tablet)**: Lightweight, touch-first kiosk UI mounted next to the storage shelves for fast check-out to a project bucket and check-in back to a home bin.

```mermaid
flowchart LR
    WikiUI["Central Control Panel\n(Lab Wiki Integration:\nFloorplan, Photo Annotator, Admin & Search)"]
    KioskUI["Shelf Kiosk Thin Client\n(Always-On Galaxy Tablet:\nTouch Check-Out / Check-In & Quick Lookup)"]
    API["Application Service\n(Search, Inventory Ops, Check-Out, Import)"]
    DB[("Structured Data Store\n(Zones, Units, Shelves, Bins, Projects, Items)")]
    Media[("Media Store\n(Floorplan SVGs/Images, Shelf Photos)")]

    WikiUI <--> API
    KioskUI <--> API
    API <--> DB
    API <--> Media
```

---

## Visual Locating Flow

1. **Search**: Lab member searches by part name, spec, material, or category.
2. **Assignment Check**: System shows whether the item is currently in its **Home Bin** or checked out to a **Project Bucket**.
3. **Floorplan Highlight**: If in storage, the lab floorplan highlights the target `StorageUnit` (rack, shelf, or caddy).
4. **Shelf Photo Overlay**: Selecting the unit opens the relevant `Shelf / Drawer` photo with the target `Bin / TagRegion` highlighted.

---

## Home Bin & Project Bucket Workflow

Every tracked item exists in one of two mutually exclusive states:

- **In Home Bin** (`current_project_id = null`): The item is unassigned and physically stored in its designated `home_bin_tag_id`.
- **In Project Bucket** (`current_project_id != null`): The item is actively assigned/checked out to a specific lab project or drone build. Checking the item back in clears `current_project_id` and directs the user to return it to its **Home Bin** (with the shelf photo highlight).

---

## Core Domain Model

```mermaid
erDiagram
    ZONE ||--o{ STORAGE_UNIT : contains
    STORAGE_UNIT ||--o{ SHELF : has
    SHELF ||--o{ BIN_TAG : displays
    BIN_TAG ||--o{ ITEM : "home location for"
    PROJECT_BUCKET ||--o{ ITEM : "currently holds"
    ITEM ||--o{ CHECKOUT_LOG : tracks

    ZONE {
        string id
        string name
        string floorplan_asset
    }
    STORAGE_UNIT {
        string id
        string zone_id
        string label
        string unit_type
        float map_x
        float map_y
        float width
        float height
    }
    SHELF {
        string id
        string storage_unit_id
        string label
        string photo_asset
    }
    BIN_TAG {
        string id
        string shelf_id
        string label
        string shape_type
        string coordinates
    }
    PROJECT_BUCKET {
        string id
        string name
        string lead_member
        string status
    }
    ITEM {
        string id
        string home_bin_tag_id
        string current_project_id
        string name
        string category
        string specs
        string material
        int quantity
        int min_quantity
        date purchased_at
        date last_stocked_at
        string added_by
        string purchase_url
        string cad_url
        string slicer_url
        string compatible_platforms
    }
    CHECKOUT_LOG {
        string id
        string item_id
        string project_id
        string borrower
        datetime checked_out_at
        datetime returned_at
    }
```
