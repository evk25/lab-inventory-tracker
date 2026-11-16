# Lab Inventory Tracker

A visual inventory management system designed for the **Quadrotor Control and Perception Lab** to make locating drone parts, fasteners, perception hardware, and shared tools fast and intuitive.

> [!NOTE]
> **MVP Ready for Testing**: The core Kiosk (`/kiosk/`) and Wiki Control Panel (`/portal/`) MVP is implemented. Full requirements, architecture, workflows, and roadmap details live in [`docs/`](docs/).

---

## Documentation

| Document | Contents |
| --- | --- |
| [Project Requirements](docs/requirements.md) | Functional (`FR-1`–`FR-9`) and Non-Functional (`NFR-1`–`NFR-5`) requirements |
| [Design Overview](docs/design-overview.md) | High-level architecture, visual locating flow, Home Bin vs. Project Bucket workflow, and ER domain model |
| [System Workflows](docs/workflow.md) | Step-by-step interactions for the Shelf Kiosk (`/kiosk/`), Wiki Portal (`/portal/`), Running Low, and Movement Journal |
| [Features Management System](docs/features.md) | Status legend and prioritized roadmap (`Phase 1 MVP`, `Phase 2 v1.0`, `Phase 3 Future`) |
| [Categories & Import Schema](docs/categories-and-schema.md) | Public part categories, storage hierarchy, and legacy Markdown import mapping |

---

## Quick Start (Testing Phase)

### Prerequisites
- **Python 3.10+**
- **Node.js 18+ & npm**

### 1. Install Backend Dependencies & Seed Database
```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt

# Seed SQLite from confidential/spare-parts-inventory.md (if present)
.venv/bin/python backend/seed.py
```

### 2. Install Frontend Dependencies & Build
```bash
npm --prefix frontend install
npm --prefix frontend run build
```

### 3. Run the Prototype Server
```bash
.venv/bin/uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Once running, open:
- **Shelf Kiosk Thin Client**: `http://localhost:8000/kiosk/`
- **Lab Wiki Control Panel**: `http://localhost:8000/portal/`

*(Optional)* For frontend hot-reload during UI development, run `npm --prefix frontend run dev` alongside `uvicorn` and access `http://localhost:5173/kiosk/` or `http://localhost:5173/portal/`.

---

## Repository Structure

```text
lab-inventory-tracker/
├── README.md                    # Documentation index & testing setup
├── backend/                     # FastAPI + SQLite prototype API & seeder
├── frontend/                    # Vite + React + TypeScript UI (/kiosk/ & /portal/)
├── docs/                        # Public requirements, design, workflows, roadmap, and schema
│   ├── requirements.md
│   ├── design-overview.md
│   ├── workflow.md
│   ├── features.md
│   └── categories-and-schema.md
└── confidential/                # Gitignored lab inventory data & shelf photos (local only)
```

> [!IMPORTANT]
> `confidential/`, `.venv/`, `backend/data/`, `frontend/node_modules/`, and `frontend/dist/` are listed in `.gitignore` and are not committed to version control.
