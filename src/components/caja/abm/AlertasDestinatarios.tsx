"use client";

import { useState } from "react";
import { auditar, cambios, hoy, siguienteId, usuarioActual } from "@/lib/caja-store";
import { ROL_CAJA_LABEL, type RolCaja } from "@/lib/caja-tipos";
import { controlStores, useAlertasConfig, usePlazos } from "@/lib/control-store";
import { EVENTOS_ALERTA, EVENTO_ALERTA_LABEL, type ConfigAlerta, type EventoAlerta, type PlazosControl } from "@/lib/control-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { AbmCaja, ESTADOS_TRES, ModalFormulario, persistir, type Columna } from "./AbmCaja";

const ENTIDAD = "Destinatarios de alertas";
const ROLES = Object.keys(ROL_CAJA_LABEL) as RolCaja[];
const rolesTexto = (r: RolCaja[]) => (r.length > 0 ? r.map((x) => ROL_CAJA_LABEL[x]).join(", ") : "—");

const COLUMNAS: Columna<ConfigAlerta>[] = [
  { clave: "evento", label: "Evento", valor: (c) => EVENTO_ALERTA_LABEL[c.evento] },
  { clave: "destinatarios", label: "Destinatarios", valor: (c) => rolesTexto(c.destinatarios) },
];

function FormularioConfig({ inicial, onClose }: { inicial: ConfigAlerta | null; onClose: () => void }) {
  const lista = useAlertasConfig();
  const libres = EVENTOS_ALERTA.filter((e) => !lista.some((c) => c.evento === e.id && c.estado !== "ELIMINADO" && c.id !== inicial?.id));
  const [evento, setEvento] = useState<EventoAlerta>(inicial?.evento ?? libres[0]?.id ?? "DIFERENCIA_SOBRE_TOLERANCIA");
  const [destinatarios, setDestinatarios] = useState<RolCaja[]>(inicial?.destinatarios ?? EVENTOS_ALERTA.find((e) => e.id === evento)?.destinatarios ?? []);
  const [intentado, setIntentado] = useState(false);

  const errores: Record<string, string> = {};
  if (!inicial && libres.length === 0) errores.evento = "Todos los eventos ya tienen su configuración.";
  if (destinatarios.length === 0) errores.destinatarios = "Elegí al menos un rol destinatario.";
  const e = (k: string) => (intentado ? errores[k] : undefined);

  const grabar = () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    persistir(
      controlStores.alertasConfig,
      ENTIDAD,
      inicial,
      inicial
        ? { ...inicial, evento, destinatarios }
        : { id: siguienteId("ALC", lista.map((c) => c.id)), evento, destinatarios, estado: "ACTIVO", fechaAlta: hoy(), usuarioAlta: usuarioActual().nombre }
    );
    onClose();
  };

  return (
    <ModalFormulario titulo={inicial ? `Modificar ${inicial.id}` : "Nuevo evento de alerta"} onClose={onClose} onGrabar={grabar} maxWidth="max-w-xl">
      <div className="space-y-4">
        {inicial && <FormField id="alc-id" label="ID" value={inicial.id} onChange={() => {}} disabled hint="Lo asigna el sistema." />}
        <SelectField
          id="alc-evento"
          label="Evento"
          required
          value={evento}
          disabled={!!inicial}
          onChange={(v) => {
            setEvento(v as EventoAlerta);
            setDestinatarios(EVENTOS_ALERTA.find((x) => x.id === v)?.destinatarios ?? []);
          }}
          options={(inicial ? EVENTOS_ALERTA : libres).map((x) => ({ value: x.id, label: x.label }))}
          error={e("evento")}
        />
        <fieldset>
          <legend className="text-sm font-medium text-ink-700">Roles destinatarios</legend>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
            {ROLES.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={destinatarios.includes(r)}
                  onChange={() => setDestinatarios((d) => (d.includes(r) ? d.filter((x) => x !== r) : [...d, r]))}
                  className="h-4 w-4"
                />
                {ROL_CAJA_LABEL[r]}
              </label>
            ))}
          </div>
          {e("destinatarios") && <p className="mt-1 text-xs text-danger-700">{e("destinatarios")}</p>}
          <p className="mt-2 text-xs text-ink-500">Director y Tesorero central reciben de todas las sucursales; los demás roles, sólo las de su sucursal.</p>
        </fieldset>
      </div>
    </ModalFormulario>
  );
}

const entero = (t: string) => (/^\d+$/.test(t.trim()) ? Number(t) : undefined);

