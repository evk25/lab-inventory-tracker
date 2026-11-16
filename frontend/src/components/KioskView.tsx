import { useState } from "react";
import type { BootstrapData } from "../types";
import { PartTransferWorkspace } from "./PartTransferWorkspace";

interface Props {
  data: BootstrapData;
  onAllocate: (itemId: string, projectId: string, delta: number, source: string) => void;
  onConsume: (itemId: string, projectId: string, quantity: number, source: string) => void;
  onCreateProject: (name: string) => void;
  onSwitchMode: (mode: "kiosk" | "portal") => void;
}

export function KioskView({
  data,
  onAllocate,
  onConsume,
  onCreateProject,
  onSwitchMode,
}: Props) {
  const [kioskTab, setKioskTab] = useState<"checkout" | "checkin">("checkout");

  return (
    <div className="kiosk-shell">
      <div className="topbar" style={{ padding: "6px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div
            className="topbar-title"
            style={{
              fontSize: 14,
              background: "#e2e8f0",
              color: "#0f172a",
              border: "1px solid #cbd5e1",
              padding: "6px 12px",
              borderRadius: 0,
            }}
          >
            <span>Shelf Kiosk</span>
            <span
              className="badge"
              style={{
                background: "#f8fafc",
                borderColor: "#cbd5e1",
                color: "#475569",
                fontSize: 11,
                borderRadius: 0,
              }}
            >
              Quadrotor Lab
            </span>
          </div>

          <div style={{ display: "flex", gap: 4 }}>
            <button
              className={`tab-btn ${kioskTab === "checkout" ? "active" : ""}`}
              style={{ padding: "6px 12px" }}
              onClick={() => setKioskTab("checkout")}
            >
              Check Out
            </button>
            <button
              className={`tab-btn ${kioskTab === "checkin" ? "active" : ""}`}
              style={{ padding: "6px 12px" }}
              onClick={() => setKioskTab("checkin")}
            >
              Check In / Manage Bucket
            </button>
          </div>
        </div>

        <button className="btn btn-sm" onClick={() => onSwitchMode("portal")}>
          Open Wiki Portal
        </button>
      </div>

      <PartTransferWorkspace
        variant="kiosk"
        sourceLabel="Kiosk"
        data={data}
        kioskTab={kioskTab}
        onKioskTabChange={setKioskTab}
        onAllocate={onAllocate}
        onConsume={onConsume}
        onCreateProject={onCreateProject}
      />
    </div>
  );
}
