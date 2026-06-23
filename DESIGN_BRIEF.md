# Vacaciones — Brief de diseño visual

> **Para:** el agente de diseño (Claude Design / claude.ai/design).
> **Objetivo:** diseñar la interfaz de una PWA personal para gestionar **vacaciones** y
> **jornada parcial**, cuya pieza central es un **calendario anual** marcable. La app ya
> funciona; aquí se pide la **dirección visual**.
> **Plataforma:** PWA en **HTML + CSS + JS vanilla, un solo archivo** (`public/index.html`),
> sin frameworks ni librerías externas. Móvil primero (iPhone, "Añadir a pantalla de inicio")
> y también escritorio (Mac).
> **Regla de oro:** legibilidad del calendario por encima de todo, y que se distinga cada tipo
> de día **sin depender solo del color** (también forma/icono/borde, por daltonismo).
> **Entrega:** propón **2-3 direcciones visuales con nombre** (p. ej. "Sereno claro",
> "Nocturno", "Papel") como HTML standalone para comparar; yo elijo una y se implementa.

## 0. Contexto del producto

- **Usuario único:** una persona con **contrato de 30 h** y semanas irregulares (una semana
  trabaja 5 días, otra 3). No es una app de empresa: es personal, sin login visible.
- **Tareas clave:**
  1. Ver de un vistazo **cuántos días de vacaciones le quedan** este año.
  2. **Marcar en un calendario anual** los días que coge de vacaciones.
  3. **Marcar días libres personales** (su jornada parcial): un patrón semanal (p. ej. libra
     los lunes) con excepciones sueltas.
  4. Consultar los **festivos** del año por ámbito (España / Catalunya / Cornellà).
  5. Ver su **jornada trabajada** (días y horas por semana y por mes).
- **Tono:** sobrio, claro, de confianza, "panel personal" tranquilo. Nada infantil, nada
  recargado. Sensación de control y calma.

## 1. Estado visual actual (punto de partida)

Hoy es un estilo claro minimalista tipo "cuenta bancaria":
- Tokens de color en `:root` con **oklch**. Fondo casi blanco `--bg`, tarjetas `--surface`
  blancas con borde *hairline* (no sombras duras), texto `--ink`/`--muted`/`--faint`.
- Acentos: `--in` (verde), `--out` (rojo/naranja), `--cat` (amarillo), `--libre` (violeta).
- Tipografía del sistema (`-apple-system`...) y **mono tabular** para números.
- Layout centrado, máx ~860 px, mucho aire.
Puedes mantener esta base o reinterpretarla; tienes libertad.

## 2. Principios

1. **Neutral primero**, color solo para significado (tipos de día, saldo).
2. **Jerarquía clara**: el saldo y el calendario son los protagonistas.
3. **Densidad legible**: 12 meses en pantalla deben leerse sin agobio; en móvil, scroll vertical cómodo.
4. **No solo color**: cada estado de día se distingue también por forma/icono/borde/punto.
5. **Mobile-first** y *thumb-friendly* (targets ≥ 40 px en lo táctil).
6. Sin emojis en la UI (usar SVG inline). Sin librerías externas.

## 3. Design tokens (entregable)

- **Neutros**: fondo, superficie, bordes (2 niveles), texto (3 niveles). Define light y, si la
  dirección lo pide, dark.
- **Acentos semánticos del saldo**: positivo (disponible), negativo (gastado/sobregiro).
- **Colores por TIPO DE DÍA** (críticos, deben convivir en una celda pequeña):
  | Tipo | Significado | Idea visual |
  |------|-------------|-------------|
  | Vacaciones | día cogido de vacaciones | relleno fuerte de acento, texto claro |
  | Día libre | libre personal (jornada parcial) | relleno suave/violeta, distinguible de vacaciones |
  | Finde | sábado/domingo | atenuado |
  | Trabajo | día laborable normal | neutro base |
  | Festivo nacional | — | marca/punto color A + borde |
  | Festivo Catalunya | — | marca/punto color B |
  | Festivo Cornellà | — | marca/punto color C |
  | Hoy | día actual | contorno marcado |