// Plazos y parámetros de control (7.17): un único registro.
function Plazos() {
  const actual = usePlazos()[0];
  const [form, setForm] = useState({
    diasAvisoAcuerdos: String(actual.diasAvisoAcuerdos),
    margenCajaSinCerrarMin: String(actual.margenCajaSinCerrarMin),
    horaLimiteCierreDiario: actual.horaLimiteCierreDiario,
    ventanaAjusteHoras: String(actual.ventanaAjusteHoras),
    plazoReaperturaDias: String(actual.plazoReaperturaDias),
    superiorEscalamiento: actual.superiorEscalamiento,
  });
  const [guardado, setGuardado] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const campo = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setGuardado(false);
  };

  const errores: Record<string, string> = {};
  for (const k of ["diasAvisoAcuerdos", "margenCajaSinCerrarMin", "ventanaAjusteHoras", "plazoReaperturaDias"] as const)
    if (entero(form[k]) === undefined) errores[k] = "Ingresá un número entero (0 o más).";
  if (!/^\d{2}:\d{2}$/.test(form.horaLimiteCierreDiario)) errores.horaLimiteCierreDiario = "Ingresá la hora (HH:MM).";
  const e = (k: string) => (intentado ? errores[k] : undefined);

  const grabar = () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    const nuevo: PlazosControl = {
      id: "plazos",
      diasAvisoAcuerdos: Number(form.diasAvisoAcuerdos),
      margenCajaSinCerrarMin: Number(form.margenCajaSinCerrarMin),
      horaLimiteCierreDiario: form.horaLimiteCierreDiario,
      ventanaAjusteHoras: Number(form.ventanaAjusteHoras),
      plazoReaperturaDias: Number(form.plazoReaperturaDias),
      superiorEscalamiento: form.superiorEscalamiento,
    };
    controlStores.plazos.commit([nuevo]);
    const c = cambios(actual as unknown as Record<string, unknown>, nuevo as unknown as Record<string, unknown>);
    auditar("Plazos de control", "plazos", "MODIFICACION", c.antes, c.despues);
    setGuardado(true);
  };

  return (
    <div className="mt-8">
      <h3 className="text-sm font-bold uppercase tracking-widest text-ink-700">Plazos y parámetros</h3>
      <Card className="mt-3 p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField id="pz-acuerdos" label="Días de aviso de vencimiento de acuerdos" value={form.diasAvisoAcuerdos} onChange={campo("diasAvisoAcuerdos")} inputMode="numeric" error={e("diasAvisoAcuerdos")} />
          <FormField id="pz-margen" label="Margen de caja sin cerrar (minutos)" value={form.margenCajaSinCerrarMin} onChange={campo("margenCajaSinCerrarMin")} inputMode="numeric" error={e("margenCajaSinCerrarMin")} hint="Por defecto; cada caja puede tener el suyo." />
          <FormField id="pz-hora" label="Hora límite del cierre diario" value={form.horaLimiteCierreDiario} onChange={campo("horaLimiteCierreDiario")} placeholder="20:00" error={e("horaLimiteCierreDiario")} />
          <FormField id="pz-ventana" label="Ventana de ajuste (horas)" value={form.ventanaAjusteHoras} onChange={campo("ventanaAjusteHoras")} inputMode="numeric" error={e("ventanaAjusteHoras")} />
          <FormField id="pz-reapertura" label="Plazo máximo de reapertura (días hábiles)" value={form.plazoReaperturaDias} onChange={campo("plazoReaperturaDias")} inputMode="numeric" error={e("plazoReaperturaDias")} />
          <SelectField
            id="pz-superior"
            label="Superior al que se escala una negativa a firmar"
            value={form.superiorEscalamiento}
            onChange={campo("superiorEscalamiento")}
            options={(["TESORERO_CENTRAL", "DIRECTOR"] as RolCaja[]).map((r) => ({ value: r, label: ROL_CAJA_LABEL[r] }))}
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={grabar}>Grabar</Button>
          {guardado && <span className="text-sm text-success-700">Plazos grabados.</span>}
        </div>
      </Card>
    </div>
  );
}

export function AlertasDestinatarios() {
  const lista = useAlertasConfig();
  return (
    <div>
      <Banner tone="info" title="Los mails son simulados" className="mb-5">
        En la demo no sale ningún mail: cada alerta queda registrada en «Alertas enviadas» (Posición de caja y bancos). Una configuración suspendida
        deja de enviar esa alerta.
      </Banner>
      <AbmCaja<ConfigAlerta>
        entidad={ENTIDAD}
        archivo="alertas-destinatarios"
        singular="evento"
        plural="eventos"
        nuevoLabel="Nuevo evento"
        registros={lista}
        store={controlStores.alertasConfig}
        columnas={COLUMNAS}
        estados={ESTADOS_TRES}
        nombreDe={(c) => EVENTO_ALERTA_LABEL[c.evento]}
        formulario={(p) => <FormularioConfig key={p.inicial?.id ?? "nuevo"} {...p} />}
      />
      <Plazos />
    </div>
  );
}
