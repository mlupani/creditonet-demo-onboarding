"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import {
  crearMotivoObservacion,
  editarMotivoObservacion,
  eliminarMotivoObservacion,
  errorNombreMotivo,
  useMotivosObservacion,
  type MotivoObservacion,
} from "@/lib/motivos-observacion";
import { mostrarToast } from "@/lib/toast";
import { descargarXlsx } from "@/components/caja/abm/AbmCaja";
import { CrudSection } from "@/components/crud/SectionHeader";
import { DataState } from "@/components/crud/DataState";
import { DeleteConfirmationModal } from "@/components/crud/DeleteConfirmationModal";
import type { ExportFormat } from "@/components/crud/ExportModal";
import { FormModal } from "@/components/crud/FormModal";
import { Table, useTablaPaginada, type TableColumn } from "@/components/crud/Table";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IconEye } from "@/components/icons";

// `null` = modal cerrado; `{ motivo: null }` = alta; `{ motivo }` = edición.
type Edicion = { motivo: MotivoObservacion | null } | null;

const textoDe = (m: MotivoObservacion) => m.nombre;

const estado = <StatusBadge tone="success">Activo</StatusBadge>;

const COLUMNAS: TableColumn<MotivoObservacion>[] = [
  {
    id: "nombre",
    header: "Descripción",
    className: "break-words text-sm font-medium",
    cell: (m) => (
      <div className="flex flex-col items-start gap-1">
        <span className="text-ink-900">{m.nombre}</span>
        <span className="sm:hidden">{estado}</span>
      </div>
    ),
  },
  { id: "estado", header: "Estado", hideOnMobile: true, cell: () => estado },
];

function MotivoModal({ edicion, onClose }: { edicion: Edicion; onClose: () => void }) {
  const motivo = edicion?.motivo ?? null;
  const [nombre, setNombre] = useState(motivo?.nombre ?? "");
  const [intentado, setIntentado] = useState(false);
  const error = errorNombreMotivo(nombre, motivo?.id);

  function guardar() {
    setIntentado(true);
    if (error) return;
    if (motivo) editarMotivoObservacion(motivo.id, nombre);
    else crearMotivoObservacion(nombre);
    onClose();
  }

  return (
    <FormModal
      open={edicion !== null}
      mode={motivo ? "edit" : "create"}
      title={motivo ? "Editar motivo" : "Nuevo motivo de observación"}
      onSubmit={guardar}
      onCancel={onClose}
    >
      <FormField
        id="motivo-observacion-nombre"
        label="Nombre del motivo"
        required
        value={nombre}
        onChange={setNombre}
        placeholder="Ej.: Agregar referencia"
        error={intentado ? error : undefined}
        hint="Es el texto que el analista elige al observar una solicitud."
      />
    </FormModal>
  );
}

export function MotivosObservacion() {
  const { hidratado } = useApplication();
  const motivos = useMotivosObservacion();
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [detalle, setDetalle] = useState<MotivoObservacion | null>(null);
  const [baja, setBaja] = useState<MotivoObservacion | null>(null);
  const tabla = useTablaPaginada(motivos, textoDe);

  const exportar = (formato: ExportFormat) => {
    if (formato === "pdf") {
      mostrarToast("La exportación a PDF todavía no está disponible.");
      return;
    }
    const filas = [["Descripción", "Estado"], ...motivos.map((m) => [m.nombre, "Activo"])];
    if (formato === "excel") {
      descargarXlsx("motivos-de-observacion.xlsx", "Motivos", filas);
      return;
    }
    const csv = filas.map((f) => f.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "motivos-de-observacion.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <CrudSection
      description="Tipificación de las observaciones. El analista elige uno de estos motivos al observar una solicitud; los cambios se aplican a las próximas observaciones."
      toolbar={{
        searchLabel: "Buscar motivos",
        searchPlaceholder: "Buscar por descripción…",
        ...tabla.toolbar,
        onNew: () => setEdicion({ motivo: null }),
        onExport: exportar,
      }}
    >
      {!hidratado ? (
        <Card className="overflow-hidden">
          <DataState kind="loading" />
        </Card>
      ) : (
        <Table
          label="Motivos de observación"
          columns={COLUMNAS}
          rows={tabla.rows}
          getRowKey={(m) => m.id}
          page={tabla.page}
          pageSize={tabla.pageSize}
          total={tabla.total}
          onPageChange={tabla.setPage}
          onPageSizeChange={tabla.setPageSize}
          rowActions={(m) => ({
            itemName: m.nombre,
            onView: () => setDetalle(m),
            onEdit: () => setEdicion({ motivo: m }),
            onDelete: () => setBaja(m),
            deleteDisabledReason: motivos.length <= 1 ? "Tiene que quedar al menos un motivo vigente." : undefined,
          })}
          minWidthClassName="min-w-0"
          emptyState={
            tabla.buscando ? (
              <DataState kind="no-matches" />
            ) : (
              <DataState kind="empty" message="Todavía no hay motivos." />
            )
          }
        />
      )}

      <Modal
        open={detalle !== null}
        onClose={() => setDetalle(null)}
        title="Motivo de observación"
        maxWidth="max-w-md"
        variant="alert"
        footer={
          <Button variant="soft" size="lg" className="w-full" onClick={() => setDetalle(null)}>
            Cerrar
          </Button>
        }
      >
        <div className="flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <IconEye width={30} height={30} />
          </span>
          <h3 className="mt-4 text-lg font-bold text-ink-900">Motivo de observación</h3>
        </div>
        <dl className="mt-5 divide-y divide-ink-100 rounded-xl border border-ink-200 bg-ink-25 text-sm">
          <div className="flex items-start justify-between gap-4 px-4 py-2.5">
            <dt className="text-ink-500">Descripción</dt>
            <dd className="break-words text-right font-medium text-ink-900">{detalle?.nombre}</dd>
          </div>
          <div className="flex items-start justify-between gap-4 px-4 py-2.5">
            <dt className="text-ink-500">Estado</dt>
            <dd>{estado}</dd>
          </div>
        </dl>
      </Modal>

      {/* key: el formulario arranca limpio cada vez que se abre. */}
      <MotivoModal
        key={edicion ? (edicion.motivo?.id ?? "nuevo") : "cerrado"}
        edicion={edicion}
        onClose={() => setEdicion(null)}
      />
      <DeleteConfirmationModal
        itemName={baja?.nombre ?? null}
        title="Dar de baja el motivo"
        question="Deja de ofrecerse al observar. Las observaciones ya registradas conservan su motivo."
        confirmLabel="Dar de baja"
        onCancel={() => setBaja(null)}
        onConfirm={() => {
          if (baja) eliminarMotivoObservacion(baja.id);
          setBaja(null);
        }}
      />
    </CrudSection>
  );
}
