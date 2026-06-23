# Vacaciones — PWA de saldo de vacaciones

App personal (Mac + iPhone) para cuadrar días de vacaciones: saldo disponible,
movimientos (devengo mensual desde inicio de contrato − periodos disfrutados),
previsión a fin de año y festivos (España + Catalunya + Cornellà de Llobregat).

**Producción:** https://vacaciones.jmauri.com (PWA instalable, sincronizada entre dispositivos)

## Cómo se usa

1. Abre https://vacaciones.jmauri.com en Safari (iPhone) o el navegador del Mac.
2. **iPhone**: Compartir → "Añadir a pantalla de inicio" (icono propio, pantalla completa, offline).
   **Mac**: Chrome/Edge → instalar app; o Safari → Archivo → Añadir al Dock.
3. La primera vez, en **Ajustes → Sincronización** pega el token (`SYNC_TOKEN` del servidor).
   El mismo token en Mac y iPhone = mismos datos. Sin token, funciona solo en local.
4. En **Ajustes → Contrato** pon tus días/año y la fecha de inicio de contrato.

El cómputo es en **días naturales** (findes y festivos incluidos). Los festivos se
muestran como información (panel "Festivos") y son editables en Ajustes; no descuentan saldo.

## Arquitectura

- `public/` — PWA estática: `index.html` (UI + lógica), `sw.js` (offline app-shell),
  `manifest.webmanifest`, `icons/`.
- `server.js` — Express: sirve `public/` y expone `GET/PUT /api/state`, que lee/escribe
  `/data/state.json` (volumen persistente), protegido por bearer token (`SYNC_TOKEN`).
- Sync cliente: caché en `localStorage` + last-write-wins por `updatedAt`, debounce y
  reintento offline.

## Deploy (Dokku en VPS Hetzner, igual que `desarrolloweb`)

```bash
# admin por Tailscale con la key de root
ssh -i ~/.ssh/id_rsa_vps root@100.123.246.74 "dokku apps:create vacaciones"
ssh -i ~/.ssh/id_rsa_vps root@100.123.246.74 \
  "dokku storage:ensure-directory vacaciones && \
   dokku storage:mount vacaciones /var/lib/dokku/data/storage/vacaciones:/data"
ssh -i ~/.ssh/id_rsa_vps root@100.123.246.74 \
  "dokku config:set vacaciones DATA_DIR=/data NODE_ENV=production SYNC_TOKEN=<token> DOKKU_LETSENCRYPT_EMAIL=j.maurim@gmail.com"
ssh -i ~/.ssh/id_rsa_vps root@100.123.246.74 "dokku domains:set vacaciones vacaciones.jmauri.com"

# git remote usa la key dokku_deploy (configurada en ~/.ssh/config)
git remote add dokku dokku@100.123.246.74:vacaciones
git push dokku main
```

### Gotchas (resueltos en este deploy)

- **bind-address**: el global del VPS es `127.0.0.1` (apps por túnel). Esta app va por A
  directo + CF proxied, así que necesita escuchar en público:
  `dokku nginx:set vacaciones bind-address-ipv4 0.0.0.0 && dokku proxy:build-config vacaciones`.
  Sin esto, el tráfico externo cae en el server por defecto y devuelve 301.
- **Let's Encrypt**: emitir con el registro DNS **sin proxy** (gris) en Cloudflare; el reto
  HTTP-01 debe llegar al origen. Luego activar el proxy.
- **Cloudflare SSL**: la zona `jmauri.com` quedó en **Full (strict)** (CF→origen por HTTPS).
  En `flexible` el origen redirige http→https y CF devuelve 301 en bucle.
- **DNS**: registro A `vacaciones` → `157.90.113.91`, Proxied.

El token vive solo en `SYNC_TOKEN` (config de Dokku) — no se commitea.
