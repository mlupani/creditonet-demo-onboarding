"use client";

import { useApplication } from "@/lib/application-context";
import { GENEROS } from "@/lib/validation";
import { PROVINCIAS } from "@/lib/parametros";
import { evaluarInstitucionales, institucionalesBloquean } from "@/lib/reglas-institucionales";
import { ORGANISMOS, PRODUCTOS, nombreOpcion } from "@/lib/config";
import { formatDNI } from "@/lib/format";
import { Banner } from "@/components/ui/Banner";
import { Card, CardHeader } from "@/components/ui/Card";
import { TelefonoField } from "@/components/ui/TelefonoField";
import { parseTelefono, validarNumero } from "@/lib/telefono";
import { CampoCliente } from "./CampoCliente";
import { RegistroFirma } from "./RegistroFirma";
import { VerificacionPresencial } from "./VerificacionPresencial";
import { IconUsers } from "@/components/icons";

// Muestra el resultado de la consulta por DNI/CUIL hecha en el paso 1: cliente y verificación
// presencial. La condición laboral se carga en el paso 4.
export function PasoIdentificacion() {
  const { app, patchCliente } = useApplication();
  const encontrado = app.identificacion.consultado && app.cliente;
  // Las reglas institucionales que ya tienen sus datos se evalúan acá, en vivo: si el
  // vendedor rectifica un dato de la API, la regla se vuelve a evaluar (Motor §6 y §11).
  const institucionales = evaluarInstitucionales(app, "IDENTIFICACION");
  const descartada = institucionalesBloquean(institucionales);

  if (!encontrado) return null;

  const tel = parseTelefono(app.cliente!.telefono);
  const errorTelefono =
    (tel.numero ? validarNumero(tel.pais, tel.caracteristica, tel.numero) : null) ?? undefined;

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
            <CampoCliente id="c-calle" label="Calle" campo="calle" />
            <CampoCliente id="c-numero" label="Número" campo="numero" />
            <CampoCliente id="c-localidad" label="Localidad" campo="localidad" />
            <CampoCliente
              id="c-provincia"
              label="Provincia"
              campo="provincia"
              as="select"
              options={PROVINCIAS}
            />
            <TelefonoField
              id="c-telefono"
              label="Teléfono"
              value={app.cliente!.telefono}
              onChange={(v) => patchCliente({ telefono: v })}
              error={errorTelefono}
            />
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
        <>
          <VerificacionPresencial />
          {app.identificacion.tipoCliente === "NUEVO" && <RegistroFirma />}
        </>
      )}
    </div>
  );
}
