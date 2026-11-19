"use client";

import { useRef, useState } from "react";
import { calcularTotal, erroresComprobante, formatearCuit, type DatosComprobante } from "@/lib/proveedores-reglas";
import { useComprobantes, useTiposComprobante } from "@/lib/proveedores-store";
import { ALICUOTAS_IVA, type AlicuotaIva, type Comprobante, type Proveedor } from "@/lib/proveedores-tipos";
import { hoy } from "@/lib/caja-store";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { ErrorBanner } from "@/components/caja/comunes";
import { aNumero, pesos, textoNumero } from "./comunes";

const redondear = (n: number) => Math.round(n * 100) / 100;
const etiquetaAlicuota = (a: AlicuotaIva) => a.replace(".", ",");

// Patrón de puntos fijo, sólo para dibujar un "QR" de demostración.
function QrFalso() {
  const celdas = Array.from({ length: 21 * 21 }, (_, i) => {
    const x = i % 21;
    const y = Math.floor(i / 21);
    const esquina = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    if (esquina) {
      const dx = x > 13 ? x - 14 : x;
      const dy = y > 13 ? y - 14 : y;
      return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx > 1 && dx < 5 && dy > 1 && dy < 5);
    }
    return (x * 7 + y * 13 + x * y) % 3 === 0;
  });
  return (
    <div className="mx-auto grid w-44 grid-cols-[repeat(21,minmax(0,1fr))] gap-0 rounded-lg border border-ink-200 bg-white p-2" aria-hidden>
      {celdas.map((negra, i) => (
        <span key={i} className={`aspect-square ${negra ? "bg-ink-900" : "bg-white"}`} />
      ))}
    </div>
  );
}

function ModalTelefono({ onFoto, onClose }: { onFoto: (nombre: string) => void; onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title="Vincular un teléfono"
      maxWidth="max-w-sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onFoto("foto-telefono.jpg");
              onClose();
            }}
          >
            Simular foto recibida
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-ink-600">
        Escaneá este código con la cámara del teléfono, sacá la foto del comprobante y llegará acá.
      </p>
      <QrFalso />
      <p className="mt-3 text-center text-xs text-ink-400">Simulación de demo: no se conecta ningún teléfono.</p>
    </Modal>
  );
}

interface Props {
  proveedor: Proveedor;
  inicial?: Comprobante;
  // Devuelve el error a mostrar o null si se grabó.
  onSubmit: (datos: DatosComprobante, respaldo: string | undefined) => string | null;
  textoBoton: string;
  prefijoId?: string;
}

