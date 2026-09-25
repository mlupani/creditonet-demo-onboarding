# Notificaciones de comentarios + Comentario canal de venta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada comentario en un crédito genera un aviso en la campanita del header que navega al crédito, y el chequeo suma la opción "Comentario canal de venta" sin mover el crédito.

**Architecture:** Store nuevo `lib/notificaciones.ts` (patrón `useSyncExternalStore` + `sessionStorage`, igual que `productos.ts`); `agregarComentario` emite el evento; `Header.tsx` fusiona avisos dinámicos sobre los estáticos; `ChequeoCredito.tsx` agrega el tercer radio.

**Tech Stack:** Next.js 16 + React 19 + TypeScript (sin test runner en el repo).

**Spec:** `docs/superpowers/specs/2026-09-25-notificaciones-comentarios-chequeo-design.md`

## Global Constraints

- El repo NO tiene runner de tests (scripts: `dev`, `build`, `start`, `lint`; cero archivos `*.test.*`). Verificación por task = `npx tsc --noEmit` + `npx eslint <tocados>` + chequeo manual guionado. No agregar frameworks de test en este plan (YAGNI).
- No cambiar la firma de `agregarComentario(texto, autor?)`.
- No tocar los avisos estáticos `NOTIFICACIONES` ni su comportamiento.
- Nunca mostrar CVV ni PAN completo (no aplica acá, pero rige el módulo: el store guarda solo extracto de 120 caracteres).
- Commits chicos, un task = un commit, solo archivos del task.

## Review Focus

- Comentar sobre la solicitud en curso sin `_id` (nuevo crédito de la demo): el clic en la campanita navega a la bandeja sin precargar y sin romper. → Verificación manual en Task 3.
- El crédito cambió de estado después del comentario: se navega por el estado snapshot (aceptado en el spec). → Verificación manual en Task 3.
- `sessionStorage` ausente o con JSON dañado: la campanita igual renderiza (tolera y sigue). → Verificación manual en Task 1.
- Comentario de 500 caracteres: el aviso muestra extracto de ~120 sin romper layout. → Verificación manual en Task 3.
- "Marcar todas como leídas" + recarga: persiste. → Verificación manual en Task 3.

---

### Task 1: Store de notificaciones

**Files:**
- Create: `src/lib/notificaciones.ts`

**Interfaces:**
- Consumes: `EstadoCredito` de `@/lib/types` (solo tipo).
- Produces (usado por Tasks 2 y 3 — nombres exactos):
  - `export interface ComentarioNotificacion { id: string; creditoId: string | null; numeroCredito: string | null; autor: string; texto: string; fecha: string; estado: EstadoCredito; leida: boolean }`
  - `export function hidratarNotificaciones(): void`
  - `export function agregarNotificacion(n: Omit<ComentarioNotificacion, "id" | "leida">): void`
  - `export function marcarLeida(id: string): void`
  - `export function marcarTodasLeidas(): void`
  - `export function useNotificaciones(): ComentarioNotificacion[]`
  - `export function extracto(texto: string): string` (recorta a 120, agrega "…" si recorta)
  - `export function rutaParaEstado(estado: EstadoCredito): "/" | "/analisis" | "/chequeo"` (`CHEQUEO_TELEFONICO → /chequeo`; `OBSERVADO | BORRADOR | EN_TRAMITE → /`; resto `→ /analisis`)

- [ ] **Step 1: Crear `src/lib/notificaciones.ts` con este contenido exacto**

