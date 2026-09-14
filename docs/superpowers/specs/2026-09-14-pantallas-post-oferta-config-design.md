# Diseño — Bloques 2 y 3: pantallas post-oferta y su configuración

Fecha: 2026-09-14
Estado: implementado
Fuente de verdad: `docs/Modulo_Onboarding_CreditoNet_v4_1409.md` (§3–§14),
`Modulo_Producto_CreditoNet_v5_1409` (§7 bis), `Modulo_Organismo_CreditoNet_v3_1409` (§4 bis),
`00_Revision_Onboarding_PantallasDetalle_1409`.
Continúa a `2026-09-14-flujo-originacion-docs-1409-design.md` (bloque 1).

## 1. Alcance y decisiones

Alinear las 7 pantallas post-oferta con el detalle funcional y hacerlas configurables por
Producto con excepciones del Organismo, consumiendo catálogos de Parámetros. Sigue siendo una
demo sin backend: APIs, proveedor de tokenización, WhatsApp y archivos son simulados.

| Tema | Decisión |
|---|---|
| Alcance | Bloques 2 (pantallas) y 3 (configuración) juntos: las pantallas no se pueden construir sin la configuración. |
| Modelo | Catálogo de campos para Personales y Laborales; componentes a medida para las pantallas con listas. |
| Banco y CBU | No figuran en el detalle de pantallas, pero la liquidación los usa: se mantienen en una tarjeta “Cuenta de acreditación” de Laborales, marcada con DemoTag. |
| WhatsApp | Envío del link con estado de espera y botón de demo “Simular que el cliente completó”. |

Fuera de alcance: circuito de firma (Función 9), persona jurídica, pantalla de administración
de Parámetros.

## 2. Modelo de campos, configuración y Parámetros

### 2.1 Parámetros (`src/lib/parametros.ts`, nuevo)

Catálogos: estados civiles, tipos de vivienda, provincias, localidades (con provincia y código
postal), vínculos de referencia, vínculos de garante, tipos de documento (id, nombre,
categoría), rubros, compañías telefónicas, bancos, marcas de tarjeta y proveedores de
tokenización. Se mueven desde `validation.ts` los que eran de post-oferta; `GENEROS`,
`CONDICIONES_LABORALES`, `ENTIDADES_ACREEDORAS` y los motivos del analista quedan donde están.

### 2.2 Origen del dato (Onboarding §3)

```ts
type OrigenCampo = "PRECARGADO" | "NO_MODIFICABLE" | "A_CARGAR";
```

- Precargado: insignia “Precargado”; si el valor difiere del precargado, “Rectificado”.
- No modificable: campo bloqueado con candado y “Participó en la generación de la oferta”.
- A cargar: sin insignia; asterisco si es obligatorio.

### 2.3 Catálogo de campos (`src/lib/campos-post-oferta.ts`, nuevo)

`CampoDef`: `id` (único global), `pantalla` (`personales` | `laboral`), `seccion`, `label`,
`origen`, `obligatorio` por defecto, `tipo` (texto, número, fecha, email, dni, cuit, cbu,
característica, teléfono, código postal, select, sí/no), `opciones` (desde Parámetros; pueden
depender de otros valores), `visibleSi` y `valorFijo` (para no modificables, leído de los datos
mínimos).

Funciones: `camposDe`, `obligatorioEfectivo`, `validarCampo`, `erroresPantalla`, `valorCampo`,
`camposRectificados` y `aplicarCambioCampo` (al cambiar provincia limpia la localidad si no
corresponde; al elegir localidad completa el código postal).

### 2.4 Configuración

`ProductoConfig` reemplaza `pantallasPostOferta` y `requiereGarante` por:

```ts
onboarding: {
  pantallas: PantallaPostOfertaConfig[];                 // visible · orden · obligatoria
  camposObligatorios: Partial<Record<string, boolean>>;  // pisa el catálogo
  referencias: { minimo: number; maximo: number };
  garantes: { minimo: number; maximo: number };
  tokenizacion: { maximoTarjetas: number; proveedorId: string };
  documentos: { tipoId: string; obligatorio: boolean; multiple: boolean }[];
}
```

