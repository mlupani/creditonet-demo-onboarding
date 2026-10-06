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
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IconPencil, IconPlus, IconTrash } from "@/components/icons";

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

  return (
    <div>
      <div className="animate-fade-in">
        <p className="max-w-2xl text-sm text-ink-500">
          Servicios que un plan de cuotas puede cobrar como cargo periódico dentro de la cuota
          (seguros, asistencias, sepelio…). Un plan puede cargar más de uno.
        </p>
      </div>

      <div className="mt-6">
        <Button onClick={() => abrir(null)}>
          <IconPlus width={16} height={16} />
          Nuevo servicio
        </Button>
      </div>

      {aviso && (
        <div className="mt-4">
          <Banner tone="warning" title="No se pudo eliminar">
            {aviso}
          </Banner>
        </div>
      )}

      <Card className="mt-5 overflow-hidden">
        {!hidratado ? (
          <p className="px-5 py-8 text-center text-sm text-ink-400">Cargando…</p>
        ) : servicios.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">Todavía no hay servicios.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2.5">Servicio</th>
                  <th className="px-4 py-2.5">Forma de cálculo</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5">Planes que lo usan</th>
                  <th className="px-4 py-2.5">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {servicios.map((s) => {
                  const usados = planesDelServicio(s.id);
                  return (
                    <tr key={s.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink-900">{s.nombre}</p>
                        {s.descripcion && <p className="text-xs text-ink-500">{s.descripcion}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-600">
                        {TIPOS_CARGO.find((t) => t.value === s.tipo)?.label}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={s.estado === "ACTIVO" ? "success" : "neutral"}>
                          {s.estado === "ACTIVO" ? "Activo" : "Inactivo"}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-600">
                        {usados.length === 0 ? <span className="text-ink-400">Ninguno</span> : usados.join(", ")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => abrir(s)}>
                            <IconPencil width={14} height={14} />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Eliminar ${s.nombre}`}
                            onClick={() => eliminar(s)}
                          >
                            <IconTrash width={14} height={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!editando}
        onClose={() => setEditando(null)}
        title={esNuevo ? "Nuevo servicio" : "Editar servicio"}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={guardar}>Guardar</Button>
          </div>
        }
      >
        {editando && (
          <div className="space-y-4">
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
          </div>
        )}
      </Modal>
    </div>
  );
}
