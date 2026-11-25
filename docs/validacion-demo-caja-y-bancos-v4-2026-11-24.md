# Validación de la demo de Caja y Bancos contra la especificación v4

**Proyecto CreditoNet**  
**Fecha de revisión** · 24 de noviembre de 2026, Buenos Aires  
**Demo** · Demo interactiva v0.3, acceso inicial con el perfil Superior  
**Especificación** · Módulo Caja y Bancos, v4 del 20/11/2026, 30 páginas

- [Demo publicada con el perfil Superior](https://creditonet-demo-onboarding.vercel.app/?rol=superior)
- [PDF de referencia en Descargas](<C:/Users/crist/Downloads/CajaYBancos_v4_2026-11-20.pdf>)

## Resumen ejecutivo

**La demo se adapta bastante al v4 y sirve para validar el diseño con el equipo.** Representa bien la operatoria de caja, el circuito de actas, las remesas, el cálculo del saldo disponible, el monitoreo y el armado de órdenes de pago. Posición de saldos, Tablero de tesoros y Órdenes de pago son las pantallas con mayor fidelidad a los ejemplos del PDF.

**La conformidad funcional completa sigue pendiente.** Hay una diferencia en el momento en que un depósito aumenta el saldo real del banco. Faltan el cierre de medios electrónicos, la carga diaria de saldos bancarios y el desembolso de préstamos desde la Bandeja. La recepción física del efectivo también admite un rol adicional en la demo. En Proveedores, la carga masiva usa CSV y la cuenta corriente revisada presenta un saldo en pesos.

**El hallazgo visual más importante afecta la documentación de control.** En una apertura simulada con un faltante de $20.000, la pantalla mantuvo la caja pendiente de autorización y generó un acta de diferencia pendiente de firma. La vista imprimible de la apertura mostraba «Supervisor: no requerido». Ambas superficies describían el mismo recuento.

### Contenido

- [Alcance y evidencia](#alcance-y-evidencia)
- [Validación funcional por área](#validación-funcional-por-área)
- [Reglas transversales del v4](#reglas-transversales-del-v4)
- [Validación de diseño por pantalla](#validación-de-diseño-por-pantalla)
- [Registro de pruebas ejecutadas](#registro-de-pruebas-ejecutadas)
- [Hallazgos y prioridad propuesta](#hallazgos-y-prioridad-propuesta)
- [Pruebas pendientes para conformidad](#pruebas-pendientes-para-conformidad)
- [Decisiones abiertas del PDF](#decisiones-abiertas-del-pdf)

## Alcance y evidencia

1. **Primera revisión funcional.** Se leyó la especificación completa y se inventariaron los submenús de Caja y Bancos con Superior seleccionado. Chrome perdió la conexión de control al seguir los enlaces. Se inspeccionaron las rutas y los archivos de interfaz que sirve la demo publicada para completar el contraste de pantallas, estados y reglas representadas.
2. **Segunda revisión de diseño.** Se recuperó el acceso a Chrome y se recorrieron las pantallas en escritorio. Se contrastaron los ejemplos visuales del PDF con la interfaz renderizada. Se probaron el recuento de apertura hasta mostrar la diferencia, la selección de comprobantes de una orden de pago y la lectura de los controles de cierre. Se generó un acta de prueba en el navegador integrado, en una sesión aislada con datos simulados.
3. **Alcance del resultado.** Una pantalla vista o una regla encontrada en la interfaz publicada acredita que la demo la representa. Las transiciones que efectivamente se ejercitaron están detalladas en el registro de pruebas. Quedaron pendientes la ejecución de los circuitos completos, la validación de autorizaciones y visibilidad con todos los perfiles, la descarga y revisión de archivos finales, la adaptación móvil y las integraciones reales.

La cabecera experimentada muestra el perfil general **Superior**, asociado a Diego Suárez, Supervisor de riesgo. Las pantallas del módulo tienen además el selector **Actuar como**, cuyo usuario operativo inicial era Ana Gómez, Cajero. La fecha y la hora operativas son simuladas. En las pruebas de apertura y cierre se observó el 24/11/2026 a las 11:00. El acta simulada se generó en la sesión aislada y la orden de pago se dejó en estado de selección, sin emitirla.

## Validación funcional por área

### 1. Caja y actas · pp. 3–11

| Sección del v4 | Resultado en la demo | Alcance de la evidencia |
|---|---|---|
| **1.1 Apertura de caja** · p. 7 | Caja asignada, horario operativo, recuento por denominación, total contado y revelado posterior del esperado. El faltante que excede tolerancia solicita motivo y presenta el bloqueo hasta autorización. | Se ejecutó el recuento y se registró una apertura simulada con faltante. Se comprobó el estado pendiente. [Apertura](https://creditonet-demo-onboarding.vercel.app/caja/apertura) |
| **1.2 Cierre de caja** · pp. 7–8 | La interfaz distingue el cierre en sistema de la entrega y la custodia física. Contempla firma de recepción, segunda firma remota para sucursal unipersonal y reapertura autorizada. La recepción presencial admite al tesorero o a un supervisor de sucursal. El PDF asigna la recepción y custodia al tesorero. | La interfaz publicada contiene tanto el texto como la validación que admite al supervisor. La entrega física y el cambio de custodia quedan por ejercitar. [Cierre de caja](https://creditonet-demo-onboarding.vercel.app/caja/cierre) |
| **1.3 Arqueo ordinario y sorpresivo** · pp. 8–9 | Están representados el controlador, el corte, el recuento ciego, el segundo conteo opcional, la inclusión de varias cajas en un corte, el historial y el ajuste separado. El Tablero contempla ordenar el arqueo desde Casa Central. | Pantallas y reglas identificadas en la interfaz publicada. Queda probar el bloqueo durante el corte, la segunda firma y la liberación de caja. [Arqueo](https://creditonet-demo-onboarding.vercel.app/caja/arqueo) · [Tablero](https://creditonet-demo-onboarding.vercel.app/caja/tablero) |
| **1.4 Cambio de turno** · p. 9 | Circuito de solicitud, corte, arqueo de relevo, autorización, recepción y cierre del relevo. La interfaz contempla reemplazo urgente, atribución de la diferencia al saliente, modalidades directa y por tesoro, e incidencia si el entrante cuenta un importe diferente. | Identificado en la interfaz publicada. Quedan por ejecutar las variantes con dos usuarios y resolver una incidencia. [Cambio de turno](https://creditonet-demo-onboarding.vercel.app/caja/turno) |
| **1.5 Libro de movimientos** · pp. 9–10 | Mayor por caja y moneda, filtros básicos y avanzados, saldo inicial y final, ingresos, egresos, saldo por fila, estado, comprobante, referencia y exportación. El original anulado y su contramovimiento se muestran en filas distintas. | Se verificó visualmente el par LB-0009 y LB-0010, con referencias y motivo. Las exportaciones y sus registros de auditoría quedan por ejecutar. [Libro de movimientos](https://creditonet-demo-onboarding.vercel.app/caja/libro) |
| **1.6 Cierre diario de sucursal** · pp. 10–11 | La pantalla presenta los seis controles, el estado de la fecha y el historial. La interfaz contempla justificaciones, ventana de ajuste, acta de cierre, segunda firma remota, bloqueo de fecha y reapertura con llave. La reapertura habilita ajustes y contramovimientos. | Se observó la tabla, un movimiento pendiente justificable y el aviso de medios electrónicos pendiente. La firma, el nuevo cierre y el historial de reapertura quedan por ejecutar. [Cierre de sucursal](https://creditonet-demo-onboarding.vercel.app/caja/cierre-sucursal) |
| **1.7 Cierre de medios electrónicos** · p. 11 | El cierre diario lista tarjetas, QR y transferencias como control requerido, con el estado «No aplica en la demo (1.7 pendiente)». El menú carece de una entrada específica para cierre de lotes y cruce de operaciones. | Brecha confirmada en la pantalla. El flujo definido incluye carga o importación del lote, cruce con terminal, diferencias, ajustes y paso a conciliación bancaria. [Cierre de sucursal](https://creditonet-demo-onboarding.vercel.app/caja/cierre-sucursal) |

**Actas de conformidad y diferencia.** La ficha de la demo contempla identificador, evento de origen, fecha y hora, moneda, esperado, contado, diferencia con signo, responsable de los fondos, detector, motivo y las dos firmas. La interfaz publicada también contempla disconformidad con observaciones, negativa a firmar, escalamiento a un superior, rechazo con nueva verificación, segunda firma remota, ajuste vinculado e historial. La leyenda de autorización remota indica que la firma se hace sin verificación física. En la prueba se verificó la creación del acta y su estado pendiente de primera firma. Las firmas, la resolución y la recepción física posterior quedan por probar. PDF, pp. 3–6. [Actas de caja](https://creditonet-demo-onboarding.vercel.app/caja/actas)

### 2. Bancos · pp. 12–14

| Sección del v4 | Resultado en la demo | Alcance de la evidencia |
|---|---|---|
| **2.1 Alta de acuerdos** | ABM por cuenta bancaria con fecha, importe, tasa, vencimiento y estado. En Posición de saldos aparecen avisos por vencimiento según los datos y la fecha operativa de la demo. | Se abrió el inventario de acuerdos y se revisaron controles y columnas. El disparo de la alerta queda por probar. [Alta de acuerdos](https://creditonet-demo-onboarding.vercel.app/caja/acuerdos) |
| **2.2 Alta de chequeras** | Formulario para chequera física o e-cheq, banco, cuenta, fecha y rango. La interfaz admite e-cheq sin rango y contempla la validación de rangos superpuestos. | Identificado en la interfaz publicada. La regla definitiva de numeración del e-cheq sigue abierta en el PDF. [Alta de chequeras](https://creditonet-demo-onboarding.vercel.app/caja/chequeras) |
| **2.3 Conciliaciones** | Se representa el cruce de acreditaciones de depósitos de tesorería, con importe y referencia del extracto, y vistas de pendientes y conciliados. El alcance visible no cubre importación general de extractos ni conciliación de tarjetas, QR y transferencias con aranceles, retenciones y contracargos. | Implementación parcial del alcance enunciado. El detalle y la modalidad general de conciliación siguen abiertos en el v4. [Conciliaciones](https://creditonet-demo-onboarding.vercel.app/caja/bancos) |
| **2.4 Carga diaria de saldos** | No se encontró una opción para cargar saldo bancario observado por cuenta, moneda y fecha, adjuntar respaldo y compararlo con los registros del sistema. La posición de bancos se presenta a partir del saldo inicial y los movimientos de la demo. | Brecha identificada en el menú y en la interfaz publicada de las rutas revisadas. [Posición de saldos](https://creditonet-demo-onboarding.vercel.app/caja/posicion) |
| **2.5 Transferencias y cheques** | La interfaz representa preparación, pendiente de ejecución, ejecución y confirmación de transferencias, con tratamiento de rechazos. Para cheques propios muestra emisión, entrega, presentación, débito, anulación y rechazo. La entrega del cheque permite dar por pagada la orden antes del débito bancario, con la reserva aún comprometida. | Presencia de los estados y de las reglas en la interfaz publicada. Queda ejecutar cada transición y conciliar sus efectos en la orden, en la reserva y en el saldo real. [Cheques y valores](https://creditonet-demo-onboarding.vercel.app/caja/cheques) · [Bandeja](https://creditonet-demo-onboarding.vercel.app/caja/bandeja) |

### 3. Movimientos de tesorería y Bandeja de autorizaciones · pp. 15–17 y 29

La pestaña **Remesas** representa pedidos realizados y recibidos, movimientos por autorizar, enviados en tránsito, por recibir, con incidencia y finalizados. El circuito contempla refuerzos, pases, remesas, depósitos y extracciones. La interfaz pide origen, destino, moneda, importe, motivo y comprobante o precinto según el caso. Incluye entrega al portador, conteo de destino, incidencia y finalización documentada. La lógica publicada contempla el control del estimado al autorizar. Queda ejecutar un traslado completo con autorización independiente, reserva, entrega, recepción y cierre. [Bandeja de autorizaciones](https://creditonet-demo-onboarding.vercel.app/caja/bandeja)

**Diferencia del depósito bancario.** El ejemplo del PDF indica que la remesa autorizada reserva $100.000 en el tesoro, la entrega consume la reserva y baja el real del origen, y la carga de la boleta sube el saldo real del banco de $1.000.000 a $1.100.000. En la demo, la boleta finaliza documentalmente la remesa, pero el banco conserva el ingreso como *A recibir* hasta conciliar la acreditación. La propia pantalla de Posición explica que su saldo real bancario suma depósitos conciliados. Esta regla puede cambiar el disponible y el momento en que se permite un nuevo egreso. PDF, pp. 16–18. [Posición de saldos](https://creditonet-demo-onboarding.vercel.app/caja/posicion) · [Conciliaciones](https://creditonet-demo-onboarding.vercel.app/caja/bancos)

**Ubicación de la Bandeja.** El PDF v4 la establece como módulo propio y conserva en Caja y Bancos la definición de los movimientos de tesorería. La demo la presenta como enlace dentro de Caja y Bancos. El acceso a Remesas desde esa Bandeja coincide con el flujo especificado. [Bandeja de autorizaciones](https://creditonet-demo-onboarding.vercel.app/caja/bandeja)

**Préstamos.** Se vio la opción Préstamos en la Bandeja y en la interfaz publicada figura como próxima. Queda pendiente demostrar el desembolso por beneficiario, la regularización de pagos parciales o a terceros y el cambio a *Activo* al completarse el total, criterio que el PDF da por resuelto. El detalle de otros cobros y pagos pertenece al documento propio de la Bandeja, que no formó parte de esta revisión. PDF, p. 15 y punto 22, p. 29. [Bandeja de autorizaciones](https://creditonet-demo-onboarding.vercel.app/caja/bandeja)

### 4. Posición de caja y bancos · pp. 18–19

- **Posición de saldos.** La pantalla mantiene saldo real, comprometido, estimado y a recibir por caja o cuenta y moneda. El estimado se muestra como real menos comprometido. La interfaz representa detalle de reservas y operaciones comprometidas y avisos de acuerdos. El disponible consolidado observado fue $75.960.000, con real de $76.520.000 y comprometido de $560.000. En dólares se mostraron US$145.000 de estimado y US$0 de comprometido. Son cifras de la demo. [Posición de saldos](https://creditonet-demo-onboarding.vercel.app/caja/posicion)
- **Tablero de tesoros.** Se verificaron estado por caja, responsable del turno, saldos en pesos y dólares, diferencias, efectivo al cierre, estado de cierre diario, alertas, fondos en tránsito, máximos y autorizaciones pendientes. Ver actas y exportar estaban disponibles en la vista revisada. La acción de arqueo sorpresivo corresponde a Casa Central según la regla de la interfaz publicada. [Tablero de tesoros](https://creditonet-demo-onboarding.vercel.app/caja/tablero)
- **Histórico de saldos.** La interfaz publicada contempla evolución diaria o mensual, una foto a fecha, consolidados, detalle del período y exportación a Excel y PDF. Queda verificar la selección múltiple de cajas y cuentas, la navegación al detalle y la integridad de los archivos exportados. [Histórico de saldos](https://creditonet-demo-onboarding.vercel.app/caja/historico)

### 5. Cash flow · p. 19

El PDF deja Cash flow para una etapa posterior y el menú de la demo lo muestra como próximo. Es un pendiente compartido del alcance. [Demo de CreditoNet](https://creditonet-demo-onboarding.vercel.app/?rol=superior)

### 6. Proveedores · pp. 20–23

| Sección del v4 | Resultado en la demo | Diferencia o verificación pendiente |
|---|---|---|
| **6.1 Carga de comprobantes** | La interfaz publicada contempla proveedor, datos fiscales, percepciones, respaldo, controles de duplicado y consistencia de importes, autorización independiente y estados. La carga masiva tiene plantilla, resultados por fila y motivo de rechazo. | El archivo que la demo lee es CSV preparado en Excel. La lectura de QR y la vinculación del teléfono son simulaciones. La carga manual, el lote y la transición de Preaprobado a Para liquidar quedan por ejecutar. [Carga de comprobantes](https://creditonet-demo-onboarding.vercel.app/proveedores/carga) |
| **6.2 Órdenes de pago** | Se representa una orden de un solo proveedor, con comprobantes Para liquidar, cuenta destino, moneda, saldo por comprobante, importe a pagar y total. Se separan borrador, emisión, autorización y pago desde la Bandeja. La interfaz publicada identifica a un autorizante distinto de quien armó la orden. | Se validó la selección de una factura y el recálculo del total. Quedan por ejecutar emisión, autorización, reserva al elegir el origen, aplicación del pago, rechazos y liberación. El pago parcial aparece como opción de la demo y sigue abierto en el PDF. [Órdenes de pago](https://creditonet-demo-onboarding.vercel.app/proveedores/ordenes) · [Bandeja](https://creditonet-demo-onboarding.vercel.app/caja/bandeja) |
| **6.3 Posición de proveedores** | Vista general con búsqueda por CUIT, razón social o ID, saldo, vencimientos, antigüedad de deuda y acceso a cuenta corriente. La lógica publicada toma comprobantes autorizados y pagos aplicados. | La pantalla revisada presenta un saldo en pesos. El v4 requiere separar el saldo en ARS y USD. Queda verificar con un proveedor con deuda en las dos monedas. [Posición de proveedores](https://creditonet-demo-onboarding.vercel.app/proveedores/posicion) |
| **6.4 Consultas** | La interfaz ofrece órdenes por número o proveedor, comprobantes pendientes, cuenta corriente, trazabilidad, exportación y acciones de reimpresión y reenvío. | Reimpresión y reenvío figuran como simulados en los mensajes de la demo. Queda comprobar el resultado con una orden pagada que tenga comprobantes, fecha valor y origen identificados. [Consultas](https://creditonet-demo-onboarding.vercel.app/proveedores/consultas) |

### 7. Parámetros, roles y alertas · pp. 24–28

- El PDF define los catálogos de sucursales, cajas, denominaciones, motivos, movimientos, bancos, chequeras, proveedores y comprobantes. También define terminales, aranceles y retenciones, jurisdicciones, alertas, plazos y matriz de autorizaciones. La revisión se apoyó en el patrón de ABM visible y en los controles de roles, plazos y firma de las pantallas del módulo. El catálogo completo, las asignaciones por sucursal y caja y la matriz por tipo e importe quedan por verificar, incluidos los límites efectivos de cada perfil. [Demo de CreditoNet](https://creditonet-demo-onboarding.vercel.app/?rol=superior)
- La salida de **Alertas enviadas** se identifica como simulada. La interfaz publicada contempla diferencias sobre tolerancia, actas no conformes, cierres pendientes, arqueos vencidos, acuerdos por vencer y escalamiento por negativa de firma. Queda verificar destinatarios, registro, oportunidad del aviso y enrutamiento de cada evento. [Alertas enviadas](https://creditonet-demo-onboarding.vercel.app/caja/alertas)

## Reglas transversales del v4

| Regla | Evidencia y alcance |
|---|---|
| **R1 · Original y contramovimiento** | Se comprobó en el Libro que el original anulado y la anulación se conservan visibles, vinculados y con motivo. Queda probar la generación del vínculo y el efecto en los saldos para distintos tipos de movimiento. |
| **R2 · Identificador propio** | Se observaron IDs de movimientos, jornadas, actas y acuerdos. Queda comprobar generación, unicidad, conservación y trazabilidad en todos los tipos de operación. |
| **R3 · Manda el estimado** | La pantalla de Posición separa real, comprometido, estimado y a recibir. La interfaz publicada contempla bloqueo por falta de estimado en operaciones de tesorería y pagos. Queda probar creación, consumo, liberación y no duplicación de reservas. El momento de acreditación del depósito difiere del ejemplo del PDF. |
| **R4 · Alertas de contingencia** | Se identificó la bandeja de salida simulada y la lógica de eventos. Queda verificar cada disparador y su destinatario. |
| **R5 · Visibilidad según el ámbito** | El PDF reserva la vista de todas las cajas a Director y Tesorero central. La cabecera Superior coexistió con el usuario operativo Cajero y la Posición mostró saldos centrales. Esto amerita una prueba comparativa de permisos por ambos selectores antes de atribuir la visibilidad a uno de ellos. |
| **R6 · Llave y autorización independiente** | Se identificaron la llave simulada con código temporal, los roles de firma y el control de autorización por un usuario distinto del cargador. Se comprobó el estado de espera de la primera firma. Quedan por ejercitar la misma identidad con múltiples roles, la firma remota, los límites de la matriz y el segundo factor definitivo. |
| **R7 · Correcciones mediante ajustes** | La interfaz representa reapertura y ajustes con movimientos propios y el Libro conserva las dos filas de una anulación. Queda comprobar que una fecha reabierta solo admite los cambios habilitados y que su nuevo cierre referencia al anterior. |

## Validación de diseño por pantalla

### Patrón visual general

El PDF ofrece ejemplos de organización de la información y elementos de interfaz, con tablas, estados, formularios y diagramas de procesos. La demo los lleva a la navegación lateral de CreditoNet, con tablas de encabezado azul oscuro, secciones, tarjetas y acciones por fila. La estructura se reconoce en escritorio y la densidad de información es coherente con un módulo operativo. Algunas etiquetas largas del menú quedan truncadas cuando se despliega la sección.

La barra de actor, fecha y hora permite probar escenarios y ocupa la parte superior de las pantallas. El perfil superior de la cabecera y el rol operativo deben distinguirse antes de elegir una acción. La revisión mostró una orden cuyo total se recalculaba con normalidad mientras las acciones de guardar y emitir seguían deshabilitadas para Cajero. El formulario informa el requisito de perfil financiero al pie. Mostrarlo junto a la acción reduciría la ambigüedad. [Demo de CreditoNet](https://creditonet-demo-onboarding.vercel.app/?rol=superior) · [Órdenes de pago](https://creditonet-demo-onboarding.vercel.app/proveedores/ordenes)

### Apertura y acta · pp. 6–7

- La grilla de denominaciones es una adaptación apta para ingresar cantidades y ver el total. **Ver diferencia** revela los valores de comparación después del recuento. La tarjeta roja muestra importe, signo y carácter deudor del faltante, junto con la explicación del siguiente paso.
- El PDF concentra identificación, recuento por denominación, importes, responsable, detector, motivo y firmas en una ficha. La demo muestra un panel de diferencia para revisar y firmar y una vista de acta de apertura con el desglose por denominación. El historial permite abrir el detalle y ofrece la acción PDF.
- La vista imprimible abierta desde **Ver acta de apertura** mostraba el responsable y el detalle de los 29 billetes, pero incluía «Supervisor: no requerido» durante la espera de autorización. El motivo se leía como código MDC-001 en esa vista, mientras el panel de diferencia mostraba «Error de vuelto». La pantalla previa, el documento imprimible y el historial deben expresar el mismo estado y un motivo legible. [Apertura](https://creditonet-demo-onboarding.vercel.app/caja/apertura) · [Actas de caja](https://creditonet-demo-onboarding.vercel.app/caja/actas)

### Posición de saldos y Tablero de tesoros · pp. 18–19

- **Posición.** Conserva las seis columnas del ejemplo y jerarquiza el disponible con color y peso tipográfico. Separar cajas de bancos y sumar tarjetas de totales por moneda facilita la lectura. La ayuda explica la composición de los saldos y la columna de fondos a recibir se identifica como informativa.
- **Tablero.** Mantiene la lectura por sucursal y caja del PDF. Las tarjetas de pendientes, tránsito, máximos y diferencias amplían el resumen. El color y la etiqueta distinguen estados. En la misma fila pueden coexistir *Sin abrir hoy* para la caja y *Abierta* para la fecha operativa de la sucursal. Explicitar los dos niveles de estado en la lectura de cada fila reduciría la confusión. [Posición de saldos](https://creditonet-demo-onboarding.vercel.app/caja/posicion) · [Tablero de tesoros](https://creditonet-demo-onboarding.vercel.app/caja/tablero)

### Libro de movimientos y cierre diario · p. 10

- **Libro.** Reproduce el patrón de mayor. La fila original se distingue por tachado y estado Anulado, y el contramovimiento conserva su fila confirmada. Las referencias cruzadas permiten seguir la relación sin depender del color. Los filtros avanzados se abren bajo demanda. La densidad del ejemplo probado hizo que algunos importes se vieran en dos líneas.
- **Cierre diario.** La columna **Resultado** agrega una lectura operativa a la tabla de controles del PDF. Distingue controles conformes, pendientes justificables y una función pendiente de la demo. En la vista revisada, con Cajero como actor, el botón de inicio estaba deshabilitado. Una indicación próxima de quién puede iniciarlo ayudaría cuando el perfil superior de la cabecera sugiere otra cosa. [Libro de movimientos](https://creditonet-demo-onboarding.vercel.app/caja/libro) · [Cierre de sucursal](https://creditonet-demo-onboarding.vercel.app/caja/cierre-sucursal)

### Orden de pago · p. 22

- Se preservan proveedor, cuenta destino, moneda, grilla con selección, saldo, importe a pagar, total y las acciones de enviar a autorizar, guardar borrador y cancelar. El panel que explica dónde se paga ayuda a seguir la transición a la Bandeja.
- La grilla mostraba **Vencimiento** en el lugar de **Fecha de proceso** del PDF. El vencimiento sirve para priorizar pagos y la fecha de proceso conserva la trazabilidad de carga. Debe decidirse dónde mostrar ambos datos.
- En el proveedor de prueba, la cuenta destino mostraba el CBU completo sin el nombre del banco. El ejemplo del PDF usa banco, CBU abreviado y cuenta predeterminada identificada. Mejorar ese resumen facilitaría distinguir cuentas cuando haya varias. [Órdenes de pago](https://creditonet-demo-onboarding.vercel.app/proveedores/ordenes)

### ABM de acuerdos · pp. 2 y 12

El ABM respeta el inventario con búsqueda, alta, exportación, acciones y auditoría a través del historial. Conserva los campos propios de acuerdos bancarios. La demo inicia en **Activos y suspendidos** y usa un selector para cambiar de estado. El ejemplo documental inicia en **Activos** y agrupa Suspendidos y Eliminados como secciones colapsadas. La demo representa las acciones por fila con íconos y etiquetas accesibles. En los acuerdos, las fechas de la tabla se muestran en formato ISO. [Alta de acuerdos](https://creditonet-demo-onboarding.vercel.app/caja/acuerdos)

## Registro de pruebas ejecutadas

| Prueba | Acción | Resultado observado |
|---|---|---|
| **Navegación inicial** | Abrir la demo con Superior y desplegar Caja y Bancos. | Se inventariaron Caja, Bancos, Bandeja, Posición, Cash flow y Proveedores. Se identificaron las rutas internas y la ubicación de la Bandeja. |
| **Recuento ciego** | En Caja 1 Sucursal Bariloche, cargar 29 billetes de $20.000 y pulsar Ver diferencia. | Antes de pulsar se veía el contado. Después aparecieron $580.000 contados, $600.000 esperados y −$20.000 de diferencia. Se informó el exceso de tolerancia y se habilitaron motivo y opción de repetir el recuento. |
| **Registro del faltante** | En sesión aislada, elegir Error de vuelto y registrar la apertura de prueba. | Jornada JOR-0001 en Apertura pendiente de autorización. Acta ACT-000001 de diferencia, pendiente de firma 1. Se identificó a Ana Gómez como responsable de los fondos y como quien detectó la diferencia en este caso. |
| **Historial y detalle del acta** | Abrir Actas de caja y desplegar el detalle de ACT-000001. | Se vio la fila con caja, fecha, tipo, firmantes y estado, y la acción PDF. El detalle mostraba la firma del responsable y la del supervisor pendientes. |
| **Vista imprimible de apertura** | Abrir Ver acta de apertura para JOR-0001. | El diálogo mostró detalle de 29 billetes, importes y motivo MDC-001. Mostró «Supervisor: no requerido» mientras la apertura seguía pendiente de autorización. Se verificó la vista previa en pantalla. |
| **Orden de pago** | Elegir un proveedor con una factura Para liquidar y tildarla. | El total pasó de $0,00 a $96.800,00. La grilla mostraba fecha de emisión, vencimiento, saldo y a pagar. Guardar y enviar seguían deshabilitados para el actor Cajero. |
| **Libro de caja** | Abrir el Libro con la caja operativa visible. | LB-0009 mostraba un cobro original de $45.000 anulado por LB-0010. LB-0010 mostraba el contramovimiento y el motivo «Importe erróneo». El saldo exhibido seguía en $600.000. |
| **Cierre diario** | Abrir el cierre de Sucursal Bariloche. | Se vieron seis controles. MT-0002 aparecía pendiente de autorización y justificable. Medios electrónicos figuraba como pendiente de la demo. El historial estaba vacío en la fecha y situación revisadas. |
| **Posición, tablero y ABM** | Abrir las tres pantallas de escritorio y cotejarlas con los ejemplos del PDF. | Se verificaron las columnas de saldos, indicadores del tablero, estados, totales, acciones Ver actas y Exportar, e inventario de acuerdos con filtro inicial Activos y suspendidos. |

## Hallazgos y prioridad propuesta

Las prioridades expresan impacto en la próxima validación con Producto y Tesorería.

| Prioridad | Hallazgo | Criterio de aceptación |
|---|---|---|
| **Alta** | El acta imprimible indica que el supervisor no es requerido durante una apertura pendiente de autorización. | Panel, historial y documento muestran la misma necesidad de firma, el estado y el firmante correspondiente. El motivo se lee como descripción. |
| **Alta** | El depósito aumenta el real bancario al conciliar en la demo y al cargar la boleta en el ejemplo del v4. | Producto fija el evento de acreditación y el mismo resultado se observa en Remesas, Conciliaciones, Posición y validación de egresos, sin contabilizar dos veces. |
| **Alta** | Cierre de medios electrónicos ausente del circuito operativo. | Se puede cerrar y cruzar lotes de tarjeta, QR y transferencias. Cierre diario muestra el resultado real del control y el tratamiento de diferencias. |
| **Alta** | Falta la carga diaria de saldos bancarios. | Se registra saldo informado por banco, moneda, fecha y cuenta, con respaldo, identificación del operador, comparación, alerta y reflejo en Posición. |
| **Alta** | Préstamos permanece como próximo en la Bandeja. | Se prueba desembolso por beneficiario, pago parcial, regularización y activación al completar el total. |
| **Media** | Recibe efectivo un Supervisor además del Tesorero en la demo. | La política define quién puede asumir la custodia y en qué condiciones. El acta identifica al receptor físico y preserva la diferencia con una autorización remota. |
| **Media** | Superior y Actuar como comunican identidades distintas. | El operador puede reconocer qué usuario y rol condicionan la visibilidad, el permiso y la firma de cada acción. |
| **Media** | Carga masiva de comprobantes en CSV y posición de proveedores en pesos. | Se acuerda el formato de importación y se prueban casos válidos y rechazados. Se muestran ARS y USD por separado en deuda y cuenta corriente. |
| **Media** | Orden de pago cambia Fecha de proceso por Vencimiento y muestra un CBU completo sin banco en el caso revisado. | La grilla o el detalle conserva las fechas requeridas y la cuenta destino se identifica con banco, moneda y referencia abreviada según el diseño aprobado. |
| **Baja** | Bandeja bajo Caja y Bancos, inventario inicial de ABM con activos y suspendidos, y etiquetas largas truncadas en el menú. | Se alinea la jerarquía de navegación y el estado inicial de los ABM con el diseño acordado. Las opciones largas se pueden reconocer completas en la navegación. |

## Pruebas pendientes para conformidad

1. **Remesa a banco.** Ejecutar solicitud, autorización por otro usuario, reserva, entrega al portador, boleta y conciliación. Anotar saldos real, comprometido, estimado y a recibir en ambos extremos en cada etapa. Confirmar el momento de acreditación decidido y que la reserva se consume una sola vez.
2. **Cierre diario con medios electrónicos.** Cargar lotes de tarjetas y cobros por QR y transferencia. Reproducir una diferencia, justificar o ajustar, firmar, bloquear la fecha y comprobar el resultado en el Tablero.
3. **Desembolso parcial.** Pagar una parte a un beneficiario, dejar otro pago pendiente o rechazado, regularizarlo y comprobar estado, fecha de alta y saldos al completar el total.
4. **Actas y custodia.** Probar conformidad, disconformidad, negativa y escalamiento con identidades distintas. Comparar panel, historial y documento generado. En una sucursal unipersonal, comprobar que la segunda firma remota no registra una recepción física y que el cambio de custodio se genera al recibir el efectivo.
5. **Reapertura y ajustes.** Ejecutar ventana de ajuste, vencimiento, solicitud y autorización con llave, contramovimientos, nuevo cierre y referencia al acta anterior. Confirmar parámetros y permisos con los roles correspondientes.
6. **Roles y visibilidad.** Comparar Cajero, Supervisor de sucursal, Tesorero de sucursal, Tesorero central y Director en Libro, Posición, Tablero, cierres y Bandeja. Probar autorización por el mismo usuario con otro rol, montos límite y qué acciones se habilitan por actor.
7. **Medios de pago y reservas.** Completar una transferencia y un cheque desde la autorización hasta su ejecución o débito. Repetir con rechazo, devolución y pago parcial donde corresponda. Confirmar los efectos en la OP, reservas, deuda y saldo bancario.
8. **Proveedores y exportaciones.** Ejecutar carga manual y masiva con una fila aceptada, una rechazada y un duplicado. Autorizar con otra identidad, armar una orden, pagar y verificar cuenta corriente y deuda en ARS y USD. Abrir los Excel y PDF de actas, libro, histórico y consultas para comprobar contenido y trazabilidad.
9. **Alertas.** Probar diferencia sobre tolerancia, acta no conforme, negativa de firma, caja sin cerrar, solicitud remota, sucursal sin cierre y vencimiento de acuerdos. Revisar destinatarios y registros simulados.

## Decisiones abiertas del PDF

- **Conciliaciones y e-cheq.** El v4 deja por cerrar la modalidad de cruce de extractos y la confirmación bancaria de la numeración de e-cheq. La operatoria general de Caja y Bancos ya define el cierre de medios electrónicos y la carga diaria de saldos. PDF, puntos 7–8 y §§1.7 y 2.4.
- **Roles y cajas.** Siguen abiertos el ámbito exacto del Supervisor central, el detalle de fondo fijo, días operativos y feriados, la clasificación de caja de cajero y si el responsable de sucursal es siempre el Tesorero. La recepción física por Supervisor que permite la demo requiere una decisión explícita del producto. PDF, puntos 9–14.
- **Comprobantes y órdenes.** Quedan abiertos códigos propios de estado, detalles del ABM de proveedores, duplicidad de cuenta corriente entre consultas, fecha contable y pago parcial de una OP. La independencia entre cargador y autorizante quedó resuelta en el v4. PDF, puntos 4–6, 15–16 y 19.
- **Reservas y reaperturas.** Ingresos por recibir quedan fuera del disponible. Las prioridades entre reservas siguen abiertas. Los plazos hasta las 23:59 y de cinco días hábiles son propuestas del v4 sujetas a confirmación y parametrización. PDF, puntos 17–18.
- **Llaves y matriz.** El mecanismo definitivo del segundo factor y los topes o excepciones de la matriz siguen abiertos. El flujo de autorización con una identidad distinta y la posibilidad de segunda firma remota para sucursal unipersonal sí forman parte del v4. PDF, puntos 20–21 y §7.18.
- **Desembolsos y responsabilidad.** El v4 establece que el crédito se activa cuando se completa el pago total. La regularización de pagos a terceros remite a la Bandeja. El tratamiento económico posterior de faltantes está pendiente de definición con RR. HH. y Legales. PDF, puntos 22–23.

La decisión de conformidad depende de cerrar las diferencias que afectan el saldo disponible, el estado de firma y la custodia, y de completar las pruebas de cierre electrónico y desembolso. El diseño existente permite trabajar esos casos con Producto y Tesorería a partir de pantallas ya reconocibles.