```ts
import { useSyncExternalStore } from "react";
import type { EstadoCredito } from "./types";

export interface ComentarioNotificacion {
  id: string;
  creditoId: string | null;
  numeroCredito: string | null;
  autor: string;
  texto: string;
  fecha: string;
  estado: EstadoCredito;
  leida: boolean;
}

const CLAVE = "creditonet.notificaciones.v1";
let registros: ComentarioNotificacion[] = [];
const oyentes = new Set<() => void>();

function commit(lista: ComentarioNotificacion[]) {
  registros = lista;
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    /* demo sin persistencia si el storage no está disponible */
  }
  oyentes.forEach((f) => f());
}

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

function esValida(r: unknown): r is ComentarioNotificacion {
  const o = r as Record<string, unknown>;
  return (
    !!o &&
    typeof o.id === "string" &&
    (o.creditoId === null || typeof o.creditoId === "string") &&
    typeof o.autor === "string" &&
    typeof o.texto === "string" &&
    typeof o.fecha === "string" &&
    typeof o.estado === "string" &&
    typeof o.leida === "boolean"
  );
}

// Se llama una vez al hidratar la sesión, junto a hidratarProductos().
export function hidratarNotificaciones() {
  try {
    const raw = sessionStorage.getItem(CLAVE);
    if (!raw) return;
    const guardado = JSON.parse(raw) as unknown;
    if (Array.isArray(guardado) && guardado.every(esValida)) commit(guardado);
  } catch {
    /* si el guardado está dañado se arranca vacío */
  }
}

export function agregarNotificacion(n: Omit<ComentarioNotificacion, "id" | "leida">) {
  commit([{ ...n, id: `notif-${Date.now()}`, leida: false }, ...registros]);
}

export function marcarLeida(id: string) {
  commit(registros.map((r) => (r.id === id ? { ...r, leida: true } : r)));
}

export function marcarTodasLeidas() {
  commit(registros.map((r) => ({ ...r, leida: true })));
}

export function useNotificaciones(): ComentarioNotificacion[] {
  return useSyncExternalStore(suscribir, () => registros, () => []);
}

export function extracto(texto: string): string {
  const t = texto.trim();
  return t.length > 120 ? `${t.slice(0, 117)}…` : t;
}

export function rutaParaEstado(estado: EstadoCredito): "/" | "/analisis" | "/chequeo" {
  if (estado === "CHEQUEO_TELEFONICO") return "/chequeo";
  if (estado === "OBSERVADO" || estado === "BORRADOR" || estado === "EN_TRAMITE") return "/";
  return "/analisis";
}
```

- [ ] **Step 2: Cablear la hidratación junto a `hidratarProductos()`**

Run: `grep -rn "hidratarProductos()" src --include="*.tsx" | grep -v "lib/productos"`
Expected: una llamada dentro de un efecto de hidratación de sesión (p. ej. en `AppProvider`).

En ese efecto, importar y llamar al lado:

```ts
import { hidratarNotificaciones } from "./notificaciones";
// dentro del efecto, junto a hidratarProductos():
hidratarNotificaciones();
```

(Respetar el path relativo real del archivo donde esté el efecto: si es `application-context.tsx`, el import es `"./notificaciones"`.)

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS (sin salida)

- [ ] **Step 4: Commit**

```bash
git add src/lib/notificaciones.ts
git commit -m "feat: store de notificaciones de comentarios con persistencia"
```

---

### Task 2: Emitir aviso en cada comentario

**Files:**
- Modify: `src/lib/application-context.tsx` (import + `agregarComentario` en línea ~1570; chequear líneas con `grep -n "agregarComentario\|from \"./format\"\|appDbIdRef" src/lib/application-context.tsx`)

**Interfaces:**
- Consumes: `agregarNotificacion`, `extracto` de `./notificaciones` (Task 1); refs ya existentes `appRef`, `appDbIdRef`; `selloTiempo` (ya importado de `./format`).
- Produces: `agregarComentario` con la misma firma; cada comentario válido genera 1 aviso. Nada que otro task consuma salvo el evento en el store.

- [ ] **Step 1: Agregar el import**

```ts
import { agregarNotificacion, extracto } from "./notificaciones";
```

Ubicación: junto a los demás imports de `./` (cerca de `import { hidratarProductos } from "./productos";`).

- [ ] **Step 2: Emitir la notificación en `agregarComentario` (reemplazo exacto)**

```ts
  // Comentario sobre la solicitud: lo dejan tanto el canal de venta como el analista.
  // Además genera un aviso en la campanita (se lee por snapshot de refs: el updater de
  // setApp no debe tener efectos secundarios).
  const agregarComentario = useCallback((texto: string, autor: string = SESION.nombre) => {
    const limpio = texto.trim();
    const fecha = selloTiempo();
    const snap = appRef.current;
    setApp((prev) => ({
      ...prev,
      comentarios: [
        ...prev.comentarios,
        { id: `comentario-${Date.now()}`, autor, texto, fecha },
      ],
    }));
    if (!limpio) return;
    agregarNotificacion({
      creditoId: appDbIdRef.current,
      numeroCredito: snap.numeroCredito ?? null,
      autor,
      texto: extracto(limpio),
      fecha,
      estado: snap.estado,
    });
  }, []);
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npx eslint src/lib/application-context.tsx`
Expected: solo issues pre-existentes (`no-explicit-any`, `exhaustive-deps`); ninguno que mencione `agregarNotificacion`, `extracto`, `agregarComentario`

- [ ] **Step 4: Verificación manual (store)**

