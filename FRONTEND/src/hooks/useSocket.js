import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

let _socket = null;
let _token  = null;

export function getSocket() { return _socket; }

export function connectSocket(token) {
  if (!token) return null;
  if (_socket && _socket.connected && _token === token) return _socket;
  if (_socket) { _socket.removeAllListeners(); _socket.disconnect(); _socket = null; }

  _token  = token;
  _socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
  });

  _socket.on("connect",       () => console.log("✅ Socket connected:", _socket.id));
  _socket.on("disconnect",    (r) => console.log("🔌 Socket disconnected:", r));
  _socket.on("connect_error", (e) => {
    console.error("❌ Socket error:", e.message);
    const fresh = localStorage.getItem("access_token");
    if (fresh && fresh !== _token) connectSocket(fresh);
  });

  return _socket;
}

export function disconnectSocket() {
  if (_socket) { _socket.removeAllListeners(); _socket.disconnect(); _socket = null; _token = null; }
}

export function useSocket(handlers = {}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let wrappers   = null;
    let retryTimer = null;

    const detach = () => {
      if (wrappers && _socket) {
        Object.keys(wrappers).forEach(e => _socket.off(e, wrappers[e]));
      }
      wrappers = null;
    };

    const attach = () => {
      if (!_socket) return false;
      detach();                              // avoid duplicate listeners
      wrappers = {};
      Object.keys(handlersRef.current).forEach(event => {
        wrappers[event] = (...args) => handlersRef.current[event]?.(...args);
        _socket.on(event, wrappers[event]);
      });
      // Re-bind our handlers on every (re)connect — same fn ref, so off+on dedupes
      _socket.off("connect", attach);
      _socket.on("connect", attach);
      return true;
    };

    // Attach now if the socket exists; otherwise keep retrying until it does.
    // This is the key fix: components that mount before the socket connects
    // used to never bind their handlers at all.
    const ensure = () => {
      if (!attach()) retryTimer = setTimeout(ensure, 300);
    };
    ensure();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      detach();
      _socket?.off("connect", attach);
    };
  }, []);
}
