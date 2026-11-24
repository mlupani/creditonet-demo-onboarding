"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import {
  eliminarServicio,
  guardarServicio,
  nuevoServicio,
  planesDelServicio,
  useServicios,
  validarServicio,
  type Servicio,
} from "@/lib/servicios";
import { usePlanes } from "@/lib/planes";
import { TIPOS_CARGO, type TipoCargo } from "@/lib/config";
import { mostrarToast } from "@/lib/toast";
import { descargarXlsx } from "@/components/caja/abm/AbmCaja";
import { CrudSection } from "@/components/crud/SectionHeader";
import { DataState } from "@/components/crud/DataState";
import { DeleteConfirmationModal } from "@/components/crud/DeleteConfirmationModal";
import type { ExportFormat } from "@/components/crud/ExportModal";
import { FormModal } from "@/components/crud/FormModal";
import { Table, useTablaPaginada, type TableColumn } from "@/components/crud/Table";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";

const textoDe = (s: Servicio) => `${s.nombre} ${s.descripcion}`;

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

const estadoBadge = (s: Servicio) => (
  <StatusBadge tone={s.estado === "ACTIVO" ? "success" : "neutral"}>{s.estado === "ACTIVO" ? "Activo" : "Inactivo"}</StatusBadge>
);

// ABM de cargos/servicios: catálogo que los planes de cuotas cobran como cargo periódico. Es una
// solapa del módulo Parámetros.
export function ListaServicios() {
  const { hidratado } = useApplication();
  const servicios = useServicios();
  // Los planes cambian el uso de cada servicio: se suscribe para mantener la columna al día.
  usePlanes();
  const [editando, setEditando] = useState<Servicio | null>(null);
  const [esNuevo, setEsNuevo] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [baja, setBaja] = useState<Servicio | null>(null);
  const tabla = useTablaPaginada(servicios, textoDe);

  const errores = editando ? validarServicio(editando, servicios) : {};
  const enUso = editando && !esNuevo ? planesDelServicio(editando.id) : [];

  function abrir(s: Servicio | null) {
    setEsNuevo(!s);
    setEditando(s ? { ...s } : nuevoServicio());
    setIntentado(false);
    setAviso(null);
  }

  function guardar() {
    setIntentado(true);
    if (!editando || Object.keys(errores).length > 0) return;
    guardarServicio({ ...editando, nombre: editando.nombre.trim(), descripcion: editando.descripcion.trim() });
    setEditando(null);
  }

  function eliminar(s: Servicio) {
    const r = eliminarServicio(s.id);
    setAviso(r.ok ? null : `No se puede eliminar “${s.nombre}”. ${r.error}`);
  }

  function cambiarEstado(s: Servicio, estado: Servicio["estado"]) {
    guardarServicio({ ...s, estado });
    setAviso(null);
  }

  function exportar(formato: ExportFormat) {
    if (formato === "pdf") {
      mostrarToast("La exportación a PDF todavía no está disponible.");
      return;
    }
    const encabezado = ["Servicio", "Descripción", "Forma de cálculo", "Estado", "Planes que lo usan"];
    const filas = servicios.map((s) => [
      s.nombre,
      s.descripcion,
      TIPOS_CARGO.find((t) => t.value === s.tipo)?.label ?? "",
      s.estado === "ACTIVO" ? "Activo" : "Inactivo",
      planesDelServicio(s.id).join(", "),
    ]);
    if (formato === "excel") descargarXlsx("servicios.xlsx", "Servicios", [encabezado, ...filas]);
    else descargarCsv("servicios.csv", csv([encabezado, ...filas]));
  }

  const columnas: TableColumn<Servicio>[] = [
    {
      id: "servicio",
      header: "Servicio",
      cell: (s) => (
        <div className="flex flex-col items-start gap-1">
          <span className="font-semibold text-ink-900">{s.nombre}</span>
          {s.descripcion && <span className="text-xs text-ink-500">{s.descripcion}</span>}
          <span className="sm:hidden">{estadoBadge(s)}</span>
        </div>
      ),
    },
    {
      id: "tipo",
      header: "Forma de cálculo",
      className: "text-xs text-ink-600",
      cell: (s) => TIPOS_CARGO.find((t) => t.value === s.tipo)?.label,
    },
    { id: "estado", header: "Estado", hideOnMobile: true, cell: estadoBadge },
    {
      id: "planes",
      header: "Planes que lo usan",
      className: "text-xs text-ink-600",
      cell: (s) => {
        const usados = planesDelServicio(s.id);
        return usados.length === 0 ? <span className="text-ink-400">Ninguno</span> : usados.join(", ");
      },
    },
  ];

  return (
    <CrudSection
      description="Servicios que un plan de cuotas puede cobrar como cargo periódico dentro de la cuota (seguros, asistencias, sepelio…). Un plan puede cargar más de uno."
      toolbar={{
        searchLabel: "Buscar servicios",
        searchPlaceholder: "Buscar por nombre o descripción…",
        ...tabla.toolbar,
        onNew: () => abrir(null),
        newLabel: "Agregar",
        onExport: exportar,
      }}
    >
      {aviso && (
        <Banner tone="warning" title="No se pudo eliminar">
          {aviso}
        </Banner>
      )}

      {!hidratado ? (
        <Card className="overflow-hidden">
          <DataState kind="loading" />
        </Card>
      ) : (
        <Table<Servicio>
          label="Servicios"
          columns={columnas}
          rows={tabla.rows}
          getRowKey={(s) => s.id}
          page={tabla.page}
          pageSize={tabla.pageSize}
          total={tabla.total}
          onPageChange={tabla.setPage}
          onPageSizeChange={tabla.setPageSize}
          rowActions={(s) => ({
            itemName: s.nombre,
            onEdit: () => abrir(s),
            suspended: s.estado !== "ACTIVO",
            suspendLabel: "Desactivar",
            reactivateLabel: "Activar",
            onSuspend: () => cambiarEstado(s, "INACTIVO"),
            onReactivate: () => cambiarEstado(s, "ACTIVO"),
            onDelete: () => setBaja(s),
          })}
          emptyState={
            tabla.buscando ? <DataState kind="no-matches" /> : <DataState kind="empty" message="Todavía no hay servicios." />
          }
        />
      )}

      {editando && (
        <FormModal
          mode={esNuevo ? "create" : "edit"}
          title={esNuevo ? "Nuevo servicio" : "Editar servicio"}
          onSubmit={guardar}
          onCancel={() => setEditando(null)}
        >
          <FormField
            id="srv-nombre"
            label="Nombre"
            value={editando.nombre}
            onChange={(v) => setEditando({ ...editando, nombre: v })}
            error={intentado ? errores.nombre : undefined}
            required
          />
          <FormField
            id="srv-descripcion"
            label="Descripción"
            value={editando.descripcion}
            onChange={(v) => setEditando({ ...editando, descripcion: v })}
          />
          <SelectField
            id="srv-tipo"
            label="Forma de cálculo"
            value={editando.tipo}
            onChange={(v) => setEditando({ ...editando, tipo: v as TipoCargo })}
            options={TIPOS_CARGO}
            // Los planes que lo usan cargaron el valor con esta forma: cambiarla lo desvirtuaría.
            disabled={enUso.length > 0}
            hint={
              enUso.length > 0
                ? `No se puede cambiar: lo usan ${enUso.join(", ")}.`
                : "En el plan sólo se carga el valor: monto o porcentaje según esta forma."
            }
          />
          <SelectField
            id="srv-estado"
            label="Estado"
            value={editando.estado}
            onChange={(v) => setEditando({ ...editando, estado: v as Servicio["estado"] })}
            options={[
              { value: "ACTIVO", label: "Activo" },
              { value: "INACTIVO", label: "Inactivo (no se puede elegir en cargos nuevos)" },
            ]}
          />
        </FormModal>
      )}

      <DeleteConfirmationModal
        itemName={baja?.nombre ?? null}
        title="Eliminar servicio"
        question="¿Confirma que desea eliminar el siguiente servicio?"
        onConfirm={() => {
          if (baja) eliminar(baja);
          setBaja(null);
        }}
        onCancel={() => setBaja(null)}
      />
    </CrudSection>
  );
}
