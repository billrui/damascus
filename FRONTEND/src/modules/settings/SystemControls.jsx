import { useState } from "react";
import { C, Card, CardHeader, CardBody, Btn } from "./shared";
import { reportsApi } from "../../api/index.js";

export default function SystemControls({ toast, currentUser }) {
  const [backupInProgress, setBackupInProgress] = useState(false);
  const isAdmin = currentUser.role === "admin";

  const handleBackup = async () => {
    setBackupInProgress(true);
    try {
      const blob = await reportsApi.backup();
      // Server may return a JSON error as a blob (e.g. pg_dump missing)
      if (blob.type && blob.type.includes("application/json")) {
        const text = await blob.text();
        let msg = "Backup failed";
        try { msg = JSON.parse(text).error || msg; } catch {}
        toast(msg, "error");
        return;
      }
      const stamp = new Date().toISOString().replace(/[:T]/g, "-").replace(/\..+/, "");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `damascus_backup_${stamp}.sql`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Backup downloaded successfully", "success");
    } catch (e) {
      toast(e?.response?.data?.error || e?.message || "Backup failed", "error");
    } finally {
      setBackupInProgress(false);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ background: "#FEF9E7", border: "1px solid #F0D98C", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#8A6D1B" }}>
          Only administrators can access System Controls.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: C.textPrimary, margin: 0, letterSpacing: "0.5px" }}>System Controls</h2>
        <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>Back up your data and view system information</p>
      </div>

      <Card>
        <CardHeader title="Backup Database" subtitle="Download a complete copy of all your hotel data" />
        <CardBody>
          <div style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.6, marginBottom: 16 }}>
            This saves everything &mdash; sales, stock, staff, settings, and history &mdash; as a single <strong>.sql</strong> file on this computer. Keep it somewhere safe (a USB drive or a cloud folder). If anything ever goes wrong, this file can rebuild your whole system.
          </div>
          <Btn variant="primary" onClick={handleBackup} disabled={backupInProgress}>
            {backupInProgress ? "Preparing backup\u2026" : "Download Backup Now"}
          </Btn>
          <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 10 }}>
            Do this at the end of each day, or at least once a week.
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="System Information" />
        <CardBody>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0" }}>
            <span style={{ color: C.textSecondary }}>System</span>
            <span style={{ color: C.textPrimary, fontWeight: 600 }}>Damascus Hotel POS</span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
