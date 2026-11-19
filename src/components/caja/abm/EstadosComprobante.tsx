"use client";

import { ESTADOS_COMPROBANTE } from "@/lib/proveedores-tipos";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";

export function EstadosComprobante() {
  return (
    <div className="space-y-4">
      <Banner tone="info" title="Los fija el sistema">
        El circuito de autorización y pago de los comprobantes usa estos estados; por eso no se pueden agregar, modificar ni eliminar. Se
        muestran como referencia. Los marcados como propuestos están pendientes de confirmar.
      </Banner>
      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5">Significado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {ESTADOS_COMPROBANTE.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3 font-semibold text-ink-900">
                  {e.label}
                  {e.propuesto && <span className="ml-2 rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-semibold text-warning-700">Propuesto</span>}
                </td>
                <td className="px-4 py-3 text-ink-700">{e.propuesto ? "Pendiente de confirmar" : e.significado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