Run: `npm run dev`, abrir la bandeja del vendedor, en un crédito En análisis usar "Agregar comentario", luego en consola del navegador correr `sessionStorage.getItem("creditonet.notificaciones.v1")`.
Expected: un JSON con 1 aviso `{autor, texto (extracto), estado, leida: false}`

- [ ] **Step 5: Commit**

```bash
git add src/lib/application-context.tsx
git commit -m "feat: cada comentario genera aviso en la campanita"
```

---

### Task 3: Campanita con avisos dinámicos y navegación

**Files:**
- Modify: `src/components/layout/Header.tsx` (función `Notificaciones`, líneas 28-99; imports líneas 1-14)

**Interfaces:**
- Consumes: `useNotificaciones`, `marcarLeida`, `marcarTodasLeidas`, `rutaParaEstado`, tipo `ComentarioNotificacion` (Task 1); `cargarCreditoDeDB` de `useApplication()` (ya importado en el archivo); `useRouter` de `next/navigation`.
- Produces: nada (UI final).

- [ ] **Step 1: Agregar imports**

```tsx
import { useRouter } from "next/navigation";
import {
  marcarLeida,
  marcarTodasLeidas,
  rutaParaEstado,
  useNotificaciones,
  type ComentarioNotificacion,
} from "@/lib/notificaciones";
```

- [ ] **Step 2: Reescribir `Notificaciones()` con este contenido exacto**

