// El organismo se edita con las mismas pantallas que el producto: se muestra el producto con las
// excepciones del organismo aplicadas (el "producto virtual") y lo que se cambia ahí vuelve como
// excepciones. Lo que queda igual al producto no se guarda: sigue heredado.

import type { CambiosPantalla, OnboardingConfig, OverridesOrganismo } from "./config";
import type { PantallaPostOfertaId } from "./types";
import { camposConfigurablesDe, esObligatorio, TITULO_PANTALLA_CAMPOS } from "./campos-config";
import { EXTRAS_POR_SECCION, type VistaOrganismo } from "./organismos";
import type { ExtrasProducto, ProductoAbm } from "./productos";

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Valores del producto que admiten excepción.
const CLAVES_CON_EXCEPCION = new Set<string>(Object.values(EXTRAS_POR_SECCION).flat());

/** Onboarding del producto con las excepciones del organismo aplicadas (igual que `configEfectiva`). */
export function onboardingEfectivo(base: OnboardingConfig, ov: OverridesOrganismo): OnboardingConfig {
  return {
    ...base,
    pantallas: base.pantallas.map((p) => ({ ...p, ...(ov.pantallas?.[p.id] ?? {}) })),
    navegacion: ov.navegacion ?? base.navegacion,
    camposObligatorios: { ...base.camposObligatorios, ...(ov.camposObligatorios ?? {}) },
    referencias: { ...base.referencias, ...(ov.referencias ?? {}) },
    garantes: { ...base.garantes, ...(ov.garantes ?? {}) },
    tokenizacion: ov.tokenizacion ?? base.tokenizacion,
    documentos: ov.documentos ?? base.documentos,
  };
}

/** Excepciones del onboarding: sólo lo que se aparta del producto. El resto de `previas` se conserva. */
function overridesOnboarding(
  base: OnboardingConfig,
  nuevo: OnboardingConfig,
  previas: OverridesOrganismo
): OverridesOrganismo {
  const r: OverridesOrganismo = { ...previas };
  const fijar = <K extends keyof OverridesOrganismo>(k: K, v: OverridesOrganismo[K] | undefined) => {
    if (v === undefined) delete r[k];
    else r[k] = v;
  };

  fijar("navegacion", nuevo.navegacion !== base.navegacion ? nuevo.navegacion : undefined);

  const pantallas: CambiosPantalla = {};
  for (const p of nuevo.pantallas) {
    const b = base.pantallas.find((x) => x.id === p.id);
    if (!b) continue;
    const cambio: { visible?: boolean; orden?: number } = {};
    if (p.visible !== b.visible) cambio.visible = p.visible;
    if (p.orden !== b.orden) cambio.orden = p.orden;
    if (Object.keys(cambio).length > 0) pantallas[p.id] = cambio;
  }
  fijar("pantallas", Object.keys(pantallas).length > 0 ? pantallas : undefined);

  // Se compara la obligatoriedad efectiva de cada campo: el editor guarda sólo lo que se aparta
  // del catálogo, así que el mismo campo puede faltar en un lado y estar en el otro.
  const campos: Record<string, boolean> = {};
  for (const pantalla of Object.keys(TITULO_PANTALLA_CAMPOS) as PantallaPostOfertaId[])
    for (const c of camposConfigurablesDe(pantalla)) {
      const v = esObligatorio(c, nuevo.camposObligatorios);
      if (v !== esObligatorio(c, base.camposObligatorios)) campos[c.id] = v;
    }
  fijar("camposObligatorios", Object.keys(campos).length > 0 ? campos : undefined);

  fijar("referencias", igual(nuevo.referencias, base.referencias) ? undefined : nuevo.referencias);
  fijar("garantes", igual(nuevo.garantes, base.garantes) ? undefined : nuevo.garantes);
  fijar("tokenizacion", igual(nuevo.tokenizacion, base.tokenizacion) ? undefined : nuevo.tokenizacion);
  fijar("documentos", igual(nuevo.documentos, base.documentos) ? undefined : nuevo.documentos);
  return r;
}

/** El producto tal como rige para el organismo. */
export function productoVirtual(o: VistaOrganismo, p: ProductoAbm): ProductoAbm {
  const ov = o.config.overrides;
  return {
    ...p,
    config: {
      ...p.config,
      canales: o.config.canales ?? p.config.canales,
      permiteDeudaTerceros: ov.permiteDeudaTerceros ?? p.config.permiteDeudaTerceros,
      capitalMaximo: ov.capitalMaximo ?? p.config.capitalMaximo,
      onboarding: onboardingEfectivo(p.config.onboarding, ov),
    },
    extras: { ...p.extras, ...o.excepciones },
  };
}

/** Vuelca un producto virtual editado sobre las excepciones del organismo. */
export function aplicarProductoVirtual(o: VistaOrganismo, p: ProductoAbm, nuevo: ProductoAbm): VistaOrganismo {
  // Las excepciones guardadas sobre valores que ya no la admiten se conservan tal cual.
  const extras: Record<string, unknown> = Object.fromEntries(
    Object.entries(o.excepciones).filter(([k]) => !CLAVES_CON_EXCEPCION.has(k))
  );
  for (const k of CLAVES_CON_EXCEPCION) {
    const clave = k as keyof ExtrasProducto;
    if (!igual(nuevo.extras[clave], p.extras[clave])) extras[k] = nuevo.extras[clave];
  }

  const ov = overridesOnboarding(p.config.onboarding, nuevo.config.onboarding, o.config.overrides);
  if (nuevo.config.permiteDeudaTerceros !== p.config.permiteDeudaTerceros)
    ov.permiteDeudaTerceros = nuevo.config.permiteDeudaTerceros;
  else delete ov.permiteDeudaTerceros;
  if (nuevo.config.capitalMaximo !== null && nuevo.config.capitalMaximo !== p.config.capitalMaximo)
    ov.capitalMaximo = nuevo.config.capitalMaximo;
  else delete ov.capitalMaximo;

  const canales = igual([...nuevo.config.canales].sort(), [...p.config.canales].sort())
    ? null
    : nuevo.config.canales;

  return {
    ...o,
    config: { ...o.config, overrides: ov, canales },
    excepciones: extras as Partial<ExtrasProducto>,
  };
}
