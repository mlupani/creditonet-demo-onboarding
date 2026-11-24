"use client";

import { useEffect, useState } from "react";
import { revisarAlertas } from "@/lib/alertas";
import { nombreUsuario } from "@/lib/caja-store";
import { ROL_CAJA_LABEL } from "@/lib/caja-tipos";
import { useAlertasEnviadas } from "@/lib/control-store";
import { EVENTOS_ALERTA, EVENTO_ALERTA_LABEL, type AlertaEnviada } from "@/lib/control-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { PanelVentana, TablaCompacta, Td, Th } from "./compacto";
import { CLASE_INPUT, PaginaCaja, descargarXlsx, sinAcentos } from "./comunes";

const ETIQUETA = "mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-500";
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
    <div className="space-y-3">
      <Banner tone="info" title="Los mails son simulados">
        Toda contingencia (diferencias sobre la tolerancia, actas No conformes, cajas o sucursales sin cerrar, arqueos vencidos, acuerdos por vencer…)
        dispara un mail a los roles configurados en Parámetros. Acá se ve la bandeja de salida.
      </Banner>
      <PanelVentana
        titulo="Filtros"
        accion={
          <div className="flex gap-1.5">
            <Button size="xs" variant="brandOutline" onClick={() => setNuevas(revisarAlertas())}>
              Revisar ahora
            </Button>
            <Button size="xs" variant="navyOutline" onClick={exportar}>
              Exportar a Excel
            </Button>
          </div>
        }
      >
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
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
          <p className="mt-2 text-xs font-semibold text-ink-700">
            La revisión generó {nuevas} {nuevas === 1 ? "alerta nueva" : "alertas nuevas"}.
          </p>
        )}
      </PanelVentana>

      <PanelVentana titulo={`Alertas enviadas · ${filas.length}`}>
        {filas.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink-400">No hay alertas para mostrar.</p>
        ) : (
          <TablaCompacta etiqueta="Alertas enviadas" minWidth="min-w-[48rem]">
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Fecha y hora</Th>
                <Th>Alerta</Th>
                <Th>Para</Th>
                <Th>Referencia</Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((a) => (
                <tr key={a.id}>
                  <Td className="font-mono font-bold text-brand-700">{a.id}</Td>
                  <Td className="whitespace-nowrap">{a.fechaHora}</Td>
                  <Td>
                    <p className="font-semibold text-ink-900">{EVENTO_ALERTA_LABEL[a.evento]}</p>
                    <p className="mt-0.5 text-[11px] text-ink-500">{a.detalle}</p>
                  </Td>
                  <Td className="text-[11px]">{paraTexto(a)}</Td>
                  <Td className="font-mono">{a.referencia ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </TablaCompacta>
        )}
      </PanelVentana>
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
