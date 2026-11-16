import { useMemo, useState } from "react";
import type { BootstrapData, Item, ProjectBucket } from "../types";
import { PartTransferWorkspace } from "./PartTransferWorkspace";
import { ShelfPhotoModal } from "./ShelfPhotoModal";

interface Props {
  data: BootstrapData;
  wikiSource: string;
  onAllocate: (itemId: string, projectId: string, delta: number, source: string) => void;
  onConsume: (itemId: string, projectId: string, quantity: number, source: string) => void;
  onUpdateItem: (
    itemId: string,
    payload: {
      name: string;
      category: string;
      specs: string;
      material: string;
      quantity: number;
      min_quantity: number;
      home_bin_tag_id: string | null;
      home_location_label: string;
      purchased_at: string;
      added_by: string;
      purchase_url: string;
      cad_url: string;
      slicer_url: string;
      is_restock: boolean;
    }
  ) => void;
  onCreateItem: (payload: {
    name: string;
    category: string;
    specs: string;
    material: string;
    quantity: number;
    home_bin_tag_id: string | null;
    home_location_label: string;
    purchased_at: string;
    added_by: string;
    purchase_url: string;
    source: string;
  }) => void;
  onCreateBinTag: (shelfId: string, label: string, xPct: number, yPct: number) => void;
  onCreateStorageUnit: (payload: {
    name: string;
    unit_type: string;
    map_x: number;
    map_y: number;
    image_data_url: string | null;
  }) => void;
  onCreateProject: (name: string, description?: string, owner?: string, members?: string) => void;
  onUpdateProject: (projectId: string, payload: { name?: string; description?: string; owner?: string; members?: string }) => void;
  onDeleteProject: (projectId: string, mode: "return" | "consume") => void;
  onSwitchMode: (mode: "kiosk" | "portal") => void;
}

