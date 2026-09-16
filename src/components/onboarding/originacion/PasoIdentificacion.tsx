"use client";

import { useApplication } from "@/lib/application-context";
import { GENEROS } from "@/lib/validation";
import { evaluarInstitucionales, institucionalesBloquean } from "@/lib/reglas-institucionales";
import { ORGANISMOS, PRODUCTOS, nombreOpcion } from "@/lib/config";
import { formatDNI } from "@/lib/format";
import { Banner } from "@/components/ui/Banner";
import { Card, CardHeader } from "@/components/ui/Card";
import { CampoCliente } from "./CampoCliente";
import { VerificacionPresencial } from "./VerificacionPresencial";
import { IconUsers } from "@/components/icons";

// Muestra el resultado de la consulta por DNI/CUIL hecha en el paso 1: cliente y verificación
// presencial. La condición laboral se carga en el paso 4.
export function PasoIdentificacion() {
  const { app } = useApplication();
  const encontrado = app.identificacion.consultado && app.cliente;
  // Las reglas institucionales que ya tienen sus datos se evalúan acá, en vivo: si el
  // vendedor rectifica un dato de la API, la regla se vuelve a evaluar (Motor §6 y §11).
  const institucionales = evaluarInstitucionales(app, "IDENTIFICACION");
  const descartada = institucionalesBloquean(institucionales);

  if (!encontrado) return null;

  return (
    <div className="animate-fade-up space-y-5">
      <Card>
        <CardHeader
          title={`${app.cliente!.nombre} ${app.cliente!.apellido}`}
          description={`DNI ${formatDNI(app.cliente!.dni)} · CUIL ${app.cliente!.cuil}`}
          icon={<IconUsers width={18} height={18} />}
          action={
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                Producto · Organismo
              </p>
              <p className="text-sm font-semibold text-ink-700">
                {nombreOpcion(PRODUCTOS, app.configuracion.productoId)} ·{" "}
                {nombreOpcion(ORGANISMOS, app.configuracion.organismoId)}
              </p>
            </div>
          }
        />
        <div className="p-5 sm:p-6">
          <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
            <CampoCliente id="c-nombre" label="Nombre" campo="nombre" />
            <CampoCliente id="c-apellido" label="Apellido" campo="apellido" />
            <CampoCliente id="c-fnac" label="Fecha de nacimiento" campo="fechaNacimiento" />
            <CampoCliente
              id="c-genero"
              label="Género"
              campo="genero"
              as="select"
              options={GENEROS}
            />
            <div className="sm:col-span-2">
              <CampoCliente id="c-domicilio" label="Domicilio" campo="domicilio" />
            </div>
            <CampoCliente id="c-email" label="Email" campo="email" />
          </div>
        </div>
      </Card>

      {descartada ? (
        <Banner tone="error" title="Solicitud descartada por una regla institucional">
          Con estos datos no se puede continuar: no se genera ID de Crédito ni se ejecuta el
          motor. Si un dato vino mal de la API, corregilo arriba y la regla se vuelve a evaluar.
        </Banner>
      ) : (
        <VerificacionPresencial />
      )}

      <Banner tone="info">
        Los datos son editables: al modificar uno, su origen pasa a carga manual. Para un
        cliente nuevo se asigna un ID de Cliente interno permanente.
      </Banner>
    </div>
  );
}
