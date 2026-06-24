'use strict';
// Mini-servidor de la PWA de vacaciones: sirve public/, sincroniza el estado en
// /data/state.json y protege el acceso con login de Google (solo el email permitido).

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

const PORT = process.env.PORT || 5000;
const DATA_DIR = process.env.DATA_DIR || '/data';
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const TMP_FILE = path.join(DATA_DIR, 'state.json.tmp');
const TOKEN = process.env.SYNC_TOKEN || '';                       // bearer admin (curl), opcional
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';             // OAuth Web client id
const ALLOWED = (process.env.ALLOWED_EMAILS || 'j.maurim@gmail.com')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const SECRET = process.env.SESSION_SECRET || TOKEN || 'vac-dev-secret';
const COOKIE = 'vacses';
const SESSION_DAYS = 30;

try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* noop */ }
const gclient = CLIENT_ID ? new OAuth2Client(CLIENT_ID) : null;

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

/* ---------- sesión firmada (HMAC, sin dependencias) ---------- */
const b64u = (b) => Buffer.from(b).toString('base64url');
function sign(email) {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  const body = b64u(JSON.stringify({ email, exp }));
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return body + '.' + sig;
}
function verify(tok) {
  if (!tok || tok.indexOf('.') < 0) return null;
  const [body, sig] = tok.split('.');
  const exp = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig !== exp) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch (e) { return null; }
}
function getCookie(req, name) {
  const h = req.headers.cookie || '';
  const m = h.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function setSession(res, email) {
  const v = sign(email);
  res.set('Set-Cookie', `${COOKIE}=${encodeURIComponent(v)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}`);
}
function sessionEmail(req) {
  const d = verify(getCookie(req, COOKIE));
  return d ? d.email : null;
}
// ¿Petición autorizada para leer/escribir el estado?
function authed(req) {
  if (!CLIENT_ID) return true;                                     // login no configurado → abierto (como antes)
  if (sessionEmail(req)) return true;                              // sesión Google
  if (TOKEN && (req.get('authorization') || '') === 'Bearer ' + TOKEN) return true; // admin curl
  return false;
}

/* ---------- auth Google ---------- */
app.get('/api/config', (req, res) => res.json({ clientId: CLIENT_ID, loginRequired: !!CLIENT_ID }));

app.get('/api/me', (req, res) => {
  if (!CLIENT_ID) return res.json({ email: 'open' });              // login no configurado aún
  const email = sessionEmail(req);
  if (email) return res.json({ email });
  res.status(401).json({ error: 'login' });
});

app.post('/api/login', async (req, res) => {
  if (!gclient) return res.status(400).json({ error: 'login not configured' });
  const credential = req.body && req.body.credential;
  if (!credential) return res.status(400).json({ error: 'missing credential' });
  try {
    const ticket = await gclient.verifyIdToken({ idToken: credential, audience: CLIENT_ID });
    const p = ticket.getPayload();
    const email = (p.email || '').toLowerCase();
    if (!p.email_verified || !ALLOWED.includes(email)) {
      return res.status(403).json({ error: 'not allowed' });
    }
    setSession(res, email);
    res.json({ email });
  } catch (e) {
    res.status(401).json({ error: 'invalid token' });
  }
});

app.post('/api/logout', (req, res) => {
  res.set('Set-Cookie', `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
  res.json({ ok: true });
});

/* ---------- estado ---------- */
function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) { return null; }
}
app.get('/api/state', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauthorized' });
  const state = readState();
  if (!state) return res.status(204).end();
  res.json(state);
});
app.put('/api/state', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauthorized' });
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'invalid body' });
  const current = readState();
  if (current && typeof current.updatedAt === 'number' && typeof body.updatedAt === 'number' && body.updatedAt < current.updatedAt) {
    return res.status(409).json(current);
  }
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(body));
    fs.renameSync(TMP_FILE, STATE_FILE);
  } catch (e) { return res.status(500).json({ error: 'write failed' }); }
  res.json({ ok: true, updatedAt: body.updatedAt || null });
});

/* ---------- fichaje IMFALU (proxy solo lectura, server-to-server) ---------- */
const IMFALU_URL = process.env.IMFALU_JORNADA_URL || '';
const IMFALU_SECRET = process.env.INTEGRATION_SECRET || '';
let fichajeCache = { key: '', at: 0, data: null };
app.get('/api/fichaje', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauthorized' });
  if (!IMFALU_URL || !IMFALU_SECRET) return res.json({ enabled: false });
  const from = String(req.query.from || '').slice(0, 10);
  const to = String(req.query.to || '').slice(0, 10);
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const key = qs.toString();
  if (fichajeCache.key === key && Date.now() - fichajeCache.at < 5 * 60000) {
    return res.json(fichajeCache.data);
  }
  try {
    const r = await fetch(IMFALU_URL + (key ? '?' + key : ''), { headers: { 'x-integration-secret': IMFALU_SECRET } });
    if (!r.ok) return res.status(502).json({ enabled: true, error: 'imfalu ' + r.status });
    const data = await r.json();
    const out = Object.assign({ enabled: true }, data);
    fichajeCache = { key, at: Date.now(), data: out };
    res.json(out);
  } catch (e) {
    res.status(502).json({ enabled: true, error: 'fetch failed' });
  }
});

// Calendario laboral de empresa (festivos) desde IMFALU.
const IMFALU_HOLIDAYS_URL = process.env.IMFALU_HOLIDAYS_URL || '';
let holidaysCache = { key: '', at: 0, data: null };
app.get('/api/holidays', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauthorized' });
  if (!IMFALU_HOLIDAYS_URL || !IMFALU_SECRET) return res.json({ enabled: false });
  const from = String(req.query.from || '').slice(0, 10);
  const to = String(req.query.to || '').slice(0, 10);
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const key = qs.toString();
  if (holidaysCache.key === key && Date.now() - holidaysCache.at < 60 * 60000) {
    return res.json(holidaysCache.data);
  }
  try {
    const r = await fetch(IMFALU_HOLIDAYS_URL + (key ? '?' + key : ''), { headers: { 'x-integration-secret': IMFALU_SECRET } });
    if (!r.ok) return res.status(502).json({ enabled: true, error: 'imfalu ' + r.status });
    const data = await r.json();
    const out = Object.assign({ enabled: true }, data);
    holidaysCache = { key, at: Date.now(), data: out };
    res.json(out);
  } catch (e) {
    res.status(502).json({ enabled: true, error: 'fetch failed' });
  }
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('sw.js') || filePath.endsWith('index.html')) res.set('Cache-Control', 'no-cache');
  },
}));

app.listen(PORT, () => {
  console.log(`vacaciones on :${PORT} (data:${DATA_DIR}, login:${CLIENT_ID ? 'google' : 'open'})`);
});
