"use client";

import { useApplication } from "@/lib/application-context";
import { evaluarReglas, getMotor, reglaMarcada } from "@/lib/motores";
import { RESULTADO_LABEL, evaluarPlan, netoAAcreditar, seCancela, totalPrecancelaciones } from "@/lib/credit";
import { formatARS, formatPct } from "@/lib/format";
import { TERMINOS } from "@/lib/terminologia";
import { estadoTone, generarHistorialPagos } from "@/lib/historial-pagos";
import { Modal } from "@/components/ui/Modal";
import { CerrarFooter, Filas, Seccion } from "@/components/bandeja/ModalesBandeja";

interface ModalProps {
  open: boolean;
  onClose: () => void;
}

const tonoResultado = {
  ok: "text-success-700",
  marcada: "text-warning-700",
  falla: "text-danger-600",
} as const;

// Buró (situaciones que se traen con el DNI) y detalle de las reglas que evaluó el motor.
export function BuroMotorModal({ open, onClose }: ModalProps) {
  const { app } = useApplication();
  const motor = getMotor(app.riesgo.motorId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Buró y motor de riesgo"
      maxWidth="max-w-2xl"
      footer={<CerrarFooter onClose={onClose} />}
    >
      <Seccion titulo="Buró">
        <Filas
          filas={[
            { label: "Situación BCRA", value: app.situaciones?.bcra ?? "—" },
            { label: "Situación interna", value: app.situaciones?.interna ?? "—" },
          ]}
        />
      </Seccion>

      <Seccion titulo={`Motor · ${motor.nombre}`}>
        <ul className="space-y-2">
          {app.riesgo.reglas.map((r) => {
            const marcada = reglaMarcada(r);
            const estado = r.resultado === "PASA" ? "ok" : marcada ? "marcada" : "falla";
            return (
              <li key={r.id} className="rounded-xl border border-ink-200 px-4 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-ink-900">
                    {r.codigo} · {r.nombre}
                    {!r.bloqueante && (
                      <span className="ml-1.5 text-[11px] font-medium text-ink-400">
                        no bloqueante
                      </span>
                    )}
                  </p>
                  <span className={`shrink-0 text-xs font-bold ${tonoResultado[estado]}`}>
                    {estado === "ok" ? "Pasa" : estado === "marcada" ? "Marcada · revisar" : "No pasa"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-500">
                  {r.fuente} · Valor {r.valorEvaluado} · Condición {r.condicion}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-ink-600">
          Resultado:{" "}
          <strong>{app.riesgo.resultado ? RESULTADO_LABEL[app.riesgo.resultado] : "—"}</strong>
          {app.riesgo.fecha && ` · evaluado ${app.riesgo.fecha}`}
        </p>
      </Seccion>
    </Modal>
  );
}

// Reglas del motor y del plan que evaluó la solicitud: el conjunto completo, con su resultado.
export function ReglasMotorModal({ open, onClose }: ModalProps) {
  const { app } = useApplication();
  const motor = getMotor(app.riesgo.motorId);
  const plan = evaluarPlan(app);
  // Reglas ya evaluadas en la solicitud + el resto del catálogo del motor, para ver el conjunto completo.
  const reglasMotor = [
    ...app.riesgo.reglas,
    ...evaluarReglas(app, motor).filter((r) => !app.riesgo.reglas.some((e) => e.nombre === r.nombre)),
  ];

  type Estado = keyof typeof tonoResultado;
  const filas: {
    id: string;
    codigo: string;
    nombre: string;
    fuente: string;
    condicion: string;
    valor: string;
    tipo: string;
    estado: Estado;
  }[] = [
    ...reglasMotor.map((r) => ({
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      fuente: r.fuente,
      condicion: r.condicion,
      valor: r.valorEvaluado,
      tipo: r.bloqueante ? "Bloqueante" : "No bloqueante",
      estado: (r.resultado === "PASA" ? "ok" : reglaMarcada(r) ? "marcada" : "falla") as Estado,
    })),
    {
      id: "rci",
      codigo: "PL-01",
      nombre: "RCI (cuota sobre ingreso neto)",
      fuente: "Plan de cuotas",
      condicion: `Hasta ${plan.plan.rciMaxPct} %`,
      valor: formatPct(plan.rciPct),
      tipo: "Plan",
      estado: plan.cumpleRci ? "ok" : "falla",
    },
    {
      id: "endeudamiento",
      codigo: "PL-02",
      nombre: "Endeudamiento total",
      fuente: "Plan de cuotas",
      condicion: `Hasta ${plan.plan.endeudamientoMaxPct} %`,
      valor: formatPct(plan.endeudamientoPct),
      tipo: "Plan",
      estado: plan.cumpleEndeudamiento ? "ok" : "falla",
    },
    {
      id: "smvm",
      codigo: "PL-03",
      nombre: "Ingreso de bolsillo (SMVM)",
      fuente: "Plan de cuotas",
      condicion: `Mínimo ${formatARS(plan.plan.smvmBolsillo)}`,
      valor: formatARS(plan.ingresoBolsillo),
      tipo: "Plan",
      estado: plan.cumpleSmvm ? "ok" : "falla",
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reglas · ${motor.nombre}`}
      maxWidth="max-w-5xl"
      footer={<CerrarFooter onClose={onClose} />}
    >
      <p className="mb-3 text-sm text-ink-600">
        {filas.length} reglas: {reglasMotor.length} del motor y 3 del plan de cuotas.
        {app.riesgo.resultado && (
          <>
            {" "}
            Resultado del motor: <strong>{RESULTADO_LABEL[app.riesgo.resultado]}</strong>
            {app.riesgo.fecha && ` · evaluado ${app.riesgo.fecha}`}.
          </>
        )}
      </p>
      <div className="overflow-x-auto rounded-xl border border-ink-200">
        <table className="w-full min-w-[46rem] text-left text-xs">
          <thead className="bg-ink-50 text-[11px] uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Regla</th>
              <th className="px-3 py-2">Fuente</th>
              <th className="px-3 py-2">Condición</th>
              <th className="px-3 py-2">Valor evaluado</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 bg-white">
            {filas.map((f) => (
              <tr key={f.id}>
                <td className="px-3 py-2 font-mono font-semibold text-brand-700">{f.codigo}</td>
                <td className="px-3 py-2 font-medium text-ink-900">{f.nombre}</td>
                <td className="px-3 py-2 text-ink-600">{f.fuente}</td>
                <td className="px-3 py-2 text-ink-600">{f.condicion}</td>
                <td className="px-3 py-2 text-ink-700">{f.valor}</td>
                <td className="px-3 py-2 text-ink-500">{f.tipo}</td>
                <td className={`px-3 py-2 font-bold ${tonoResultado[f.estado]}`}>
                  {f.estado === "ok" ? "Pasa" : f.estado === "marcada" ? "Marcada · revisar" : "No pasa"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

// Desarrollo de los créditos propios que se renuevan (o precancelan por mora) con esta
// operación: crédito original, pagos, capital residual, cálculo de la cancelación y lo que
// se le mostró al cliente.
export function CreditosRenovarModal({ open, onClose }: ModalProps) {
  const { app } = useApplication();
  const aRenovar = app.oferta.creditosActivos.filter(seCancela);
  const total = totalPrecancelaciones(app.oferta);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Desarrollo del crédito a renovar"
      maxWidth="max-w-4xl"
      footer={<CerrarFooter onClose={onClose} />}
    >
      {aRenovar.length === 0 ? (
        <p className="rounded-xl border border-ink-200 bg-ink-25 px-4 py-3 text-sm text-ink-500">
          La operación no renueva créditos propios.
        </p>
      ) : (
        <>
          <div className="space-y-6">
            {aRenovar.map((c) => {
              const pagos = generarHistorialPagos(c).filter((h) => h.nro <= c.cuotasAbonadas);
              const d = c.desglose;
              return (
                <section key={c.id} className="rounded-xl border border-ink-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-sm font-bold text-brand-700">{c.id}</p>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        c.enMora
                          ? "border-danger-200 bg-danger-50 text-danger-700"
                          : "border-brand-200 bg-brand-50 text-brand-700"
                      }`}
                    >
                      {c.enMora ? "En mora · precancelación" : "A renovar"}
                    </span>
                  </div>

                  <Seccion titulo="Crédito original">
                    <Filas
                      filas={[
                        { label: "Capital original", value: formatARS(c.capitalOriginal) },
                        { label: "Cuotas", value: `${c.cuotasAbonadas} abonadas de ${c.cuotasOriginales}` },
                        { label: "Valor de cuota", value: formatARS(c.valorCuota) },
                        { label: "Capital residual", value: formatARS(c.capitalResidual) },
                      ]}
                    />
                  </Seccion>

                  <Seccion titulo={`Pagos realizados (${pagos.length})`}>
                    {pagos.length === 0 ? (
                      <p className="rounded-xl border border-ink-200 bg-ink-25 px-4 py-3 text-sm text-ink-500">
                        Sin pagos registrados.
                      </p>
                    ) : (
                      <div className="max-h-56 overflow-auto rounded-xl border border-ink-200">
                        <table className="min-w-full text-left text-xs">
                          <thead className="sticky top-0 bg-ink-50 text-[11px] uppercase tracking-wide text-ink-500">
                            <tr>
                              <th className="px-3 py-2">Cuota</th>
                              <th className="px-3 py-2">Vencimiento</th>
                              <th className="px-3 py-2">Importe</th>
                              <th className="px-3 py-2">Fecha de pago</th>
                              <th className="px-3 py-2">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ink-100 bg-white">
                            {pagos.map((h) => (
                              <tr key={h.nro}>
                                <td className="px-3 py-2 font-mono font-semibold text-ink-800">{h.nro}</td>
                                <td className="px-3 py-2 tabular-nums text-ink-700">{h.vencimiento}</td>
                                <td className="px-3 py-2 tabular-nums text-ink-900">{formatARS(h.importe)}</td>
                                <td className="px-3 py-2 tabular-nums text-ink-600">{h.fechaPago ?? "—"}</td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${estadoTone(h.estado)}`}
                                  >
                                    {h.estado}
                                    {h.diasAtraso ? ` · ${h.diasAtraso}d` : ""}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Seccion>

                  <Seccion titulo="Cálculo de la cancelación">
                    <Filas
                      filas={[
                        { label: "Capital residual", value: formatARS(d.capitalResidual) },
                        { label: "Intereses a vencer", value: formatARS(d.interesesAVencer) },
                        { label: "IVA", value: formatARS(d.iva) },
                        { label: "Cargos de cancelación", value: formatARS(d.cargosCancelacion) },
                        ...(d.punitorios ? [{ label: "Punitorios", value: formatARS(d.punitorios) }] : []),
                        {
                          label: "Total de la cancelación",
                          value: <strong className="tabular-nums">{formatARS(c.montoCancelacion)}</strong>,
                        },
                      ]}
                    />
                  </Seccion>
                </section>
              );
            })}
          </div>

          <Seccion titulo="Información mostrada al cliente">
            <Filas
              filas={[
                { label: "Capital solicitado", value: formatARS(app.oferta.montoSolicitado) },
                {
                  label: `Cancelación de ${aRenovar.length} crédito${aRenovar.length === 1 ? "" : "s"}`,
                  value: `−${formatARS(total)}`,
                },
                { label: TERMINOS.saldoAcreditacion, value: <strong>{formatARS(netoAAcreditar(app.oferta))}</strong> },
              ]}
            />
            <p className="mt-2 text-xs text-ink-500">
              La cancelación se descuenta del capital solicitado antes de acreditar.
            </p>
          </Seccion>
        </>
      )}
    </Modal>
  );
}

// Datos cargados por el vendedor (personales o laborales) para consulta puntual del analista.
export function DatosCamposModal({
  open,
  onClose,
  titulo,
  filas,
}: ModalProps & { titulo: string; filas: { label: string; value: string }[] }) {
  return (
    <Modal open={open} onClose={onClose} title={titulo} footer={<CerrarFooter onClose={onClose} />}>
      {filas.length === 0 ? (
        <p className="rounded-xl border border-ink-200 bg-ink-25 px-4 py-3 text-sm text-ink-500">
          Sin datos cargados.
        </p>
      ) : (
        <Filas filas={filas} />
      )}
    </Modal>
  );
}
