import type { BinTag, Item, Shelf, StorageUnit } from "../types";

interface Props {
  item: Item;
  binTags: BinTag[];
  shelves: Shelf[];
  storageUnits: StorageUnit[];
  onClose: () => void;
}

export function ShelfPhotoModal({ item, binTags, shelves, storageUnits, onClose }: Props) {
  const bin = binTags.find((b) => b.id === item.home_bin_tag_id);
  const shelf = bin ? shelves.find((s) => s.id === bin.shelf_id) : undefined;
  const unit = shelf ? storageUnits.find((u) => u.id === shelf.storage_unit_id) : undefined;
  const photoUrl = shelf?.photo_url || unit?.photo_url || null;
  const siblingBins = shelf ? binTags.filter((b) => b.shelf_id === shelf.id) : [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{item.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {unit?.name ?? "Lab Storage"} &rarr; {shelf?.label ?? "Shelf"} &rarr;{" "}
              <strong>{bin?.label ?? item.home_location_label}</strong>
            </div>
          </div>
          <button className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        {photoUrl ? (
          <div className="photo-stage">
            <img src={photoUrl} alt={shelf?.label ?? "Shelf"} />
            {siblingBins.map((b) => (
              <div
                key={b.id}
                className={`bin-overlay ${b.id === bin?.id ? "highlight" : ""}`}
                style={{ left: `${b.x_pct}%`, top: `${b.y_pct}%` }}
              >
                {b.label}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", border: "1px dashed var(--border)", borderRadius: 8 }}>
            No shelf photo attached yet for this bin. You can upload/tag one in the Portal.
          </div>
        )}
      </div>
    </div>
  );
}
