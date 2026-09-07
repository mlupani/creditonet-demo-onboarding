"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ClienteDatos,
  CreditApplication,
  DatosLaboralesPost,
  DatosPersonalesPost,
  Garante,
  LaboralIngresos,
  Oferta,
  PantallaPostOfertaId,
  Referencia,
  RiskResultado,
  RiskRule,
  TipoPersona,
  Tokenizacion,
} from "./types";
import { crearAplicacionInicial, CONSULTA_CLIENTE_MOCK } from "./mocks";
import { recalcularOferta } from "./credit";
import { selloTiempo } from "./format";

const STORAGE_KEY = "creditonet.demo.v2";

interface EstadoPersistido {
  app: CreditApplication;
  paso: number;
  pantallaActual: PantallaPostOfertaId;
}

interface ApplicationContextValue {
  app: CreditApplication;
  paso: number;
  pantallaActual: PantallaPostOfertaId;
  menuAbierto: boolean;
  hidratado: boolean;

  setPaso: (paso: number) => void;
  setPantallaActual: (id: PantallaPostOfertaId) => void;
  setMenuAbierto: (abierto: boolean) => void;

  patchApp: (patch: Partial<CreditApplication>) => void;
  setTipoPersona: (t: TipoPersona) => void;
  consultarCliente: () => void;
  patchCliente: (patch: Partial<ClienteDatos>) => void;
  patchLaboral: (patch: Partial<LaboralIngresos>) => void;
  verificarIdentidad: () => void;
  finalizarRiesgo: (reglas: RiskRule[], resultado: RiskResultado) => void;
  reiniciarRiesgo: () => void;

  patchOferta: (patch: Partial<Oferta>) => void;
  togglePrecancelar: (id: string) => void;
  setDeudaTerceros: (importe: number) => void;
  aceptarOferta: () => void;
  irAPostOferta: () => void;

  patchLaboralPost: (patch: Partial<DatosLaboralesPost>) => void;
  patchPersonalesPost: (patch: Partial<DatosPersonalesPost>) => void;
  patchTokenizacion: (patch: Partial<Tokenizacion>) => void;
  tokenizarTarjeta: () => void;
  setReferencias: (refs: Referencia[]) => void;
  patchGarante: (patch: Partial<Garante>) => void;
  subirDocumento: (scope: "legajo" | "garante", id: string) => void;
  generarImpresion: () => void;
  visitarPantalla: (id: PantallaPostOfertaId) => void;
  finalizarCarga: () => void;

  tomarAnalisis: () => void;
  observarCredito: (observacion: string) => void;
  rechazarCredito: (motivo: string) => void;
  aprobarCredito: () => void;
  reanudarAnalisis: () => void;

  reiniciarDemo: () => void;
}

