"use client";

import { useApplication } from "@/lib/application-context";
import { DATOS_API_PUBLICA } from "@/lib/mocks";
import { GENEROS } from "@/lib/validation";
import { evaluarInstitucionales, institucionalesBloquean } from "@/lib/reglas-institucionales";
import { formatDNI } from "@/lib/format";
import { Banner } from "@/components/ui/Banner";
import { Card, CardHeader } from "@/components/ui/Card";
import { DemoTag } from "@/components/ui/DemoTag";
import { CampoCliente } from "./CampoCliente";
import { VerificacionPresencial } from "./VerificacionPresencial";
import { InstitucionalesPanel } from "../evaluacion/InstitucionalesPanel";
import { IconCheckCircle, IconUsers } from "@/components/icons";

// Muestra el resultado de la consulta por DNI/CUIL hecha en el paso 1: cliente, reglas
// institucionales y verificación presencial. La condición laboral se carga en el paso 4.
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
        />
        <div className="p-5 sm:p-6">
          <div className="rounded-lg border border-ink-100 bg-ink-25 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              Autocompletado desde la API
            </p>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {DATOS_API_PUBLICA.map((d) => (
                <li
                  key={d.campo}
                  className="flex items-center gap-2 text-sm font-medium text-success-700"
                >
                  <IconCheckCircle width={14} height={14} className="shrink-0" />
                  {d.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2">
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

      <InstitucionalesPanel reglas={institucionales} />

      {descartada ? (
        <Banner tone="error" title="Solicitud descartada por una regla institucional">
          <span className="flex flex-wrap items-center gap-2">
            Con estos datos no se puede continuar: no se genera ID de Crédito ni se ejecuta el
            motor. Si un dato vino mal de la API, corregilo arriba y la regla se vuelve a evaluar.
            <DemoTag
              variant="regla"
              detalle="Para mostrar el descarte temprano cambiá la fecha de nacimiento a 14/05/1955. Con 14/05/1982 la regla vuelve a pasar."
            />
          </span>
        </Banner>
      ) : (
        <VerificacionPresencial />
      )}

      <Banner tone="info">
        <span className="flex flex-wrap items-center gap-2">
          Los datos son editables: al modificar uno, su origen pasa a carga manual. Para un
          cliente nuevo se asigna un ID de Cliente interno permanente.
          <DemoTag
            variant="regla"
            detalle="Qué servicios de datos públicos/privados se consultan y qué ocurre si no devuelven un dato son definiciones pendientes."
          />
        </span>
      </Banner>
    </div>
  );
}
