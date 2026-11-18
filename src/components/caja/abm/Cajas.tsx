"use client";

import { useState } from "react";
import { CUENTAS_CONTABLES, USUARIOS_CAJA } from "@/lib/caja-datos";
import { errorBajaCaja, errorCambioResponsables, erroresCaja } from "@/lib/caja-reglas";
import { cajaStores, hoy, siguienteId, useCajas, useJornadas, useLibro, usuarioActual, useSucursales } from "@/lib/caja-store";
import {
  MONEDAS,
  NOMBRE_MONEDA,
  TIPO_CAJA_LABEL,
  esTesoro,
  monedasDe,
  type Caja,
  type CajeroTurno,
  type FrecuenciaArqueo,
  type ModalidadRelevo,
  type MonedaCaja,
  type PorMoneda,
  type TipoCaja,
} from "@/lib/caja-tipos";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { SelectField } from "@/components/ui/SelectField";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import { IconPlus, IconTrash } from "@/components/icons";
import { AbmCaja, ESTADOS_TRES, ModalFormulario, persistir, type Columna } from "./AbmCaja";

const ENTIDAD = "Caja";

const nombreUsuario = (id: string) => USUARIOS_CAJA.find((u) => u.id === id)?.nombre ?? id;

const FRECUENCIAS: { value: FrecuenciaArqueo; label: string }[] = [
  { value: "SIN_FRECUENCIA", label: "Sin frecuencia" },
  { value: "SEMANAL", label: "Semanal" },
  { value: "QUINCENAL", label: "Quincenal" },
  { value: "MENSUAL", label: "Mensual" },
];

const opcionesUsuario = (rol: "TESORERO" | "OPERADOR") =>
  USUARIOS_CAJA.filter((u) => (rol === "TESORERO" ? u.roles.includes("TESORERO") : u.roles.includes("CAJERO") || u.roles.includes("TESORERO"))).map((u) => ({
    value: u.id,
    label: u.nombre,
  }));

const cuentasOpciones = CUENTAS_CONTABLES.map((c) => ({ value: c.codigo, label: `${c.codigo} · ${c.nombre}` }));