const ApplicationContext = createContext<ApplicationContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [app, setApp] = useState<CreditApplication>(() => crearAplicacionInicial());
  const [paso, setPaso] = useState(1);
  const [pantallaActual, setPantallaActual] = useState<PantallaPostOfertaId>("laboral");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<EstadoPersistido>;
          if (parsed.app) setApp(parsed.app);
          if (typeof parsed.paso === "number") setPaso(parsed.paso);
          if (parsed.pantallaActual) setPantallaActual(parsed.pantallaActual);
        }
      } catch {
        /* demo sin persistencia si el storage no está disponible */
      } finally {
        setHidratado(true);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hidratado) return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ app, paso, pantallaActual } satisfies EstadoPersistido)
      );
    } catch {
      /* noop */
    }
  }, [app, paso, pantallaActual, hidratado]);

  const patchApp = useCallback((patch: Partial<CreditApplication>) => {
    setApp((prev) => ({ ...prev, ...patch }));
  }, []);

  const setTipoPersona = useCallback((t: TipoPersona) => {
    setApp((prev) => ({ ...prev, tipoPersona: t }));
  }, []);

  const consultarCliente = useCallback(() => {
    setApp((prev) => ({
      ...prev,
      cliente: { ...CONSULTA_CLIENTE_MOCK.datos },
      origenCampos: { ...CONSULTA_CLIENTE_MOCK.origen },
      numeroCliente: CONSULTA_CLIENTE_MOCK.numeroCliente,
      identificacion: {
        ...prev.identificacion,
        consultado: true,
        tipoCliente: CONSULTA_CLIENTE_MOCK.tipoCliente,
      },
      laboral: { ...CONSULTA_CLIENTE_MOCK.laboral },
    }));
  }, []);

  const patchCliente = useCallback((patch: Partial<ClienteDatos>) => {
    setApp((prev) => {
      if (!prev.cliente) return prev;
      const origenCampos = { ...prev.origenCampos };
      (Object.keys(patch) as (keyof ClienteDatos)[]).forEach((k) => {
        origenCampos[k] = "Manual";
      });
      return { ...prev, cliente: { ...prev.cliente, ...patch }, origenCampos };
    });
  }, []);

  const patchLaboral = useCallback((patch: Partial<LaboralIngresos>) => {
    setApp((prev) => ({ ...prev, laboral: { ...prev.laboral, ...patch } }));
  }, []);

  const verificarIdentidad = useCallback(() => {
    setApp((prev) => ({ ...prev, identidadVerificada: true }));
  }, []);

  const finalizarRiesgo = useCallback(
    (reglas: RiskRule[], resultado: RiskResultado) => {
      setApp((prev) => ({
        ...prev,
        numeroCredito: prev.numeroCredito ?? "CR-000184",
        riesgo: {
          estado: "COMPLETO",
          reglas,
          resultado,
          evaluadoConIngresoNeto: prev.laboral.ingresoNeto,
          fecha: selloTiempo(),
        },
      }));
    },
    []
  );

  const reiniciarRiesgo = useCallback(() => {
    setApp((prev) => ({
      ...prev,
      riesgo: {
        estado: "PENDIENTE",
        reglas: [],
        resultado: null,
        evaluadoConIngresoNeto: null,
        fecha: null,
      },
    }));
  }, []);

  const patchOferta = useCallback((patch: Partial<Oferta>) => {
    setApp((prev) => ({ ...prev, oferta: recalcularOferta({ ...prev.oferta, ...patch }) }));
  }, []);

  const togglePrecancelar = useCallback((id: string) => {
    setApp((prev) => ({
      ...prev,
      oferta: recalcularOferta({
        ...prev.oferta,
        creditosActivos: prev.oferta.creditosActivos.map((c) =>
          c.id === id ? { ...c, precancelar: !c.precancelar } : c
        ),
      }),
    }));
  }, []);

  const setDeudaTerceros = useCallback((importe: number) => {
    setApp((prev) => ({
      ...prev,
      oferta: recalcularOferta({
        ...prev.oferta,
        deudaTerceros: { ...prev.oferta.deudaTerceros, importe: Math.max(0, importe) },
      }),
    }));
  }, []);

  const aceptarOferta = useCallback(() => {
    setApp((prev) => ({
      ...prev,
      oferta: { ...prev.oferta, aceptada: true },
      etapa: "TRANSICION",
    }));
  }, []);

  const irAPostOferta = useCallback(() => {
    setApp((prev) => ({ ...prev, etapa: "POST_OFERTA" }));
  }, []);

  const patchLaboralPost = useCallback((patch: Partial<DatosLaboralesPost>) => {
    setApp((prev) => ({
      ...prev,
      postOferta: { ...prev.postOferta, laboral: { ...prev.postOferta.laboral, ...patch } },
    }));
  }, []);

  const patchPersonalesPost = useCallback((patch: Partial<DatosPersonalesPost>) => {
    setApp((prev) => ({
      ...prev,
      postOferta: {
        ...prev.postOferta,
        personales: { ...prev.postOferta.personales, ...patch },
      },
    }));
  }, []);

  const patchTokenizacion = useCallback((patch: Partial<Tokenizacion>) => {
    setApp((prev) => ({
      ...prev,
      postOferta: {
        ...prev.postOferta,
        tokenizacion: { ...prev.postOferta.tokenizacion, ...patch },
      },
    }));
  }, []);

  const tokenizarTarjeta = useCallback(() => {
    setApp((prev) => ({
      ...prev,
      postOferta: {
        ...prev.postOferta,
        tokenizacion: {
          ...prev.postOferta.tokenizacion,
          tokenizada: true,
          token: "tok_demo_8F29A1",
        },
      },
    }));
  }, []);

  const setReferencias = useCallback((refs: Referencia[]) => {
    setApp((prev) => ({
      ...prev,
      postOferta: { ...prev.postOferta, referencias: refs },
    }));
  }, []);

  const patchGarante = useCallback((patch: Partial<Garante>) => {
    setApp((prev) => ({
      ...prev,
      postOferta: { ...prev.postOferta, garante: { ...prev.postOferta.garante, ...patch } },
    }));
  }, []);

  const subirDocumento = useCallback((scope: "legajo" | "garante", id: string) => {
    setApp((prev) => {
      const lista = scope === "legajo" ? prev.postOferta.legajo : prev.postOferta.garanteDocs;
      const actualizada = lista.map((d) =>
        d.id === id
          ? {
              ...d,
              estado: "CARGADO" as const,
              archivo: `${id.replace(/-/g, "_")}_demo.pdf`,
              detalle: `248 KB · ${selloTiempo()}`,
            }
          : d
      );
      return {
        ...prev,
        postOferta:
          scope === "legajo"
            ? { ...prev.postOferta, legajo: actualizada }
            : { ...prev.postOferta, garanteDocs: actualizada },
      };
    });
  }, []);

  const generarImpresion = useCallback(() => {
    setApp((prev) => ({
      ...prev,
      postOferta: { ...prev.postOferta, impresionGenerada: true },
    }));
  }, []);

  const visitarPantalla = useCallback((id: PantallaPostOfertaId) => {
    setApp((prev) =>
      prev.pantallasVisitadas.includes(id)
        ? prev
        : { ...prev, pantallasVisitadas: [...prev.pantallasVisitadas, id] }
    );
  }, []);

  const finalizarCarga = useCallback(() => {
    setApp((prev) => ({
      ...prev,
      estado: "EN_ANALISIS",
      etapa: "ENVIADA",
      fechaEnvioAnalisis: selloTiempo(),
    }));
  }, []);

  const tomarAnalisis = useCallback(() => {
    setApp((prev) => ({
      ...prev,
      estado: "ANALISIS_TOMADO",
      analista: { ...prev.analista, tomado: true },
    }));
  }, []);

  const observarCredito = useCallback((observacion: string) => {
    setApp((prev) => ({
      ...prev,
      estado: "OBSERVADA",
      analista: { ...prev.analista, observacion },
    }));
  }, []);

  const rechazarCredito = useCallback((motivo: string) => {
    setApp((prev) => ({
      ...prev,
      estado: "RECHAZADO",
      analista: { ...prev.analista, motivoRechazo: motivo },
    }));
  }, []);

  const aprobarCredito = useCallback(() => {
    setApp((prev) => ({
      ...prev,
      estado: "APROBADO",
      fechaAprobacion: selloTiempo(),
    }));
  }, []);

  const reanudarAnalisis = useCallback(() => {
    setApp((prev) => ({
      ...prev,
      estado: "ANALISIS_TOMADO",
      analista: { ...prev.analista, observacion: null },
    }));
  }, []);

  const reiniciarDemo = useCallback(() => {
    setApp(crearAplicacionInicial());
    setPaso(1);
    setPantallaActual("laboral");
    setMenuAbierto(false);
  }, []);

  const value = useMemo<ApplicationContextValue>(
    () => ({
      app,
      paso,
      pantallaActual,
      menuAbierto,
      hidratado,
      setPaso,
      setPantallaActual,
      setMenuAbierto,
      patchApp,
      setTipoPersona,
      consultarCliente,
      patchCliente,
      patchLaboral,
      verificarIdentidad,
      finalizarRiesgo,
      reiniciarRiesgo,
      patchOferta,
      togglePrecancelar,
      setDeudaTerceros,
      aceptarOferta,
      irAPostOferta,
      patchLaboralPost,
      patchPersonalesPost,
      patchTokenizacion,
      tokenizarTarjeta,
      setReferencias,
      patchGarante,
      subirDocumento,
      generarImpresion,
      visitarPantalla,
      finalizarCarga,
      tomarAnalisis,
      observarCredito,
      rechazarCredito,
      aprobarCredito,
      reanudarAnalisis,
      reiniciarDemo,
    }),
    [
      app,
      paso,
      pantallaActual,
      menuAbierto,
      hidratado,
      patchApp,
      setTipoPersona,
      consultarCliente,
      patchCliente,
      patchLaboral,
      verificarIdentidad,
      finalizarRiesgo,
      reiniciarRiesgo,
      patchOferta,
      togglePrecancelar,
      setDeudaTerceros,
      aceptarOferta,
      irAPostOferta,
      patchLaboralPost,
      patchPersonalesPost,
      patchTokenizacion,
      tokenizarTarjeta,
      setReferencias,
      patchGarante,
      subirDocumento,
      generarImpresion,
      visitarPantalla,
      finalizarCarga,
      tomarAnalisis,
      observarCredito,
      rechazarCredito,
      aprobarCredito,
      reanudarAnalisis,
      reiniciarDemo,
    ]
  );

  return <ApplicationContext.Provider value={value}>{children}</ApplicationContext.Provider>;
}

export function useApplication(): ApplicationContextValue {
  const ctx = useContext(ApplicationContext);
  if (!ctx) throw new Error("useApplication debe usarse dentro de AppProvider");
  return ctx;
}
