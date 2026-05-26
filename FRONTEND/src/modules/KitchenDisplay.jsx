import React, { useState, useEffect } from "react";
import { T } from "../posTheme";
import { fmt } from "../utils";
import { useSocket, getSocket } from "../hooks/useSocket.js";

function safeItems(items) {
  if (Array.isArray(items)) return items;
  try { return JSON.parse(items || "[]"); } catch { return []; }
}



// Normalize hold from backend (snake_case → camelCase, items parsed)
function normalizeHold(h) {
  const items = safeItems(h.items);
  const seats = [...new Set(
    items
      .map(i => { const m = (i.note || "").match(/^\[([^\]]+)\]/); return m ? m[1] : null; })
      .filter(Boolean)
  )];
  return {
    ...h,
    id:          String(h.id),
    table:       h.table       ?? h.table_no    ?? "Walk-in",
    waiter:      h.waiter      ?? h.waiter_name ?? "Staff",
    createdDate: h.createdDate ?? (h.created_at
      ? new Date(h.created_at).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })
      : new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })),
    items,
    seats,
  };
}


// --- Helpers ------------------------------------------------------------------
function elapsedMinutes(createdDate) {
  // createdDate is stored as a time string like "14:32" - compare against now
  const now  = new Date();
  const [h, m] = (createdDate || "00:00").split(":").map(Number);
  const then = new Date();
  then.setHours(h, m, 0, 0);
  const diff = Math.floor((now - then) / 60000);
  return Math.max(0, diff);
}

function urgencyColor(mins) {
  if (mins >= 20) return "#8B3A3A"; // burgundy - very late
  if (mins >= 12) return "#B8860B"; // dark goldenrod - getting late
  return "#2E7D64";                  // deep teal - fine
}

function urgencyLabel(mins) {
  if (mins >= 20) return "CRITICAL";
  if (mins >= 12) return "DELAYED";
  return "ON TRACK";
}

const STATION_COLORS = {
  hot:    { bg:"#1A1515", border:"#8B3A3A", label:"Hot Kitchen",  text:"#8B3A3A"  },
  cold:   { bg:"#151A24", border:"#C5A059", label:"Cold Station",  text:"#C5A059"  },
  grill:  { bg:"#1A1810", border:"#B8860B", label:"Grill",        text:"#B8860B"  },
  bar:    { bg:"#18151A", border:"#C5A059", label:"Bar",           text:"#C5A059"  },
  pastry: { bg:"#151A15", border:"#2E7D64", label:"Pastry",        text:"#2E7D64"  },
  all:    { bg:T.surface, border:T.border,  label:"All Stations",    text:T.textPrimary },
};

// Category - station mapping
const CATEGORY_STATION = {
  mains:      "hot",
  starters:   "hot",
  soups:      "hot",
  grills:     "grill",
  salads:     "cold",
  desserts:   "pastry",
  beverages:  "bar",
  cocktails:  "bar",
  wines:      "bar",
};
const itemStation = (item) => CATEGORY_STATION[item.category] || "hot";

// --- Ticker (live clock shown on KDS) ----------------------------------------
function Ticker() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{ 
      fontSize: 12, 
      color: T.textMuted, 
      fontVariantNumeric: "tabular-nums",
      fontFamily: "'Inter', monospace",
    }}>
      {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}