// Datos del comprobante y respaldo (v2, 6.1, pasos 2 y 3). No pide cuentas contables ni fecha contable.
export function FormularioComprobante({ proveedor, inicial, onSubmit, textoBoton, prefijoId = "cmp" }: Props) {
  const tipos = useTiposComprobante();
  const comprobantes = useComprobantes();
  const archivo = useRef<HTMLInputElement>(null);

  const [tipoId, setTipoId] = useState(inicial?.tipoId ?? proveedor.tipoComprobanteId);
  const [fecha, setFecha] = useState(inicial?.fechaComprobante ?? "");
  const [prefijo, setPrefijo] = useState(inicial?.prefijo ?? "");
  const [numero, setNumero] = useState(inicial?.numero ?? "");
  const [noGravado, setNoGravado] = useState(textoNumero(inicial?.noGravado ?? 0));
  const [exento, setExento] = useState(textoNumero(inicial?.exento ?? 0));
  const [subtotal, setSubtotal] = useState(textoNumero(inicial?.subtotalGravado ?? 0));
  const [bases, setBases] = useState<Record<AlicuotaIva, string>>({
    "10.5": textoNumero(inicial?.gravados["10.5"].base ?? 0),
    "21": textoNumero(inicial?.gravados["21"].base ?? 0),
    "27": textoNumero(inicial?.gravados["27"].base ?? 0),
  });
  const [ivas, setIvas] = useState<Record<AlicuotaIva, string>>({
    "10.5": textoNumero(inicial?.gravados["10.5"].iva ?? 0),
    "21": textoNumero(inicial?.gravados["21"].iva ?? 0),
    "27": textoNumero(inicial?.gravados["27"].iva ?? 0),
  });
  const [percIva, setPercIva] = useState(textoNumero(inicial?.percepcionIva ?? 0));
  const [iibb, setIibb] = useState<string[]>((inicial?.percepcionesIibb ?? []).map(String));
  const [muni, setMuni] = useState<string[]>((inicial?.percepcionesMunicipales ?? []).map(String));
  const [total, setTotal] = useState(textoNumero(inicial?.total ?? 0));
  const [observaciones, setObservaciones] = useState(inicial?.observaciones ?? "");
  const [respaldo, setRespaldo] = useState<string | undefined>(inicial?.respaldo);
  const [telefono, setTelefono] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const datos = (): DatosComprobante => ({
    tipoId,
    fechaComprobante: fecha,
    prefijo,
    numero,
    noGravado: aNumero(noGravado),
    exento: aNumero(exento),
    subtotalGravado: aNumero(subtotal),
    gravados: {
      "10.5": { base: aNumero(bases["10.5"]), iva: aNumero(ivas["10.5"]) },
      "21": { base: aNumero(bases["21"]), iva: aNumero(ivas["21"]) },
      "27": { base: aNumero(bases["27"]), iva: aNumero(ivas["27"]) },
    },
    percepcionIva: aNumero(percIva),
    percepcionesIibb: iibb.map(aNumero).filter((x) => x > 0),
    percepcionesMunicipales: muni.map(aNumero).filter((x) => x > 0),
    total: aNumero(total),
    observaciones,
  });

  const actual = datos();
  const errores = erroresComprobante(actual, { proveedor, tipos, comprobantes, excluirId: inicial?.id, hoy: hoy() });
  const e = (k: string) => (intentado ? errores[k] : undefined);
  const sugerido = calcularTotal(actual);

  // Completa el IVA de cada alícuota, el subtotal gravado y el total a partir de las bases.
  const calcular = () => {
    const nuevosIvas = { ...ivas };
    let sub = 0;
    for (const a of ALICUOTAS_IVA) {
      const base = aNumero(bases[a]);
      sub += base;
      nuevosIvas[a] = textoNumero(redondear((base * Number(a)) / 100));
    }
    setIvas(nuevosIvas);
    setSubtotal(textoNumero(redondear(sub)));
    const calculado = calcularTotal({
      ...actual,
      subtotalGravado: redondear(sub),
      gravados: Object.fromEntries(
        ALICUOTAS_IVA.map((a) => [a, { base: aNumero(bases[a]), iva: aNumero(nuevosIvas[a]) }])
      ) as DatosComprobante["gravados"],
    });
    setTotal(textoNumero(calculado));
  };

  const grabar = () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0) {
      setError("Revisá los datos marcados.");
      return;
    }
    const r = onSubmit(actual, respaldo);
    setError(r);
  };

  const listaVariable = (
    titulo: string,
    valores: string[],
    set: (v: string[]) => void,
    max: number,
    id: string,
    error?: string
  ) => (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink-700">
        {titulo} <span className="text-xs font-normal text-ink-400">(hasta {max})</span>
      </p>
      <div className="space-y-2">
        {valores.map((v, i) => (
          <div key={i} className="flex items-end gap-2">
            <FormField
              id={`${id}-${i}`}
              label={`Importe ${i + 1}`}
              type="number"
              value={v}
              onChange={(x) => set(valores.map((y, k) => (k === i ? x : y)))}
              className="flex-1"
            />
            <Button size="sm" variant="ghost" onClick={() => set(valores.filter((_, k) => k !== i))}>
              Quitar
            </Button>
          </div>
        ))}
        {valores.length < max && (
          <Button size="sm" variant="outline" onClick={() => set([...valores, ""])}>
            Agregar
          </Button>
        )}
        {error && <p className="text-xs text-danger-600">{error}</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          id={`${prefijoId}-tipo`}
          label="Tipo de comprobante"
          required
          value={tipoId}
          onChange={setTipoId}
          options={tipos.filter((t) => t.estado === "ACTIVO" || t.id === tipoId).map((t) => ({ value: t.id, label: t.descripcion }))}
          error={e("tipoId")}
          hint={tipoId === proveedor.tipoComprobanteId ? "Tipo habitual del proveedor." : undefined}
        />
        <FormField
          id={`${prefijoId}-fecha`}
          label="Fecha real del comprobante"
          type="date"
          required
          value={fecha}
          onChange={setFecha}
          error={e("fechaComprobante")}
        />
        <FormField
          id={`${prefijoId}-prefijo`}
          label="Prefijo"
          required
          value={prefijo}
          onChange={(v) => setPrefijo(v.replace(/\D/g, "").slice(0, 5))}
          inputMode="numeric"
          placeholder="0005"
          error={e("prefijo")}
        />
        <FormField
          id={`${prefijoId}-numero`}
          label="Número"
          required
          value={numero}
          onChange={(v) => setNumero(v.replace(/\D/g, "").slice(0, 8))}
          inputMode="numeric"
          placeholder="00001234"
          error={e("numero")}
        />
      </div>
      {e("duplicado") && <Banner tone="error" title="Comprobante duplicado">{errores.duplicado}</Banner>}

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id={`${prefijoId}-nograv`} label="No gravado" type="number" value={noGravado} onChange={setNoGravado} />
        <FormField id={`${prefijoId}-exento`} label="Exento" type="number" value={exento} onChange={setExento} />
        <FormField id={`${prefijoId}-subtotal`} label="Subtotal gravado" type="number" value={subtotal} onChange={setSubtotal} error={e("subtotalGravado")} />
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-700">Gravado e IVA por alícuota</p>
        <div className="space-y-3">
          {ALICUOTAS_IVA.map((a) => (
            <div key={a} className="grid gap-3 sm:grid-cols-2">
              <FormField
                id={`${prefijoId}-base-${a}`}
                label={`Gravado ${etiquetaAlicuota(a)} %`}
                type="number"
                value={bases[a]}
                onChange={(v) => setBases({ ...bases, [a]: v })}
              />
              <FormField
                id={`${prefijoId}-iva-${a}`}
                label={`IVA ${etiquetaAlicuota(a)} %`}
                type="number"
                value={ivas[a]}
                onChange={(v) => setIvas({ ...ivas, [a]: v })}
                error={e(`iva${a}`)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <FormField id={`${prefijoId}-perciva`} label="Percepción de IVA" type="number" value={percIva} onChange={setPercIva} />
        {listaVariable("Percepciones de IIBB", iibb, setIibb, 3, `${prefijoId}-iibb`, e("percepcionesIibb"))}
        {listaVariable("Percepciones municipales", muni, setMuni, 2, `${prefijoId}-muni`, e("percepcionesMunicipales"))}
      </div>
      {e("importes") && <p className="text-xs text-danger-600">{errores.importes}</p>}

      <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
        <FormField
          id={`${prefijoId}-total`}
          label="Total del comprobante"
          type="number"
          required
          value={total}
          onChange={setTotal}
          error={e("total")}
          hint={
            aNumero(total) > 0
              ? Math.abs(sugerido - aNumero(total)) <= 0.01
                ? "El total cierra con los importes cargados."
                : `Los importes suman ${pesos(sugerido)}: el total no cierra.`
              : `Los importes suman ${pesos(sugerido)}.`
          }
        />
        <Button variant="outline" onClick={calcular}>
          Calcular IVA y total
        </Button>
      </div>

      <FormField id={`${prefijoId}-obs`} label="Observaciones" value={observaciones} onChange={setObservaciones} />

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-700">Respaldo del comprobante</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={archivo}
            type="file"
            className="hidden"
            aria-label="Subir archivo del comprobante"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              if (f) setRespaldo(f.name);
            }}
          />
          <Button variant="outline" size="sm" onClick={() => archivo.current?.click()}>
            Subir archivo
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRespaldo("QR de factura electrónica (leído)")}>
            Leer QR
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTelefono(true)}>
            Vincular teléfono
          </Button>
          <span className="text-xs text-ink-500">
            {respaldo ? <>Respaldo: <span className="font-semibold text-ink-700">{respaldo}</span></> : "Opcional: también se puede adjuntar después."}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-400">La lectura del QR y la vinculación del teléfono son simulaciones de demo.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={grabar}>{textoBoton}</Button>
        {proveedor && (
          <span className="text-xs text-ink-500">
            {proveedor.razonSocial} · CUIT {formatearCuit(proveedor.cuit)}
          </span>
        )}
      </div>
      <ErrorBanner error={error} titulo="No se pudo grabar el comprobante" />
      {telefono && <ModalTelefono onFoto={setRespaldo} onClose={() => setTelefono(false)} />}
    </div>
  );
}
