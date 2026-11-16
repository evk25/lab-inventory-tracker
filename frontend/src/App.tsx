import { useEffect, useState } from "react";
import type { BootstrapData, JournalEntry } from "./types";
import { KioskView } from "./components/KioskView";
import { PortalView } from "./components/PortalView";

function detectMode(): "kiosk" | "portal" {
  return window.location.pathname.startsWith("/kiosk") ? "kiosk" : "portal";
}

function getWikiSource(): string {
  const params = new URLSearchParams(window.location.search);
  const discordName = params.get("discord_user");
  return discordName ? `Wiki (${discordName})` : "Wiki (not connected)";
}

export function App() {
  const [mode, setMode] = useState<"kiosk" | "portal">(detectMode);
  const [wikiSource] = useState<string>(getWikiSource);
  const [data, setData] = useState<BootstrapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    undo?: () => void;
  } | null>(null);

  useEffect(() => {
    const onPop = () => setMode(detectMode());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    fetch("/api/bootstrap")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((payload: BootstrapData) => setData(payload))
      .catch((err) => setError(String(err)));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const switchMode = (next: "kiosk" | "portal") => {
    const nextPath = next === "kiosk" ? "/kiosk/" : "/portal/";
    window.history.pushState({}, "", nextPath);
    setMode(next);
  };

  const handleAllocate = (itemId: string, projectId: string, delta: number, source: string) => {
    if (!data || delta === 0) return;
    const item = data.items.find((i) => i.id === itemId);
    const proj = data.projects.find((p) => p.id === projectId);
    if (!item || !proj) return;

    const existingAlloc = data.allocations.find(
      (a) => a.item_id === itemId && a.project_id === projectId
    )?.quantity ?? 0;

    const actualDelta =
      delta > 0 ? Math.min(delta, item.quantity) : -Math.min(Math.abs(delta), existingAlloc);
    if (actualDelta === 0) {
      setToast({
        message: delta > 0 ? `No spare "${item.name}" left in Home Bin` : `None left in ${proj.name}`,
      });
      return;
    }

    const newStock = item.quantity - actualDelta;
    const newAlloc = existingAlloc + actualDelta;
    const action = actualDelta > 0 ? "CHECK_OUT" : "CHECK_IN";
    const moveQty = Math.abs(actualDelta);

    const optimisticEntry: JournalEntry = {
      id: Date.now(),
      item_id: itemId,
      item_name: item.name,
      action,
      source,
      from_location: actualDelta > 0 ? `Home Bin (${item.home_location_label || "Unassigned"})` : `Project: ${proj.name}`,
      to_location: actualDelta > 0 ? `Project: ${proj.name}` : `Home Bin (${item.home_location_label || "Unassigned"})`,
      quantity: moveQty,
      created_at: new Date().toISOString().replace("T", " ").slice(0, 19),
    };

    setData((prev) => {
      if (!prev) return prev;
      const filteredAllocs = prev.allocations.filter(
        (a) => !(a.item_id === itemId && a.project_id === projectId)
      );
      const nextAllocs =
        newAlloc > 0
          ? [...filteredAllocs, { item_id: itemId, project_id: projectId, quantity: newAlloc }]
          : filteredAllocs;
      return {
        ...prev,
        items: prev.items.map((i) => (i.id === itemId ? { ...i, quantity: newStock } : i)),
        allocations: nextAllocs,
        journal: [optimisticEntry, ...prev.journal],
      };
    });

    setToast({
      message:
        actualDelta > 0
          ? `Moved ${moveQty} × "${item.name}" to ${proj.name}`
          : `Returned ${moveQty} × "${item.name}" to Home Bin`,
      undo: () => handleAllocate(itemId, projectId, -actualDelta, source),
    });

    fetch(`/api/items/${itemId}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, delta: actualDelta, source }),
    }).catch((err) => console.error("Allocate sync error:", err));
  };

  const handleConsume = (itemId: string, projectId: string, quantity: number, source: string) => {
    if (!data || quantity <= 0) return;
    const item = data.items.find((i) => i.id === itemId);
    const proj = data.projects.find((p) => p.id === projectId);
    const existingAlloc =
      data.allocations.find((a) => a.item_id === itemId && a.project_id === projectId)?.quantity ?? 0;
    if (!item || !proj || existingAlloc <= 0) return;

    const consumeQty = Math.min(quantity, existingAlloc);
    const newAlloc = existingAlloc - consumeQty;

    const optimisticEntry: JournalEntry = {
      id: Date.now(),
      item_id: itemId,
      item_name: item.name,
      action: "CONSUMED",
      source,
      from_location: `Project: ${proj.name}`,
      to_location: "Consumed / Destroyed",
      quantity: consumeQty,
      created_at: new Date().toISOString().replace("T", " ").slice(0, 19),
    };

    setData((prev) => {
      if (!prev) return prev;
      const filtered = prev.allocations.filter(
        (a) => !(a.item_id === itemId && a.project_id === projectId)
      );
      const nextAllocs =
        newAlloc > 0
          ? [...filtered, { item_id: itemId, project_id: projectId, quantity: newAlloc }]
          : filtered;
      return {
        ...prev,
        allocations: nextAllocs,
        journal: [optimisticEntry, ...prev.journal],
      };
    });

    setToast({ message: `Marked ${consumeQty} × "${item.name}" as consumed from ${proj.name}` });

    fetch(`/api/items/${itemId}/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, quantity: consumeQty, source }),
    }).catch((err) => console.error("Consume sync error:", err));
  };

  const handleUpdateProject = async (
    projectId: string,
    payload: { name?: string; description?: string; owner?: string; members?: string }
  ) => {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return;
    const { project } = await res.json();
    setData((prev) =>
      prev
        ? { ...prev, projects: prev.projects.map((p) => (p.id === projectId ? project : p)) }
        : prev
    );
    setToast({ message: `Updated "${project.name}" metadata` });
  };

  const handleUpdateItem = async (
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
  ) => {
    const res = await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, source: wikiSource }),
    });
    if (!res.ok) return;
    const { item, journal_entry } = await res.json();
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((i) => (i.id === itemId ? item : i)),
            journal: journal_entry ? [journal_entry, ...prev.journal] : prev.journal,
          }
        : prev
    );
    setToast({ message: `Updated "${item.name}"` });
  };

  const handleCreateItem = async (payload: {
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
  }) => {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return;
    const { item, journal_entry } = await res.json();
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: [item, ...prev.items],
            journal: [journal_entry, ...prev.journal],
          }
        : prev
    );
    setToast({ message: `Added "${item.name}" to Home Bin` });
  };

  const handleCreateProject = async (name: string) => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const { project } = await res.json();
    setData((prev) => (prev ? { ...prev, projects: [...prev.projects, project] } : prev));
    setToast({ message: `Created project bucket "${project.name}"` });
  };

  const handleDeleteProject = async (projectId: string, mode: "return" | "consume") => {
    const projName = data?.projects.find((p) => p.id === projectId)?.name ?? "Project";
    const params = new URLSearchParams({ mode, source: wikiSource });
    const res = await fetch(`/api/projects/${projectId}?${params.toString()}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    const { updated_items, journal_entries } = await res.json();
    const updatedMap = new Map<string, (typeof updated_items)[number]>();
    updated_items.forEach((it: (typeof updated_items)[number]) => updatedMap.set(it.id, it));

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        projects: prev.projects.filter((p) => p.id !== projectId),
        allocations: prev.allocations.filter((a) => a.project_id !== projectId),
        items: prev.items.map((i) => updatedMap.get(i.id) ?? i),
        journal: [...journal_entries, ...prev.journal],
      };
    });

    setToast({
      message:
        mode === "consume"
          ? `Deleted "${projName}" (items marked consumed / removed from spare tracking)`
          : `Deleted "${projName}" and returned items to Home Bins`,
    });
  };

  const handleCreateBinTag = async (shelfId: string, label: string, xPct: number, yPct: number) => {
    const res = await fetch(`/api/shelves/${shelfId}/bins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, x_pct: xPct, y_pct: yPct }),
    });
    if (!res.ok) return;
    const { bin_tag } = await res.json();
    setData((prev) => (prev ? { ...prev, bin_tags: [...prev.bin_tags, bin_tag] } : prev));
    setToast({ message: `Tagged bin "${bin_tag.label}"` });
  };

  const handleCreateStorageUnit = async (payload: {
    name: string;
    unit_type: string;
    map_x: number;
    map_y: number;
    image_data_url: string | null;
  }) => {
    const res = await fetch("/api/storage-units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return;
    const { storage_unit, shelf } = await res.json();
    setData((prev) =>
      prev
        ? {
            ...prev,
            storage_units: [...prev.storage_units, storage_unit],
            shelves: [...prev.shelves, shelf],
          }
        : prev
    );
    setToast({ message: `Added "${storage_unit.name}" to Lab Floorplan` });
  };

  if (error) {
    return (
      <div style={{ padding: 32, color: "var(--danger)" }}>
        Failed to load inventory: {error}
      </div>
    );
  }

  if (!data) {
    return <div style={{ padding: 32, color: "var(--muted)" }}>Loading Lab Inventory...</div>;
  }

  return (
    <>
      {mode === "kiosk" ? (
        <KioskView
          data={data}
          onAllocate={handleAllocate}
          onConsume={handleConsume}
          onCreateProject={handleCreateProject}
          onSwitchMode={switchMode}
        />
      ) : (
        <PortalView
          data={data}
          wikiSource={wikiSource}
          onAllocate={handleAllocate}
          onConsume={handleConsume}
          onUpdateItem={handleUpdateItem}
          onCreateItem={handleCreateItem}
          onCreateBinTag={handleCreateBinTag}
          onCreateStorageUnit={handleCreateStorageUnit}
          onCreateProject={handleCreateProject}
          onUpdateProject={handleUpdateProject}
          onDeleteProject={handleDeleteProject}
          onSwitchMode={switchMode}
        />
      )}

      {toast && (
        <div className="toast">
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              className="btn btn-sm"
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </>
  );
}
