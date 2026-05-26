import { useState, useEffect, useMemo } from "react";
import { C, Card, CardHeader, CardBody, Input, Select, Btn, Badge } from "./shared";
import { reportsApi } from "../../api/index.js";

const ACTION_TYPES = {
  LOGIN:         { label: "Login",           color: "blue",   symbol: "-" },
  LOGOUT:        { label: "Logout",          color: "gray",   symbol: "-" },
  CREATE_SALE:   { label: "Sale",            color: "green",  symbol: "-" },
  VOID_SALE:     { label: "Void",            color: "red",    symbol: "-" },
  CREATE_USER:   { label: "User Created",    color: "blue",   symbol: "-" },
  UPDATE_USER:   { label: "User Updated",    color: "yellow", symbol: "-" },
  DEACTIVATE_USER: { label: "User Deactivated", color: "red", symbol: "-" },
  OPEN_SHIFT:    { label: "Shift Opened",    color: "green",  symbol: "-" },
  CLOSE_SHIFT:   { label: "Shift Closed",    color: "blue",   symbol: "-" },
  RECEIVE_STOCK: { label: "Stock Received",  color: "green",  symbol: "-" },
  ADJUST_BATCH:  { label: "Stock Adjusted",  color: "yellow", symbol: "-" },
  CREATE_ITEM:   { label: "Item Created",    color: "blue",   symbol: "-" },
};

export default function AuditLogs({ currentUser }) {
  const [logs,         setLogs]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [search,       setSearch]       = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterDate,   setFilterDate]   = useState("");
  const [page,         setPage]         = useState(1);
  const PER_PAGE = 15;

  useEffect(() => {
    if (currentUser.role !== "admin") return;
    setLoading(true);
    reportsApi.auditLog({ limit: 500 })
      .then(data => {
        setLogs(data.logs || []);
        setError(null);
      })
      .catch(err => setError(err.message || "Failed to load audit log"))
      .finally(() => setLoading(false));
  }, [currentUser.role]);

  const filtered = useMemo(() => {
    return logs.filter(log => {
      const detail    = (log.payload ? JSON.stringify(log.payload) : "") + " " + (log.action || "");
      const userName  = log.user_name || "";
      const matchSearch = search === "" ||
        detail.toLowerCase().includes(search.toLowerCase()) ||
        userName.toLowerCase().includes(search.toLowerCase());
      const matchAction = filterAction === "all" || log.action === filterAction;
      const logDate   = log.created_at ? log.created_at.split("T")[0] : "";
      const matchDate = filterDate === "" || logDate === filterDate;
      return matchSearch && matchAction && matchDate;
    });
  }, [logs, search, filterAction, filterDate]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageLogs   = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const today      = new Date().toISOString().split("T")[0];

  if (currentUser.role !== "admin") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: C.textPrimary, margin: 0 }}>Audit Logs</h2>
        <div style={{ background: `${C.red}15`, borderRadius: 6, padding: 32, textAlign: "center", border: `1px solid ${C.red}30` }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.red }}>Access Restricted</div>
          <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 6 }}>Only administrators can view audit logs.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.textPrimary, margin: 0 }}>Audit Logs</h2>
          <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>Complete record of all system activity</p>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {[
          { label: "Total Events",   value: logs.length,                                                     symbol: "-" },
          { label: "Today's Events", value: logs.filter(l => (l.created_at || "").startsWith(today)).length, symbol: "-" },
          { label: "Voids",          value: logs.filter(l => l.action === "VOID_SALE").length,               symbol: "-" },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, borderRadius: 6, padding: "14px 18px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 18, color: C.accent }}>{s.symbol}</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: C.textPrimary, marginTop: 4 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <Card>
        {/* Filters */}
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search logs-" style={{ maxWidth: 240 }} />
          <Select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }} style={{ maxWidth: 220 }} options={[
            { value: "all", label: "All Actions" },
            ...Object.entries(ACTION_TYPES).map(([v, { label }]) => ({ value: v, label })),
          ]} />
          <Input value={filterDate} onChange={e => { setFilterDate(e.target.value); setPage(1); }} type="date" style={{ maxWidth: 180 }} />
          {(search || filterAction !== "all" || filterDate) && (
            <Btn variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterAction("all"); setFilterDate(""); setPage(1); }}>
              Clear
            </Btn>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: C.textMuted }}>Loading audit log-</div>
        ) : error ? (
          <div style={{ padding: 32, textAlign: "center", color: C.red, fontSize: 13 }}>{error}</div>
        ) : pageLogs.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: C.textMuted }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>No matching log entries</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Time", "User", "Action", "Details", "IP"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 600, color: C.textMuted, letterSpacing: 0.8, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageLogs.map((log, i) => {
                  const at   = ACTION_TYPES[log.action] || { label: log.action, color: "gray", symbol: "-" };
                  const ts   = log.created_at ? new Date(log.created_at) : null;
                  const date = ts ? ts.toLocaleDateString("en-KE") : "-";
                  const time = ts ? ts.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }) : "-";
                  const detail = log.payload ? JSON.stringify(log.payload).slice(0, 80) : log.entity_id || "-";
                  return (
                    <tr key={log.id} style={{ borderTop: `1px solid ${C.border}`, background: i % 2 === 0 ? C.bg : C.surface }}>
                      <td style={{ padding: "11px 16px", fontSize: 11, whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 500, color: C.textPrimary }}>{time}</div>
                        <div style={{ fontSize: 10, color: C.textMuted }}>{date}</div>
                      </td>
                      <td style={{ padding: "11px 16px", fontSize: 12, fontWeight: 600, color: C.textPrimary, whiteSpace: "nowrap" }}>
                        {log.user_name || "System"}
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        <Badge label={at.label} color={at.color} />
                      </td>
                      <td style={{ padding: "11px 16px", fontSize: 11, color: C.textSecondary, maxWidth: 300 }}>
                        {detail}
                      </td>
                      <td style={{ padding: "11px 16px", fontSize: 10, color: C.textMuted, fontFamily: "monospace" }}>
                        {log.ip_address || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>{filtered.length} entries</span>
            <div style={{ display: "flex", gap: 6 }}>
              <Btn variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>- Prev</Btn>
              <span style={{ fontSize: 12, color: C.textSecondary, alignSelf: "center", padding: "0 8px" }}>{page} / {totalPages}</span>
              <Btn variant="secondary" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next -</Btn>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
