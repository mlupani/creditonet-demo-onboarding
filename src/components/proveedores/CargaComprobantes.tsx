"use client";

import { useRef, useState } from "react";
import { useUsuarioActual } from "@/lib/caja-store";
import {
  COLUMNAS_PLANTILLA,
  anularComprobante,
  autorizarComprobante,
  buscarProveedorPorCuit,
  cargarComprobante,
  confirmarLote,
  corregirComprobante,
  generarPlantilla,
  rechazarComprobante,
  validarFilasLote,
  type FilaAceptada,
  type FilaRechazada,
} from "@/lib/proveedores-operaciones";
import { formatearCuit, puedeAutorizar, validarCuit } from "@/lib/proveedores-reglas";
import { useComprobantes, useLotes, useProveedores, useTiposComprobante } from "@/lib/proveedores-store";
import { ESTADOS_COMPROBANTE, type Comprobante, type EstadoComprobanteId } from "@/lib/proveedores-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { ErrorBanner, NotaModal, PaginaCaja, descargarXlsx, quien } from "@/components/caja/comunes";
import { LlaveModal } from "@/components/caja/LlaveModal";
import { Campo, INPUT_COMPACTO, PanelVentana, Pill, TablaCompacta, Td, Th } from "@/components/caja/compacto";
import { EstadoComprobanteBadge, Pestanas, nombreProveedor, numeroComprobante, pesos } from "./comunes";
import { FormularioComprobante } from "./FormularioComprobante";

type Pestana = "manual" | "masiva" | "lista";

// ---------- Carga manual ----------

function CargaManual({ onCargado }: { onCargado: () => void }) {
  const proveedores = useProveedores();
  const [cuit, setCuit] = useState("");
  const [version, setVersion] = useState(0);
  const [exito, setExito] = useState<string | null>(null);

  const digitos = cuit.replace(/\D/g, "");
  const proveedor = buscarProveedorPorCuit(digitos, proveedores);
  const aviso =
    digitos.length === 11 && !proveedor
      ? validarCuit(digitos)
        ? "Ese CUIT no está dado de alta. El alta de proveedores se hace en Parámetros, sección Proveedores."
        : "El CUIT no es válido."
      : proveedor && proveedor.estado !== "ACTIVO"
        ? "El proveedor no está activo: no se le pueden cargar comprobantes."
        : null;

  return (
    <div className="space-y-4">
      <PanelVentana titulo="1. Proveedor">
        <div className="grid items-end gap-3 sm:grid-cols-2">
          <FormField
            id="carga-cuit"
            label="CUIT del proveedor"
            required
            value={cuit}
            onChange={(v) => {
              setCuit(v.replace(/[^\d-]/g, "").slice(0, 13));
              setExito(null);
            }}
            inputMode="numeric"
            placeholder="30-12345678-9"
            hint="Se busca por CUIT y aparece la razón social."
          />
          <div className="pb-1 text-xs">
            {proveedor && proveedor.estado === "ACTIVO" ? (
              <p className="text-ink-700">
                <span className="text-sm font-semibold text-ink-900">{proveedor.razonSocial}</span>
                <span className="block text-[11px] text-ink-500">
                  {proveedor.id} · CUIT {formatearCuit(proveedor.cuit)}
                </span>
              </p>
            ) : (
              <p className="text-ink-500">{aviso ?? "Ingresá los 11 dígitos."}</p>
            )}
          </div>
        </div>
      </PanelVentana>

      {exito && <Banner tone="success" title="Comprobante cargado">{exito}</Banner>}

      {proveedor && proveedor.estado === "ACTIVO" && (
        <PanelVentana titulo="2. Datos del comprobante y 3. Respaldo">
          <div>
            <FormularioComprobante
              key={`${proveedor.id}-${version}`}
              proveedor={proveedor}
              textoBoton="Cargar comprobante"
              onSubmit={(datos, respaldo) => {
                const r = cargarComprobante(proveedor.id, datos, respaldo);
                if (!r.ok) return r.error;
                setExito(`${r.comprobante.id} · ${numeroComprobante(r.comprobante)} por ${pesos(r.comprobante.total)}. Quedó Preaprobado, a la espera de un autorizador.`);
                setVersion((v) => v + 1);
                onCargado();
                return null;
              }}
            />
          </div>
        </PanelVentana>
      )}
    </div>
  );
}