export function PortalView({
  data,
  wikiSource,
  onAllocate,
  onConsume,
  onUpdateItem,
  onCreateItem,
  onCreateBinTag,
  onCreateStorageUnit,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onSwitchMode,
}: Props) {
  const [tab, setTab] = useState<"quick_move" | "catalog" | "running_low" | "visual" | "projects" | "journal">("catalog");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [journalQuery, setJournalQuery] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState<string>(data.storage_units[0]?.id ?? "");
  const [selectedShelfId, setSelectedShelfId] = useState<string>("");
  const [newBinMode, setNewBinMode] = useState(false);
  const [photoItem, setPhotoItem] = useState<Item | null>(null);
  const [modifyItem, setModifyItem] = useState<Item | null>(null);
  const [modifyForm, setModifyForm] = useState({
    name: "",
    category: "",
    specs: "",
    material: "",
    quantity: 0,
    min_quantity: 1,
    home_bin_tag_id: "",
    home_location_label: "",
    purchased_at: "",
    added_by: "",
    purchase_url: "",
    cad_url: "",
    slicer_url: "",
    is_restock: true,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(data.projects[0]?.id ?? "");
  const [editingProject, setEditingProject] = useState(false);
  const [projEditForm, setProjEditForm] = useState({ name: "", description: "", owner: "", members: "" });
  const [deleteProj, setDeleteProj] = useState<ProjectBucket | null>(null);
  const [deleteMode, setDeleteMode] = useState<"consume" | "return">("consume");
  const [newProjName, setNewProjName] = useState("");

  // Add item form state
  const [form, setForm] = useState({
    name: "",
    category: "Hardware & Fasteners",
    specs: "",
    material: "",
    quantity: 1,
    home_location_label: "",
    purchased_at: new Date().toISOString().slice(0, 10),
    added_by: "",
    purchase_url: "",
  });

  // Add storage unit form state
  const [unitForm, setUnitForm] = useState<{
    name: string;
    unit_type: string;
    map_x: number;
    map_y: number;
    image_data_url: string | null;
  }>({
    name: "",
    unit_type: "Shelf",
    map_x: 40,
    map_y: 18,
    image_data_url: null,
  });

  const openModifyModal = (item: Item) => {
    setModifyItem(item);
    setModifyForm({
      name: item.name,
      category: item.category,
      specs: item.specs || "",
      material: item.material || "",
      quantity: item.quantity,
      min_quantity: item.min_quantity,
      home_bin_tag_id: item.home_bin_tag_id || "",
      home_location_label: item.home_location_label || "",
      purchased_at: item.purchased_at || "",
      added_by: item.added_by || "",
      purchase_url: item.purchase_url || "",
      cad_url: item.cad_url || "",
      slicer_url: item.slicer_url || "",
      is_restock: true,
    });
  };

  const categories = useMemo(() => {
    const set = new Set(data.items.map((i) => i.category));
    return ["All", ...Array.from(set)];
  }, [data.items]);

  const projectMap = useMemo(() => {
    const m = new Map<string, ProjectBucket>();
    data.projects.forEach((p) => m.set(p.id, p));
    return m;
  }, [data.projects]);

  const itemMap = useMemo(() => {
    const m = new Map<string, Item>();
    data.items.forEach((i) => m.set(i.id, i));
    return m;
  }, [data.items]);

  const allocationsByItem = useMemo(() => {
    const m = new Map<string, { projectId: string; quantity: number }[]>();
    data.allocations.forEach((a) => {
      if (a.quantity <= 0) return;
      const list = m.get(a.item_id) ?? [];
      list.push({ projectId: a.project_id, quantity: a.quantity });
      m.set(a.item_id, list);
    });
    return m;
  }, [data.allocations]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.items.filter((i) => {
      if (categoryFilter !== "All" && i.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        i.home_location_label.toLowerCase().includes(q) ||
        i.added_by.toLowerCase().includes(q) ||
        i.material.toLowerCase().includes(q)
      );
    });
  }, [data.items, query, categoryFilter]);

  // Running Low: sort by lowest remaining % = quantity / max(last_restock_total, 1)
  const runningLowItems = useMemo(() => {
    return [...data.items]
      .map((item) => {
        const baseline = Math.max(item.last_restock_total || 1, 1);
        const ratio = item.quantity / baseline;
        const pctLeft = Math.round(ratio * 100);
        return { item, baseline, ratio, pctLeft };
      })
      .sort((a, b) => a.ratio - b.ratio || a.item.quantity - b.item.quantity);
  }, [data.items]);

  const filteredJournal = useMemo(() => {
    const q = journalQuery.trim().toLowerCase();
    if (!q) return data.journal;
    return data.journal.filter(
      (j) =>
        j.item_name.toLowerCase().includes(q) ||
        j.action.toLowerCase().includes(q) ||
        j.source.toLowerCase().includes(q) ||
        j.from_location.toLowerCase().includes(q) ||
        j.to_location.toLowerCase().includes(q)
    );
  }, [data.journal, journalQuery]);

  const activeUnit = data.storage_units.find((u) => u.id === selectedUnitId) ?? data.storage_units[0];
  const unitShelves = data.shelves.filter((s) => s.storage_unit_id === activeUnit?.id);
  const activeShelf = unitShelves.find((s) => s.id === selectedShelfId) ?? unitShelves[0];
  const shelfBins = activeShelf ? data.bin_tags.filter((b) => b.shelf_id === activeShelf.id) : [];

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div className="topbar">
        <div className="topbar-title">
          <span>Lab Wiki Control Panel</span>
          <span className="badge">{wikiSource}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sm" onClick={() => setShowAddModal(true)}>
            + Add Item
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => onSwitchMode("kiosk")}>
            Switch to Shelf Kiosk
          </button>
        </div>
      </div>

      <div className="portal-tabs">
        <button className={`tab-btn ${tab === "catalog" ? "active" : ""}`} onClick={() => setTab("catalog")}>
          Spare Inventory ({data.items.length})
        </button>
        <button className={`tab-btn ${tab === "quick_move" ? "active" : ""}`} onClick={() => setTab("quick_move")}>
          Quick Move (Kiosk View)
        </button>
        <button className={`tab-btn ${tab === "running_low" ? "active" : ""}`} onClick={() => setTab("running_low")}>
          Running Low
        </button>
        <button className={`tab-btn ${tab === "visual" ? "active" : ""}`} onClick={() => setTab("visual")}>
          Lab Floorplan &amp; Shelf Photos
        </button>
        <button className={`tab-btn ${tab === "projects" ? "active" : ""}`} onClick={() => setTab("projects")}>
          Project Buckets ({data.projects.length})
        </button>
        <button className={`tab-btn ${tab === "journal" ? "active" : ""}`} onClick={() => setTab("journal")}>
          Movement Journal ({data.journal.length})
        </button>
      </div>

      {tab === "quick_move" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <PartTransferWorkspace
            variant="wiki"
            sourceLabel={wikiSource}
            data={data}
            onAllocate={onAllocate}
            onConsume={onConsume}
            onCreateProject={(name) => onCreateProject(name)}
          />
        </div>
      )}

      {tab !== "quick_move" && (
      <div className="portal-body">
        {tab === "catalog" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                className="input"
                style={{ flex: 1, minWidth: 220 }}
                placeholder="Search items, bins, materials, added by..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                className="input"
                style={{ width: "auto" }}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Spare Qty</th>
                    <th>Home Bin</th>
                    <th>Checked Out</th>
                    <th>Provenance &amp; Links</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const allocs = allocationsByItem.get(item.id) ?? [];
                    const totalOut = allocs.reduce((s, a) => s + a.quantity, 0);
                    return (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          {(item.material || item.specs) && (
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>
                              {[item.specs, item.material].filter(Boolean).join(" • ")}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="badge">{item.category}</span>
                        </td>
                        <td>
                          <span className={`badge ${item.quantity === 0 ? "badge-low" : ""}`}>
                            {item.quantity}
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-sm" onClick={() => setPhotoItem(item)}>
                            {item.home_location_label || "View Bin"}
                          </button>
                        </td>
                        <td>
                          {totalOut > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {allocs.map((a) => (
                                <span key={a.projectId} className="badge badge-project">
                                  {projectMap.get(a.projectId)?.name ?? a.projectId}: {a.quantity}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 12 }}>
                            {item.purchased_at && <span className="badge">Date: {item.purchased_at}</span>}
                            {item.added_by && <span className="badge">By: {item.added_by}</span>}
                            {item.purchase_url && (
                              <a className="btn btn-sm" href={item.purchase_url} target="_blank" rel="noreferrer">
                                Buy
                              </a>
                            )}
                            {item.cad_url && (
                              <a className="btn btn-sm" href={item.cad_url} target="_blank" rel="noreferrer">
                                CAD
                              </a>
                            )}
                            {item.slicer_url && (
                              <a className="btn btn-sm" href={item.slicer_url} target="_blank" rel="noreferrer">
                                Slicer
                              </a>
                            )}
                          </div>
                        </td>
                        <td>
                          <button
                            className="btn btn-sm"
                            onClick={() => openModifyModal(item)}
                          >
                            Modify
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "running_low" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Ordered by depletion relative to your last restock baseline (<code>Current Qty / Last Restock Total</code>).
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Current vs. Restock Baseline</th>
                    <th>% Remaining</th>
                    <th>Last Restock</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {runningLowItems.map(({ item, baseline, pctLeft }) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td>
                        <span className="badge">{item.category}</span>
                      </td>
                      <td>
                        <span className={`badge ${item.quantity === 0 ? "badge-low" : pctLeft <= 50 ? "badge-project" : ""}`}>
                          {item.quantity} / {baseline}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: pctLeft <= 40 ? "var(--danger)" : "var(--text)" }}>
                        {pctLeft}%
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        +{item.last_restock_amount} {item.last_stocked_at ? `(${item.last_stocked_at})` : ""}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {item.purchase_url && (
                            <a className="btn btn-sm" href={item.purchase_url} target="_blank" rel="noreferrer">
                              Buy
                            </a>
                          )}
                          <button
                            className="btn btn-sm"
                            onClick={() => openModifyModal(item)}
                          >
                            Restock
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "visual" && (
          <div className="visual-grid">
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>Lab Floorplan (click a storage unit)</div>
                <button className="btn btn-sm btn-primary" onClick={() => setShowAddUnitModal(true)}>
                  + Add Storage Location
                </button>
              </div>
              <div className="floorplan-canvas">
                {data.storage_units.map((u) => (
                  <div
                    key={u.id}
                    className={`unit-box ${activeUnit?.id === u.id ? "active" : ""}`}
                    style={{
                      left: `${u.map_x}%`,
                      top: `${u.map_y}%`,
                      width: `${u.width}%`,
                      height: `${u.height}%`,
                    }}
                    onClick={() => {
                      setSelectedUnitId(u.id);
                      setSelectedShelfId("");
                    }}
                  >
                    <span>{u.name}</span>
                    <span className="badge" style={{ alignSelf: "flex-start" }}>
                      {u.unit_type}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>{activeUnit?.name ?? "Select a Unit"}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {unitShelves.length > 1 && (
                    <select
                      className="input"
                      style={{ padding: "4px 8px", fontSize: 12, width: "auto" }}
                      value={activeShelf?.id ?? ""}
                      onChange={(e) => setSelectedShelfId(e.target.value)}
                    >
                      {unitShelves.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    className={`btn btn-sm ${newBinMode ? "btn-primary" : ""}`}
                    onClick={() => setNewBinMode((v) => !v)}
                  >
                    {newBinMode ? "Click Photo to Place Bin..." : "+ Tag Bin on Photo"}
                  </button>
                </div>
              </div>

              {activeShelf?.photo_url ? (
                <div
                  className="photo-stage"
                  style={{ cursor: newBinMode ? "crosshair" : "default" }}
                  onClick={(e) => {
                    if (!newBinMode || !activeShelf) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
                    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
                    const label = window.prompt("Bin tag label (e.g., M3 Fasteners):");
                    if (label && label.trim()) {
                      onCreateBinTag(activeShelf.id, label.trim(), xPct, yPct);
                    }
                    setNewBinMode(false);
                  }}
                >
                  <img src={activeShelf.photo_url} alt={activeShelf.label} />
                  {shelfBins.map((b) => (
                    <div
                      key={b.id}
                      className="bin-overlay"
                      style={{ left: `${b.x_pct}%`, top: `${b.y_pct}%` }}
                    >
                      {b.label}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 32, textAlign: "center", border: "1px dashed var(--border)", borderRadius: 8 }}>
                  No photo attached to this shelf yet.
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "projects" && (() => {
          const focusedProj =
            data.projects.find((p) => p.id === selectedProjectId) ?? data.projects[0] ?? null;
          const focusedAllocs = focusedProj
            ? data.allocations.filter((a) => a.project_id === focusedProj.id && a.quantity > 0)
            : [];

          return (
            <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" }}>
              {/* LEFT SIDEBAR: PROJECT LIST */}
              <div className="pane">
                <div className="pane-header">
                  <span>Project Buckets</span>
                  <span className="badge">{data.projects.length}</span>
                </div>
                <div style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
                  <form
                    style={{ display: "flex", gap: 6 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newProjName.trim()) return;
                      onCreateProject(newProjName.trim());
                      setNewProjName("");
                    }}
                  >
                    <input
                      className="input"
                      placeholder="New project name..."
                      value={newProjName}
                      onChange={(e) => setNewProjName(e.target.value)}
                    />
                    <button className="btn btn-primary btn-sm" type="submit">
                      Add
                    </button>
                  </form>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {data.projects.map((p) => {
                    const count = data.allocations
                      .filter((a) => a.project_id === p.id && a.quantity > 0)
                      .reduce((s, a) => s + a.quantity, 0);
                    const isActive = focusedProj?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedProjectId(p.id);
                          setEditingProject(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          padding: "11px 12px",
                          border: "none",
                          borderBottom: "1px solid var(--border)",
                          borderLeft: `4px solid ${p.color}`,
                          background: isActive ? "var(--primary-soft)" : "var(--surface)",
                          textAlign: "left",
                          cursor: "pointer",
                          fontWeight: isActive ? 700 : 600,
                          fontSize: 13,
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.name}
                        </span>
                        <span className="badge">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* MAIN FOCUS PANEL */}
              {focusedProj ? (
                <div className="pane" style={{ borderTop: `4px solid ${focusedProj.color}` }}>
                  <div className="pane-header" style={{ padding: "12px 16px" }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700 }}>{focusedProj.name}</div>
                      {focusedProj.description && (
                        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400, marginTop: 2 }}>
                          {focusedProj.description}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => {
                          setProjEditForm({
                            name: focusedProj.name,
                            description: focusedProj.description || "",
                            owner: focusedProj.owner || "",
                            members: focusedProj.members || "",
                          });
                          setEditingProject((v) => !v);
                        }}
                      >
                        {editingProject ? "Close Edit" : "Edit Info"}
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ color: "var(--danger)", borderColor: "#fecaca" }}
                        onClick={() => {
                          setDeleteProj(focusedProj);
                          setDeleteMode("consume");
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* METADATA BAR: OWNER & MEMBERS */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      padding: "10px 16px",
                      background: "var(--surface-alt)",
                      borderBottom: "1px solid var(--border)",
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <strong>Owner (Discord):</strong>{" "}
                      <span className="badge">{focusedProj.owner || "Unassigned"}</span>
                    </div>
                    <div>
                      <strong>Members (Discord):</strong>{" "}
                      <span className="badge">{focusedProj.members || "None"}</span>
                    </div>
                  </div>

                  {editingProject && (
                    <form
                      style={{
                        padding: 14,
                        borderBottom: "1px solid var(--border)",
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                        background: "var(--surface-alt)",
                      }}
                      onSubmit={(e) => {
                        e.preventDefault();
                        onUpdateProject(focusedProj.id, projEditForm);
                        setEditingProject(false);
                      }}
                    >
                      <input
                        className="input"
                        placeholder="Project Name"
                        value={projEditForm.name}
                        onChange={(e) => setProjEditForm({ ...projEditForm, name: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Owner (Discord handle)"
                        value={projEditForm.owner}
                        onChange={(e) => setProjEditForm({ ...projEditForm, owner: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Members (comma-separated Discord handles)"
                        value={projEditForm.members}
                        onChange={(e) => setProjEditForm({ ...projEditForm, members: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Short Description"
                        value={projEditForm.description}
                        onChange={(e) => setProjEditForm({ ...projEditForm, description: e.target.value })}
                      />
                      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <button type="submit" className="btn btn-primary btn-sm">
                          Save Metadata
                        </button>
                      </div>
                    </form>
                  )}

                  {/* ALLOCATED ITEMS TABLE */}
                  <div style={{ padding: 12 }}>
                    {focusedAllocs.length === 0 ? (
                      <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                        No parts currently checked out to this project. Use <strong>Quick Move (Kiosk View)</strong> or the <strong>Shelf Kiosk</strong> to assign items here.
                      </div>
                    ) : (
                      <table>
                        <thead>
                          <tr>
                            <th>Part</th>
                            <th>Home Bin</th>
                            <th>Checked-Out Qty</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {focusedAllocs.map((a) => {
                            const item = itemMap.get(a.item_id);
                            if (!item) return null;
                            return (
                              <tr key={a.item_id}>
                                <td style={{ fontWeight: 600 }}>{item.name}</td>
                                <td>
                                  <span className="badge badge-home">
                                    {item.home_location_label || "Unassigned"}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <button
                                      className="btn btn-sm"
                                      onClick={() => onAllocate(item.id, focusedProj.id, -1, wikiSource)}
                                      title="Return 1 to Home Bin"
                                    >
                                      -
                                    </button>
                                    <span style={{ fontWeight: 700, minWidth: 22, textAlign: "center" }}>
                                      {a.quantity}
                                    </span>
                                    <button
                                      className="btn btn-sm"
                                      disabled={item.quantity <= 0}
                                      onClick={() => onAllocate(item.id, focusedProj.id, 1, wikiSource)}
                                      title="Take 1 more from Spare Inventory"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td>
                                  <button
                                    className="btn btn-sm"
                                    style={{ color: "var(--danger)", borderColor: "#fecaca" }}
                                    onClick={() => onConsume(item.id, focusedProj.id, 1, wikiSource)}
                                  >
                                    Consume 1
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ padding: 24, color: "var(--muted)" }}>Create a project bucket to get started.</div>
              )}
            </div>
          );
        })()}

        {tab === "journal" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              className="input"
              placeholder="Search movement journal by item, source (Kiosk / Wiki), action, or location..."
              value={journalQuery}
              onChange={(e) => setJournalQuery(e.target.value)}
            />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Source</th>
                    <th>Action</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>From</th>
                    <th>To</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJournal.map((j) => (
                    <tr key={j.id}>
                      <td style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{j.created_at}</td>
                      <td>
                        <span className="badge">{j.source}</span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            j.action === "CHECK_OUT"
                              ? "badge-project"
                              : j.action === "CHECK_IN" || j.action === "RESTOCK"
                              ? "badge-home"
                              : ""
                          }`}
                        >
                          {j.action}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{j.item_name}</td>
                      <td>{j.quantity}</td>
                      <td>{j.from_location}</td>
                      <td>{j.to_location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      )}

      {photoItem && (
        <ShelfPhotoModal
          item={photoItem}
          binTags={data.bin_tags}
          shelves={data.shelves}
          storageUnits={data.storage_units}
          onClose={() => setPhotoItem(null)}
        />
      )}

      {modifyItem && (
        <div className="modal-backdrop" onClick={() => setModifyItem(null)}>
          <form
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (!modifyForm.name.trim()) return;
              onUpdateItem(modifyItem.id, {
                ...modifyForm,
                quantity: Math.max(0, modifyForm.quantity),
                min_quantity: Math.max(0, modifyForm.min_quantity),
                home_bin_tag_id: modifyForm.home_bin_tag_id || null,
              });
              setModifyItem(null);
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>Modify Item: {modifyItem.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              Current Spare Qty: {modifyItem.quantity} • Last Restock Total: {modifyItem.last_restock_total}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Item Name
                <input
                  className="input"
                  required
                  value={modifyForm.name}
                  onChange={(e) => setModifyForm({ ...modifyForm, name: e.target.value })}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Category
                <input
                  className="input"
                  value={modifyForm.category}
                  onChange={(e) => setModifyForm({ ...modifyForm, category: e.target.value })}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Spare Qty
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={modifyForm.quantity}
                  onChange={(e) => setModifyForm({ ...modifyForm, quantity: Number(e.target.value) })}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Min Threshold
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={modifyForm.min_quantity}
                  onChange={(e) => setModifyForm({ ...modifyForm, min_quantity: Number(e.target.value) })}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Specs
                <input
                  className="input"
                  value={modifyForm.specs}
                  onChange={(e) => setModifyForm({ ...modifyForm, specs: e.target.value })}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Material
                <input
                  className="input"
                  value={modifyForm.material}
                  onChange={(e) => setModifyForm({ ...modifyForm, material: e.target.value })}
                />
              </label>
            </div>

            {modifyForm.quantity > modifyItem.quantity && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={modifyForm.is_restock}
                  onChange={(e) => setModifyForm({ ...modifyForm, is_restock: e.target.checked })}
                />
                Count +{modifyForm.quantity - modifyItem.quantity} as a Restock (updates Running Low baseline to {modifyForm.quantity})
              </label>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Home Location Label
                <input
                  className="input"
                  value={modifyForm.home_location_label}
                  onChange={(e) => setModifyForm({ ...modifyForm, home_location_label: e.target.value })}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Linked Photo Bin Tag
                <select
                  className="input"
                  value={modifyForm.home_bin_tag_id}
                  onChange={(e) => setModifyForm({ ...modifyForm, home_bin_tag_id: e.target.value })}
                >
                  <option value="">None</option>
                  {data.bin_tags.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Purchased Date
                <input
                  className="input"
                  value={modifyForm.purchased_at}
                  onChange={(e) => setModifyForm({ ...modifyForm, purchased_at: e.target.value })}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Added By
                <input
                  className="input"
                  value={modifyForm.added_by}
                  onChange={(e) => setModifyForm({ ...modifyForm, added_by: e.target.value })}
                />
              </label>
            </div>

            <label style={{ fontSize: 12, fontWeight: 600 }}>
              Purchase URL
              <input
                className="input"
                value={modifyForm.purchase_url}
                onChange={(e) => setModifyForm({ ...modifyForm, purchase_url: e.target.value })}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                CAD URL
                <input
                  className="input"
                  value={modifyForm.cad_url}
                  onChange={(e) => setModifyForm({ ...modifyForm, cad_url: e.target.value })}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Slicer URL
                <input
                  className="input"
                  value={modifyForm.slicer_url}
                  onChange={(e) => setModifyForm({ ...modifyForm, slicer_url: e.target.value })}
                />
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn" onClick={() => setModifyItem(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {showAddUnitModal && (
        <div className="modal-backdrop" onClick={() => setShowAddUnitModal(false)}>
          <form
            className="modal-card"
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (!unitForm.name.trim()) return;
              onCreateStorageUnit(unitForm);
              setShowAddUnitModal(false);
              setUnitForm({ name: "", unit_type: "Shelf", map_x: 40, map_y: 18, image_data_url: null });
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>Add Storage Location to Floorplan</div>
            <input
              className="input"
              required
              placeholder="Location Name (e.g., East Wall Cabinet)"
              value={unitForm.name}
              onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <select
                className="input"
                value={unitForm.unit_type}
                onChange={(e) => setUnitForm({ ...unitForm, unit_type: e.target.value })}
              >
                <option value="Shelf">Shelf</option>
                <option value="Rack">Rack</option>
                <option value="Caddy">Caddy</option>
                <option value="Cabinet">Cabinet</option>
              </select>
              <input
                className="input"
                type="number"
                min={0}
                max={80}
                placeholder="Map X %"
                value={unitForm.map_x}
                onChange={(e) => setUnitForm({ ...unitForm, map_x: Number(e.target.value) })}
              />
              <input
                className="input"
                type="number"
                min={0}
                max={85}
                placeholder="Map Y %"
                value={unitForm.map_y}
                onChange={(e) => setUnitForm({ ...unitForm, map_y: Number(e.target.value) })}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                Attach Shelf / Location Photo (optional):
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () =>
                    setUnitForm((prev) => ({ ...prev, image_data_url: String(reader.result) }));
                  reader.readAsDataURL(file);
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn" onClick={() => setShowAddUnitModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Add to Floorplan
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteProj && (() => {
        const projAllocs = data.allocations.filter(
          (a) => a.project_id === deleteProj.id && a.quantity > 0
        );
        return (
          <div className="modal-backdrop" onClick={() => setDeleteProj(null)}>
            <div className="modal-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                Delete Project Bucket: {deleteProj.name}
              </div>

              {projAllocs.length > 0 ? (
                <>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>
                    This bucket currently holds <strong>{projAllocs.length}</strong> part type(s). Choose what should happen to these items:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
                    {projAllocs.map((a) => (
                      <div key={a.item_id} className="bucket-item-row">
                        <span>{itemMap.get(a.item_id)?.name ?? a.item_id}</span>
                        <span className="badge">Qty: {a.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        padding: 10,
                        border: `1px solid ${deleteMode === "consume" ? "var(--primary)" : "var(--border)"}`,
                        borderRadius: 8,
                        background: deleteMode === "consume" ? "var(--primary-soft)" : "var(--surface)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="deleteMode"
                        checked={deleteMode === "consume"}
                        onChange={() => setDeleteMode("consume")}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>
                          Remove from Inventory Tracking (Consumed / Integrated)
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          Parts were permanently installed into a larger assembly (e.g., mounted onto a drone) and will not return to Spare Inventory.
                        </div>
                      </div>
                    </label>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        padding: 10,
                        border: `1px solid ${deleteMode === "return" ? "var(--primary)" : "var(--border)"}`,
                        borderRadius: 8,
                        background: deleteMode === "return" ? "var(--primary-soft)" : "var(--surface)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="deleteMode"
                        checked={deleteMode === "return"}
                        onChange={() => setDeleteMode("return")}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>
                          Return All Items to Home Bins
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          Add checked-out quantities back to Spare Inventory in their Home Bins.
                        </div>
                      </div>
                    </label>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  This project bucket is empty. Are you sure you want to delete it?
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn" onClick={() => setDeleteProj(null)}>
                  Cancel
                </button>
                <button
                  className="btn"
                  style={{ background: "var(--danger)", borderColor: "var(--danger)", color: "#fff" }}
                  onClick={() => {
                    onDeleteProject(deleteProj.id, projAllocs.length > 0 ? deleteMode : "return");
                    setDeleteProj(null);
                  }}
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <form
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name.trim()) return;
              onCreateItem({
                ...form,
                home_bin_tag_id: null,
                source: wikiSource,
              });
              setShowAddModal(false);
              setForm({
                name: "",
                category: "Hardware & Fasteners",
                specs: "",
                material: "",
                quantity: 1,
                home_location_label: "",
                purchased_at: new Date().toISOString().slice(0, 10),
                added_by: "",
                purchase_url: "",
              });
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>Add New Inventory Item</div>
            <input
              className="input"
              required
              placeholder="Item Name (e.g., M3x10 Standoff)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                className="input"
                placeholder="Category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <input
                className="input"
                type="number"
                min={0}
                placeholder="Quantity"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
              />
            </div>
            <input
              className="input"
              placeholder="Home Bin Location (e.g., Hardware Caddy - M3 Drawer)"
              value={form.home_location_label}
              onChange={(e) => setForm({ ...form, home_location_label: e.target.value })}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                className="input"
                type="date"
                value={form.purchased_at}
                onChange={(e) => setForm({ ...form, purchased_at: e.target.value })}
              />
              <input
                className="input"
                placeholder="Added By (member name)"
                value={form.added_by}
                onChange={(e) => setForm({ ...form, added_by: e.target.value })}
              />
            </div>
            <input
              className="input"
              placeholder="Purchase URL"
              value={form.purchase_url}
              onChange={(e) => setForm({ ...form, purchase_url: e.target.value })}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save to Home Bin
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
