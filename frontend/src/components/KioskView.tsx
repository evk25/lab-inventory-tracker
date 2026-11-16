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
  return (
    <div className="kiosk-shell">
      <div className="topbar" style={{ padding: "8px 12px" }}>
        <div className="topbar-title" style={{ fontSize: 15 }}>
          <span>Shelf Kiosk</span>
          <span className="badge">Quadrotor Lab</span>
        </div>
        <button className="btn btn-sm" onClick={() => onSwitchMode("portal")}>
          Open Wiki Portal
        </button>
      </div>

      <PartTransferWorkspace
        variant="kiosk"
        sourceLabel="Kiosk"
        data={data}
        onAllocate={onAllocate}
        onConsume={onConsume}
        onCreateProject={onCreateProject}
      />
    </div>
  );
}