// ---------- Carga masiva ----------

function parsearCsv(texto: string): string[][] {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  const primera = lineas[0] ?? "";
  const sep = primera.split(";").length > primera.split(",").length ? ";" : ",";
  return lineas.map((linea) => {
    const celdas: string[] = [];
    let actual = "";
    let comillas = false;
    for (const ch of linea) {
      if (ch === '"') comillas = !comillas;
      else if (ch === sep && !comillas) {
        celdas.push(actual);
        actual = "";
      } else actual += ch;
    }
    celdas.push(actual);
    return celdas.map((c) => c.trim());
  });
}

// Filas de demostración (con algunas inválidas) armadas con el CUIT del proveedor elegido.
function filasEjemplo(cuit: string): string[][] {
  const fila = (tipo: string, fecha: string, prefijo: string, numero: string, v: Partial<Record<number, string>>, total: string) => {
    const f = COLUMNAS_PLANTILLA.map(() => "");
    f[0] = cuit;
    f[1] = tipo;
    f[2] = fecha;
    f[3] = prefijo;
    f[4] = numero;
    for (const [k, x] of Object.entries(v)) f[Number(k)] = x ?? "";
    f[20] = total;
    f[21] = "Fila de ejemplo";
    return f;
  };
  // 7 = subtotal gravado, 10/11 = base e IVA 21 %, 8/9 = base e IVA 10,5 %.
  return [
    COLUMNAS_PLANTILLA,
    fila("Factura A", "2026-11-10", "0005", "7001", { 7: "100000", 10: "100000", 11: "21000", 22: "2026-12-10" }, "121000"),
    fila("Factura A", "2026-11-11", "0005", "7002", { 7: "50000", 8: "50000", 9: "5250", 22: "2026-11-25" }, "55250"),
    fila("Factura Z", "2026-11-12", "0005", "7003", { 7: "10000", 10: "10000", 11: "2100" }, "12100"),
    fila("Factura A", "31/02/2026", "0005", "7004", { 7: "10000", 10: "10000", 11: "2100" }, "12100"),
    fila("Factura A", "2026-11-13", "0005", "7005", { 7: "10000", 10: "10000", 11: "2100" }, "15000"),
    fila("Factura A", "2026-11-10", "0005", "7001", { 7: "100000", 10: "100000", 11: "21000" }, "121000"),
  ];
}