function FormularioCaja({ inicial, onClose }: { inicial: Caja | null; onClose: () => void }) {
  const cajas = useCajas();
  const sucursales = useSucursales();
  const jornadas = useJornadas();
  const [c, setC] = useState<Caja>(
    inicial ?? {
      id: "",
      nombre: "",
      sucursalId: "",
      tipo: "CAJA_CAJERO",
      moneda: "ARS",
      tesoreroId: "",
      cajeros: [],
      horarioDesde: "10:00",
      horarioHasta: "18:00",
      importeMaximo: { ARS: 0, USD: 0 },
      toleranciaSobrante: { ARS: 0, USD: 0 },
      toleranciaFaltante: { ARS: 0, USD: 0 },
      relevo: "DIRECTO",
      frecuenciaArqueo: "MENSUAL",
      cuentaContable: "",
      estado: "ACTIVO",
      fechaAlta: "",
      usuarioAlta: "",
    }
  );
  const [intentado, setIntentado] = useState(false);

  const normalizada: Caja = { ...c, id: inicial?.id ?? "", tesoreroId: esTesoro(c.tipo) ? c.tesoreroId : "" };
  const errores = erroresCaja(normalizada, cajas, sucursales, USUARIOS_CAJA);
  if (inicial) {
    const cambioResponsables = errorCambioResponsables(inicial, normalizada, jornadas);
    if (cambioResponsables) errores.cajeros = cambioResponsables;
  }
  const e = (k: string) => (intentado ? errores[k] : undefined);
  const monedas = monedasDe(c.moneda);

  const set = <K extends keyof Caja>(k: K, v: Caja[K]) => setC((x) => ({ ...x, [k]: v }));
  const setImporte = (k: "importeMaximo" | "toleranciaSobrante" | "toleranciaFaltante", m: "ARS" | "USD", v: number) =>
    setC((x) => ({ ...x, [k]: { ...x[k], [m]: v } as PorMoneda }));
  const setCajero = (i: number, parche: Partial<CajeroTurno>) =>
    setC((x) => ({ ...x, cajeros: x.cajeros.map((r, j) => (j === i ? { ...r, ...parche } : r)) }));

  const sucursalesOpciones = sucursales
    .filter((s) => s.estado === "ACTIVO" || s.id === inicial?.sucursalId)
    .map((s) => ({ value: s.id, label: s.nombre }));

  const grabar = () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    const limpia = { ...normalizada, nombre: c.nombre.trim().replace(/\s+/g, " ") };
    persistir(
      cajaStores.cajas,
      ENTIDAD,
      inicial,
      inicial
        ? limpia
        : { ...limpia, id: siguienteId("CAJ", cajaStores.cajas.get().map((x) => x.id)), fechaAlta: hoy(), usuarioAlta: usuarioActual().nombre }
    );
    onClose();
  };

  return (
    <ModalFormulario titulo={inicial ? `Modificar ${inicial.nombre}` : "Nueva caja"} onClose={onClose} onGrabar={grabar} maxWidth="max-w-4xl">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {inicial && <FormField id="caja-id" label="ID de caja" value={inicial.id} onChange={() => {}} disabled hint="Lo asigna el sistema." />}
          <FormField id="caja-nombre" label="Nombre" required value={c.nombre} onChange={(v) => set("nombre", v)} placeholder="Ej.: Caja Sucursal Bariloche" error={e("nombre")} />
          <SelectField id="caja-sucursal" label="Sucursal" required value={c.sucursalId} onChange={(v) => set("sucursalId", v)} options={sucursalesOpciones} error={e("sucursalId")} />
          <SelectField
            id="caja-tipo"
            label="Tipo de caja"
            required
            value={c.tipo}
            onChange={(v) => set("tipo", v as TipoCaja)}
            options={(Object.keys(TIPO_CAJA_LABEL) as TipoCaja[]).map((t) => ({ value: t, label: TIPO_CAJA_LABEL[t] }))}
            error={e("tipo")}
          />
          <SelectField
            id="caja-moneda"
            label="Moneda"
            required
            value={c.moneda}
            onChange={(v) => set("moneda", v as MonedaCaja)}
            options={[
              { value: "ARS", label: "Pesos" },
              { value: "USD", label: "Dólares" },
              { value: "AMBAS", label: "Ambas" },
            ]}
          />
          {esTesoro(c.tipo) && (
            <SelectField id="caja-tesorero" label="Tesorero" required value={c.tesoreroId} onChange={(v) => set("tesoreroId", v)} options={opcionesUsuario("TESORERO")} error={e("tesoreroId")} hint="Obligatorio para los tesoros. Usuario con rol Tesorero." />
          )}
        </div>

        <section>
          <h3 className="text-sm font-semibold text-ink-900">Cajeros y turnos</h3>
          <p className="mt-0.5 text-xs text-ink-500">
            Mínimo un responsable. Los turnos no se superponen y quedan dentro del horario operativo.
          </p>
          <div className="mt-3 space-y-2">
            {c.cajeros.length === 0 && <p className="rounded-lg border border-dashed border-ink-200 px-3 py-4 text-center text-sm text-ink-400">Todavía no hay cajeros asignados.</p>}
            {c.cajeros.map((r, i) => (
              <div key={i} className="grid items-end gap-3 rounded-lg border border-ink-200 p-3 sm:grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr_auto]">
                <SelectField id={`caja-cajero-${i}`} label="Usuario" value={r.usuarioId} onChange={(v) => setCajero(i, { usuarioId: v })} options={opcionesUsuario("OPERADOR")} />
                <FormField id={`caja-desde-${i}`} label="Hora desde" type="time" value={r.desde} onChange={(v) => setCajero(i, { desde: v })} />
                <FormField id={`caja-hasta-${i}`} label="Hora hasta" type="time" value={r.hasta} onChange={(v) => setCajero(i, { hasta: v })} />
                <SelectField
                  id={`caja-cajero-estado-${i}`}
                  label="Estado"
                  value={r.estado}
                  onChange={(v) => setCajero(i, { estado: v as CajeroTurno["estado"] })}
                  options={[
                    { value: "ACTIVO", label: "Activo" },
                    { value: "INACTIVO", label: "Inactivo" },
                  ]}
                />
                <Button variant="ghost" size="sm" aria-label="Quitar cajero" onClick={() => set("cajeros", c.cajeros.filter((_, j) => j !== i))}>
                  <IconTrash width={14} height={14} />
                </Button>
              </div>
            ))}
          </div>
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            onClick={() => set("cajeros", [...c.cajeros, { usuarioId: opcionesUsuario("OPERADOR")[0].value, desde: c.horarioDesde, hasta: c.horarioHasta, estado: "ACTIVO" }])}
          >
            <IconPlus width={14} height={14} />
            Agregar cajero
          </Button>
          {e("cajeros") && <div className="mt-2"><ValidationMessage tipo="error">{e("cajeros")}</ValidationMessage></div>}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-ink-900">Horario operativo</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <FormField id="caja-horario-desde" label="Hora desde" type="time" required value={c.horarioDesde} onChange={(v) => set("horarioDesde", v)} error={e("horario")} />
            <FormField id="caja-horario-hasta" label="Hora hasta" type="time" required value={c.horarioHasta} onChange={(v) => set("horarioHasta", v)} />
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-ink-900">Límites y tolerancias</h3>
          <p className="mt-0.5 text-xs text-ink-500">
            El importe máximo dispara una alerta de saldo. Con una diferencia dentro de la tolerancia la caja se abre o cierra sin supervisor.
          </p>
          <div className="mt-3 space-y-3">
            {MONEDAS.filter((m) => monedas.includes(m)).map((m) => (
              <div key={m} className="grid gap-4 sm:grid-cols-3">
                <MoneyInput id={`caja-max-${m}`} label={`Importe máximo · ${NOMBRE_MONEDA[m]}`} value={c.importeMaximo[m]} onChange={(v) => setImporte("importeMaximo", m, v)} />
                <MoneyInput id={`caja-sob-${m}`} label={`Tolerancia de sobrante · ${NOMBRE_MONEDA[m]}`} value={c.toleranciaSobrante[m]} onChange={(v) => setImporte("toleranciaSobrante", m, v)} />
                <MoneyInput id={`caja-fal-${m}`} label={`Tolerancia de faltante · ${NOMBRE_MONEDA[m]}`} value={c.toleranciaFaltante[m]} onChange={(v) => setImporte("toleranciaFaltante", m, v)} />
              </div>
            ))}
          </div>
          {e("importes") && <div className="mt-2"><ValidationMessage tipo="error">{e("importes")}</ValidationMessage></div>}
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="caja-relevo"
            label="Modalidad de relevo"
            value={c.relevo}
            onChange={(v) => set("relevo", v as ModalidadRelevo)}
            options={[
              { value: "DIRECTO", label: "Directo (entre cajeros, doble confirmación)" },
              { value: "POR_TESORO", label: "Por tesoro" },
            ]}
          />
          <SelectField id="caja-arqueo" label="Frecuencia de arqueo ordinario" value={c.frecuenciaArqueo} onChange={(v) => set("frecuenciaArqueo", v as FrecuenciaArqueo)} options={FRECUENCIAS} hint="Alerta si no se cumple." />
          <SelectField id="caja-cuenta" label="Cuenta contable asociada" required value={c.cuentaContable} onChange={(v) => set("cuentaContable", v)} options={cuentasOpciones} error={e("cuentaContable")} className="sm:col-span-2" />
        </div>
      </div>
    </ModalFormulario>
  );
}

