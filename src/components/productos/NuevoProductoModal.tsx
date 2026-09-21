"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIAS_PRODUCTO, crearProducto, useProductos } from "@/lib/productos";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";

const BASE = "__base__";

export function NuevoProductoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const productos = useProductos();
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS_PRODUCTO[0]);
  const [copiarDe, setCopiarDe] = useState(BASE);
  const [intentado, setIntentado] = useState(false);

  const limpio = nombre.trim();
  const repetido = productos.some((p) => p.config.nombre.trim().toLowerCase() === limpio.toLowerCase());
  const error = !limpio
    ? "Ingresá el nombre del producto."
    : repetido
      ? "Ya existe un producto con ese nombre."
      : undefined;

  function cerrar() {
    setNombre("");
    setDescripcion("");
    setCategoria(CATEGORIAS_PRODUCTO[0]);
    setCopiarDe(BASE);
    setIntentado(false);
    onClose();
  }

  function crear() {
    setIntentado(true);
    if (error) return;
    const id = crearProducto({
      nombre: limpio,
      descripcion: descripcion.trim(),
      categoria,
      copiarDeId: copiarDe === BASE ? null : copiarDe,
    });
    cerrar();
    router.push(`/productos/${id}`);
  }

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title="Nuevo producto"
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button onClick={crear}>Crear y configurar</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField
          id="nuevo-nombre"
          label="Nombre"
          required
          value={nombre}
          onChange={setNombre}
          placeholder="Ej.: Préstamo para jubilados"
          error={intentado ? error : undefined}
        />
        <FormField
          id="nuevo-descripcion"
          label="Descripción"
          value={descripcion}
          onChange={setDescripcion}
          placeholder="Qué es y a quién apunta"
        />
        <SelectField
          id="nuevo-categoria"
          label="Categoría"
          value={categoria}
          onChange={setCategoria}
          options={CATEGORIAS_PRODUCTO.map((c) => ({ value: c, label: c }))}
        />
        <SelectField
          id="nuevo-copiar"
          label="Partir de"
          value={copiarDe}
          onChange={setCopiarDe}
          options={[
            { value: BASE, label: "Configuración base" },
            ...productos
              .filter((p) => p.config.estado !== "ELIMINADO")
              .map((p) => ({ value: p.config.id, label: `Copiar de ${p.config.nombre}` })),
          ]}
          hint="Copia el onboarding, el legajo, los canales y los valores de cada sección. Después podés ajustarlos."
        />
      </div>
    </Modal>
  );
}