function CargaMasiva({ onCargado }: { onCargado: () => void }) {
  const proveedores = useProveedores();
  const lotes = useLotes();
  const entrada = useRef<HTMLInputElement>(null);
  const [proveedorId, setProveedorId] = useState("");
  const [archivo, setArchivo] = useState("");
  const [resultado, setResultado] = useState<{ aceptadas: FilaAceptada[]; rechazadas: FilaRechazada[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const proveedor = proveedores.find((p) => p.id === proveedorId);
  const activos = proveedores.filter((p) => p.estado === "ACTIVO");

  const validar = (nombre: string, filas: string[][]) => {
    setArchivo(nombre);
    setExito(null);
    setError(null);
    setResultado(validarFilasLote(proveedorId, filas));
  };

  const subir = async (f: File) => {
    setExito(null);
    if (!/\.(csv|txt)$/i.test(f.name)) {
      setResultado(null);
      setError("En la demo se lee el archivo en formato CSV: abrí la plantilla en Excel y guardala como CSV.");
      return;
    }
    validar(f.name, parsearCsv(await f.text()));
  };

  const confirmar = () => {
    if (!resultado) return;
    const r = confirmarLote(proveedorId, archivo, resultado.aceptadas, resultado.rechazadas.length);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setExito(
      `Lote ${r.lote.id}: se cargaron ${r.lote.aceptadas} comprobantes${r.lote.rechazadas > 0 ? ` y quedaron ${r.lote.rechazadas} sin cargar (descargalos para corregirlos)` : ""}. Todos quedaron Preaprobados.`
    );
    setError(null);
    onCargado();
    // Las rechazadas quedan disponibles para descargarlas; las aceptadas ya se grabaron.
    setResultado({ aceptadas: [], rechazadas: resultado.rechazadas });
  };

  const descargarRechazadas = () =>
    resultado &&
    descargarXlsx("comprobantes-rechazados.xlsx", "Rechazadas", [
      [...COLUMNAS_PLANTILLA, "Motivo del rechazo"],
      ...resultado.rechazadas.map((r) => [...r.datos, r.motivo]),
    ]);

  return (
    <div className="space-y-4">
      <PanelVentana titulo="Carga masiva por Excel">
        <ol className="list-decimal space-y-3 pl-5 text-xs text-ink-700">
          <li>
            <div className="max-w-md">
              <Campo label="Proveedor (ya dado de alta)">
                <select
                  id="masiva-proveedor"
                  aria-label="Proveedor (ya dado de alta)"
                  value={proveedorId}
                  onChange={(e) => {
                    setProveedorId(e.target.value);
                    setResultado(null);
                    setExito(null);
                  }}
                  className={INPUT_COMPACTO}
                >
                  <option value="">Elegí el proveedor</option>
                  {activos.map((p) => (
                    <option key={p.id} value={p.id}>{`${p.razonSocial} · ${formatearCuit(p.cuit)}`}</option>
                  ))}
                </select>
              </Campo>
            </div>
          </li>
          <li>
            Descargá la plantilla: una columna por cada campo de la carga manual.{" "}
            <Button size="xs" variant="navyOutline" onClick={() => descargarXlsx("plantilla-comprobantes.xlsx", "Comprobantes", generarPlantilla())}>
              Descargar plantilla
            </Button>
          </li>
          <li>
            Completala y subí el archivo (CSV).{" "}
            <input
              ref={entrada}
              type="file"
              accept=".csv,.txt,.xlsx"
              className="hidden"
              aria-label="Subir archivo de comprobantes"
              onChange={(ev) => {
                const f = ev.target.files?.[0];
                if (f) void subir(f);
                ev.target.value = "";
              }}
            />
            <Button size="xs" variant="success" disabled={!proveedor} onClick={() => entrada.current?.click()}>
              Subir archivo
            </Button>{" "}
            <Button
              size="xs"
              variant="navyOutline"
              disabled={!proveedor}
              onClick={() => proveedor && validar("comprobantes-ejemplo.csv", filasEjemplo(proveedor.cuit))}
            >
              Usar archivo de ejemplo
            </Button>
          </li>
          <li>Revisá la vista previa fila por fila y confirmá: sólo se graban las filas aceptadas.</li>
        </ol>
      </PanelVentana>

      <ErrorBanner error={error} titulo="No se pudo leer el archivo" />
      {exito && <Banner tone="success" title="Carga confirmada">{exito}</Banner>}

      {resultado && (
        <PanelVentana
          titulo={`Vista previa · ${archivo}`}
          accion={
            <span className="flex flex-wrap items-center gap-2">
              <Pill fase="ok">{resultado.aceptadas.length} aceptadas</Pill>
              <Pill fase="rechazo">{resultado.rechazadas.length} rechazadas</Pill>
            </span>
          }
        >
          <div className="mb-2 flex flex-wrap gap-2">
            {resultado.aceptadas.length > 0 && (
              <Button size="xs" variant="success" onClick={confirmar}>
                Confirmar la carga
              </Button>
            )}
            {resultado.rechazadas.length > 0 && (
              <Button size="xs" variant="navyOutline" onClick={descargarRechazadas}>
                Descargar rechazadas
              </Button>
            )}
          </div>
          <TablaCompacta etiqueta="Vista previa de la carga" minWidth="min-w-[40rem]">
            <thead>
              <tr>
                <Th>Fila</Th>
                <Th>Resultado</Th>
                <Th>Comprobante</Th>
                <Th derecha>Total</Th>
                <Th>Motivo</Th>
              </tr>
            </thead>
            <tbody>
              {resultado.aceptadas.map((a) => (
                <tr key={`a${a.fila}`}>
                  <Td>{a.fila}</Td>
                  <Td>
                    <Pill fase="ok">Aceptada</Pill>
                  </Td>
                  <Td>
                    {a.datos.fechaComprobante} · {a.datos.prefijo}-{a.datos.numero}
                  </Td>
                  <Td derecha>{pesos(a.datos.total)}</Td>
                  <Td className="text-ink-400">—</Td>
                </tr>
              ))}
              {resultado.rechazadas.map((r) => (
                <tr key={`r${r.fila}`} className="bg-danger-50/40">
                  <Td>{r.fila}</Td>
                  <Td>
                    <Pill fase="rechazo">Rechazada</Pill>
                  </Td>
                  <Td>
                    {r.datos[2]} · {r.datos[3]}-{r.datos[4]}
                  </Td>
                  <Td derecha>{r.datos[20]}</Td>
                  <Td className="text-danger-700">{r.motivo}</Td>
                </tr>
              ))}
            </tbody>
          </TablaCompacta>
        </PanelVentana>
      )}

      <div>
        <h2 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-600">Lotes registrados</h2>
        {lotes.length === 0 ? (
          <p className="rounded-lg border border-ink-200 bg-white px-5 py-5 text-center text-xs text-ink-400">Todavía no se subió ningún lote.</p>
        ) : (
          <TablaCompacta etiqueta="Lotes registrados" minWidth="min-w-[40rem]">
            <thead>
              <tr>
                <Th>Lote</Th>
                <Th>Proveedor</Th>
                <Th>Archivo</Th>
                <Th>Subió</Th>
                <Th>Cuándo</Th>
                <Th derecha>Aceptadas</Th>
                <Th derecha>Rechazadas</Th>
              </tr>
            </thead>
            <tbody>
              {[...lotes].reverse().map((l) => (
                <tr key={l.id}>
                  <Td className="font-mono font-bold text-brand-700">{l.id}</Td>
                  <Td>{nombreProveedor(proveedores, l.proveedorId)}</Td>
                  <Td>{l.archivo}</Td>
                  <Td>{quien(l.usuarioId)}</Td>
                  <Td className="whitespace-nowrap">{l.fechaHora}</Td>
                  <Td derecha>{l.aceptadas}</Td>
                  <Td derecha>{l.rechazadas}</Td>
                </tr>
              ))}
            </tbody>
          </TablaCompacta>
        )}
      </div>
    </div>
  );
}

// ---------- Comprobantes cargados ----------

function CorregirModal({ comprobante, onClose }: { comprobante: Comprobante; onClose: () => void }) {
  const proveedores = useProveedores();
  const proveedor = proveedores.find((p) => p.id === comprobante.proveedorId);
  return (
    <Modal open onClose={onClose} title={`Corregir ${comprobante.id}`} maxWidth="max-w-3xl">
      {comprobante.rechazo?.motivo && (
        <Banner tone="warning" title="Motivo del rechazo" className="mb-4">
          {comprobante.rechazo.motivo}
        </Banner>
      )}
      {proveedor && (
        <FormularioComprobante
          proveedor={proveedor}
          inicial={comprobante}
          prefijoId="corr"
          textoBoton="Corregir y reenviar a autorización"
          onSubmit={(datos) => {
            const r = corregirComprobante(comprobante.id, datos);
            if (!r.ok) return r.error;
            onClose();
            return null;
          }}
        />
      )}
    </Modal>
  );
}

function ListaComprobantes() {
  const comprobantes = useComprobantes();
  const proveedores = useProveedores();
  const tipos = useTiposComprobante();
  const usuario = useUsuarioActual();
  const [estado, setEstado] = useState<"" | EstadoComprobanteId>("");
  const [proveedorId, setProveedorId] = useState("");
  const [rechazando, setRechazando] = useState<Comprobante | null>(null);
  const [anulando, setAnulando] = useState<Comprobante | null>(null);
  const [corrigiendo, setCorrigiendo] = useState<Comprobante | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filas = comprobantes
    .filter((c) => (estado ? c.estado === estado : true))
    .filter((c) => (proveedorId ? c.proveedorId === proveedorId : true))
    .sort((a, b) => b.id.localeCompare(a.id));
  const tipoTexto = (id: string) => tipos.find((t) => t.id === id)?.descripcion ?? id;

  // La autorización se firma con la llave del autorizador (R6); recién ahí se autoriza el comprobante.
  const [firmando, setFirmando] = useState<Comprobante | null>(null);
  const autorizar = (c: Comprobante) => setFirmando(c);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <Campo label="Estado">
          <select
            id="lista-estado"
            aria-label="Estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value as "" | EstadoComprobanteId)}
            className={INPUT_COMPACTO}
          >
            <option value="">Todos</option>
            {ESTADOS_COMPROBANTE.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Proveedor">
          <select
            id="lista-proveedor"
            aria-label="Proveedor"
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            className={INPUT_COMPACTO}
          >
            <option value="">Todos</option>
            {proveedores
              .filter((p) => p.estado !== "ELIMINADO")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.razonSocial}
                </option>
              ))}
          </select>
        </Campo>
      </div>
      <p className="text-[11px] leading-snug text-ink-500">
        Autoriza un Supervisor o un Tesorero distinto de quien cargó el comprobante (cambiá el usuario en «Actuar como»). Al autorizar queda Para
        liquidar; el número de orden de pago se genera cuando el perfil financiero lo incluye en una orden (Órdenes de pago).
      </p>
      <ErrorBanner error={error} />
      {filas.length === 0 ? (
        <p className="rounded-lg border border-ink-200 bg-white px-5 py-6 text-center text-xs text-ink-400">No hay comprobantes para mostrar.</p>
      ) : (
        <TablaCompacta etiqueta="Comprobantes cargados" minWidth="min-w-[56rem]">
          <thead>
            <tr>
              <Th>ID</Th>
              <Th>Proveedor</Th>
              <Th>Comprobante</Th>
              <Th derecha>Total</Th>
              <Th>Cargó</Th>
              <Th>Estado</Th>
              <Th>OP</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((c) => {
              const denegado = c.estado === "PREAPROBADO" ? puedeAutorizar(usuario, c) : null;
              return (
                <tr key={c.id}>
                  <Td className="font-mono font-bold text-brand-700">{c.id}</Td>
                  <Td>{nombreProveedor(proveedores, c.proveedorId)}</Td>
                  <Td>
                    {tipoTexto(c.tipoId)}
                    <span className="block font-mono text-[11px] text-ink-500">
                      {numeroComprobante(c)} · {c.fechaComprobante}
                    </span>
                  </Td>
                  <Td derecha className="font-semibold">{pesos(c.total)}</Td>
                  <Td>
                    {quien(c.cargadoPor)}
                    <span className="block text-[11px] text-ink-500">{c.fechaCarga}{c.loteId ? ` · ${c.loteId}` : ""}</span>
                  </Td>
                  <Td>
                    <EstadoComprobanteBadge estado={c.estado} />
                    {c.estado === "RECHAZADO" && c.rechazo?.motivo && (
                      <span className="mt-1 block max-w-48 text-[11px] text-danger-700">{c.rechazo.motivo}</span>
                    )}
                    {c.estado === "ANULADO" && c.anulacion?.motivo && (
                      <span className="mt-1 block max-w-48 text-[11px] text-ink-500">{c.anulacion.motivo}</span>
                    )}
                  </Td>
                  <Td className="font-mono">{c.ordenPago ?? "—"}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      {c.estado === "PREAPROBADO" && (
                        <>
                          <Button size="xs" variant="successOutline" disabled={!!denegado} title={denegado ?? undefined} onClick={() => autorizar(c)}>
                            Autorizar
                          </Button>
                          <Button size="xs" variant="dangerOutline" disabled={!!denegado} title={denegado ?? undefined} onClick={() => setRechazando(c)}>
                            Rechazar
                          </Button>
                        </>
                      )}
                      {c.estado === "RECHAZADO" && (
                        <>
                          <Button size="xs" variant="brandOutline" onClick={() => setCorrigiendo(c)}>
                            Corregir
                          </Button>
                          <Button size="xs" variant="dangerOutline" onClick={() => setAnulando(c)}>
                            Anular
                          </Button>
                        </>
                      )}
                      {c.estado === "PARA_LIQUIDAR" && (
                        <Button size="xs" variant="dangerOutline" onClick={() => setAnulando(c)}>
                          Anular
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TablaCompacta>
      )}

      <NotaModal
        open={!!rechazando}
        titulo={`Rechazar ${rechazando?.id ?? ""}`}
        descripcion="El comprobante vuelve al operador para corregirlo o anularlo."
        etiquetaNota="Motivo del rechazo"
        requerida
        confirmar="Rechazar"
        tono="danger"
        onClose={() => setRechazando(null)}
        onConfirmar={(motivo) => {
          const r = rechazando ? rechazarComprobante(rechazando.id, motivo) : null;
          return r && !r.ok ? r.error : null;
        }}
      />
      <NotaModal
        open={!!anulando}
        titulo={`Anular ${anulando?.id ?? ""}`}
        descripcion="La anulación requiere permiso y motivo; el comprobante deja de impactar en la cuenta corriente."
        etiquetaNota="Motivo de la anulación"
        requerida
        confirmar="Anular"
        tono="danger"
        onClose={() => setAnulando(null)}
        onConfirmar={(motivo) => {
          const r = anulando ? anularComprobante(anulando.id, motivo) : null;
          return r && !r.ok ? r.error : null;
        }}
      />
      <LlaveModal
        open={!!firmando}
        titulo={`Autorizar ${firmando?.id ?? ""}`}
        descripcion="La autorización se firma con tu llave de autorización. Tiene que ser un usuario distinto del que cargó el comprobante."
        usuarioId={usuario.id}
        datos={{ operacion: "Autorización de comprobante", referencia: firmando?.id ?? "", importe: firmando?.total, moneda: "ARS", cargadoPor: firmando?.cargadoPor }}
        confirmar="Autorizar"
        onFirmada={() => {
          const r = firmando ? autorizarComprobante(firmando.id) : null;
          if (r && !r.ok) return r.error;
          setError(null);
          return null;
        }}
        onClose={() => setFirmando(null)}
      />
      {corrigiendo && <CorregirModal key={corrigiendo.id} comprobante={corrigiendo} onClose={() => setCorrigiendo(null)} />}
    </div>
  );
}

export function PantallaCargaComprobantes() {
  const [pestana, setPestana] = useState<Pestana>("manual");
  return (
    <PaginaCaja
      seccion="Proveedores"
      titulo="Carga de comprobantes"
      descripcion="Carga manual o masiva por Excel de facturas y demás comprobantes de proveedores, con circuito de autorización."
    >
      <div className="space-y-6">
        <Pestanas<Pestana>
          etiqueta="Modo de carga"
          valor={pestana}
          onChange={setPestana}
          opciones={[
            ["manual", "Carga manual"],
            ["masiva", "Carga masiva por Excel"],
            ["lista", "Comprobantes cargados"],
          ]}
        />
        {pestana === "manual" && <CargaManual onCargado={() => {}} />}
        {pestana === "masiva" && <CargaMasiva onCargado={() => {}} />}
        {pestana === "lista" && <ListaComprobantes />}
      </div>
    </PaginaCaja>
  );
}
