"use client";

import { useState } from "react";
import { guardarIvaPct, useIvaPct } from "@/lib/impositivos";
import { errorPorcentaje, parsearPorcentaje } from "@/lib/provincias-impuestos";
import { mostrarToast } from "@/lib/toast";
import { CrudSection } from "@/components/crud/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";

const aTexto = (n: number) => String(n).replace(".", ",");

function FormIva({ actual }: { actual: number }) {
  const [iva, setIva] = useState(aTexto(actual));
  const error = errorPorcentaje(iva, "el IVA");
  const cambio = !error && parsearPorcentaje(iva) !== actual;

  function guardar() {
    if (error) return;
    guardarIvaPct(parsearPorcentaje(iva) as number);
    mostrarToast("IVA actualizado.");
  }

  return (
    <Card className="max-w-md p-5">
      <FormField
        id="param-iva"
        label="IVA (%)"
        value={iva}
        onChange={setIva}
        inputMode="text"
        error={error}
        hint="Se aplica en los productos que tienen tildado “Calcula IVA”."
      />
      <div className="mt-4">
        <Button size="lg" className="w-full" onClick={guardar} disabled={!cambio}>
          Guardar
        </Button>
      </div>
    </Card>
  );
}

// No es un listado: son alícuotas únicas, así que solo toma el encabezado estándar de los ABM.
export function Impositivos() {
  const actual = useIvaPct();
  return (
    <CrudSection description="Alícuotas generales que usan los productos. El IVA se suma a los cargos periódicos sin IVA y se informa en la tabla de cuotas de la oferta.">
      {/* La key reinicia el formulario cuando el valor guardado cambia (hidratación u otra pestaña). */}
      <FormIva key={actual} actual={actual} />
    </CrudSection>
  );
}
