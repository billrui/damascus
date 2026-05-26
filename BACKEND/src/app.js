import express      from 'express';
import http         from 'http';
import helmet       from 'helmet';
import cors         from 'cors';
import morgan       from 'morgan';
import cookieParser from 'cookie-parser';
import { env }      from './config/env.js';
import { pool }     from './config/db.js';
import { redis }    from './config/redis.js';
import { initSocketServer } from './realtime/socketServer.js';

// ── Routes ────────────────────────────────────────────────────────────────────
import authRouter      from './routes/auth.js';
import usersRouter     from './routes/users.js';
import posRouter       from './routes/pos.js';
import inventoryRouter from './routes/inventory.js';
import itemsRouter     from './routes/items.js';
import shiftsRouter    from './routes/shifts.js';
import reportsRouter   from './routes/reports.js';
import syncRouter      from './routes/sync.js';
import settingsRouter  from './routes/settings.js';

// ── Middleware ─────────────────────────────────────────────────────────────────
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { apiLimiter }             from './middleware/rateLimit.js';

const app    = express();
const server = http.createServer(app);   // needed for Socket.IO

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: env.NODE_ENV === 'production',
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    // Allow any localhost port in development
    if (env.NODE_ENV === 'development' && /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    // In production, only allow the configured client origin
    if (origin === env.CLIENT_ORIGIN) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods:     ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// ── Parsing ───────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ── Logging ───────────────────────────────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  let dbOk    = false;
  let redisOk = false;
  try { await pool.query('SELECT 1'); dbOk = true; }    catch (_) {}
  try { await redis.ping();           redisOk = true; } catch (_) {}

  const status = dbOk ? 'ok' : 'degraded';
  res.status(dbOk ? 200 : 503).json({
    status,
    services: { database: dbOk ? 'ok' : 'down', redis: redisOk ? 'ok' : 'down' },
    env: env.NODE_ENV,
    ts: new Date().toISOString(),
  });
});

// ── Global rate limiter ───────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRouter);
app.use('/api/users',     usersRouter);
// Lift token from body to header for endpoints that can't set headers (e.g. print)
app.use('/api/pos/holds', (req, res, next) => {
  if (req.body?.token && !req.headers.authorization) {
    req.headers.authorization = 'Bearer ' + req.body.token;
  }
  next();
});

app.use('/api/pos',       posRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/items',     itemsRouter);
app.use('/api/settings',  settingsRouter);
app.use('/api/shifts',    shiftsRouter);
app.use('/api/reports',   reportsRouter);
app.use('/api/sync',      syncRouter);

// ── 404 + Error handlers ──────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('🐘  PostgreSQL connected');
  } catch (err) {
    console.error('❌  Cannot connect to PostgreSQL:', err.message);
    process.exit(1);
  }

  try {
    await redis.ping();
    console.log('🔴  Redis connected');
  } catch (err) {
    console.warn('⚠️   Redis unavailable — token revocation + rate limiting degraded');
  }

  // Boot Socket.IO on the same HTTP server
  initSocketServer(server);

  server.listen(env.PORT, () => {
    console.log(`\n🚀  Damascus Hotel API  →  http://localhost:${env.PORT}`);
    console.log(`    Mode: ${env.NODE_ENV}  |  Client: ${env.CLIENT_ORIGIN}\n`);
    console.log('    Phase 2 routes:');
    console.log('    POST   /api/auth/login          login with user_id + PIN');
    console.log('    POST   /api/auth/refresh         silent token refresh');
    console.log('    GET    /api/auth/me              current user profile');
    console.log('    ——');
    console.log('    GET    /api/items                all menu items + recipes');
    console.log('    POST   /api/items                create menu item');
    console.log('    PUT    /api/items/:id/recipe     replace recipe');
    console.log('    ——');
    console.log('    POST   /api/shifts/open          open shift');
    console.log('    POST   /api/shifts/:id/close     close shift + Z-totals');
    console.log('    ——');
    console.log('    POST   /api/pos/sales            create sale (FEFO deduct + receipt PDF)');
    console.log('    GET    /api/pos/receipts/:id     stream receipt PDF');
    console.log('    GET    /api/pos/receipts/:id/escpos  raw ESC/POS bytes');
    console.log('    POST   /api/pos/holds            create hold → KDS via Socket.IO');
    console.log('    ——');
    console.log('    GET    /api/inventory/batches    stock batches');
    console.log('    POST   /api/inventory/batches    receive stock');
    console.log('    GET    /api/inventory/expiry     expiring batches');
    console.log('    GET    /api/inventory/variance   variance report');
    console.log('    POST   /api/inventory/issues     issue to kitchen');
    console.log('    POST   /api/inventory/wastage    record wastage');
    console.log('    ——');
    console.log('    GET    /api/reports/kpis         dashboard KPIs');
    console.log('    GET    /api/reports/hourly       hourly chart data');
    console.log('    GET    /api/reports/top-items    top sellers');
    console.log('    ——');
    console.log('    POST   /api/sync                 flush offline queue\n');
  });
}

start();

export default app;
