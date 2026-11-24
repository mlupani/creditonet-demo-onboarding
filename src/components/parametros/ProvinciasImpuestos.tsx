"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import {
  crearProvinciasImpuestos,
  editarProvinciaImpuestos,
  eliminarProvinciaImpuestos,
  errorPorcentaje,
  parsearPorcentaje,
  provinciasSinCargar,
  useProvinciasImpuestos,
  type ProvinciaImpuestos,
} from "@/lib/provincias-impuestos";
import { mostrarToast } from "@/lib/toast";
import { descargarXlsx } from "@/components/caja/abm/AbmCaja";
import { CrudSection } from "@/components/crud/SectionHeader";
import { DataState } from "@/components/crud/DataState";
import { DeleteConfirmationModal } from "@/components/crud/DeleteConfirmationModal";
import type { ExportFormat } from "@/components/crud/ExportModal";
import { FormModal } from "@/components/crud/FormModal";
import { Table, useTablaPaginada, type TableColumn } from "@/components/crud/Table";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { MultiSelectField } from "@/components/ui/MultiSelectField";

// `null` = modal cerrado; `{ registro: null }` = alta; `{ registro }` = edición.
type Edicion = { registro: ProvinciaImpuestos | null } | null;

const fmt = (n: number) => `${String(n).replace(".", ",")} %`;

const textoDe = (p: ProvinciaImpuestos) => p.provincia;

const csv = (filas: string[][]) =>
  filas.map((f) => f.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join("\r\n");

function descargarCsv(nombreArchivo: string, contenido: string) {
  const blob = new Blob(["﻿", contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ProvinciaModal({ edicion, onClose }: { edicion: Edicion; onClose: () => void }) {
  const registro = edicion?.registro ?? null;
  const disponibles = provinciasSinCargar();
  const [provincias, setProvincias] = useState<string[]>([]);
  const [sellado, setSellado] = useState(registro ? String(registro.sellado).replace(".", ",") : "");
  const [intentado, setIntentado] = useState(false);

  const errorProvincias =
    !registro && provincias.length === 0 ? "Elegí al menos una provincia." : undefined;
  const errorSellado = errorPorcentaje(sellado, "el sellado");

  function guardar() {
    setIntentado(true);
    if (errorProvincias || errorSellado) return;
    const s = parsearPorcentaje(sellado) as number;
    if (registro) editarProvinciaImpuestos(registro.id, s);
    else crearProvinciasImpuestos(provincias, s);
    onClose();
  }

  return (
    <FormModal
      open={edicion !== null}
      mode={registro ? "edit" : "create"}
      title={registro ? `Editar ${registro.provincia}` : "Cargar provincias"}
      onSubmit={guardar}
      onCancel={onClose}
    >
      {!registro && (
        <MultiSelectField
          id="provincias-impuestos-provincias"
          label="Provincias"
          required
          values={provincias}
          onChange={setProvincias}
          options={disponibles}
          placeholder="Seleccioná provincias…"
          plural="provincias"
          femenino
          error={intentado ? errorProvincias : undefined}
          hint={
            disponibles.length === 0
              ? "Ya están cargadas todas las provincias."
              : "El sellado de abajo se aplica a todas las que elijas."
          }
        />
      )}
      <FormField
        id="provincias-impuestos-sellado"
        label="Sellado (%)"
        required
        inputMode="text"
        value={sellado}
        onChange={setSellado}
        placeholder="Ej.: 1,2"
        error={intentado ? errorSellado : undefined}
      />
    </FormModal>
  );
}

const COLUMNAS: TableColumn<ProvinciaImpuestos>[] = [
  { id: "provincia", header: "Provincia", className: "font-medium text-ink-900", cell: (p) => p.provincia },
  { id: "sellado", header: "Sellado", align: "end", className: "text-ink-700", cell: (p) => fmt(p.sellado) },
];

export function ProvinciasImpuestos() {
  const { hidratado } = useApplication();
  const lista = useProvinciasImpuestos();
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [baja, setBaja] = useState<ProvinciaImpuestos | null>(null);
  const completo = provinciasSinCargar().length === 0;
  const tabla = useTablaPaginada(lista, textoDe);

  const exportar = (formato: ExportFormat) => {
    if (formato === "pdf") {
      mostrarToast("La exportación a PDF todavía no está disponible.");
      return;
    }
    const encabezado = ["Provincia", "Sellado"];
    const filas = lista.map((p) => [p.provincia, fmt(p.sellado)]);
    if (formato === "excel") descargarXlsx("provincias-sellado.xlsx", "Provincias", [encabezado, ...filas]);
    else descargarCsv("provincias-sellado.csv", csv([encabezado, ...filas]));
  };

  return (
    <CrudSection
      description="Alícuota de sellado de cada provincia. Se cargan de a varias provincias con el mismo valor y después se ajustan una por una. El IVA es nacional: está en Impositivos."
      toolbar={{
        searchLabel: "Buscar provincias",
        searchPlaceholder: "Buscar por provincia…",
        ...tabla.toolbar,
        // Con todas cargadas el botón queda a la vista y avisa por qué no abre el alta.
        onNew: completo ? () => mostrarToast("Ya están cargadas todas las provincias.") : () => setEdicion({ registro: null }),
        newLabel: "Cargar provincias",
        onExport: exportar,
      }}
    >
      {!hidratado ? (
        <Card className="overflow-hidden">
          <DataState kind="loading" />
        </Card>
      ) : (
        <Table<ProvinciaImpuestos>
          label="Provincias"
          columns={COLUMNAS}
          rows={tabla.rows}
          getRowKey={(p) => p.id}
          page={tabla.page}
          pageSize={tabla.pageSize}
          total={tabla.total}
          onPageChange={tabla.setPage}
          onPageSizeChange={tabla.setPageSize}
          rowActions={(p) => ({
            itemName: p.provincia,
            onEdit: () => setEdicion({ registro: p }),
            onDelete: () => setBaja(p),
          })}
          emptyState={
            tabla.buscando ? <DataState kind="no-matches" /> : <DataState kind="empty" message="No hay provincias cargadas." />
          }
        />
      )}

      {/* key: el formulario arranca limpio cada vez que se abre. */}
      <ProvinciaModal
        key={edicion ? (edicion.registro?.id ?? "nuevo") : "cerrado"}
        edicion={edicion}
        onClose={() => setEdicion(null)}
      />
      <DeleteConfirmationModal
        itemName={baja ? `${baja.provincia} · Sellado ${fmt(baja.sellado)}` : null}
        title="Dar de baja la provincia"
        question="Se quita su sellado. Podés volver a cargarla cuando quieras."
        confirmLabel="Dar de baja"
        onConfirm={() => {
          if (baja) eliminarProvinciaImpuestos(baja.id);
          setBaja(null);
        }}
        onCancel={() => setBaja(null)}
      />
    </CrudSection>
  );
}
