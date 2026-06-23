'use strict';
// Mini-servidor de sincronización para la PWA de vacaciones.
// Sirve la PWA estática (public/) y expone GET/PUT /api/state, que lee/escribe
// un único JSON en un volumen persistente. Un solo usuario, token bearer.

const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5000;
const DATA_DIR = process.env.DATA_DIR || '/data';
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const TMP_FILE = path.join(DATA_DIR, 'state.json.tmp');
const TOKEN = process.env.SYNC_TOKEN || '';

try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* noop */ }

const app = express();
app.use(express.json({ limit: '1mb' }));

// El navegador necesita poder leer/escribir sin caché obsoleta en /api.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function authed(req) {
  if (!TOKEN) return true; // sin token configurado = modo local abierto
  const h = req.get('authorization') || '';
  return h === 'Bearer ' + TOKEN;
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    return null;
  }
}

app.get('/api/state', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauthorized' });
  const state = readState();
  if (!state) return res.status(204).end(); // aún no hay nada guardado
  res.json(state);
});

app.put('/api/state', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauthorized' });
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'invalid body' });
  }
  // Last-write-wins por updatedAt: si el servidor tiene una versión más nueva,
  // no la pisamos y devolvemos la suya para que el cliente reconcilie.
  const current = readState();
  if (current && typeof current.updatedAt === 'number' &&
      typeof body.updatedAt === 'number' && body.updatedAt < current.updatedAt) {
    return res.status(409).json(current);
  }
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(body));
    fs.renameSync(TMP_FILE, STATE_FILE); // escritura atómica
  } catch (e) {
    return res.status(500).json({ error: 'write failed' });
  }
  res.json({ ok: true, updatedAt: body.updatedAt || null });
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    // El service worker y el HTML no deben quedar cacheados de forma agresiva.
    if (filePath.endsWith('sw.js') || filePath.endsWith('index.html')) {
      res.set('Cache-Control', 'no-cache');
    }
  },
}));

app.listen(PORT, () => {
  console.log(`vacaciones server on :${PORT} (data: ${DATA_DIR}, auth: ${TOKEN ? 'on' : 'off'})`);
});
