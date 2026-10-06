"use client";

import { useState } from "react";
import { formatARS } from "@/lib/format";
import { crearXlsx } from "@/lib/xlsx";
import { useProductos, type TramoPunitorio } from "@/lib/productos";
import {
  aplicarPunitorios,
  organismosDelProducto,
  restaurarPunitorios,
  simular,
  useLogPunitorios,
  type RegistroPunitorios,
} from "@/lib/punitorios-cartera";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import { IconCheck } from "@/components/icons";
import { CampoNumero, Subtitulo } from "./campos";

const signo = (n: number) => (n > 0 ? "+" : "") + formatARS(n);

function Pasos({ pasos, actual }: { pasos: string[]; actual: number }) {
  return (
    <ol className="mb-5 flex flex-wrap items-center gap-2 text-xs font-semibold">
      {pasos.map((p, i) => (
        <li key={p} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full ${
              i < actual
                ? "bg-success-600 text-white"
                : i === actual
                  ? "bg-brand-600 text-white"
                  : "bg-ink-100 text-ink-400"
            }`}
          >
            {i < actual ? <IconCheck width={12} height={12} strokeWidth={3} /> : i + 1}
          </span>
          <span className={i === actual ? "text-ink-900" : "text-ink-400"}>{p}</span>
          {i < pasos.length - 1 && <span className="h-px w-6 bg-ink-200" />}
        </li>
      ))}
    </ol>
  );
}

function descargarXlsx(nombreArchivo: string, hoja: string, filas: string[][]) {
  const blob = new Blob([crearXlsx(hoja, filas) as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type ValoresTramo = Pick<TramoPunitorio, "punitorioPct" | "montoTopeSinIva">;

const rango = (xs: number[], f: (n: number) => string) => {
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  return min === max ? f(min) : `${f(min)} a ${f(max)}`;
};

// Modificar los punitorios de la cartera activa, paso a paso: si el cambio es hacia atrás (toda la
// cartera histórica), qué tramos y con qué valor, a qué productos y organismos se aplica, descarga
// obligatoria del archivo con los créditos y confirmación. Cada aplicación queda como checkpoint
// por producto (fecha y quién): se puede volver a la versión anterior cuando se quiera.
export function CarteraPunitorios() {
  const registros = useLogPunitorios();
  // Sólo los productos que cobran punitorios tienen tramos que modificar.
  const productos = useProductos().filter((x) => x.config.estado !== "ELIMINADO" && x.extras.cobraPunitorios);

  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState(0);
  const [retroactivo, setRetroactivo] = useState<boolean | null>(null);
  // Tramos por posición (Tramo 1, 2…): el valor nuevo se aplica a ese tramo de cada producto elegido.
  const [elegidos, setElegidos] = useState<number[]>([]);
  const [valores, setValores] = useState<Record<number, ValoresTramo>>({});
  const [prodsElegidos, setProdsElegidos] = useState<string[]>([]);
  // Organismos cuya cartera se modifica: por defecto todos los de los productos elegidos.
  const [orgsElegidos, setOrgsElegidos] = useState<string[]>([]);
  const [descargado, setDescargado] = useState(false);
  const [revisado, setRevisado] = useState(false);
  const [entiendo, setEntiendo] = useState(false);
  const [aRestaurar, setARestaurar] = useState<RegistroPunitorios | null>(null);

  // Sólo hacia atrás hay créditos que cambian, y por eso hay que bajar y revisar el archivo.
  const pasos = retroactivo === false
    ? ["Alcance", "Tramos", "Productos", "Organismos", "Confirmar"]
    : ["Alcance", "Tramos", "Productos", "Organismos", "Archivo de créditos", "Confirmar"];
  const etapa = pasos[paso];

  const posiciones = Array.from(
    { length: Math.max(0, ...productos.map((x) => x.extras.tramosPunitorios.length)) },
    (_, i) => i
  );
  const conTramo = (i: number) =>
    productos.map((x) => x.extras.tramosPunitorios[i]).filter((t): t is TramoPunitorio => !!t);
  const hayCambioTramos = elegidos.some((i) =>
    conTramo(i).some((t) => t.punitorioPct !== valores[i].punitorioPct || t.montoTopeSinIva !== valores[i].montoTopeSinIva)
  );

  // Por producto: tramos vigentes, nuevos y si algo cambia con los valores elegidos.
  const planes = productos.map((x) => {
    const vigentes = x.extras.tramosPunitorios;
    const nuevos = vigentes.map((t, i) => (elegidos.includes(i) ? { ...t, ...valores[i] } : t));
    const cambia = nuevos.some(
      (t, i) => t.punitorioPct !== vigentes[i].punitorioPct || t.montoTopeSinIva !== vigentes[i].montoTopeSinIva
    );
    return { producto: x, vigentes, nuevos, cambia, organismos: organismosDelProducto(x.config.id) };
  });
  type Plan = (typeof planes)[number];
  const aplicables = planes.filter((pl) => pl.cambia && pl.organismos.length > 0);
  const elegidosPlanes = aplicables.filter((pl) => prodsElegidos.includes(pl.producto.config.id));
  const orgsDe = (pl: Plan) => pl.organismos.filter((o) => orgsElegidos.includes(o.id)).map((o) => o.id);
  // Organismos de los productos elegidos, sin repetir.
  const organismos = elegidosPlanes
    .flatMap((pl) => pl.organismos)
    .filter((o, i, xs) => xs.findIndex((y) => y.id === o.id) === i);
  const sinOrganismo = elegidosPlanes.filter((pl) => orgsDe(pl).length === 0);

  const filas = elegidosPlanes.flatMap((pl) =>
    simular(pl.producto.config.id, pl.vigentes, pl.nuevos, retroactivo !== false, orgsDe(pl)).map((f) => ({
      ...f,
      producto: pl.producto.config.nombre,
    }))
  );
  const totalAjuste = filas.reduce((s, f) => s + f.ajuste, 0);

  function abrir() {
    setPaso(0);
    setRetroactivo(null);
    setElegidos([]);
    setValores({});
    setProdsElegidos([]);
    setOrgsElegidos([]);
    setDescargado(false);
    setRevisado(false);
    setEntiendo(false);
    setAbierto(true);
  }

  function descargar() {
    descargarXlsx(
      "punitorios-cartera.xlsx",
      "Créditos",
      [
        ["Producto", "Crédito", "Cliente", "Días de mora", "Importe de la cuota", "Punitorio antes", "Punitorio después", "Se suma a la cuota actual"],
        ...filas.map((f) => [
          f.producto,
          f.credito.numero,
          f.credito.cliente,
          String(f.credito.diasMora),
          String(f.credito.importeCuota),
          String(f.antes),
          String(f.despues),
          String(f.ajuste),
        ]),
        ["", "", "", "", "", "", "Total", String(totalAjuste)],
      ]
    );
    setDescargado(true);
  }

  const puedeSeguir =
    etapa === "Alcance"
      ? retroactivo !== null
      : etapa === "Tramos"
        ? hayCambioTramos
        : etapa === "Productos"
          ? elegidosPlanes.length > 0
          : etapa === "Organismos"
            ? sinOrganismo.length === 0
            : revisado;

  function siguiente() {
    // Al entrar a Productos u Organismos, por defecto van todos los que aplican.
    if (etapa === "Tramos") setProdsElegidos(aplicables.map((pl) => pl.producto.config.id));
    if (etapa === "Productos") setOrgsElegidos(organismos.map((o) => o.id));
    setPaso(paso + 1);
  }

  function aplicar() {
    for (const pl of elegidosPlanes)
      aplicarPunitorios(pl.producto.config.id, pl.nuevos, retroactivo !== false, orgsDe(pl));
    setAbierto(false);
  }

  function restaurar() {
    if (!aRestaurar) return;
    restaurarPunitorios(aRestaurar.id);
    setARestaurar(null);
  }

  const opciones = [
    {
      valor: true,
      titulo: "Sí, hacia atrás: toda la cartera histórica",
      detalle:
        "Se recalculan los punitorios de todos los créditos en mora desde su primer día de mora y la diferencia se suma como interés adicional a la cuota actual.",
    },
    {
      valor: false,
      titulo: "No, sólo desde ahora",
      detalle: "Los créditos conservan lo ya devengado; los nuevos valores rigen para los días de mora que vengan.",
    },
  ];

  return (
    <div className="space-y-4 rounded-xl border border-warning-300 bg-warning-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-72">
          <Subtitulo>Modificar cartera activa</Subtitulo>
          <p className="mt-1 text-xs text-ink-600">
            Cambia los punitorios de los créditos activos de uno o más productos. Es un cambio delicado: se hace
            paso a paso, hay que descargar el archivo con los créditos y confirmar. Cada aplicación queda
            como checkpoint y se puede volver a la versión anterior.
          </p>
        </div>
        <Button onClick={abrir}>Modificar punitorios…</Button>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">Checkpoints</p>
        {registros.length === 0 ? (
          <p className="text-xs text-ink-500">Todavía no se modificaron los punitorios de la cartera.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-ink-200 bg-white">
            <table className="w-full min-w-[52rem] text-left text-xs">
              <thead className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Quién</th>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2">Acción</th>
                  <th className="px-3 py-2">Antes → después</th>
                  <th className="px-3 py-2 text-right">Ajuste total</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">Restaurar</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {registros.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-3 py-2 tabular-nums text-ink-700">{r.fecha}</td>
                    <td className="px-3 py-2 text-ink-700">{r.usuario}</td>
                    <td className="px-3 py-2 text-ink-700">{r.productoNombre}</td>
                    <td className="px-3 py-2">
                      <StatusBadge tone={r.accion === "RESTAURAR" ? "neutral" : "warning"}>
                        {r.accion === "RESTAURAR" ? "Restauración" : "Modificación"}
                      </StatusBadge>
                      <p className="mt-1 text-[11px] text-ink-500">
                        {r.retroactivo ? "Hacia atrás (cartera histórica)" : "Sólo desde ahora"}
                      </p>
                      <p className="text-[11px] text-ink-500">
                        {r.organismos
                          ? `${r.organismos.length} organismo${r.organismos.length === 1 ? "" : "s"}`
                          : "Todos los organismos"}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-ink-700">
                      {r.cambios.length === 0
                        ? "Sin cambios de %"
                        : r.cambios.map((c) => (
                            <div key={c.tramo}>
                              Tramo {c.tramo} (día {c.desdeDia}+): {c.pctAntes !== c.pctDespues && <>{c.pctAntes} % → <strong>{c.pctDespues} %</strong> </>}{c.topeAntes !== c.topeDespues && <>tope {formatARS(c.topeAntes)} → <strong>{formatARS(c.topeDespues)}</strong></>}
                            </div>
                          ))}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{signo(r.ajusteTotal)}</td>
                    <td className="px-3 py-2 text-right">
                      {r.accion === "APLICAR" && (
                        <Button size="sm" variant="outline" onClick={() => setARestaurar(r)}>
                          Restaurar versión anterior
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={abierto}
        onClose={() => setAbierto(false)}
        title="Modificar punitorios de la cartera"
        maxWidth="max-w-4xl"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => (paso === 0 ? setAbierto(false) : setPaso(paso - 1))}>
              {paso === 0 ? "Cancelar" : "Volver"}
            </Button>
            {paso < pasos.length - 1 ? (
              <Button disabled={!puedeSeguir} onClick={siguiente}>
                Siguiente
              </Button>
            ) : (
              <Button variant="success" disabled={!entiendo} onClick={aplicar}>
                Confirmar y aplicar
              </Button>
            )}
          </div>
        }
      >
        <Pasos pasos={pasos} actual={paso} />

        {etapa === "Alcance" && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-ink-800">¿Los cambios son hacia atrás, sobre toda la cartera histórica?</p>
            {opciones.map((o) => (
              <button
                key={String(o.valor)}
                type="button"
                onClick={() => setRetroactivo(o.valor)}
                className={`block w-full rounded-xl border p-4 text-left transition ${
                  retroactivo === o.valor ? "border-brand-400 bg-brand-50/50" : "border-ink-200 hover:border-ink-300"
                }`}
              >
                <p className="text-sm font-semibold text-ink-900">{o.titulo}</p>
                <p className="mt-1 text-xs text-ink-600">{o.detalle}</p>
              </button>
            ))}
          </div>
        )}

        {etapa === "Tramos" && (
          <div className="space-y-3">
            <p className="text-sm text-ink-600">
              Tildá los tramos que querés modificar y poné el % de punitorio sobre la tasa y el monto tope sin IVA que deben regir.
            </p>
            {posiciones.map((i) => {
              const activo = elegidos.includes(i);
              const hoy = conTramo(i);
              return (
                <div
                  key={i}
                  className={`grid items-center gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_22rem] ${
                    activo ? "border-brand-300 bg-brand-50/40" : "border-ink-200"
                  }`}
                >
                  <Checkbox
                    checked={activo}
                    onChange={(v) => {
                      if (v && !valores[i])
                        setValores({ ...valores, [i]: { punitorioPct: hoy[0].punitorioPct, montoTopeSinIva: hoy[0].montoTopeSinIva } });
                      setElegidos(v ? [...elegidos, i] : elegidos.filter((x) => x !== i));
                    }}
                    label={`Tramo ${i + 1} · desde el día ${rango(hoy.map((t) => t.desdeDia), String)}`}
                    description={`Hoy: ${rango(hoy.map((t) => t.punitorioPct), (n) => `${n} %`)} sobre la tasa · tope ${rango(
                      hoy.map((t) => t.montoTopeSinIva),
                      formatARS
                    )}${hoy.length < productos.length ? ` · lo tienen ${hoy.length} de ${productos.length} productos` : ""}`}
                  />
                  {activo && (
                    <div className="grid grid-cols-2 gap-3">
                      <CampoNumero
                        id={`cart-pct-${i}`}
                        label="Nuevo porcentaje de tasa"
                        sufijo="%"
                        step={0.5}
                        value={valores[i].punitorioPct}
                        onChange={(v) => setValores({ ...valores, [i]: { ...valores[i], punitorioPct: v } })}
                      />
                      <MoneyInput
                        id={`cart-tope-${i}`}
                        label="Nuevo tope sin IVA"
                        value={valores[i].montoTopeSinIva}
                        onChange={(v) => setValores({ ...valores, [i]: { ...valores[i], montoTopeSinIva: v } })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {elegidos.length > 0 && !hayCambioTramos && (
              <p className="text-xs text-warning-700">Los valores elegidos son iguales a los actuales: cambiá al menos uno.</p>
            )}
          </div>
        )}

        {etapa === "Productos" && (
          <div className="space-y-3">
            <p className="text-sm text-ink-600">
              Elegí los productos cuya cartera se modifica. Los valores nuevos se aplican a esos tramos de cada producto.
            </p>
            {aplicables.length > 1 && (
              <Checkbox
                checked={elegidosPlanes.length === aplicables.length}
                onChange={(v) => setProdsElegidos(v ? aplicables.map((pl) => pl.producto.config.id) : [])}
                label="Todos los productos"
              />
            )}
            <div className="space-y-2">
              {planes.map((pl) => {
                const id = pl.producto.config.id;
                const motivo = !pl.cambia
                  ? "Con estos valores no cambia ningún tramo."
                  : pl.organismos.length === 0
                    ? "No tiene organismos: no hay cartera."
                    : null;
                const cambios = pl.nuevos
                  .map((t, i) => {
                    const v = pl.vigentes[i];
                    const partes = [
                      t.punitorioPct !== v.punitorioPct ? `${v.punitorioPct} % → ${t.punitorioPct} %` : "",
                      t.montoTopeSinIva !== v.montoTopeSinIva
                        ? `tope ${formatARS(v.montoTopeSinIva)} → ${formatARS(t.montoTopeSinIva)}`
                        : "",
                    ].filter(Boolean);
                    return partes.length ? `Tramo ${i + 1}: ${partes.join(", ")}` : null;
                  })
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div key={id} className="rounded-xl border border-ink-200 p-3">
                    <Checkbox
                      checked={!motivo && prodsElegidos.includes(id)}
                      disabled={!!motivo}
                      onChange={(v) => setProdsElegidos(v ? [...prodsElegidos, id] : prodsElegidos.filter((x) => x !== id))}
                      label={pl.producto.config.nombre}
                      description={motivo ?? cambios}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {etapa === "Organismos" && (
          <div className="space-y-3">
            <p className="text-sm text-ink-600">
              Elegí los organismos cuya cartera se modifica. Los créditos de los demás no cambian.
            </p>
            {sinOrganismo.length > 0 && (
              <ValidationMessage tipo="error">
                Elegí al menos un organismo de {sinOrganismo.map((pl) => pl.producto.config.nombre).join(", ")}.
              </ValidationMessage>
            )}
            <>
                <Checkbox
                  checked={orgsElegidos.length === organismos.length}
                  onChange={(v) => setOrgsElegidos(v ? organismos.map((o) => o.id) : [])}
                  label="Todos los organismos"
                />
                <div className="space-y-2">
                  {organismos.map((o) => (
                    <div key={o.id} className="rounded-xl border border-ink-200 p-3">
                      <Checkbox
                        checked={orgsElegidos.includes(o.id)}
                        onChange={(v) =>
                          setOrgsElegidos(v ? [...orgsElegidos, o.id] : orgsElegidos.filter((x) => x !== o.id))
                        }
                        label={o.nombre}
                        description={`Productos: ${elegidosPlanes
                          .filter((pl) => pl.organismos.some((x) => x.id === o.id))
                          .map((pl) => pl.producto.config.nombre)
                          .join(", ")}`}
                      />
                    </div>
                  ))}
                </div>
            </>
          </div>
        )}

        {etapa === "Archivo de créditos" && (
          <div className="space-y-4">
            <p className="text-sm text-ink-600">
              El impacto no se muestra en pantalla: descargá el Excel con los {filas.length} créditos activos en mora
              (punitorio antes, después y lo que se suma a la cuota actual) y revisalo antes de seguir.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant={descargado ? "outline" : "primary"} onClick={descargar}>
                {descargado ? "Descargar de nuevo" : "Descargar Excel"}
              </Button>
              {descargado ? (
                <span className="text-xs font-medium text-success-700">Archivo descargado.</span>
              ) : (
                <span className="text-xs text-ink-500">Es obligatorio para seguir.</span>
              )}
            </div>
            <Checkbox
              checked={revisado}
              onChange={setRevisado}
              disabled={!descargado}
              label="Descargué y revisé el archivo"
              description="Confirmo que los créditos y los importes son los esperados."
            />
          </div>
        )}

        {etapa === "Confirmar" && (
          <div className="space-y-4">
            <Banner tone="warning" title="Este cambio afecta a la cartera activa">
              {retroactivo !== false ? (
                <>
                  Se recalculan los punitorios de {filas.length} créditos desde su primer día de mora y la
                  diferencia (<strong>{signo(totalAjuste)}</strong> en total) se suma a la cuota actual de cada
                  uno.
                </>
              ) : (
                <>Los nuevos valores rigen sólo para los días de mora que vengan; no se modifica lo ya devengado.</>
              )}{" "}
              Productos: <strong>{elegidosPlanes.map((pl) => pl.producto.config.nombre).join(", ")}</strong>.{" "}
              Organismos incluidos: <strong>{organismos.filter((o) => orgsElegidos.includes(o.id)).map((o) => o.nombre).join(", ")}</strong>.{" "}
              Queda un checkpoint con la fecha y quién lo hizo, y podés volver a la versión anterior cuando quieras.
            </Banner>
            <ul className="space-y-1 text-sm text-ink-700">
              {[...elegidos]
                .sort((x, y) => x - y)
                .map((i) => (
                  <li key={i}>
                    Tramo {i + 1}: <strong>{valores[i].punitorioPct} %</strong> sobre la tasa · tope{" "}
                    <strong>{formatARS(valores[i].montoTopeSinIva)}</strong>
                  </li>
                ))}
            </ul>
            <Checkbox
              checked={entiendo}
              onChange={setEntiendo}
              label="Confirmo los cambios sobre la cartera activa"
              description="Se aplican apenas confirmes."
            />
          </div>
        )}
      </Modal>

      <Modal
        open={!!aRestaurar}
        onClose={() => setARestaurar(null)}
        title="Restaurar versión anterior"
        maxWidth="max-w-md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setARestaurar(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={restaurar}>
              Restaurar
            </Button>
          </div>
        }
      >
        {aRestaurar && (
          <div className="space-y-2 text-sm text-ink-700">
            <p>
              Los tramos de <strong>{aRestaurar.productoNombre}</strong> vuelven a los que había antes de la modificación del{" "}
              <strong>{aRestaurar.fecha}</strong> de {aRestaurar.usuario}
              {aRestaurar.retroactivo ? " y se recalcula la cartera con ellos, sacando lo que se había sumado a las cuotas actuales" : ""}.
            </p>
            <p className="text-xs text-ink-500">Queda registrado como un nuevo checkpoint.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
