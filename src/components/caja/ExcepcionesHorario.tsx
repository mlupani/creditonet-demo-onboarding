"use client";

import { useState } from "react";
import { habilitarFueraDeHorario, nombreCaja } from "@/lib/caja-operaciones";
import { useCajas, useExcepciones, useFechaDemo, useHoraDemo, useUsuarioActual } from "@/lib/caja-store";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { CLASE_INPUT, ErrorBanner, quien } from "./comunes";

export function ExcepcionesHorario() {
  const cajas = useCajas().filter((c) => c.estado === "ACTIVO");
  const excepciones = useExcepciones();
  const usuario = useUsuarioActual();
  const fecha = useFechaDemo();
  const hora = useHoraDemo();
  const esTesorero = usuario.roles.includes("TESORERO");

  const [cajaElegida, setCaja] = useState("");
  const [usuarioElegido, setUsuario] = useState("");
  const [hasta, setHasta] = useState("20:00");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const cajaId = cajas.some((c) => c.id === cajaElegida) ? cajaElegida : (cajas[0]?.id ?? "");
  const caja = cajas.find((c) => c.id === cajaId);
  const responsables = caja
    ? [...new Set([caja.tesoreroId, ...caja.cajeros.filter((c) => c.estado === "ACTIVO").map((c) => c.usuarioId)].filter(Boolean))]
    : [];
  const habilitado = responsables.includes(usuarioElegido) ? usuarioElegido : (responsables[0] ?? "");
  const delDia = excepciones.filter((e) => e.fecha === fecha);

  const habilitar = () => {
    const r = habilitarFueraDeHorario(cajaId, habilitado, hasta, motivo);
    setOk(r.ok);
    setError(r.ok ? null : r.error);
    if (r.ok) setMotivo("");
  };

  return (
    <Card className="p-5">
      <h2 className="text-sm font-bold uppercase tracking-widest text-ink-700">Excepciones de horario</h2>
      <p className="mt-1 max-w-3xl text-sm text-ink-500">
        Fuera del horario operativo (o en un feriado o día no operativo) ningún cajero opera, salvo una excepción
        habilitada por el Tesorero. Queda registrado quién, cuándo, hasta qué hora y por qué motivo.
      </p>

      {esTesorero ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            id="exc-caja"
            label="Caja"
            value={cajaId}
            onChange={setCaja}
            options={cajas.map((c) => ({ value: c.id, label: c.nombre }))}
          />
          <SelectField
            id="exc-usuario"
            label="Usuario habilitado"
            value={habilitado}
            onChange={setUsuario}
            options={responsables.map((id) => ({ value: id, label: quien(id) }))}
          />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">Habilitado hasta</span>
            <input
              type="time"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              aria-label="Hora hasta la que se habilita"
              className={CLASE_INPUT}
            />
          </label>
          <FormField id="exc-motivo" label="Motivo" required value={motivo} onChange={setMotivo} placeholder="Ej.: cierre de mes" />
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-ink-200 bg-ink-25 px-3 py-2 text-sm text-ink-600">
          Sólo el Tesorero puede habilitar la operación fuera de horario. Cambiá a un usuario con ese rol para cargar una
          excepción.
        </p>
      )}

      {esTesorero && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={habilitar} disabled={!cajaId}>
            Habilitar excepción
          </Button>
          <span className="text-xs text-ink-400">Hora operativa actual de la demo: {hora}</span>
          {ok && <span className="text-sm font-medium text-success-700">Excepción registrada.</span>}
        </div>
      )}
      <ErrorBanner error={error} titulo="No se pudo habilitar la excepción" />

      <div className="mt-5 overflow-x-auto">
        {delDia.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-200 px-4 py-4 text-center text-sm text-ink-400">
            No hay excepciones habilitadas para el {fecha}.
          </p>
        ) : (
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                <th className="px-3 py-2.5">Caja</th>
                <th className="px-3 py-2.5">Usuario habilitado</th>
                <th className="px-3 py-2.5">Hasta</th>
                <th className="px-3 py-2.5">Motivo</th>
                <th className="px-3 py-2.5">Habilitó</th>
                <th className="px-3 py-2.5">Cuándo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {delDia.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2.5 text-ink-900">{nombreCaja(e.cajaId)}</td>
                  <td className="px-3 py-2.5 text-ink-700">{quien(e.usuarioId)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-ink-700">{e.hastaHora}</td>
                  <td className="px-3 py-2.5 text-ink-700">{e.motivo}</td>
                  <td className="px-3 py-2.5 text-ink-700">{quien(e.habilitadaPor)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink-500">{e.fechaHora}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