`OrganismoConfig.overrides` admite `pantallas`, `camposObligatorios`, `referencias`,
`garantes`, `tokenizacion` (parciales) y `documentos` (lista propia que reemplaza la del
producto). `configEfectiva` combina y cuenta las excepciones.

| | Refs. | Garantes | Tokenización | Documentos | Campos |
|---|---|---|---|---|---|
| Préstamo personal | 1–2 | 1–2 | opcional · hasta 2 · proveedor A | DNI frente, DNI dorso, recibo de sueldo (varias), servicio; “Otros” opcional (varias) | — |
| Crédito judicial | 1–2 | pantalla oculta | pantalla oculta | DNI frente, DNI dorso, sentencia (varias), servicio | — |
| Policía de la Provincia | pantalla opcional | pantalla oculta | = | = | Repartición obligatoria |
| Jubilados y pensionados | = | = | obligatoria · hasta 1 | DNI frente, DNI dorso, recibo de haberes (una), servicio | Cargo y legajo opcionales |

`PasoConfiguracion` amplía las excepciones legibles con estas propiedades.

## 3. Pantallas 1 y 2

Orden: 1 Datos personales, 2 Datos laborales.

**Precarga.** La primera vez que se presiona “Comenzar la carga” se construye la precarga
(identificación desde `app.cliente`; contacto y domicilio desglosado desde la base interna,
agregados a `CONSULTA_CLIENTE_MOCK`; banco desde los datos mínimos) y se guarda en
`postOferta.precarga`. Reentrar conserva lo cargado. Rectificar no modifica los datos con los
que se evaluó. Los no modificables se leen de `app.laboral`, no se copian.

### Pantalla 1 · Datos personales

| Sección | Campos | Origen | Obligatorio |
|---|---|---|---|
| Identificación | Nombre completo, DNI, Fecha de nacimiento, Género, CUIT | Precargado | Sí |
| | Situación laboral | No modificable | — |
| | Nacionalidad, Estado civil, Tipo de vivienda, Personas a cargo, ¿Tiene cónyuge? | A cargar | Sí |
| | DNI del cónyuge (sólo si tiene cónyuge) | A cargar | Sí |
| Domicilio particular | Calle, Número | Precargado | Sí |
| | Piso, Departamento | Precargado | No |
| | Barrio | A cargar | Sí |
| | Entre calles, Manzana / Bloque / Lote | A cargar | No |
| | Provincia, Localidad, Código postal | Precargado | Sí |
| Contacto | Teléfono (característica y número), Compañía telefónica, Email | Precargado | Sí |
| | Teléfono alternativo (característica y número) | A cargar | No |

La compañía telefónica lleva DemoTag: su origen queda pendiente de ajustar en el pedido.

### Pantalla 2 · Datos laborales

| Sección | Campos | Origen | Obligatorio |
|---|---|---|---|
| Empleador | Fecha de ingreso, Situación laboral | No modificable | — |
| | CUIT del empleador, Razón social, Rubro, N.º de legajo, Cargo | A cargar | Sí |
| | Repartición | A cargar | No |
| Domicilio laboral | Mismos campos que el particular | A cargar | Igual que el particular |
| Teléfono laboral | Característica, Número | A cargar | Sí |
| | Interno, Horario de contacto | A cargar | No |
| Cuenta de acreditación (DemoTag) | Banco | Precargado | Sí |
| | CBU | A cargar | Sí |

Validaciones: DNI 7–8 dígitos, CUIT 11, CBU 22, código postal 4, característica 2–4, número
de teléfono 6–8, email con formato.

Componentes: `CampoPostOferta` (renderiza un campo del catálogo con insignia, bloqueo y error)
y `SeccionCampos` (tarjeta de una sección).

## 4. Pantallas 3 a 7