- **Radios**, **spacing** (escala 4 pt), **tipografía** (display del saldo, títulos de sección,
  números mono tabular, etiquetas), **elevación/sombra**, **movimiento** (transiciones suaves).

## 4. Componentes

- **Celda de calendario**: número del día + estado (ver tabla) + punto/insignia de festivo +
  estado "hoy". Estados hover/activo. Debe verse bien a ~26-32 px.
- **Mini-mes**: cabecera con nombre de mes, fila L M X J V S D, grid de 7 columnas.
- **Leyenda** del calendario (muestras + etiqueta).
- **Popover de día** (al tocar un día): fecha grande, nombre del festivo si lo hay, y acciones
  (Marcar vacaciones / Quitar, Marcar día libre / Trabajar este día, Volver al patrón). Tipo
  bottom-sheet en móvil, modal centrado en escritorio.
- **Tarjeta de saldo**: número grande de días disponibles + 4 métricas (asignados, cogidas,
  por disfrutar, año que viene).
- **Tarjeta de jornada**: "Esta semana" y "Este mes" con días · horas.
- **Chips de ámbito** de festivo (España/Catalunya/Cornellà).
- **Tabs de año** (calendario, resumen, festivos).
- **Lista** (resumen por año con cabecera de totales; festivos con fecha + nombre + chip).
- **Toggles del patrón semanal** (7 botones L–D, activos = día libre).
- **Inputs/Select/Botones** (primario sólido, ghost, quiet) y **empty states**.

## 5. Layout y navegación

- Una sola página con scroll. Orden sugerido: cabecera (marca + estado de sync + fecha de
  contrato) → **saldo + jornada** (dos tarjetas) → barra rápida "pedir vacaciones"
  (desde/hasta) → **calendario anual** → resumen por año → festivos → ajustes (colapsable).
- Respeta `env(safe-area-inset-*)` (notch del iPhone). Ancho máx contenido ~860-980 px.

## 6. Pantalla por pantalla

- **Saldo + jornada**: lo primero que se ve. El número de días libres debe destacar.
- **Calendario anual** (lo importante): cómo se ve un mes, los 12 meses juntos (grid que se
  adapta: 3-4 columnas en escritorio, 1-2 en móvil), y el **popover de un día seleccionado**.
  Enseña una variante con varios días de vacaciones, festivos y días libres marcados.
- **Festivos**: lista anual con chips por ámbito; resalta el próximo.
- **Ajustes**: formularios sobrios (días/año, inicio de contrato, horas/día, patrón semanal,
  token, alta de festivos).

## 7. Accesibilidad y calidad

- Contraste AA. **Daltonismo**: tipos de día distinguibles por algo más que color.
- Targets táctiles cómodos; foco visible en teclado.
- Estados vacío / cargando / error contemplados.
- El texto debe escalar sin romperse; números siempre tabulares.

## 8. Entregables

- 2-3 **HTML standalone** (CSS + JS de demo inline), una por dirección visual, con datos de
  ejemplo (varias vacaciones, festivos, días libres) para ver el calendario "lleno".
- Conjunto de tokens (la paleta y tipografía de cada dirección) listados para portarlos a
  `public/index.html`.

## 9. No hacer

- No cambiar el **modelo de datos** ni los nombres de estado (vacaciones/libre/finde/trabajo/
  festivo nacional·catalunya·cornella).
- Nada de emojis en UI, ni librerías/CDNs, ni fuentes pesadas (system fonts o 1 webfont ligera máx).
- No esconder el calendario tras menús: es la pantalla principal.

## 10. TL;DR

PWA personal de vacaciones + jornada parcial. Protagonistas: **un número de días disponibles**
y un **calendario anual marcable** donde se distinguen vacaciones, días libres, findes,
trabajo y festivos (por ámbito), sin depender solo del color. Sobrio, móvil primero, un solo
archivo, sin librerías. Dame 2-3 direcciones visuales con nombre.
