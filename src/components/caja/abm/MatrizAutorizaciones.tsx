"use client";

import { useState } from "react";
import { USUARIOS_CAJA } from "@/lib/caja-datos";
import { auditar, hoy, siguienteId, usuarioActual } from "@/lib/caja-store";
import { ROL_CAJA_LABEL, type RolCaja } from "@/lib/caja-tipos";
import { controlStores, useLlaves, useMatriz } from "@/lib/control-store";
import { ESTADO_LLAVE_LABEL, OPERACION_MATRIZ_LABEL, type EstadoLlave, type ReglaMatriz, type TipoOperacionMatriz } from "@/lib/control-tipos";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AbmCaja, ESTADOS_TRES, ModalFormulario, persistir, type Columna } from "./AbmCaja";

const ENTIDAD = "Matriz de autorizaciones";
const ROLES = Object.keys(ROL_CAJA_LABEL) as RolCaja[];
const rolesTexto = (r: RolCaja[]) => (r.length > 0 ? r.map((x) => ROL_CAJA_LABEL[x]).join(", ") : "—");
const topeTexto = (n: number | null) => (n === null ? "Sin tope" : n.toLocaleString("es-AR"));

const COLUMNAS: Columna<ReglaMatriz>[] = [
  { clave: "operacion", label: "Operación", valor: (r) => OPERACION_MATRIZ_LABEL[r.operacion] },
  { clave: "carga", label: "Carga", valor: (r) => rolesTexto(r.perfilCarga) },
  { clave: "autoriza", label: "Autoriza", valor: (r) => rolesTexto(r.perfilAutoriza) },
  { clave: "ars", label: "Hasta (pesos)", valor: (r) => topeTexto(r.importeHasta.ARS) },
  { clave: "usd", label: "Hasta (dólares)", valor: (r) => topeTexto(r.importeHasta.USD) },
  { clave: "remota", label: "Remota", valor: (r) => (r.admiteRemota ? "Sí" : "No") },
  { clave: "doble", label: "Doble", valor: (r) => (r.dobleAutorizacion ? "Sí" : "No") },
  { clave: "escala", label: "Escala a", valor: (r) => rolesTexto(r.escalaA) },
];

function ChecksRoles({ leyenda, valor, onChange, error }: { leyenda: string; valor: RolCaja[]; onChange: (v: RolCaja[]) => void; error?: string }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink-700">{leyenda}</legend>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {ROLES.map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={valor.includes(r)}
              onChange={() => onChange(valor.includes(r) ? valor.filter((x) => x !== r) : [...valor, r])}
              className="h-4 w-4"
            />
            {ROL_CAJA_LABEL[r]}
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-danger-700">{error}</p>}
    </fieldset>
  );
}