### 4.1 Tokenización

`postOferta.tarjetas: TarjetaTokenizada[]` con vía (`WHATSAPP` | `PRESENCIAL`), estado
(`ESPERANDO_CLIENTE` | `TOKENIZADA`), destino del envío, tipo, marca, últimos 4 y token. El
número completo y el código de seguridad no se guardan.

- Enviar link por WhatsApp: al celular precargado (deshabilitado si falta). Crea una tarjeta en
  espera con “Simular que el cliente completó”.
- Carga presencial: formulario; al tokenizar se agrega la tarjeta y el formulario se limpia.
- Hasta `maximoTarjetas`; cada una se puede quitar. Muestra el proveedor configurado.
- Completa con al menos 1 tokenizada. Aviso: WhatsApp sólo comparte el link.

### 4.2 Referencias y Garantías

`PersonaVinculada`: vínculo (Parámetros), DNI, nombre completo, domicilio completo, email,
`autocompletado`. Componente compartido `PersonasVinculadas`. “Buscar” por DNI autocompleta
nombre y domicilio desde una API simulada (editables). Agregar hasta el máximo; quitar hasta el
mínimo. Completa con mínimo alcanzado y todas válidas. Garantías agrega el aviso de firma
(Función 9).

### 4.3 Legajo virtual

`postOferta.legajo: Record<tipoId, ArchivoLegajo[]>`. Una fila por documento configurado con
insignias Obligatorio/Opcional y Una imagen/Varias imágenes; adjuntar simulado, varias si
`multiple`, quitar archivo. Completa con todos los obligatorios con ≥ 1 archivo.

### 4.4 Impresión

Resumen de secciones del legajo; botones Imprimir PDF (simulado) y Visualizar en pantalla
(modal con el legajo completo). Cualquiera completa la pantalla y registra
`postOferta.impresion = { accion, fecha }`.

## 5. Estado, analista, liquidación y persistencia

- `estadoPantallasPostOferta` se reescribe sobre catálogo y configuración (§2). Finalizar sigue
  exigiendo las obligatorias completas.
- Contexto: `setCampo`, `enviarLinkWhatsApp`, `simularCompletaCliente`, `tokenizarPresencial`,
  `quitarTarjeta`, `agregarPersona`, `actualizarPersona`, `buscarPersonaPorDni`,
  `quitarPersona`, `adjuntarDocumento`, `quitarArchivo`, `registrarLegajo`. Salen las acciones
  anteriores de post-oferta y `DocumentChecklist`.
- Estado inicial (al comenzar la carga): todo cargado salvo 3 pendientes — DNI del cónyuge,
  email de la referencia, comprobante de servicio. Sin tarjetas; un garante completo.
- Analista: “Documentación” con obligatorios adjuntados, tarjetas, referencias, garantes y
  legajo impreso/visualizado; tarjeta “Datos rectificados” si corresponde.
- Liquidación: banco y CBU desde `postOferta.laboral`.
- `STORAGE_KEY` → `creditonet.demo.v10`.

## 6. Verificación

`npx tsc --noEmit`, `npx eslint src` y recorrido en navegador:

1. Préstamo personal · Salud: stepper Personales (1) → Impresión (7) con 3 pendientes.
2. Personales: rectificar email → “Rectificado”; situación laboral bloqueada; “Tiene cónyuge:
   No” oculta el DNI del cónyuge y quita el pendiente.
3. Laborales: fecha de ingreso bloqueada; localidad completa el código postal.
4. Tokenización: WhatsApp en espera → simular → tokenizada; segunda presencial; máximo 2.
5. Referencias: agregar hasta 2, buscar DNI autocompleta. Legajo: recibo admite 2 archivos.
6. Impresión: visualizar completa. Finalizar → analista ve documentación y rectificados.
7. Policía: repartición obligatoria, sin garantías. Jubilados: tokenización obligatoria bloquea
   finalizar. Crédito judicial: documento de sentencia.
8. Liquidación con banco y CBU.
