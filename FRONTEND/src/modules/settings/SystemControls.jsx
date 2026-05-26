import { useState } from "react";
import { C, Card, CardHeader, CardBody, Toggle, Btn, Badge, ConfirmModal, Modal } from "./shared";

export default function SystemControls({ toast, currentUser }) {
  const [offlineMode, setOfflineMode] = useState(false);
  const [syncStatus, setSyncStatus] = useState("synced"); // synced | syncing | error | offline
  const [lastSync, setLastSync] = useState(new Date().toLocaleString());
  const [pendingChanges, setPendingChanges] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmResetInput, setConfirmResetInput] = useState("");
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [restoreModal, setRestoreModal] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [version] = useState("v1.0.0");
  const [lastBackup] = useState("Today at 02:30");

  const isAdmin = currentUser.role === "admin";

  const handleBackup = () => {
    setBackupInProgress(true);
    setTimeout(() => {
      setBackupInProgress(false);
      toast("Database backup completed and downloaded", "success");
    }, 2400);
  };

  const handleSync = () => {
    setSyncStatus("syncing");
    setTimeout(() => {
      setSyncStatus("synced");
      setPendingChanges(0);
      setLastSync(new Date().toLocaleString());
      toast("Data synced successfully", "success");
    }, 1800);
  };

  const handleToggleOffline = (val) => {
    setOfflineMode(val);
    setSyncStatus(val ? "offline" : "synced");
    if (val) { 
      setPendingChanges(3); 
      toast("Offline mode enabled - changes will sync when reconnected", "success"); 
    } else { 
      toast("Online mode restored", "success"); 
    }
  };

  const handleReset = () => {
    if (confirmResetInput !== "RESET") return;
    toast("System reset initiated - no data was actually deleted", "success");
    setConfirmReset(false);
    setConfirmResetInput("");
  };

  const SYNC_STATUS = {
    synced:  { color: C.green,       symbol: "-", label: "All data synced" },
    syncing: { color: C.blue,        symbol: "-", label: "Synchronising..." },
    error:   { color: C.red,         symbol: "-", label: "Sync error" },
    offline: { color: C.yellow,      symbol: "-", label: "Offline mode" },
  };

  const ss = SYNC_STATUS[syncStatus];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: C.textPrimary, margin: 0, letterSpacing: "0.5px" }}>System Controls</h2>
        <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>Backup, sync, connectivity, and system-level controls</p>
      </div>

      {/* Sync Status Panel */}
      <Card>
        <CardBody style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 6, background: `${ss.color}15`, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, color: ss.color, fontWeight: 600,
            }}>
              {ss.symbol}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: ss.color, letterSpacing: "0.3px" }}>{ss.label}</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                Last sync: {lastSync}
                {pendingChanges > 0 && <span style={{ color: C.yellow, fontWeight: 600, marginLeft: 8 }}> - {pendingChanges} pending changes</span>}
              </div>
            </div>
          </div>
          {!offlineMode && (
            <Btn variant="secondary" onClick={handleSync} disabled={syncStatus === "syncing"}>
              {syncStatus === "syncing" ? "Synchronising..." : "Sync Now"}
            </Btn>
          )}
        </CardBody>
      </Card>

      {/* Connectivity */}
      <Card>
        <CardHeader title="Connectivity" subtitle="Control online/offline behaviour" />
        <CardBody>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, letterSpacing: "0.3px" }}>Offline Mode</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>Work without internet - changes saved locally and synced when back online</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {offlineMode && <Badge label="Offline" color="yellow" />}
              <Toggle checked={offlineMode} onChange={handleToggleOffline} />
            </div>
          </div>
          <div style={{ padding: "12px 0", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: offlineMode ? C.yellow : C.green, boxShadow: `0 0 0 2px ${offlineMode ? C.yellowLight : C.greenLight}` }} />
            <span style={{ fontSize: 11, color: C.textSecondary }}>{offlineMode ? "Operating offline - Changes queue locally" : "Connected to server - Real-time sync active"}</span>
          </div>
        </CardBody>
      </Card>

      {/* Backup & Restore */}
      <Card>
        <CardHeader title="Backup & Restore" subtitle="Protect your data with regular backups" />
        <CardBody>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Backup */}
            <div style={{ background: C.greenLight, borderRadius: 6, padding: 20, border: `1px solid ${C.green}30` }}>
              <div style={{ fontSize: 28, marginBottom: 10, color: C.green }}>-</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 4, letterSpacing: "0.3px" }}>Backup Database</div>
              <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 4 }}>Download encrypted backup of all hotel data</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 16 }}>Last backup: {lastBackup}</div>
              <Btn variant="success" onClick={handleBackup} disabled={backupInProgress}>
                {backupInProgress ? "Creating backup..." : "Download Backup"}
              </Btn>
            </div>

            {/* Restore */}
            <div style={{ background: C.blueLight, borderRadius: 6, padding: 20, border: `1px solid ${C.blue}30` }}>
              <div style={{ fontSize: 28, marginBottom: 10, color: C.blue }}>-</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 4, letterSpacing: "0.3px" }}>Restore Backup</div>
              <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 4 }}>Upload backup file to restore previous data</div>
              <div style={{ fontSize: 10, color: C.yellow, marginBottom: 16, fontWeight: 500 }}>This will overwrite current data</div>
              <Btn variant="secondary" onClick={() => setRestoreModal(true)}>Choose Backup File</Btn>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Maintenance */}
      {isAdmin && (
        <Card>
          <CardHeader title="Maintenance" subtitle="Advanced system options" />
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, letterSpacing: "0.3px" }}>Maintenance Mode</div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>Temporarily locks POS and inventory - only admins can log in</div>
              </div>
              <Toggle checked={maintenanceMode} onChange={v => { setMaintenanceMode(v); toast(v ? "Maintenance mode activated" : "Maintenance mode deactivated", "success"); }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, letterSpacing: "0.3px" }}>Debug Logging</div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>Enable detailed logs for troubleshooting</div>
              </div>
              <Toggle checked={debugMode} onChange={v => { setDebugMode(v); toast(v ? "Debug logging enabled" : "Debug logging disabled", "success"); }} />
            </div>
          </CardBody>
        </Card>
      )}

      {/* System Info */}
      <Card>
        <CardHeader title="System Information" />
        <CardBody>
          {[
            ["System Version", version],
            ["Database Size", "24.6 MB"],
            ["Total Sales Records", "189"],
            ["Active Users", "5"],
            ["Active Sessions", "1"],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
              <span style={{ color: C.textSecondary }}>{label}</span>
              <span style={{ fontWeight: 500, color: C.textPrimary, fontFamily: "'Inter', monospace" }}>{value}</span>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* Danger Zone */}
      {isAdmin && (
        <Card style={{ border: `1px solid ${C.red}40` }}>
          <CardHeader title="System Reset" subtitle="Irreversible actions - proceed with extreme caution" />
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.red, letterSpacing: "0.3px" }}>Reset System</div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>Permanently delete all sales data, users, and settings. Cannot be undone.</div>
              </div>
              <Btn variant="danger" onClick={() => setConfirmReset(true)}>Reset System</Btn>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Restore Modal */}
      <Modal open={restoreModal} onClose={() => setRestoreModal(false)} title="Restore from Backup" width={440}>
        <div style={{ background: C.yellowLight, borderRadius: 4, padding: "10px 14px", fontSize: 12, color: C.yellow, fontWeight: 500, marginBottom: 16 }}>
          All current data will be replaced with the backup. This action cannot be undone.
        </div>
        <label style={{ display: "block", padding: "32px", border: `2px dashed ${C.border}`, borderRadius: 4, textAlign: "center", cursor: "pointer", fontSize: 12, color: C.textMuted }}>
          Click to choose backup file (.json or .zip)
          <input type="file" accept=".json,.zip" style={{ display: "none" }} onChange={() => { setRestoreModal(false); toast("Restore file received - demo mode, no data changed", "success"); }} />
        </label>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn variant="secondary" onClick={() => setRestoreModal(false)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal open={confirmReset} onClose={() => { setConfirmReset(false); setConfirmResetInput(""); }} title="System Reset" width={420}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 28, marginBottom: 8, color: C.red }}>!</div>
          <p style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.5, margin: 0 }}>
            This will permanently erase all sales history, users, and configuration. Type <strong>RESET</strong> below to confirm.
          </p>
        </div>
        <input value={confirmResetInput} onChange={e => setConfirmResetInput(e.target.value)}
          placeholder="Type RESET to confirm" style={{ width: "100%", padding: "10px 14px", borderRadius: 4, border: `1px solid ${C.red}`, fontSize: 13, fontWeight: 600, textAlign: "center", outline: "none", marginBottom: 16, fontFamily: "'Inter', monospace", boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="secondary" onClick={() => { setConfirmReset(false); setConfirmResetInput(""); }} style={{ flex: 1 }}>Cancel</Btn>
          <Btn variant="danger" onClick={handleReset} disabled={confirmResetInput !== "RESET"} style={{ flex: 1 }}>Confirm Reset</Btn>
        </div>
      </Modal>
    </div>
  );
}