const COLUMNAS = (sucursales: { id: string; nombre: string }[]): Columna<Caja>[] => [
  { clave: "nombre", label: "Nombre", valor: (c) => c.nombre },
  { clave: "sucursal", label: "Sucursal", valor: (c) => sucursales.find((s) => s.id === c.sucursalId)?.nombre ?? c.sucursalId },
  { clave: "tipo", label: "Tipo", valor: (c) => TIPO_CAJA_LABEL[c.tipo] },
  { clave: "moneda", label: "Moneda", ancho: "w-24", valor: (c) => (c.moneda === "AMBAS" ? "Ambas" : NOMBRE_MONEDA[c.moneda]) },
  {
    clave: "responsables",
    label: "Responsables",
    valor: (c) =>
      [...(c.tesoreroId ? [`${nombreUsuario(c.tesoreroId)} (tesorero)`] : []), ...c.cajeros.filter((x) => x.estado === "ACTIVO").map((x) => nombreUsuario(x.usuarioId))].join(", "),
  },
  { clave: "horario", label: "Horario", ancho: "w-28", valor: (c) => `${c.horarioDesde} a ${c.horarioHasta}` },
];

export function Cajas() {
  const cajas = useCajas();
  const sucursales = useSucursales();
  const jornadas = useJornadas();
  const libro = useLibro();
  return (
    <div>
      <p className="mb-5 max-w-2xl text-sm text-ink-500">
        Tesoros, cajas de cajero y fondos fijos. Hay un único Tesoro central y, como máximo, un Tesoro por sucursal; las cajas de cajero
        dependen del tesoro de su sucursal. Una caja abierta o con saldo no se puede suspender ni eliminar.
      </p>
      <AbmCaja<Caja>
        entidad={ENTIDAD}
        archivo="cajas"
        singular="caja"
        plural="cajas"
        nuevoLabel="Nueva caja"
        registros={cajas}
        store={cajaStores.cajas}
        columnas={COLUMNAS(sucursales)}
        estados={ESTADOS_TRES}
        nombreDe={(c) => c.nombre}
        errorAccion={(c, a) => (a.estado === "SUSPENDIDO" || a.estado === "ELIMINADO" ? errorBajaCaja(c, libro, jornadas) : undefined)}
        formulario={(p) => <FormularioCaja key={p.inicial?.id ?? "nuevo"} {...p} />}
      />
    </div>
  );
}
