/**
 * socketServer.js
 *
 * Real-time event bus using Socket.IO.
 *
 * Rooms:
 *   kitchen   → KDS screen (new orders, order bumped)
 *   managers  → Hold list, low-stock alerts, sales summary
 *   pos       → Open invoice updates (cashier screen)
 *
 * All connections must present a valid JWT — unauthenticated sockets
 * are disconnected immediately.
 */

import { Server }     from 'socket.io';
import jwt            from 'jsonwebtoken';
import { env }        from '../config/env.js';
import { isTokenBlocked } from '../config/redis.js';

let io = null;

// ─── Initialise (call once from app.js with the http.Server) ──────────────────
export function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin:      env.CLIENT_ORIGIN,
      credentials: true,
    },
    // Prefer WebSocket, fall back to long-polling (works on hotel WiFi)
    transports: ['websocket', 'polling'],
  });

  // ── Auth middleware — runs before every connection ──────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token
               || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      // Check revocation
      if (await isTokenBlocked(token)) {
        return next(new Error('Token revoked'));
      }

      const payload = jwt.verify(token, env.JWT_SECRET);
      socket.user   = payload;   // attach to socket for use in handlers
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection handler ──────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const { sub: userId, name, role } = socket.user;

    if (env.NODE_ENV === 'development') {
      console.log(`🔌  Socket connected: ${name} (${role}) [${socket.id}]`);
    }

    // Auto-join rooms based on role
    socket.join(role);                                        // own role room
    if (role === 'admin' || role === 'manager') {
      socket.join('managers');
    }
    if (role === 'cashier') {
      socket.join('pos');
    }
    if (role === 'kitchen') {
      socket.join('kitchen');
    }

    // Client can also explicitly join rooms (e.g. admin joining kitchen view)
    socket.on('join:room', (room) => {
      const allowed = ['kitchen', 'managers', 'pos'];
      if (allowed.includes(room)) socket.join(room);
    });

    socket.on('disconnect', (reason) => {
      if (env.NODE_ENV === 'development') {
        console.log(`🔌  Socket disconnected: ${name} — ${reason}`);
      }
    });

    // Ping/pong for connection health checks
    socket.on('ping', (cb) => {
      if (typeof cb === 'function') cb({ ts: Date.now() });
    });
  });

  console.log('🔌  Socket.IO server initialised');
  return io;
}

// ─── Emit helpers (called from route handlers) ────────────────────────────────

/** New hold/order created — notify KDS and managers */
export function emitHoldCreated(hold) {
  if (!io) return;
  io.to('kitchen').to('managers').to('pos').emit('hold:created', hold);
}

/** Hold status changed (billed, bumped, cancelled) */
export function emitHoldUpdated(hold) {
  if (!io) return;
  io.to('kitchen').to('managers').to('pos').emit('hold:updated', hold);
}

/** Hold removed */
export function emitHoldDeleted(holdId) {
  if (!io) return;
  io.to('kitchen').to('managers').emit('hold:deleted', { id: holdId });
}

/** Sale completed — update manager dashboard live */
export function emitSaleCompleted(saleSummary) {
  if (!io) return;
  io.to('managers').emit('sale:completed', saleSummary);
}

/** Invoice created (waiter → cashier) — cashier sees it immediately */
export function emitInvoiceCreated(invoice) {
  if (!io) return;
  io.to('pos').to('managers').emit('invoice:created', invoice);
}

/** Invoice status changed (open → paid / void) */
export function emitInvoiceUpdated(invoice) {
  if (!io) return;
  io.to('pos').to('managers').emit('invoice:updated', invoice);
}

/** Low-stock alert after FEFO deduction */
export function emitLowStock(alerts) {
  if (!io) return;
  if (!alerts?.length) return;
  io.to('managers').emit('stock:low', { alerts, ts: new Date().toISOString() });
}

/** Expiry alert (called on shift open or scheduled check) */
export function emitExpiryAlert(alerts) {
  if (!io) return;
  if (!alerts?.length) return;
  io.to('managers').emit('stock:expiry', { alerts, ts: new Date().toISOString() });
}