```tsx
function Notificaciones() {
  const router = useRouter();
  const { cargarCreditoDeDB } = useApplication();
  const [abierto, setAbierto] = useState(false);
  const [leidas, setLeidas] = useState<string[]>([]);
  const dinamicas = useNotificaciones();
  const noLeidas =
    dinamicas.filter((n) => !n.leida).length +
    NOTIFICACIONES.filter((n) => !leidas.includes(n.id)).length;

  function abrirNotificacion(n: ComentarioNotificacion) {
    marcarLeida(n.id);
    if (n.creditoId) cargarCreditoDeDB(n.creditoId);
    router.push(rutaParaEstado(n.estado));
    setAbierto(false);
  }

  function marcarTodas() {
    marcarTodasLeidas();
    setLeidas(NOTIFICACIONES.map((n) => n.id));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-label="Notificaciones"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
      >
        <IconBell width={19} height={19} />
        {noLeidas > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-danger-500 ring-2 ring-white" />
        )}
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} aria-hidden />
          <div className="absolute right-0 z-50 mt-2 w-80 animate-slide-down overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lift">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">Notificaciones</p>
              <button
                onClick={marcarTodas}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                Marcar todas como leídas
              </button>
            </div>
            <ul className="max-h-80 overflow-y-auto scroll-thin">
              {dinamicas.map((n) => (
                <li key={n.id} className="border-b border-ink-50 last:border-0">
                  <button
                    onClick={() => abrirNotificacion(n)}
                    className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-ink-50 ${
                      n.leida ? "opacity-60" : "bg-brand-50/40"
                    }`}
                  >
                    <span className="mt-0.5 shrink-0 text-brand-600">
                      <IconInfo width={17} height={17} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug text-ink-900">
                        {n.numeroCredito ?? "Sin ID"} · {n.autor}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-500">
                        {n.texto}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-ink-400">{n.fecha}</p>
                    </div>
                  </button>
                </li>
              ))}
              {NOTIFICACIONES.map((n) => {
                const leida = leidas.includes(n.id);
                return (
                  <li
                    key={n.id}
                    className={`flex gap-3 border-b border-ink-50 px-4 py-3 last:border-0 ${
                      leida ? "opacity-60" : "bg-brand-50/40"
                    }`}
                  >
                    <span
                      className={`mt-0.5 shrink-0 ${
                        n.tone === "warning"
                          ? "text-warning-600"
                          : n.tone === "success"
                            ? "text-success-600"
                            : "text-brand-600"
                      }`}
                    >
                      {n.tone === "warning" ? (
                        <IconAlertTriangle width={17} height={17} />
                      ) : n.tone === "success" ? (
                        <IconCheckCircle width={17} height={17} />
                      ) : (
                        <IconInfo width={17} height={17} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug text-ink-900">{n.titulo}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{n.detalle}</p>
                      <p className="mt-1 text-[11px] font-medium text-ink-400">{n.hace}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
```

Nota: el bloque estático se copia tal cual del original; solo cambia el botón "Marcar todas" (`marcarTodas`) y se antepone la lista dinámica clicable.

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npx eslint src/components/layout/Header.tsx`
Expected: PASS sin issues

- [ ] **Step 4: Verificación manual (navegación + Review Focus)**

  1. Comentar en un crédito de la DB → punto rojo → clic en el aviso → cae en la bandeja del estado con el crédito como "En curso".
  2. Comentar sobre la solicitud en curso nueva (sin `_id`): el clic navega sin romper.
  3. Comentario de 500 caracteres: el aviso muestra ~120 con "…" sin romper layout.
  4. "Marcar todas como leídas" + recarga: persiste apagado.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: campanita con avisos de comentarios que navegan al crédito"
```

---

### Task 4: Opción "Comentario canal de venta" en el chequeo

**Files:**
- Modify: `src/components/chequeo/ChequeoCredito.tsx` (tipo `Resultado` línea 34, `OPCIONES` líneas 38-50, destructure línea 65, radio líneas 263-286, placeholder ~299, botones ~322, `pedirConfirmacion` ~90, modal ~361)

**Interfaces:**
- Consumes: `agregarComentario` de `useApplication()`; `SESION_CHEQUEADOR` (ya importado en el archivo); store de Task 1 (indirecto, vía `agregarComentario`).
- Produces: nada (UI final).

- [ ] **Step 1: Tipo y opciones (reemplazos exactos)**

```ts
type Resultado = "OK" | "NO_OK" | "COMENTARIO";
```

```ts
{
  valor: "COMENTARIO",
  titulo: "Comentario canal de venta",
  detalle:
    "Deja un comentario para el canal de venta sin mover el crédito: sigue en chequeo.",
},
```

Agregar como tercer elemento de `OPCIONES` (después de `NO_OK`).

- [ ] **Step 2: Destructure `agregarComentario`**

```ts
const { app, tomarChequeo, soltarChequeo, finalizarChequeo, enviarChequeoASuperior, agregarComentario } = useApplication();
```

(Reemplaza la línea 65 actual, que termina en `enviarChequeoASuperior }`.)

- [ ] **Step 3: Estilo del radio (rama neutra para COMENTARIO)**

```tsx
activa
  ? op.valor === "OK"
    ? "border-success-500 bg-success-50"
    : op.valor === "NO_OK"
      ? "border-danger-500 bg-danger-50"
      : "border-brand-500 bg-brand-50"
  : "border-ink-300 bg-white hover:border-ink-400"
```

(Reemplaza el ternario actual `OK ? success : danger`.)

- [ ] **Step 4: Placeholder y `pedirConfirmacion`**

Placeholder (agregar rama primera):

```tsx
resultado === "COMENTARIO"
  ? "Comentario para el canal de venta"
  : resultado === "NO_OK"
    ? "Qué pasó (ej.: el cliente se arrepintió y no quiso el crédito)"
    : "Con quién hablaste y qué confirmó"
```

`pedirConfirmacion` (el modal solo confirma OK/NO_OK):

```ts
if (!resultado || resultado === "COMENTARIO" || !comentarioValido) return;
```

- [ ] **Step 5: Botones (reemplazo exacto del bloque actual)**

```tsx
{resultado === "COMENTARIO" ? (
  <Button variant="primary" onClick={enviarComentario}>
    Enviar comentario
  </Button>
) : (
  <Button variant={resultado === "NO_OK" ? "danger" : "success"} onClick={pedirConfirmacion}>
    {resultado === "NO_OK" ? (
      <IconUsers width={16} height={16} />
    ) : (
      <IconCheck width={16} height={16} />
    )}
    {resultado === "NO_OK" ? "Enviar a SUP" : "Finalizar chequeo"}
  </Button>
)}
```

- [ ] **Step 6: Handler `enviarComentario` (agregar junto a `pedirConfirmacion`)**

```ts
function enviarComentario() {
  setIntentado(true);
  if (!comentarioValido) return;
  agregarComentario(comentario.trim(), SESION_CHEQUEADOR.nombre);
  setComentario("");
  setResultado(null);
  setIntentado(false);
}
```

Sin `ConfirmationModal`, sin `onSalir`, sin tocar `chequeoTelefonico`: el crédito sigue en chequeo.

- [ ] **Step 7: Verificar tipos, lint y manual**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npx eslint src/components/chequeo/ChequeoCredito.tsx`
Expected: PASS sin issues

Manual: tomar un chequeo → elegir "Comentario canal de venta" → enviar sin texto (pide ≥5) → enviar con texto → sigue en chequeo, el hilo lo muestra, la campanita suma el aviso; OK y NO_OK siguen igual.

- [ ] **Step 8: Commit**

```bash
git add src/components/chequeo/ChequeoCredito.tsx
git commit -m "feat: opción comentario canal de venta en resultado del chequeo"
```
