"use client";

import { ESTADOS_MOVIMIENTO } from "@/lib/caja-tipos";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";

export function EstadosMovimiento() {
  return (
    <div className="space-y-4">
      <Banner tone="info" title="Los fija el sistema">
        El circuito de los movimientos de tesorería usa estos estados; por eso no se pueden agregar, modificar ni eliminar. Se muestran como
        referencia.
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
            {ESTADOS_MOVIMIENTO.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3 font-semibold text-ink-900">{e.label}</td>
                <td className="px-4 py-3 text-ink-700">{e.significado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
