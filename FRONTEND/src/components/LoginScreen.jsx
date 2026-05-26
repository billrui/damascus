import { useState, useEffect, useRef } from "react";
import { T } from "../posTheme";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function fetchPublicUsers() {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/users`);
    if (!res.ok) return [];
    return (await res.json()).users || [];
  } catch { return []; }
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const date = now.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return { time, date };
}

const ROLE_META = {
  admin:       { color: "#9b7eef", bg: "#9b7eef14", label: "Administrator"  },
  manager:     { color: "#2f7fc1", bg: "#2f7fc114", label: "Manager"        },
  cashier:     { color: "#2d9e6b", bg: "#2d9e6b14", label: "Cashier"        },
  storekeeper: { color: "#e07b39", bg: "#e07b3914", label: "Storekeeper"    },
  waiter:      { color: "#d45b8a", bg: "#d45b8a14", label: "Waiter"         },
  kitchen:     { color: "#c9a84c", bg: "#c9a84c14", label: "Kitchen Staff"  },
};

const UserIcon = ({ size = 20, color = "#666" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="#666" strokeWidth="2.5" strokeLinecap="round"
    style={{ transition: "transform .2s", transform: open ? "rotate(180deg)" : "rotate(0)" }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

export default function LoginScreen({ onLogin }) {
  const [users,        setUsers]        = useState([]);
  const [fetching,     setFetching]     = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [dropOpen,     setDropOpen]     = useState(false);
  const [pin,          setPin]          = useState("");
  const [error,        setError]        = useState("");
  const [shake,        setShake]        = useState(false);
  const [loading,      setLoading]      = useState(false);
  const dropRef = useRef(null);
  const { time, date } = useClock();

  useEffect(() => {
    fetchPublicUsers().then(setUsers).finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { setPin(""); setError(""); setShake(false); }, [selectedUser]);

  const activeUsers = users.filter(u => u.active !== false);
  const meta = selectedUser ? (ROLE_META[selectedUser.role] || ROLE_META.cashier) : null;

  const handleKey = async (k) => {
    if (loading) return;
    if (!selectedUser) {
      setError("Please select a staff member first.");
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    if (k === "C") { setPin(p => p.slice(0, -1)); setError(""); return; }
    if (pin.length >= 4) return;

    const next = pin + k;
    setPin(next);

    if (next.length === 4) {
      setLoading(true);
      try {
        await onLogin(selectedUser.id, next);
      } catch {
        setShake(true);
        setError(`Incorrect PIN. Please try again.`);
        setTimeout(() => { setShake(false); setPin(""); setLoading(false); }, 650);
      }
    }
  };

  // -- Fetching -------------------------------------------------------------
  if (fetching) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c0f18" }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 36, height: 36, border: "3px solid #1a2030", borderTopColor: "#c9a84c", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 14px" }} />
          <div style={{ color: "#6b7280", fontSize: 13, fontFamily: T.font }}>Connecting-</div>
        </div>
      </div>
    );
  }

  // -- No users --------------------------------------------------------------
  if (activeUsers.length === 0) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c0f18" }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ background: "#fff", padding: 40, borderRadius: 12, textAlign: "center", maxWidth: 340, margin: "0 16px" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>-</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontFamily: T.font }}>No staff accounts yet</h2>
          <p style={{ color: "#888", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
            Create staff accounts from the backend before logging in.
          </p>
          <code style={{ display: "block", background: "#f5f5f5", padding: "8px 12px", borderRadius: 6, fontSize: 12, marginBottom: 20 }}>
            POST /api/users
          </code>
          <button onClick={() => { setFetching(true); fetchPublicUsers().then(setUsers).finally(() => setFetching(false)); }}
            style={{ padding: "10px 24px", background: "#2d9e6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: T.font }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // -- Main login ------------------------------------------------------------
  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: T.font, background: "#0c0f18", flexWrap: "wrap" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap');
        @keyframes shake  { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dropIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to { transform: rotate(360deg); } }
        .pin-key { transition: all .1s; }
        .pin-key:hover { background: #e8e4de !important; transform: scale(0.98); }
        .pin-key:active { transform: scale(0.95) !important; }
        .user-row:hover { background: #f8f6f2 !important; }

        /* Responsive: hide left panel on small screens */
        @media (max-width: 640px) {
          .login-left  { display: none !important; }
          .login-right { min-height: 100vh; width: 100% !important; flex: none !important; padding: 28px 20px !important; justify-content: flex-start !important; padding-top: 48px !important; }
        }
        @media (min-width: 641px) and (max-width: 900px) {
          .login-left  { flex: 0 0 38% !important; padding: 32px 28px !important; }
          .login-right { padding: 32px 28px !important; }
        }
      `}</style>

      {/* -- LEFT: Branding panel -- */}
      <div className="login-left" style={{
        flex: "0 0 42%", position: "relative", overflow: "hidden",
        background: "linear-gradient(170deg, #0d1e2e 0%, #0a2e20 55%, #0e1f10 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "48px 44px",
      }}>
        {/* Concentric rings */}
        {[180, 280, 380].map((size, i) => (
          <div key={i} style={{
            position: "absolute", top: "48%", left: "50%", transform: "translate(-50%,-50%)",
            width: size, height: size, borderRadius: "50%",
            border: `1px solid rgba(201,168,76,${0.08 - i * 0.02})`, pointerEvents: "none",
          }} />
        ))}

        {/* Corner accents */}
        <div style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", opacity: 0.12 }}>
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <path d="M0 0 L80 0 L0 80 Z" fill={T.amberLight}/>
          </svg>
        </div>
        <div style={{ position: "absolute", bottom: 0, right: 0, pointerEvents: "none", opacity: 0.12 }}>
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <path d="M80 80 L0 80 L80 0 Z" fill={T.amberLight}/>
          </svg>
        </div>

        {/* Brand */}
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", animation: "fadeUp .9s ease both" }}>
          <div style={{
            width: 72, height: 72, margin: "0 auto 24px",
            background: `linear-gradient(145deg, #a07830, ${T.amber}, #7a5c1e)`,
            borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 0 6px rgba(201,168,76,0.1), 0 0 0 12px rgba(201,168,76,0.05), 0 20px 48px rgba(0,0,0,0.5)`,
            transform: "rotate(45deg)",
          }}>
            <div style={{ transform: "rotate(-45deg)" }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M16 4L28 16L16 28L4 16L16 4Z" fill="rgba(12,15,24,0.85)"/>
                <path d="M16 9L23 16L16 23L9 16L16 9Z" fill={T.amberLight} opacity="0.7"/>
              </svg>
            </div>
          </div>

          <div style={{ color: "rgba(201,168,76,0.5)", fontSize: 9, letterSpacing: 5, marginBottom: 10, fontWeight: 500 }}>EST. 2018</div>

          <div style={{
            color: T.amberLight, fontWeight: 600, fontSize: 30,
            letterSpacing: 6, lineHeight: 1.1,
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontStyle: "italic",
            textShadow: "0 2px 20px rgba(232,201,106,0.2)",
          }}>Damascus</div>
          <div style={{ color: "rgba(201,168,76,0.7)", fontSize: 11, letterSpacing: 8, marginTop: 4, fontWeight: 500 }}>HOTEL</div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px auto", width: 160 }}>
            <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, transparent, rgba(201,168,76,0.3))" }} />
            <div style={{ width: 4, height: 4, background: T.amber, transform: "rotate(45deg)", opacity: 0.6 }} />
            <div style={{ flex: 1, height: 1, background: "linear-gradient(to left, transparent, rgba(201,168,76,0.3))" }} />
          </div>

          <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 8.5, letterSpacing: 4 }}>
            POINT OF SALE & INVENTORY SYSTEM
          </div>
        </div>

        {/* Clock */}
        <div style={{ position: "absolute", bottom: 36, zIndex: 1, textAlign: "center", animation: "fadeUp 1s .4s ease both", opacity: 0 }}>
          <div style={{ color: "#fff", fontSize: 30, fontWeight: 300, letterSpacing: 3, fontVariantNumeric: "tabular-nums" }}>{time}</div>
          <div style={{ color: "rgba(201,168,76,0.45)", fontSize: 9, letterSpacing: 2.5, marginTop: 6 }}>{date.toUpperCase()}</div>
        </div>
      </div>

      {/* -- RIGHT: Login form -- */}
      <div className="login-right" style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        background: "#f2ede6", padding: "40px 32px",
        minWidth: 0,
      }}>
        <div style={{ width: "100%", maxWidth: 340, animation: "fadeUp .65s .1s ease both", opacity: 0 }}>

          {/* Mobile logo (only visible when left panel is hidden) */}
          <div style={{ display: "none" }} className="mobile-brand">
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#181c28", letterSpacing: 1, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic" }}>Damascus Hotel</div>
              <div style={{ fontSize: 9, color: "#c9a84c", letterSpacing: 3, marginTop: 2 }}>POS SYSTEM</div>
            </div>
          </div>

          <div style={{ fontSize: 21, fontWeight: 700, color: "#181c28", marginBottom: 3 }}>Staff Login</div>
          <div style={{ fontSize: 12, color: "#9ca0a8", marginBottom: 26 }}>Select your name and enter your 4-digit PIN</div>

          {/* User dropdown */}
          <div ref={dropRef} style={{ position: "relative", marginBottom: 20 }}>
            <div
              onClick={() => setDropOpen(o => !o)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 13px", borderRadius: 8, cursor: "pointer",
                border: `1.5px solid ${dropOpen ? T.amber : selectedUser ? "#d8d2c8" : "#ccc"}`,
                background: "#fff",
                boxShadow: dropOpen ? `0 0 0 3px rgba(201,168,76,0.1)` : "0 1px 4px rgba(0,0,0,0.05)",
                transition: "all .15s",
              }}
            >
              {selectedUser ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${meta.color}30` }}>
                    <UserIcon size={14} color={meta.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#181c28", lineHeight: 1.2 }}>{selectedUser.name}</div>
                    <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", background: meta.bg, color: meta.color, padding: "1px 6px", borderRadius: 3 }}>{meta.label}</span>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#aaa" }}>
                  <UserIcon size={16} color="#bbb" />
                  <span style={{ fontSize: 13, fontWeight: 400 }}>Select staff member-</span>
                </div>
              )}
              <ChevronIcon open={dropOpen} />
            </div>

            {dropOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0, zIndex: 50,
                background: "#fff", borderRadius: 10, border: "1px solid #e0dbd4",
                boxShadow: "0 10px 36px rgba(0,0,0,0.12)", overflow: "hidden",
                animation: "dropIn .18s ease both", maxHeight: 280, overflowY: "auto",
              }}>
                {Object.entries(
                  activeUsers.reduce((acc, u) => {
                    if (!acc[u.role]) acc[u.role] = [];
                    acc[u.role].push(u);
                    return acc;
                  }, {})
                ).map(([role, group]) => {
                  const rm = ROLE_META[role] || ROLE_META.cashier;
                  return (
                    <div key={role}>
                      <div style={{ padding: "5px 13px", fontSize: 8.5, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: rm.color, background: rm.bg, borderTop: "1px solid #f0ece6" }}>
                        {rm.label}s
                      </div>
                      {group.map(u => (
                        <div key={u.id} className="user-row"
                          onClick={() => { setSelectedUser(u); setDropOpen(false); }}
                          style={{
                            display: "flex", alignItems: "center", gap: 11,
                            padding: "9px 13px", cursor: "pointer",
                            background: selectedUser?.id === u.id ? "#f5f2ec" : "#fff",
                            borderLeft: selectedUser?.id === u.id ? `2.5px solid ${rm.color}` : "2.5px solid transparent",
                            transition: "all .1s",
                          }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: rm.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <UserIcon size={13} color={rm.color} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#181c28" }}>{u.name}</div>
                            <div style={{ fontSize: 10, color: "#aaa", marginTop: 1, textTransform: "capitalize" }}>{rm.label}</div>
                          </div>
                          {selectedUser?.id === u.id && (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={rm.color} strokeWidth="2.5" strokeLinecap="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* PIN label */}
          <div style={{ fontSize: 12, fontWeight: 600, color: "#181c28", marginBottom: 13 }}>
            {selectedUser ? `PIN for ${selectedUser.name.split(" ")[0]}` : "Enter 4-digit PIN"}
          </div>

          {/* PIN dots */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 5, animation: shake ? "shake .4s ease" : "none" }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{
                width: 52, height: 52, borderRadius: 10,
                border: `1.5px solid ${pin.length > i ? (meta?.color || T.amber) : "#d8d2c8"}`,
                background: pin.length > i ? (meta?.bg || "#fff9ee") : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .15s",
                boxShadow: pin.length > i ? `0 3px 12px ${meta?.color || T.amber}25` : "none",
              }}>
                {pin.length > i ? <div style={{ width: 9, height: 9, borderRadius: "50%", background: meta?.color || T.amber }} /> : null}
              </div>
            ))}
          </div>

          <div style={{ minHeight: 20, textAlign: "center", fontSize: 11.5, color: "#c0392b", fontWeight: 600, marginBottom: 12 }}>
            {loading ? (
              <span style={{ color: "#888" }}>Verifying-</span>
            ) : error}
          </div>

          {/* Numpad */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {[1,2,3,4,5,6,7,8,9,"C",0,"-"].map(k => {
              const isDel = k === "C" || k === "-";
              return (
                <button key={k} className="pin-key"
                  onClick={() => isDel ? handleKey("C") : handleKey(String(k))}
                  disabled={loading}
                  style={{
                    padding: "14px",
                    borderRadius: 9,
                    border: `1.5px solid ${isDel ? "#f5c6c6" : "#ddd8d0"}`,
                    background: isDel ? "#fff8f8" : "#fff",
                    color: isDel ? "#c0392b" : "#181c28",
                    fontWeight: 600, fontSize: isDel ? 14 : 16,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.6 : 1,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                    fontFamily: T.font,
                  }}>{k}</button>
              );
            })}
          </div>

          <div style={{ marginTop: 14, fontSize: 10.5, color: "#b0a898", textAlign: "center" }}>
            PIN auto-submits after 4 digits
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: "#ccc", textAlign: "center" }}>
            Contact your administrator if you cannot log in
          </div>
        </div>
      </div>

      {/* Mobile branding CSS (inject via style tag) */}
      <style>{`
        @media (max-width: 640px) {
          .mobile-brand { display: block !important; }
        }
      `}</style>
    </div>
  );
}
