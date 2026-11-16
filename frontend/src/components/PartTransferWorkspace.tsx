import { useMemo, useRef, useState } from "react";
import type { BinTag, BootstrapData, Item, ProjectBucket, Shelf, StorageUnit } from "../types";
import { ShelfPhotoModal } from "./ShelfPhotoModal";

interface Props {
  variant: "kiosk" | "wiki";
  sourceLabel: string;
  data: BootstrapData;
  kioskTab?: "checkout" | "checkin";
  onKioskTabChange?: (tab: "checkout" | "checkin") => void;
  onAllocate: (itemId: string, projectId: string, delta: number, source: string) => void;
  onConsume: (itemId: string, projectId: string, quantity: number, source: string) => void;
  onCreateProject: (name: string) => void;
}

export function PartTransferWorkspace({
  variant,
  sourceLabel,
  data,
  kioskTab: controlledTab,
  onKioskTabChange,
  onAllocate,
  onConsume,
  onCreateProject,
}: Props) {
  const isKiosk = variant === "kiosk";
  const [internalTab, setInternalTab] = useState<"checkout" | "checkin">("checkout");
  const kioskTab = controlledTab ?? internalTab;
  const setKioskTab = onKioskTabChange ?? setInternalTab;
  const [checkInProjId, setCheckInProjId] = useState<string>(data.projects[0]?.id ?? "");

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "out">("all");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const dragItemIdRef = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [flashedBucketId, setFlashedBucketId] = useState<string | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const touchDragRef = useRef<{ itemId: string; startX: number; startY: number; active: boolean } | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [photoItem, setPhotoItem] = useState<Item | null>(null);
  const [checkedOutItem, setCheckedOutItem] = useState<Item | null>(null);
  const [newProjName, setNewProjName] = useState("");
  const [showNewProj, setShowNewProj] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

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

  const binUnitMap = useMemo(() => {
    const shelfById = new Map<string, Shelf>();
    data.shelves.forEach((s) => shelfById.set(s.id, s));
    const unitById = new Map<string, StorageUnit>();
    data.storage_units.forEach((u) => unitById.set(u.id, u));
    const binById = new Map<string, BinTag>();
    data.bin_tags.forEach((b) => binById.set(b.id, b));
    return { shelfById, unitById, binById };
  }, [data.shelves, data.storage_units, data.bin_tags]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.items.filter((item) => {
      if (selectedCategory !== "All" && item.category !== selectedCategory) return false;
      if (stockFilter === "in_stock" && item.quantity <= 0) return false;
      if (stockFilter === "out" && item.quantity > 0) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q) ||
        item.home_location_label.toLowerCase().includes(q) ||
        item.material.toLowerCase().includes(q) ||
        item.specs.toLowerCase().includes(q)
      );
    });
  }, [data.items, query, selectedCategory, stockFilter]);

  const selectedItem = useMemo(
    () => data.items.find((i) => i.id === selectedItemId) ?? null,
    [data.items, selectedItemId]
  );

  const triggerBucketFlash = (projectId: string) => {
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    setFlashedBucketId(null);
    requestAnimationFrame(() => {
      setFlashedBucketId(projectId);
      flashTimerRef.current = window.setTimeout(() => setFlashedBucketId(null), 550);
    });
  };

  const handleDropOnProject = (projectId: string, dataTransferId?: string) => {
    const id = dataTransferId || dragItemIdRef.current;
    if (id) {
      onAllocate(id, projectId, 1, sourceLabel);
      triggerBucketFlash(projectId);
    }
    dragItemIdRef.current = null;
    setDropTarget(null);
  };

  const getUnitName = (item: Item) => {
    if (!item.home_bin_tag_id) return "";
    const bin = binUnitMap.binById.get(item.home_bin_tag_id);
    const shelf = bin ? binUnitMap.shelfById.get(bin.shelf_id) : undefined;
    const unit = shelf ? binUnitMap.unitById.get(shelf.storage_unit_id) : undefined;
    return unit ? unit.name.split(":")[0] : "";
  };

  const activeCheckInProj =
    projectMap.get(checkInProjId) ?? data.projects[0] ?? null;
  const checkInAllocs = activeCheckInProj
    ? data.allocations.filter((a) => a.project_id === activeCheckInProj.id && a.quantity > 0)
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {isKiosk && !controlledTab && (
        <div className="portal-tabs" style={{ padding: "0 12px" }}>
          <button
            className={`tab-btn ${kioskTab === "checkout" ? "active" : ""}`}
            onClick={() => setKioskTab("checkout")}
          >
            Check Out (Spare Inventory &rarr; Bucket)
          </button>
          <button
            className={`tab-btn ${kioskTab === "checkin" ? "active" : ""}`}
            onClick={() => setKioskTab("checkin")}
          >
            Check In / Manage Bucket
          </button>
        </div>
      )}

      {(!isKiosk || kioskTab === "checkout") && (
        <>
          <div className="kiosk-controls" style={isKiosk ? { padding: "8px 12px", gap: 6 } : undefined}>
            <div className="kiosk-search-row">
              <input
                ref={searchRef}
                className="input"
                placeholder="Search spare inventory by part, spec, material, or home bin..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  className="btn"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                >
                  Clear
                </button>
              )}
              <select
                className="input"
                style={{ width: "auto", minWidth: 130 }}
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as "all" | "in_stock" | "out")}
              >
                <option value="all">All Stock</option>
                <option value="in_stock">In Stock (&gt;0)</option>
                <option value="out">Out of Stock (0)</option>
              </select>
            </div>

            <div className="pill-row">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`pill ${selectedCategory === cat ? "active" : ""}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="kiosk-main" style={isKiosk ? { padding: "8px 12px", gap: 10 } : undefined}>
            {/* LEFT PANE: SPARE INVENTORY */}
            <div className="pane">
              <div className="pane-header">
                <span>Spare Inventory ({filteredItems.length})</span>
                {selectedItem && (
                  <span className="badge badge-project">
                    Selected: {selectedItem.name} (tap bucket &rarr;)
                  </span>
                )}
              </div>
              <div className="pane-scroll" style={isKiosk ? { padding: 8, gap: 6 } : undefined}>
                {filteredItems.map((item) => {
                  const unitShort = getUnitName(item);
                  const isSelected = selectedItemId === item.id;
                  const itemAllocs = allocationsByItem.get(item.id) ?? [];
                  const totalCheckedOut = itemAllocs.reduce((sum, a) => sum + a.quantity, 0);

                  return (
                    <div
                      key={item.id}
                      className={`item-card ${isSelected ? "selected" : ""}`}
                      style={{
                        ...(isKiosk ? { padding: "8px 10px" } : {}),
                        ...(item.quantity <= 0 ? { opacity: 0.6, cursor: "not-allowed" } : {}),
                      }}
                      draggable={item.quantity > 0}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", item.id);
                        e.dataTransfer.effectAllowed = "move";
                        dragItemIdRef.current = item.id;
                      }}
                      onDragEnd={() => {
                        dragItemIdRef.current = null;
                        setDropTarget(null);
                      }}
                      onTouchStart={(e) => {
                        if (item.quantity <= 0) return;
                        const t = e.touches[0];
                        touchDragRef.current = {
                          itemId: item.id,
                          startX: t.clientX,
                          startY: t.clientY,
                          active: false,
                        };
                      }}
                      onTouchMove={(e) => {
                        const state = touchDragRef.current;
                        if (!state) return;
                        const t = e.touches[0];
                        const dx = Math.abs(t.clientX - state.startX);
                        const dy = Math.abs(t.clientY - state.startY);
                        if (!state.active && dx > 18 && dx > dy) {
                          state.active = true;
                          dragItemIdRef.current = state.itemId;
                        }
                        if (state.active) {
                          const el = document.elementFromPoint(t.clientX, t.clientY);
                          const bucketEl = el?.closest("[data-bucket-id]") as HTMLElement | null;
                          setDropTarget(bucketEl?.dataset.bucketId ?? null);
                        }
                      }}
                      onTouchEnd={(e) => {
                        const state = touchDragRef.current;
                        touchDragRef.current = null;
                        if (!state || !state.active) return;
                        const t = e.changedTouches[0];
                        const el = document.elementFromPoint(t.clientX, t.clientY);
                        const bucketEl = el?.closest("[data-bucket-id]") as HTMLElement | null;
                        const targetProjId = bucketEl?.dataset.bucketId;
                        if (targetProjId) {
                          handleDropOnProject(targetProjId, state.itemId);
                        } else {
                          dragItemIdRef.current = null;
                          setDropTarget(null);
                        }
                      }}
                      onClick={() => setSelectedItemId(isSelected ? null : item.id)}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="item-title" style={isKiosk ? { fontSize: 13 } : undefined}>
                          {item.name}
                        </div>
                        <div className="item-meta">
                          {!isKiosk && <span className="badge">{item.category}</span>}
                          <span className={`badge ${item.quantity === 0 ? "badge-low" : ""}`}>
                            Qty: {item.quantity}
                          </span>
                          <span className="badge badge-home">
                            Home: {unitShort ? `${unitShort} → ` : ""}
                            {item.home_location_label || "Unassigned"}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {totalCheckedOut > 0 && (
                          <button
                            className="btn btn-sm"
                            style={{ borderColor: "#fde68a", background: "var(--warn-soft)", color: "#b45309" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCheckedOutItem(item);
                            }}
                          >
                            Checked Out ({totalCheckedOut})
                          </button>
                        )}
                        <button
                          className="btn btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoItem(item);
                          }}
                        >
                          Photo
                        </button>
                      </div>
                    </div>
                  );
                })}
                {filteredItems.length === 0 && (
                  <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                    No matching parts found.
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANE: PROJECT BUCKETS */}
            <div className="pane">
              <div className="pane-header">
                <span>Project Buckets</span>
                {!isKiosk && (
                  <button className="btn btn-sm" onClick={() => setShowNewProj((v) => !v)}>
                    + Project
                  </button>
                )}
              </div>
              <div className="pane-scroll" style={isKiosk ? { padding: 8, gap: 8 } : undefined}>
                {!isKiosk && showNewProj && (
                  <form
                    style={{ display: "flex", gap: 6 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newProjName.trim()) return;
                      onCreateProject(newProjName.trim());
                      setNewProjName("");
                      setShowNewProj(false);
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
                )}

                {data.projects.map((proj) => {
                  const bucketAllocs = data.allocations.filter(
                    (a) => a.project_id === proj.id && a.quantity > 0
                  );
                  const totalUnits = bucketAllocs.reduce((sum, a) => sum + a.quantity, 0);
                  const isExpanded = expandedProjectId === proj.id;

                  return (
                    <div
                      key={proj.id}
                      data-bucket-id={proj.id}
                      className={`bucket-card ${dropTarget === proj.id ? "drop-active" : ""} ${
                        flashedBucketId === proj.id ? "just-updated" : ""
                      }`}
                      style={{
                        borderLeft: `5px solid ${proj.color}`,
                        padding: isKiosk ? "14px 12px" : "12px",
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        setDropTarget(proj.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dropTarget !== proj.id) setDropTarget(proj.id);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setDropTarget(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const dtId = e.dataTransfer.getData("text/plain");
                        handleDropOnProject(proj.id, dtId);
                      }}
                      onClick={() => {
                        if (selectedItem) {
                          onAllocate(selectedItem.id, proj.id, 1, sourceLabel);
                          triggerBucketFlash(proj.id);
                          setSelectedItemId(null);
                        } else if (!isKiosk) {
                          setExpandedProjectId(isExpanded ? null : proj.id);
                        } else {
                          setCheckInProjId(proj.id);
                          setKioskTab("checkin");
                        }
                      }}
                    >
                      <div className="bucket-header">
                        <span>{proj.name}</span>
                        {!isKiosk && (
                          <span className="badge">
                            {bucketAllocs.length} parts ({totalUnits} units)
                          </span>
                        )}
                      </div>

                      {!isKiosk && proj.description && (
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                          {proj.description}
                        </div>
                      )}

                      {!isKiosk && bucketAllocs.length > 0 && (
                        <div className="bucket-items">
                          {(isExpanded ? bucketAllocs : bucketAllocs.slice(0, 4)).map((alloc) => {
                            const item = itemMap.get(alloc.item_id);
                            if (!item) return null;
                            return (
                              <div
                                key={alloc.item_id}
                                className="bucket-item-row"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span
                                  style={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    flex: 1,
                                  }}
                                >
                                  {item.name}
                                </span>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <button
                                    className="btn btn-sm"
                                    onClick={() => onAllocate(item.id, proj.id, -1, sourceLabel)}
                                  >
                                    -
                                  </button>
                                  <span style={{ minWidth: 22, textAlign: "center", fontWeight: 700 }}>
                                    {alloc.quantity}
                                  </span>
                                  <button
                                    className="btn btn-sm"
                                    disabled={item.quantity <= 0}
                                    onClick={() => onAllocate(item.id, proj.id, 1, sourceLabel)}
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          {!isExpanded && bucketAllocs.length > 4 && (
                            <div style={{ fontSize: 11, color: "var(--primary)", fontWeight: 600 }}>
                              +{bucketAllocs.length - 4} more (tap to expand)
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {isKiosk && kioskTab === "checkin" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, flex: 1, minHeight: 0 }}>
          <div className="pill-row">
            {data.projects.map((p) => (
              <button
                key={p.id}
                className={`pill ${activeCheckInProj?.id === p.id ? "active" : ""}`}
                onClick={() => setCheckInProjId(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>

          <div className="pane" style={{ flex: 1 }}>
            <div className="pane-header">
              <span>{activeCheckInProj?.name ?? "Select a Project Bucket"}</span>
              <span className="badge">{checkInAllocs.length} parts</span>
            </div>
            <div className="pane-scroll">
              {checkInAllocs.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                  No items currently checked out to this project bucket.
                </div>
              ) : (
                checkInAllocs.map((alloc) => {
                  const item = itemMap.get(alloc.item_id);
                  if (!item) return null;
                  return (
                    <div key={alloc.item_id} className="item-card" style={{ cursor: "default" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="item-title">{item.name}</div>
                        <div className="item-meta">
                          <span className="badge badge-home">
                            Home: {item.home_location_label || "Unassigned"}
                          </span>
                          <span className="badge">Spare left: {item.quantity}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => onAllocate(item.id, activeCheckInProj!.id, -1, sourceLabel)}
                          title="Return 1 to Home Bin"
                        >
                          -
                        </button>
                        <span style={{ minWidth: 26, textAlign: "center", fontWeight: 700 }}>
                          {alloc.quantity}
                        </span>
                        <button
                          className="btn btn-sm"
                          disabled={item.quantity <= 0}
                          onClick={() => onAllocate(item.id, activeCheckInProj!.id, 1, sourceLabel)}
                          title="Take 1 more"
                        >
                          +
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ color: "var(--danger)", borderColor: "#fecaca" }}
                          onClick={() => onConsume(item.id, activeCheckInProj!.id, 1, sourceLabel)}
                          title="Mark 1 unit as consumed/destroyed"
                        >
                          Consume 1
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
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

      {checkedOutItem && (
        <div className="modal-backdrop" onClick={() => setCheckedOutItem(null)}>
          <div className="modal-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Checked Out: {checkedOutItem.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  Home Bin: {checkedOutItem.home_location_label || "Unassigned"} • Remaining Spare Qty:{" "}
                  {itemMap.get(checkedOutItem.id)?.quantity ?? checkedOutItem.quantity}
                </div>
              </div>
              <button className="btn btn-sm" onClick={() => setCheckedOutItem(null)}>
                Close
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(allocationsByItem.get(checkedOutItem.id) ?? []).map((a) => {
                const proj = projectMap.get(a.projectId);
                return (
                  <div key={a.projectId} className="bucket-item-row" style={{ padding: "8px 10px" }}>
                    <span style={{ fontWeight: 600 }}>{proj?.name ?? a.projectId}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => onAllocate(checkedOutItem.id, a.projectId, -1, sourceLabel)}
                      >
                        -
                      </button>
                      <span style={{ fontWeight: 700, minWidth: 24, textAlign: "center" }}>
                        {a.quantity}
                      </span>
                      <button
                        className="btn btn-sm"
                        disabled={(itemMap.get(checkedOutItem.id)?.quantity ?? 0) <= 0}
                        onClick={() => onAllocate(checkedOutItem.id, a.projectId, 1, sourceLabel)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
              {(allocationsByItem.get(checkedOutItem.id) ?? []).length === 0 && (
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  All units are currently in the Home Bin.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
