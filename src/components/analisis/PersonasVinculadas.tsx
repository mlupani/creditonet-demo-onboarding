"use client";

import type { ReactNode } from "react";
import type { Domicilio, PersonaVinculada } from "@/lib/types";
import { formatARS, nombreApellido } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconFileText } from "@/components/icons";

const valor = (v: string) => v?.trim() || "—";

function domicilio(d: Domicilio): string {
  const base = [`${d.calle} ${d.numero}`.trim(), d.piso && `piso ${d.piso}`, d.departamento && `dpto ${d.departamento}`]
    .filter(Boolean)
    .join(" ");
  const loc = [d.localidad, d.provincia].filter(Boolean).join(", ");
  return [base, loc, d.codigoPostal && `CP ${d.codigoPostal}`].filter(Boolean).join(" · ") || "—";
}

// Referencias y garantes del análisis: puede haber más de una persona en cada caso, así que
// cada una va en su propia ficha y el encabezado muestra cuántas hay contra lo que pide el producto.
export function PersonasVinculadas({
  titulo,
  icono,
  tipo,
  personas,
  minimo,
  maximo,
  onVerLegajo,
}: {
  titulo: string;
  icono: ReactNode;
  tipo: "REFERENCIA" | "GARANTE";
  personas: PersonaVinculada[];
  minimo: number;
  maximo: number;
  onVerLegajo?: (garanteId: string) => void;
}) {
  const faltan = Math.max(minimo - personas.length, 0);
  const singular = tipo === "GARANTE" ? "garante" : "referencia";
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            {icono}
          </span>
          {titulo}
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-600">
            {personas.length}
          </span>
        </h3>
        <p className={`text-xs ${faltan > 0 ? "font-semibold text-warning-700" : "text-ink-500"}`}>
          {faltan > 0
            ? `Faltan ${faltan} · mínimo ${minimo}`
            : minimo === 0 && maximo === 0
              ? "El producto no las pide"
              : `Mínimo ${minimo} · máximo ${maximo}`}
        </p>
      </div>

      {personas.length === 0 ? (
        <p className="mt-3 rounded-xl border border-ink-200 bg-ink-25 px-4 py-3 text-sm text-ink-500">
          Sin {singular === "garante" ? "garantes cargados" : "referencias cargadas"}.
        </p>
      ) : (
        <ul className={`mt-4 grid gap-3 ${personas.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {personas.map((p, idx) => {
            const campos: [string, string][] = [
              ["Domicilio", domicilio(p.domicilio)],
              ["Teléfono", valor(p.telefono)],
              ["Email", valor(p.email)],
            ];
            if (tipo === "GARANTE")
              campos.push(
                ["Condición laboral", valor(p.condicionLaboral)],
                ["Ingreso bruto / neto", `${formatARS(p.ingresoBruto)} / ${formatARS(p.ingresoNeto)}`],
                ["Empleador", [p.empleadorCalle, p.empleadorLocalidad].filter((x) => x.trim()).join(" · ") || "—"],
                ["Tel. empleador", [p.empleadorCompaniaTelefonica, p.empleadorTelefono].filter((x) => x.trim()).join(" ") || "—"]
              );
            else campos.push(["Condición laboral", valor(p.condicionLaboral)]);
            campos.push(["Banco / CBU", [valor(p.banco), p.cbu.trim()].filter((x) => x && x !== "—").join(" · ") || "—"]);
            const docs = p.reciboSueldo.length + p.otrosDocumentos.length;

            return (
              <li key={p.id} className="rounded-xl border border-ink-200 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-900">{nombreApellido(p) || "Sin nombre"}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                      <span className="rounded-full bg-ink-100 px-2 py-0.5 font-medium text-ink-600">
                        {valor(p.vinculo) === "—" ? "Sin vínculo" : p.vinculo}
                      </span>
                      <span className="tabular-nums">DNI {valor(p.dni)}</span>
                      {p.autocompletado && <span className="text-success-700">autocompletado por DNI</span>}
                    </p>
                  </div>
                </div>

                <dl className="mt-3 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                  {campos.map(([label, v]) => (
                    <div key={label} className={label === "Domicilio" ? "sm:col-span-2" : ""}>
                      <dt className="font-semibold uppercase tracking-wider text-ink-400">{label}</dt>
                      <dd className={`mt-0.5 break-words ${v === "—" ? "text-ink-400" : "text-ink-800"}`}>{v}</dd>
                    </div>
                  ))}
                </dl>

                {tipo === "GARANTE" && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3">
                    <p className={`text-xs ${p.reciboSueldo.length === 0 ? "font-semibold text-warning-700" : "text-ink-500"}`}>
                      {p.reciboSueldo.length === 0
                        ? "Recibo de sueldo pendiente"
                        : `${docs} documento${docs === 1 ? "" : "s"} en el legajo`}
                    </p>
                    {onVerLegajo && (
                      <Button size="sm" variant="outline" onClick={() => onVerLegajo(p.id)}>
                        <IconFileText width={14} height={14} />
                        Ver legajo virtual
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