const aTope = (texto: string): number | null | undefined => {
  const t = texto.trim();
  if (t === "") return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

function FormularioRegla({ inicial, onClose }: { inicial: ReglaMatriz | null; onClose: () => void }) {
  const lista = useMatriz();
  const [operacion, setOperacion] = useState<TipoOperacionMatriz>(inicial?.operacion ?? "MOVIMIENTO_TESORERIA");
  const [carga, setCarga] = useState<RolCaja[]>(inicial?.perfilCarga ?? []);
  const [autoriza, setAutoriza] = useState<RolCaja[]>(inicial?.perfilAutoriza ?? []);
  const [escala, setEscala] = useState<RolCaja[]>(inicial?.escalaA ?? []);
  const [ars, setArs] = useState(inicial?.importeHasta.ARS?.toString() ?? "");
  const [usd, setUsd] = useState(inicial?.importeHasta.USD?.toString() ?? "");
  const [remota, setRemota] = useState(inicial?.admiteRemota ?? false);
  const [doble, setDoble] = useState(inicial?.dobleAutorizacion ?? false);
  const [intentado, setIntentado] = useState(false);

  const errores: Record<string, string> = {};
  if (carga.length === 0) errores.carga = "Elegí al menos un perfil que cargue.";
  if (autoriza.length === 0) errores.autoriza = "Elegí al menos un perfil que autorice.";
  if (aTope(ars) === undefined) errores.ars = "Ingresá un importe válido o dejalo vacío (sin tope).";
  if (aTope(usd) === undefined) errores.usd = "Ingresá un importe válido o dejalo vacío (sin tope).";
  const e = (k: string) => (intentado ? errores[k] : undefined);

  const grabar = () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    const base = {
      operacion,
      perfilCarga: carga,
      perfilAutoriza: autoriza,
      importeHasta: { ARS: aTope(ars) ?? null, USD: aTope(usd) ?? null },
      admiteRemota: remota,
      dobleAutorizacion: doble,
      escalaA: escala,
    };
    persistir(
      controlStores.matriz,
      ENTIDAD,
      inicial,
      inicial
        ? { ...inicial, ...base }
        : { ...base, id: siguienteId("MTX", lista.map((r) => r.id)), estado: "ACTIVO", fechaAlta: hoy(), usuarioAlta: usuarioActual().nombre }
    );
    onClose();
  };

  return (
    <ModalFormulario titulo={inicial ? `Modificar ${inicial.id}` : "Nueva regla de la matriz"} onClose={onClose} onGrabar={grabar} maxWidth="max-w-xl">
      <div className="space-y-4">
        {inicial && <FormField id="mtx-id" label="ID" value={inicial.id} onChange={() => {}} disabled hint="Lo asigna el sistema." />}
        <SelectField
          id="mtx-operacion"
          label="Tipo de operación"
          required
          value={operacion}
          onChange={(v) => setOperacion(v as TipoOperacionMatriz)}
          options={Object.entries(OPERACION_MATRIZ_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <ChecksRoles leyenda="Perfiles que pueden cargar" valor={carga} onChange={setCarga} error={e("carga")} />
        <ChecksRoles leyenda="Perfiles que autorizan" valor={autoriza} onChange={setAutoriza} error={e("autoriza")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="mtx-ars" label="Importe hasta (pesos)" value={ars} onChange={setArs} inputMode="numeric" error={e("ars")} hint="Vacío = sin tope." />
          <FormField id="mtx-usd" label="Importe hasta (dólares)" value={usd} onChange={setUsd} inputMode="numeric" error={e("usd")} hint="Vacío = sin tope." />
        </div>
        <ChecksRoles leyenda="Se escala al superior" valor={escala} onChange={setEscala} />
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={remota} onChange={(ev) => setRemota(ev.target.checked)} className="h-4 w-4" />
            Admite autorización remota de Casa Central
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={doble} onChange={(ev) => setDoble(ev.target.checked)} className="h-4 w-4" />
            Requiere doble autorización
          </label>
        </div>
      </div>
    </ModalFormulario>
  );
}

// Alta, baja y bloqueo de la llave de autorización de cada usuario (segundo factor).
function Llaves() {
  const llaves = useLlaves();
  const cambiar = (usuarioId: string, estado: EstadoLlave) => {
    const actual = llaves.find((l) => l.id === usuarioId);
    controlStores.llaves.commit(
      actual ? llaves.map((l) => (l.id === usuarioId ? { ...l, estado } : l)) : [...llaves, { id: usuarioId, estado }]
    );
    auditar("Llave de autorización", usuarioId, "ESTADO", actual ? ESTADO_LLAVE_LABEL[actual.estado] : null, ESTADO_LLAVE_LABEL[estado]);
  };
  return (
    <div className="mt-8">
      <h3 className="text-sm font-bold uppercase tracking-widest text-ink-700">Llaves de autorización</h3>
      <p className="mt-1 max-w-2xl text-sm text-ink-500">
        Toda autorización y toda firma de acta se hace con la llave personal (usuario y clave más segundo factor). Acá se da de baja o se bloquea la
        llave de un usuario; una llave bloqueada o de baja no puede firmar.
      </p>
      <Card className="mt-3 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              <th className="px-3 py-2.5">Usuario</th>
              <th className="px-3 py-2.5">Roles</th>
              <th className="px-3 py-2.5">Llave</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {USUARIOS_CAJA.map((u) => {
              const estado = llaves.find((l) => l.id === u.id)?.estado ?? "BAJA";
              return (
                <tr key={u.id}>
                  <td className="px-3 py-3 font-semibold text-ink-900">{u.nombre}</td>
                  <td className="px-3 py-3 text-ink-700">{rolesTexto(u.roles)}</td>
                  <td className="px-3 py-3">
                    <StatusBadge tone={estado === "ACTIVA" ? "success" : estado === "BLOQUEADA" ? "warning" : "neutral"}>{ESTADO_LLAVE_LABEL[estado]}</StatusBadge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {estado === "ACTIVA" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => cambiar(u.id, "BLOQUEADA")}>
                            Bloquear
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => cambiar(u.id, "BAJA")}>
                            Dar de baja
                          </Button>
                        </>
                      )}
                      {estado === "BLOQUEADA" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => cambiar(u.id, "ACTIVA")}>
                            Desbloquear
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => cambiar(u.id, "BAJA")}>
                            Dar de baja
                          </Button>
                        </>
                      )}
                      {estado === "BAJA" && (
                        <Button size="sm" variant="outline" onClick={() => cambiar(u.id, "ACTIVA")}>
                          Dar de alta
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function MatrizAutorizaciones() {
  const lista = useMatriz();
  return (
    <div>
      <p className="mb-5 max-w-2xl text-sm text-ink-500">
        Por tipo de operación: qué perfil puede cargar, qué perfil autoriza y hasta qué importe, si admite la autorización remota de Casa Central y si
        requiere doble autorización. Cada operación tiene varios escalones: el importe decide cuáles aplican. Nadie autoriza lo que cargó, aunque tenga
        otros roles.
      </p>
      <AbmCaja<ReglaMatriz>
        entidad={ENTIDAD}
        archivo="matriz-autorizaciones"
        singular="regla"
        plural="reglas"
        nuevoLabel="Nueva regla"
        registros={lista}
        store={controlStores.matriz}
        columnas={COLUMNAS}
        estados={ESTADOS_TRES}
        nombreDe={(r) => `${OPERACION_MATRIZ_LABEL[r.operacion]} · ${rolesTexto(r.perfilAutoriza)}`}
        formulario={(p) => <FormularioRegla key={p.inicial?.id ?? "nuevo"} {...p} />}
      />
      <Llaves />
    </div>
  );
}
