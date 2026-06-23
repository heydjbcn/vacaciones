# Vacaciones — PWA de vacaciones + jornada

App personal (Mac + iPhone) para gestionar vacaciones y jornada parcial:
- **Saldo de vacaciones** por año (asignación con reinicio cada enero; el año de alta se
  prorratea). Las vacaciones se descuentan en **días laborables** (ni findes, ni festivos, ni
  días libres personales).
- **Calendario anual** marcable: pones vacaciones y días libres, y ves los festivos por ámbito
  (España / Catalunya / Cornellà).
- **Jornada parcial (30 h)**: patrón semanal de días libres (por defecto, lunes) con
  excepciones por fecha; la app cuenta días y horas trabajados por semana y mes.

**Producción:** https://vacaciones.jmauri.com (PWA instalable, sincronizada entre dispositivos)

## Cómo se usa

1. Abre https://vacaciones.jmauri.com en Safari (iPhone) o el navegador del Mac.
2. **iPhone**: Compartir → "Añadir a pantalla de inicio". **Mac**: instalar como app o añadir al Dock.
3. El token de sincronización va **horneado** (no hay que pegar nada); el mismo en todos los
   dispositivos = mismos datos. Cambiable en Ajustes → Sincronización.
4. En **Ajustes** configura: días/año (laborables), inicio de contrato, **horas/día** y el
   **patrón semanal** de días libres.
5. En el **calendario**, toca un día para marcar vacaciones / día libre / trabajar ese día.
   Para periodos largos, usa la barra "Pedir vacaciones" (desde/hasta).

El diseño visual se itera con `DESIGN_BRIEF.md` (para claude.ai/design).

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
