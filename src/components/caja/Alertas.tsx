"use client";

import { useEffect, useState } from "react";
import { revisarAlertas } from "@/lib/alertas";
import { nombreUsuario } from "@/lib/caja-store";
import { ROL_CAJA_LABEL } from "@/lib/caja-tipos";
import { useAlertasEnviadas } from "@/lib/control-store";
import { EVENTOS_ALERTA, EVENTO_ALERTA_LABEL, type AlertaEnviada } from "@/lib/control-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { CLASE_INPUT, PaginaCaja, descargarXlsx, sinAcentos } from "./comunes";

const ETIQUETA = "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-400";
const paraTexto = (a: AlertaEnviada) =>
  a.destinatarios.length > 0 ? a.destinatarios.map((d) => `${nombreUsuario(d.usuarioId)} (${ROL_CAJA_LABEL[d.rol]})`).join(", ") : "Sin destinatarios configurados";

function BandejaDeSalida() {
  const alertas = useAlertasEnviadas();
  const [evento, setEvento] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [texto, setTexto] = useState("");
  const [nuevas, setNuevas] = useState<number | null>(null);

  // Las condiciones que dependen del tiempo (caja sin cerrar, arqueo vencido, acuerdos por vencer…) se
  // revisan al entrar a la pantalla y cuando se pide; cada aviso se manda una vez por fecha.
  useEffect(() => {
    revisarAlertas();
  }, []);

  const q = sinAcentos(texto.trim());
  const filas = alertas
    .filter((a) => !evento || a.evento === evento)
    .filter((a) => !desde || a.fechaHora.slice(0, 10) >= desde)
    .filter((a) => !hasta || a.fechaHora.slice(0, 10) <= hasta)
    .filter((a) => !q || sinAcentos(`${a.id} ${a.asunto} ${a.detalle} ${a.referencia ?? ""} ${paraTexto(a)}`).includes(q))
    .sort((a, b) => b.id.localeCompare(a.id));

  const exportar = () =>
    descargarXlsx("alertas-enviadas.xlsx", "Alertas enviadas", [
      ["ID", "Fecha y hora", "Evento", "Asunto", "Detalle", "Destinatarios", "Referencia"],
      ...filas.map((a) => [a.id, a.fechaHora, EVENTO_ALERTA_LABEL[a.evento], a.asunto, a.detalle, paraTexto(a), a.referencia ?? ""]),
    ]);

  return (
    <div className="space-y-4">
      <Banner tone="info" title="Los mails son simulados">
        Toda contingencia (diferencias sobre la tolerancia, actas No conformes, cajas o sucursales sin cerrar, arqueos vencidos, acuerdos por vencer…)
        dispara un mail a los roles configurados en Parámetros. Acá se ve la bandeja de salida.
      </Banner>
      <Card>
        <CardHeader
          title="Filtros"
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setNuevas(revisarAlertas())}>
                Revisar ahora
              </Button>
              <Button size="sm" variant="outline" onClick={exportar}>
                Exportar a Excel
              </Button>
            </div>
          }
        />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className={ETIQUETA}>Evento</span>
            <select value={evento} onChange={(e) => setEvento(e.target.value)} aria-label="Evento" className={CLASE_INPUT}>
              <option value="">Todos</option>
              {EVENTOS_ALERTA.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={ETIQUETA}>Desde</span>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" className={CLASE_INPUT} />
          </label>
          <label className="block">
            <span className={ETIQUETA}>Hasta</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" className={CLASE_INPUT} />
          </label>
          <label className="block">
            <span className={ETIQUETA}>Buscar</span>
            <input type="text" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="ID, caja, destinatario…" aria-label="Buscar" className={CLASE_INPUT} />
          </label>
        </div>
        {nuevas !== null && nuevas > 0 && (
          <p className="border-t border-ink-100 px-5 py-3 text-sm text-ink-700">
            La revisión generó {nuevas} {nuevas === 1 ? "alerta nueva" : "alertas nuevas"}.
          </p>
        )}
      </Card>

      <Card className="overflow-hidden">
        {filas.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-400">No hay alertas para mostrar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead>
                <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  <th className="px-3 py-2.5">ID</th>
                  <th className="px-3 py-2.5">Fecha y hora</th>
                  <th className="px-3 py-2.5">Alerta</th>
                  <th className="px-3 py-2.5">Para</th>
                  <th className="px-3 py-2.5">Referencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 align-top">
                {filas.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-3 font-mono text-xs font-bold text-brand-700">{a.id}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-700">{a.fechaHora}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-ink-900">{EVENTO_ALERTA_LABEL[a.evento]}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{a.detalle}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-ink-700">{paraTexto(a)}</td>
                    <td className="px-3 py-3 font-mono text-xs text-ink-700">{a.referencia ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export function PantallaAlertas() {
  return (
    <PaginaCaja
      seccion="Posición de caja y bancos"
      titulo="Alertas enviadas"
      descripcion="Bandeja de salida de los mails de alerta del módulo (simulados): a quién se avisó, cuándo y por qué."
    >
      <BandejaDeSalida />
    </PaginaCaja>
  );
}