// --- Order Card ---------------------------------------------------------------
function OrderCard({ hold, onBump, onRecall }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000); // re-render every 30s
    return () => clearInterval(id);
  }, []);

  const mins   = elapsedMinutes(hold.createdDate);
  const uColor = urgencyColor(mins);
  const uLabel = urgencyLabel(mins);
  const isBumped = hold.status === "bumped";

  return (
    <div style={{
      background: isBumped ? "#0A0E1A" : T.card,
      border: `1px solid ${isBumped ? T.border : uColor}`,
      borderTop: `3px solid ${isBumped ? T.border : uColor}`,
      borderRadius: 6, 
      overflow: "hidden",
      opacity: isBumped ? 0.6 : 1,
      transition: "all 0.2s ease",
      boxShadow: mins >= 12 && !isBumped ? `0 2px 8px ${uColor}30` : "none",
    }}>
      {/* Card header — one standalone card per person */}
      <div style={{
        background: isBumped ? T.surface : `${uColor}10`,
        padding: "10px 14px",
        borderBottom: `1px solid ${isBumped ? T.border : `${uColor}30`}`,
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            {/* Table pill — same style as waiter active table */}
            <div style={{
              padding:"4px 10px", borderRadius:5, fontSize:11, fontWeight:700,
              border:`1px solid ${isBumped ? T.border : uColor}`,
              background: isBumped ? T.card : uColor,
              color: isBumped ? T.textMuted : "#0A0E1A",
            }}>
              {hold.table === "WALK-IN" ? "WALK" : hold.table}
            </div>
            {/* Person pill — same style as waiter active P tab */}
            {hold._seat && (
              <div style={{
                padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:700,
                border:`1px solid ${isBumped ? T.border : uColor}`,
                background: isBumped ? "transparent" : `${uColor}20`,
                color: isBumped ? T.textMuted : uColor,
              }}>
                {hold._seat}
              </div>
            )}
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:9, fontWeight:600, color: isBumped ? T.textMuted : uColor }}>{uLabel}</div>
            <div style={{ fontSize:18, fontWeight:800, color: isBumped ? T.textMuted : uColor, fontFamily:"monospace", lineHeight:1 }}>{mins}m</div>
          </div>
        </div>
        <div style={{ fontSize:9, fontWeight:700, color:T.textMuted }}>
          WAITER: <span style={{ color:"#7EB8F7" }}>{hold.waiter}</span>
          <span style={{ fontWeight:400, marginLeft:6 }}>· {hold.createdDate}</span>
        </div>
      </div>
      {/* Items — flat list, already filtered to this person */}
      <div style={{ padding:"8px 14px 4px" }}>
        {safeItems(hold.items).map((item, i) => {
          const raw = item.cleanNote || (item.note ? item.note.replace(/^\[[^\]]+\]\s*/, "").trim() : "");
          return (
            <div key={i} style={{
              display:"flex", alignItems:"flex-start", gap:8, padding:"5px 0",
              borderBottom: i < safeItems(hold.items).length-1 ? `1px solid ${T.border}55` : "none",
            }}>
              <span style={{ fontSize:13, minWidth:24, fontWeight:700, color: isBumped ? T.textMuted : "#C5A059" }}>
                {item.qty}×
              </span>
              <div style={{ flex:1 }}>
                <span style={{ fontSize:12, fontWeight:600, color: isBumped ? T.textMuted : T.textPrimary }}>
                  {item.name}
                </span>
                {raw && <div style={{ fontSize:9, color:"#B8860B", fontStyle:"italic", marginTop:2 }}>{raw}</div>}
              </div>
            </div>
          );
        })}
      </div>
      {/* Actions */}
      <div style={{ padding: "10px 16px 14px", display: "flex", gap: 8 }}>
        {!isBumped ? (
          <button 
            onClick={() => onBump(hold.id)}
            style={{ 
              flex: 1, 
              padding: "12px", 
              borderRadius: 4, 
              border: "none", 
              cursor: "pointer",
              background: uColor, 
              color: uColor === "#B8860B" ? "#1A1A1A" : "#FFFFFF",
              fontWeight: 700, 
              fontSize: 13, 
              fontFamily: T.font, 
              letterSpacing: "0.5px",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            - FOOD READY - WAITER COLLECTING
          </button>
        ) : (
          <button 
            onClick={() => onRecall(hold.id)}
            style={{ 
              flex: 1, 
              padding: "10px", 
              borderRadius: 4, 
              border: `1px solid ${T.border}`, 
              cursor: "pointer",
              background: T.card, 
              color: T.textMuted, 
              fontWeight: 500, 
              fontSize: 11, 
              fontFamily: T.font,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = T.hover;
              e.currentTarget.style.color = T.textPrimary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = T.card;
              e.currentTarget.style.color = T.textMuted;
            }}
          >
            Recall Order
          </button>
        )}
      </div>
    </div>
  );
}


