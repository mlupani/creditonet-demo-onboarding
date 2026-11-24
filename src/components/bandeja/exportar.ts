import { bancoTexto, nombreCaja } from "@/lib/caja-operaciones";
import { cajaStores, nombreUsuario } from "@/lib/caja-store";
import {
  TIPO_PENDIENTE_LABEL,
  lotesDeBandeja,
  ordenesDeBandeja,
  pendientesDeBandeja,
  remesasDeBandeja,
  type DatosBandeja,
  type FiltrosBandeja,
  type VistaBandeja,
} from "@/lib/bandeja-reglas";
import { ESTADO_PAGO_LABEL } from "@/lib/proveedores-tipos";
import { destinoTexto, estadoTexto } from "@/components/caja/TesoreriaModales";
import { cuitTexto } from "./comunes";

export interface HojaBandeja {
  nombre: string;
  filas: string[][];
}

// Filas de cada solapa de la Bandeja, con los mismos filtros que la pantalla. Una sola función para que
// el botón "Exportar a Excel" de la barra de filtros sirva para cualquier solapa (y para "Todos").
export function hojaDeVista(vista: VistaBandeja, d: DatosBandeja, filtros: FiltrosBandeja): HojaBandeja {
  if (vista === "proveedores") {
    return {
      nombre: "Órdenes de pago",
      filas: [
        ["Orden", "Proveedor", "CUIT", "Fecha proceso", "Facturas", "Total", "Pendiente", "Estado", "Armó", "Autorizó"],
        ...ordenesDeBandeja(d.ordenes, d.pagos, d.proveedores, filtros).map((f) => [
          f.orden.id,
          f.proveedor?.razonSocial ?? f.orden.proveedorId,
          cuitTexto(f.proveedor),
          f.orden.fechaArmado,
          String(f.orden.items.length),
          String(f.orden.total),
          String(f.pendiente),
          f.fase === "AUTORIZAR" ? "Por autorizar" : "Autorizada · por pagar",
          nombreUsuario(f.orden.armadaPor),
          f.orden.autorizacion ? nombreUsuario(f.orden.autorizacion.usuarioId) : "",
        ]),
      ],
    };
  }
  if (vista === "transferencias") {
    return {
      nombre: "Transferencias",
      filas: [
        ["Cuenta de origen", "Pago", "Orden", "Proveedor", "CUIT", "CBU destino", "Importe", "Estado"],
        ...lotesDeBandeja(d.lotes, filtros, d.pagos).flatMap((l) =>
          l.items.map((i) => [bancoTexto(l.cuentaId), i.pagoId, i.ordenPago, i.proveedor, i.cuit, i.cbuDestino, String(i.importe), ESTADO_PAGO_LABEL[i.estado]])
        ),
      ],
    };
  }
  if (vista === "remesas") {
    const tipos = cajaStores.tipos.get();
    return {
      nombre: "Remesas",
      filas: [
        ["ID", "Fecha", "Tipo", "Origen", "Destino", "Moneda", "Importe", "Estado", "Motivo"],
        ...remesasDeBandeja(d.movimientos, d.cajas, d.usuario, filtros).map((m) => [
          m.id,
          m.fechaSolicitud,
          tipos.find((t) => t.id === m.tipoId)?.descripcion ?? m.tipoId,
          nombreCaja(m.origenId),
          destinoTexto(m),
          m.moneda,
          String(m.importe),
          estadoTexto(m),
          m.motivo,
        ]),
      ],
    };
  }
  return {
    nombre: "Pendientes",
    filas: [
      ["Tipo", "Referencia", "Detalle", "Importe", "Moneda"],
      ...pendientesDeBandeja(d, filtros).map((p) => [TIPO_PENDIENTE_LABEL[p.tipo], p.referencia, p.detalle, String(p.importe), p.moneda]),
    ],
  };
}

// Una vista, una hoja con su nombre. Varias ("Todos"): una sola hoja con cada sección precedida por su título
// y separadas por una fila en blanco, porque el generador de Excel de la demo escribe una hoja por archivo.
export function hojaDeVistas(vistas: VistaBandeja[], d: DatosBandeja, filtros: FiltrosBandeja): HojaBandeja {
  if (vistas.length === 1) return hojaDeVista(vistas[0], d, filtros);
  const filas: string[][] = [];
  for (const v of vistas) {
    const h = hojaDeVista(v, d, filtros);
    if (filas.length > 0) filas.push([]);
    filas.push([h.nombre.toUpperCase()], ...h.filas);
  }
  return { nombre: "Bandeja", filas };
}