// --- Table Card — one card per table, each person independently bumpable -----
function TableCard({ table, holds, onBump, onRecall, onCancel }) {
  // Build per-seat order map — merge items from multiple holds for same seat
  const seatMap   = {};   // { P1: { items:[], holds:Set } }
  const seatOrder = [];

  holds.forEach(h => {
    const items = safeItems(h.items);
    items.forEach(item => {
      const m    = (item.note || "").match(/^\[([^\]]+)\]\s*/);
      const seat = m ? m[1] : "P1";
      if (!seatMap[seat]) { seatMap[seat] = { items:[], holdIds:[] }; seatOrder.push(seat); }
      seatMap[seat].items.push({
        ...item,
        cleanNote: item.note ? item.note.replace(/^\[[^\]]+\]\s*/, "").trim() : "",
        holdId: h.id,
      });
      if (!seatMap[seat].holdIds.includes(h.id)) seatMap[seat].holdIds.push(h.id);
    });
  });

  // Per-seat done state — independent
  const [doneSeat, setDoneSeat] = React.useState({});

  const markSeatDone = (seat) => {
    const next = { ...doneSeat, [seat]: true };
    setDoneSeat(next);
    // bump the holds that belong to this seat
    seatMap[seat]?.holdIds.forEach(hid => {
      // only bump if all seats from that hold are done
      const holdSeats = seatOrder.filter(s => seatMap[s]?.holdIds.includes(hid));
      const allHoldDone = holdSeats.every(s => next[s]);
      if (allHoldDone) onBump(hid);
    });
  };

  const recallSeat = (seat) => {
    setDoneSeat(prev => ({ ...prev, [seat]: false }));
    seatMap[seat]?.holdIds.forEach(hid => onRecall(hid));
  };

  const mins      = holds.length ? elapsedMinutes(holds[0].createdDate) : 0;
  const uColor    = urgencyColor(mins);
  const uLabel    = urgencyLabel(mins);
  const waiter    = holds[0]?.waiter || "Staff";
  const created   = holds[0]?.createdDate || "";
  const allDone   = seatOrder.length > 0 && seatOrder.every(s => doneSeat[s]);

  return (
    <div style={{
      background: allDone ? "#0A0E1A" : T.card,
      border: `1px solid ${allDone ? T.border : uColor}`,
      borderTop: `3px solid ${allDone ? T.border : uColor}`,
      borderRadius: 6,
      overflow: "hidden",
      opacity: allDone ? 0.65 : 1,
      boxShadow: mins >= 12 && !allDone ? `0 2px 12px ${uColor}35` : "none",
    }}>

      {/* ── Table header ── */}
      <div style={{
        background: allDone ? T.surface : `${uColor}10`,
        padding: "10px 14px",
        borderBottom: `1px solid ${allDone ? T.border : `${uColor}30`}`,
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
          {/* Table pill */}
          <div style={{
            padding:"4px 14px", borderRadius:5, fontSize:14, fontWeight:800,
            background: allDone ? T.card : uColor,
            color: allDone ? T.textMuted : "#0A0E1A",
            border: `1px solid ${allDone ? T.border : uColor}`,
            letterSpacing:"0.5px",
          }}>
            {table === "WALK-IN" ? "WALK-IN" : table}
          </div>
          {/* Timer + Cancel */}
          <div style={{ textAlign:"right", display:"flex", alignItems:"flex-start", gap:8 }}>
            <div>
              <div style={{ fontSize:9, fontWeight:600, color: allDone ? T.textMuted : uColor }}>{uLabel}</div>
              <div style={{ fontSize:20, fontWeight:800, color: allDone ? T.textMuted : uColor, fontFamily:"monospace", lineHeight:1.1 }}>{mins}m</div>
            </div>
            {/* Cancel whole table */}
            <button
              onClick={() => holds.forEach(h => onCancel(h.id))}
              title="Cancel entire table order"
              style={{
                background:"transparent", border:`1px solid ${T.border}`,
                borderRadius:4, color:T.textMuted, cursor:"pointer",
                fontSize:14, lineHeight:1, padding:"2px 6px", marginTop:2,
              }}
            >✕</button>
          </div>
        </div>

        {/* Waiter */}
        <div style={{ fontSize:9, color:T.textMuted, marginBottom:6 }}>
          WAITER: <span style={{ color:"#7EB8F7", fontWeight:700 }}>{waiter}</span>
          <span style={{ marginLeft:6, fontWeight:400 }}>· {created}</span>
        </div>

        {/* Person pills — clickable to scroll to that section, strikethrough when done */}
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {seatOrder.map(seat => (
            <span key={seat} style={{
              padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:700,
              border:`1px solid ${doneSeat[seat] ? T.border : uColor}`,
              background: doneSeat[seat] ? "transparent" : `${uColor}20`,
              color: doneSeat[seat] ? T.textMuted : uColor,
              textDecoration: doneSeat[seat] ? "line-through" : "none",
              transition:"all .2s",
            }}>
              {seat}
            </span>
          ))}
        </div>
      </div>

      {/* ── Per-person sections — fully independent ── */}
      {seatOrder.map((seat, si) => {
        const isDone  = !!doneSeat[seat];
        const items   = seatMap[seat]?.items || [];
        const total   = items.reduce((s,i) => s + i.price * i.qty, 0);

        return (
          <div key={seat} style={{
            borderTop: `1px solid ${T.border}`,
            background: isDone ? T.surface : "transparent",
            transition: "background .2s",
          }}>
            {/* Person row header */}
            <div style={{
              display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"8px 14px 4px",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                {/* Person pill — solid when active, faded when done */}
                <span style={{
                  padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:700,
                  background: isDone ? "transparent" : uColor,
                  color: isDone ? T.textMuted : "#0A0E1A",
                  border: `1px solid ${isDone ? T.border : uColor}`,
                }}>
                  {seat}
                </span>
                <span style={{ fontSize:9, color:T.textMuted }}>
                  {items.length} item{items.length !== 1 ? "s" : ""}
                  {isDone && <span style={{ color:T.green, marginLeft:4 }}>✓ done</span>}
                </span>
              </div>

              {/* DONE / Recall button */}
              {!isDone ? (
                <button onClick={() => markSeatDone(seat)} style={{
                  padding:"5px 14px", borderRadius:4, border:"none", cursor:"pointer",
                  background: uColor,
                  color: "#0A0E1A",
                  fontWeight:700, fontSize:11, fontFamily:T.font,
                  letterSpacing:"0.3px",
                }}>
                  ✓ DONE
                </button>
              ) : (
                <button onClick={() => recallSeat(seat)} style={{
                  padding:"4px 10px", borderRadius:4,
                  border:`1px solid ${T.border}`,
                  background:"transparent", color:T.textMuted,
                  fontWeight:600, fontSize:10, fontFamily:T.font, cursor:"pointer",
                }}>
                  Recall
                </button>
              )}
            </div>

            {/* Items — normal (already prepared) struck through, EXTRA highlighted */}
            <div style={{ padding:"2px 14px 10px", opacity: isDone ? 0.5 : 1 }}>
              {(() => {
                const normal = items.filter(i => !(i.note||"").includes("[EXTRA]"));
                const extras = items.filter(i => (i.note||"").includes("[EXTRA]"));
                return (
                  <>
                    {/* Already prepared — shown faded/strikethrough when extras exist */}
                    {normal.map((item, i) => {
                      const note = item.cleanNote || "";
                      return (
                        <div key={i} style={{
                          display:"flex", alignItems:"flex-start", gap:8, padding:"3px 0",
                          borderBottom: i < normal.length-1 ? `1px solid ${T.border}33` : "none",
                          opacity: extras.length > 0 ? 0.3 : 1,
                          textDecoration: extras.length > 0 ? "line-through" : "none",
                        }}>
                          <span style={{ fontSize:12, minWidth:24, fontWeight:700, color: isDone ? T.textMuted : "#C5A059" }}>
                            {item.qty}×
                          </span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12, fontWeight:600, color: isDone ? T.textMuted : T.textPrimary }}>
                              {item.name}
                            </div>
                            {note && <div style={{ fontSize:9, color:"#B8860B", fontStyle:"italic" }}>{note}</div>}
                          </div>
                          <span style={{ fontSize:10, color:T.textMuted }}>{fmt(item.price * item.qty)}</span>
                        </div>
                      );
                    })}
                    {/* NEW additions — highlighted with border and NEW badge */}
                    {extras.length > 0 && (
                      <div style={{ marginTop: normal.length > 0 ? 6 : 0, borderTop: normal.length > 0 ? `2px dashed ${uColor}` : "none", paddingTop: normal.length > 0 ? 6 : 0 }}>
                        {normal.length > 0 && (
                          <div style={{ fontSize:9, fontWeight:800, color:uColor, marginBottom:4, letterSpacing:"0.5px" }}>
                            ⚡ NEW ADDITIONS ONLY
                          </div>
                        )}
                        {extras.map((item, i) => {
                          const note = (item.cleanNote || item.note || "").replace("[EXTRA]","").trim();
                          return (
                            <div key={i} style={{
                              display:"flex", alignItems:"flex-start", gap:8, padding:"5px 0",
                              borderBottom: i < extras.length-1 ? `1px solid ${T.border}55` : "none",
                              background: `${uColor}10`, borderRadius:4, paddingLeft:6,
                            }}>
                              <span style={{ fontSize:13, minWidth:24, fontWeight:800, color: uColor }}>
                                {item.qty}×
                              </span>
                              <div style={{ flex:1 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                  <span style={{ fontSize:12, fontWeight:700, color: T.textPrimary }}>
                                    {item.name}
                                  </span>
                                  <span style={{ fontSize:8, fontWeight:800, padding:"1px 5px", borderRadius:4, background:uColor, color:"#0A0E1A" }}>
                                    NEW
                                  </span>
                                </div>
                                {note && <div style={{ fontSize:9, color:"#B8860B", fontStyle:"italic", marginTop:2 }}>{note}</div>}
                              </div>
                              <span style={{ fontSize:10, color:T.textMuted }}>{fmt(item.price * item.qty)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

          </div>
        );
      })}

      {/* ── Footer: Recall whole table when all done ── */}
      {allDone && (
        <div style={{ padding:"10px 14px" }}>
          <button
            onClick={() => holds.forEach(h => onRecall(h.id))}
            style={{
              width:"100%", padding:"10px", borderRadius:4,
              border:`1px solid ${T.border}`,
              background:T.card, color:T.textMuted,
              fontWeight:600, fontSize:12, fontFamily:T.font, cursor:"pointer",
            }}
          >
            ↩ Recall Table {table}
          </button>
        </div>
      )}
    </div>
  );
}


// --- MAIN KDS COMPONENT -------------------------------------------------------
export default function KitchenDisplay({ holdList, setHoldList }) {
  const [station,    setStation]    = useState("all");
  const [showBumped, setShowBumped] = useState(false);
  const [tick,       setTick]       = useState(0);

  // Live orders from waiter via Socket.IO
  useSocket({
    "hold:created": (hold) => setHoldList(prev => [normalizeHold(hold), ...prev]),
    "hold:updated": (hold) => setHoldList(prev => prev.map(h => String(h.id) === String(hold.id) ? normalizeHold(hold) : h)),
    "hold:deleted": ({ id }) => setHoldList(prev => prev.filter(h => String(h.id) !== String(id))),
  });

  // Re-render every 60s to keep elapsed times fresh
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const holds = (holdList || []);

  // Group holds by table — one card per table, persons inside
  const tableGroups = (() => {
    const filtered = holds.filter(h => {
      const matchBumped = showBumped ? true : h.status !== "bumped";
      return (h.status === "pending" || h.status === "bumped") && matchBumped;
    });
    const map = {};
    const order = [];
    filtered.forEach(h => {
      const tKey = h.table || "Walk-in";
      if (!map[tKey]) { map[tKey] = []; order.push(tKey); }
      // Split hold into per-person groups
      const items = safeItems(h.items);
      const personMap = {};
      const personOrder = [];
      items.forEach(item => {
        const m    = (item.note || "").match(/^\[([^\]]+)\]\s*/);
        const seat = m ? m[1] : "P1";
        if (!personMap[seat]) { personMap[seat] = []; personOrder.push(seat); }
        personMap[seat].push({
          ...item,
          cleanNote: item.note ? item.note.replace(/^\[[^\]]+\]\s*/, "").trim() : "",
        });
      });
      map[tKey].push({
        ...h,
        personOrder,
        personMap,
      });
    });
    return order.map(tKey => ({ table: tKey, holds: map[tKey] }));
  })();

  // Keep visibleHolds for counts
  const visibleHolds = holds.filter(h => {
    const matchBumped = showBumped ? true : h.status !== "bumped";
    return (h.status === "pending" || h.status === "bumped") && matchBumped;
  });

  const pendingCount = holds.filter(h => h.status === "pending").length;
  const bumpedCount  = holds.filter(h => h.status === "bumped").length;

  // Elapsed minutes for alerting
  const lateCount = holds.filter(h => h.status === "pending" && elapsedMinutes(h.createdDate) >= 12).length;

  const handleCancel = async (id) => {
    const sid = String(id);
    setHoldList(p => p.filter(h => String(h.id) !== sid));
    try {
      const { posApi } = await import("../api/index.js");
      await posApi.deleteHold(sid);
    } catch(err) { console.error("Cancel failed:", err.message); }
  };

  const handleBump = async (id) => {
    const sid = String(id);
    setHoldList(p => p.map(h => String(h.id) === sid
      ? { ...h, status: "bumped", bumpedAt: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) }
      : h
    ));
    try {
      const { posApi } = await import("../api/index.js");
      const result = await posApi.updateHold(sid, { status: "bumped" });
      console.log("✅ Bumped hold", sid, result);
    } catch (err) {
      console.error("❌ Bump failed:", err.response?.data || err.message);
    }
  };
  const handleRecall = async (id) => {
    const sid = String(id);
    setHoldList(p => p.map(h => String(h.id) === sid
      ? { ...h, status: "pending", bumpedAt: null }
      : h
    ));
    try {
      const { posApi } = await import("../api/index.js");
      await posApi.updateHold(sid, { status: "pending" });
    } catch (err) { console.error("❌ Recall failed:", err.response?.data || err.message); }
  };

  const stationsWithOrders = ["all", ...Object.keys(STATION_COLORS).filter(s => {
    if (s === "all") return false;
    return holds.some(h => h.status === "pending" && safeItems(h.items).some(i => itemStation(i) === s));
  })];

  return (
    <div style={{ 
      flex: 1, 
      display: "flex", 
      flexDirection: "column", 
      overflow: "hidden",
      background: "#0A0E1A", 
      fontFamily: T.font, 
      color: T.textPrimary 
    }}>

      {/* -- Top bar -- */}
      <div style={{ 
        background: "#0A0E1A", 
        borderBottom: "1px solid #1E2A3A", 
        padding: "12px 24px",
        display: "flex", 
        alignItems: "center", 
        gap: 20, 
        flexShrink: 0 
      }}>
        <div style={{ 
          fontSize: 14, 
          fontWeight: 600, 
          color: T.amber, 
          letterSpacing: 1.5,
          textTransform: "uppercase",
        }}>
          Kitchen Display
        </div>

        {/* Live stats */}
        <div style={{ display: "flex", gap: 12, flex: 1 }}>
          <div style={{ 
            background: T.card, 
            borderRadius: 4, 
            padding: "5px 14px", 
            border: `1px solid ${T.border}` 
          }}>
            <span style={{ fontSize: 10, color: T.textMuted, letterSpacing: "0.5px" }}>
              PENDING 
            </span>
            <span style={{ 
              fontSize: 16, 
              fontWeight: 700, 
              color: T.amber,
              fontFamily: "'Inter', monospace",
            }}>
              {pendingCount}
            </span>
          </div>
          {lateCount > 0 && (
            <div style={{ 
              background: "#8B3A3A22", 
              borderRadius: 4, 
              padding: "5px 14px", 
              border: "1px solid #8B3A3A66",
              animation: "pulse 1s infinite" 
            }}>
              <span style={{ fontSize: 10, color: "#8B3A3A", letterSpacing: "0.5px" }}>
                DELAYED 
              </span>
              <span style={{ 
                fontSize: 16, 
                fontWeight: 700, 
                color: "#8B3A3A",
                fontFamily: "'Inter', monospace",
              }}>
                {lateCount}
              </span>
            </div>
          )}
          {bumpedCount > 0 && (
            <div style={{ 
              background: T.card, 
              borderRadius: 4, 
              padding: "5px 14px", 
              border: `1px solid ${T.border}` 
            }}>
              <span style={{ fontSize: 10, color: T.textMuted, letterSpacing: "0.5px" }}>
                COMPLETED 
              </span>
              <span style={{ 
                fontSize: 14, 
                fontWeight: 600, 
                color: T.textMuted,
                fontFamily: "'Inter', monospace",
              }}>
                {bumpedCount}
              </span>
            </div>
          )}
        </div>

        {/* Show bumped toggle */}
        <button 
          onClick={() => setShowBumped(v => !v)} 
          style={{
            padding: "6px 16px", 
            borderRadius: 4, 
            border: `1px solid ${showBumped ? T.amber : T.border}`,
            background: showBumped ? `${T.amber}20` : T.card, 
            color: showBumped ? T.amber : T.textMuted,
            fontSize: 11, 
            fontWeight: 600, 
            cursor: "pointer", 
            fontFamily: T.font,
            letterSpacing: "0.5px",
            transition: "all 0.2s ease",
          }}
        >
          {showBumped ? "Hide" : "Show"} Completed
        </button>

        <Ticker />
      </div>

      {/* -- Station tabs -- */}
      <div style={{ 
        background: "#0A0E1A", 
        borderBottom: `1px solid ${T.border}`,
        display: "flex", 
        gap: 0, 
        overflowX: "auto", 
        flexShrink: 0,
        paddingLeft: 20,
      }}>
        {stationsWithOrders.map(s => {
          const sc = STATION_COLORS[s] || STATION_COLORS.all;
          const count = s === "all" ? pendingCount
            : holds.filter(h => h.status==="pending" && safeItems(h.items).some(i => itemStation(i) === s)).length;
          return (
            <button 
              key={s} 
              onClick={() => setStation(s)} 
              style={{
                padding: "12px 24px", 
                border: "none", 
                cursor: "pointer", 
                fontWeight: 600, 
                fontSize: 12,
                background: "transparent", 
                whiteSpace: "nowrap", 
                fontFamily: T.font,
                color: station === s ? sc.text : T.textMuted,
                borderBottom: `2px solid ${station === s ? sc.text : "transparent"}`,
                transition: "all 0.15s ease",
                letterSpacing: "0.5px",
              }}
            >
              {sc.label}
              {count > 0 && (
                <span style={{ 
                  marginLeft: 8, 
                  background: sc.text, 
                  color: sc.text === T.amber ? "#0A0E1A" : "#FFFFFF",
                  fontSize: 10, 
                  fontWeight: 700, 
                  borderRadius: 10, 
                  padding: "1px 7px",
                  fontFamily: "'Inter', monospace",
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* -- Order grid -- */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {visibleHolds.length === 0 ? (
          <div style={{ 
            flex: 1, 
            display: "flex", 
            flexDirection: "column", 
            alignItems: "center",
            justifyContent: "center", 
            height: "60vh", 
            color: T.textFaint 
          }}>
            <div style={{ 
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "rgba(45, 158, 107, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              border: "1px solid rgba(45, 158, 107, 0.2)",
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2E7D64" strokeWidth="1.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div style={{ 
              fontSize: 18, 
              fontWeight: 600, 
              color: T.textMuted,
              letterSpacing: "0.5px",
            }}>
              {pendingCount === 0 ? "All Orders Completed" : "No Orders for This Station"}
            </div>
            <div style={{ fontSize: 12, marginTop: 8, color: T.textMuted }}>
              {pendingCount === 0 ? "Kitchen is up to date" : `${pendingCount} pending in other stations`}
            </div>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16
          }}>
            {tableGroups.map(({ table, holds: tHolds }) => (
              <TableCard
                key={table}
                table={table}
                holds={tHolds}
                onBump={handleBump}
                onRecall={handleRecall}
                onCancel={handleCancel}
                showBumped={showBumped}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}