# Diseño — Auditoría v2: flujo, bandejas y navegación persistente

Fecha: 2026-09-11
Estado: implementado
Fuente de verdad: documentación funcional del 11/09/2026 —
`00_Flujos_Integrados_CreditoNet_v1_1109`, `Modulo_Onboarding_CreditoNet_v2_1109`,
`Modulo_Motor_Riesgo_CreditoNet_v1_1109`, `06-Modulo_Plan_Cuotas_CreditoNet_v2_1109`,
`Modulo_Producto_CreditoNet_v4_1109`, `Modulo_Organismo_CreditoNet_v2_1109` y la
transcripción completa de la reunión (`Proyecto_CreditoNet_Reunion_11-09-2026`), que en varios
puntos es más precisa que los documentos derivados.
Reemplaza en lo que contradiga a `2026-09-10-onboarding-alineacion-doc-final-design.md`.

## 1. Objetivo y restricciones

Alinear la demo con el flujo definido en la reunión del 11/09. Sigue siendo una demo visual:
sin backend, sin APIs, sin persistencia real, sin motor real y sin cálculo financiero real.
La persistencia sigue siendo `sessionStorage` (clave `creditonet.demo.v8`).

Decisiones tomadas con el usuario antes de implementar:

1. **Reordenar** los pasos según el prompt de auditoría §9/§23 (el documento más reciente),
   aunque `Modulo_Onboarding §3` ponga Identificación antes de Producto.
2. Motor, límites y plan viven **dentro de un solo paso "Evaluación"** con tres bloques, y
   Oferta queda como paso siguiente. Evita un stepper de 7 pasos.
3. El motor tiene **dos resultados en este flujo**: rebota o continúa. Se pueden forzar con un
   selector de escenario para mostrar ambos caminos en vivo durante una presentación.

## 2. Navegación persistente (el problema central)

Los datos nunca se destruían: todo vive en `CreditApplication` dentro del contexto. Lo que se
rompía era la representación. `Stepper.tsx` derivaba el estado de cada paso del paso **actual**:

```ts
const done = numero < current;              // antes
const clickable = done && !!onStepClick;
```

Al volver atrás, los pasos posteriores perdían el tilde, se pintaban en gris y dejaban de ser
clickeables: el vendedor percibía que había perdido el trabajo y tenía que recorrer el flujo de
nuevo con "Continuar".

**Solución.** Se agrega `pasoMaximo` al contexto (persistido). `setPaso` sólo lo aumenta, nunca
lo reduce:

```ts
const setPaso = useCallback((n: number) => {
  setPasoState(n);
  setPasoMaximo((max) => Math.max(max, n));
}, []);
```

El stepper deriva su estado de `maxAlcanzado`, no de `current`:

```ts
const done = numero < maxAlcanzado && numero !== current;
const clickable = numero <= maxAlcanzado && !active && !!onStepClick;
```

Coincide con el ejemplo del prompt §8: el paso donde el usuario estaba parado (el máximo
alcanzado) vuelve a mostrar su número porque nunca se completó; los anteriores conservan ✓.
Además, el wizard muestra un aviso con acceso directo para volver al paso más avanzado.

**No se implementó un motor de dependencias.** Modificar un dato anterior no limpia nada; si el
dato afecta lo ya evaluado, aparece el banner "Los datos cambiaron desde la última evaluación"
con la acción de volver a ejecutar, y la decisión queda en manos del usuario.

## 3. Orden del flujo

| # | Paso | Contenido |
|---|---|---|
| 1 | Contexto | Persona física/jurídica + Producto + Organismo + plan y motor resultantes. |
| 2 | Identificación | DNI/CUIT, cliente nuevo/existente, verificación presencial. |
| 3 | Datos mínimos | Sólo lo que el motor necesita para evaluar. |
| 4 | Evaluación | Motor → Resultado + límites → Plan de cuotas. |
| 5 | Oferta | Alternativas válidas, renovaciones, terceros y preaprobación. |

Persona jurídica se puede seleccionar pero no es navegable: no hay documentación del flujo por
CUIT, así que se marca explícitamente en vez de inventarlo.

## 4. Motor de riesgo

`src/lib/motores.ts` (nuevo) define **múltiples motores** (Salud, Fuerzas de Seguridad,
Pasivos, Judicial, General), cada uno con nombre, descripción, fuentes y umbrales propios.
`seleccionarMotor(configuracion)` resuelve cuál corresponde a partir de Producto + Organismo y
devuelve además el **criterio** de la selección, que se muestra en pantalla.

Resultados: `OFERTAR | RECHAZAR`. La documentación (Motor §11) contempla además VERIFICAR y
ANALISTA, pero **en este flujo no son resultados separados**: el analista revisa siempre al
final, sobre toda solicitud que el vendedor termina de cargar, así que ambos colapsan en esa
revisión. Aclaración de la reunión del 11/09. La pantalla lo dice explícitamente en vez de
ocultarlo.

Una regla que no se cumple rebota la operación. Una regla en **advertencia no frena nada**:
queda registrada y el analista la ve en su revisión posterior (la bandeja cuenta cuántas hay).
Las reglas de edad, antigüedad, ingreso mínimo y endeudamiento se evalúan con los datos reales
del onboarding; las de fuentes externas (BCRA, mora, blacklist) son mock, y el escenario
RECHAZAR fuerza la situación BCRA a no cumplir.

## 4 bis. Correcciones de la transcripción de la reunión

Seis puntos de la implementación contradecían lo que se dijo en la reunión y se corrigieron:

1. **El motor no devuelve capital** (02:22: *"no te está diciendo monto de nada, ni capital de
   nada"*; 02:24: *"acá viene el motor y el motor no hay cálculo"*). Se eliminó el "Límite por
   riesgo" que salía del motor y `MotorRiesgo.limiteCapitalRiesgo`. Todos los cálculos arrancan
   en el Plan de Cuotas. ⚠️ `Modulo_Motor_Riesgo_v1 §15` dice lo contrario: queda por confirmar.
2. **Al vendedor se le muestran sólo las reglas rechazadas** (02:01). Al analista, todas.
3. **Condición laboral** como dato mínimo (27:08, 02:35). Junto con la situación BCRA y la del
   buró interno son los tres limitantes que habilitan la línea, y además el motor se asigna por
   condición laboral dentro del producto (02:11).
4. **Rechazo por falta de línea** (02:28, 02:57). Pasado el motor y antes de calcular se busca
   la línea; si ninguna acepta la combinación del cliente la solicitud se rechaza con origen
   `SIN_LINEA`, que no es un rechazo del motor y no llega al analista.
5. **Situación BCRA y buró interno se traen con el documento**, antes de evaluar (02:30).
6. **PREAPROBADO se dispara al finalizar la carga**, no al aceptar la oferta (13:15, 01:03:29):
   *"el pre va a disparar que se vaya [a la bandeja del analista]"*. La carga post-oferta
   transcurre En trámite. Se eliminó el estado `EN_ANALISIS`, que era redundante.

Además se agregó la acción que más tiempo ocupó en la reunión (01:14–01:35): **el analista
puede cambiar la oferta** —capital, plazo y los sueldos que el vendedor cargó mal—; la cuota se
recalcula sola, se controla que el monto a liquidar quede por encima de cero y el crédito vuelve
al canal de venta en estado Observado con el nuevo importe.

## 5. Resultado y límites

El cálculo tiene tres tramos, ninguno de los cuales sale del motor:

1. **Cuota máxima**: compiten SMVM de bolsillo, RCI y nivel de endeudamiento, y gana la **menor**
   (02:47).
2. **Límites de capital**: universal por cliente, sueldos brutos, producto, plan/organismo y el
   capital que soporta la cuota máxima. Gana el **menor** (02:46).
3. **Limitantes de la oferta**: recortes porcentuales sobre ese capital —cliente nuevo, condición
   laboral, situación BCRA—. Si aplican varios manda el **mayor recorte** (02:48–02:50).

Los tres tramos se recalculan **en vivo con la selección de cancelaciones**: no hay valores
precalculados. Ver §12. Ese capital considerado es el que
continúa hacia el Plan de Cuotas y alimenta `oferta.capitalMaximoBase`. La renovación de un
crédito propio se resuelve con un segundo cálculo (`conRenovacion`) que alimenta
`oferta.capitalMaximoRenovacion`, en lugar de la constante fija anterior.

## 6. Grilla

No es una pantalla y el vendedor no la opera. La tarjeta de la oferta que se llamaba "Grilla de
cuotas" pasó a llamarse **"Alternativas de financiación"**: son las combinaciones que quedaron
válidas después de aplicar los límites. El Plan explica que la grilla se consulta internamente.

## 7. Preaprobación y bandejas

Se agrega el estado `PREAPROBADO`: aceptar la oferta deja la operación preaprobada y el vendedor
continúa con la carga post-oferta. Al finalizar la carga pasa a `EN_ANALISIS`.

Hay un único camino hacia la bandeja del analista: la carga completa. Una operación que el motor
rechazó nunca llega. Las bandejas existentes se mantuvieron; la del analista ahora muestra el
motor ejecutado, los límites aplicados y cuántas reglas quedaron en advertencia.

## 8. Configuración

Se agregó un segundo producto (Crédito judicial) y dos organismos más (Policía de la Provincia,
Jubilados y pensionados) **con excepciones reales** sobre el producto, para que la diferencia
Producto/Organismo sea demostrable: antes todos los caminos decían "Hereda 100 % del producto".
Los planes incorporan los parámetros financieros del Plan de Cuotas §6 (gracia, IVA, sellos,
cargo de otorgamiento).

## 9. Verificación

Recorrido completo en navegador contra `next dev`: originación de punta a punta, vuelta al paso 2
desde la oferta comprobando que 3 y 4 conservan ✓, salto directo del paso 2 al 5 con los datos
intactos, los dos escenarios del motor, cambio de organismo a mitad de flujo y recorrido del
analista hasta la aprobación. `next build` y `eslint` sin errores ni warnings.

La clave de `sessionStorage` pasó a `creditonet.demo.v6` porque cambiaron la forma del resultado
del motor, la máquina de estados y la estructura de límites: una sesión vieja podría traer
valores que ya no existen.

## 10. Segunda tanda de correcciones

Cerrados después de la primera revisión:

- **Limitantes porcentuales de la oferta** con el mayor recorte (02:48–02:50). Se configuran por
  plan: cliente nuevo, condición laboral y situación BCRA distinta de 1.
- **Cuota máxima como el menor entre SMVM, RCI y endeudamiento** (02:47). Las tres se muestran
  en pantalla, con la que manda destacada.
- **Cambiar la renovación limpia el plazo elegido** y obliga a volver a seleccionarlo sobre los
  importes nuevos (43:06–45:21).
- **Anular** como acción del vendedor y del analista, y como estado propio distinto de rechazado
  (01:10, 01:19).
- **Regla MR-07 de trámite pendiente** por dos canales (01:54). El motor pasó a ocho reglas.
- **Pantalla a corregir** en la observación: el analista la elige, el vendedor la ve resaltada en
  el stepper y la carga abre directamente ahí (01:09).

## 11. Cancelaciones antes de la oferta

> *«El tipo acá, PIN para decirte: este lo quiero cancelar. Eso va a disparar que va a cambiar
> la oferta»* (43:06). *«Los dos palos se lo está dando sabiendo que este préstamo se va a
> cancelar»* (44:00).

Las dos secciones existían, pero sólo dentro de la pantalla de oferta y el capital no se
recalculaba de verdad: saltaba entre dos valores precomputados porque el plan tenía otro tope
configurado, no porque la cuota del crédito cancelado dejara de pesar.

Qué cambió:

- La decisión sube al paso de **Evaluación**, como bloque 2 («Cancelaciones y límites»), antes
  de que se arme la oferta. Las secciones de la pantalla de oferta se mantienen y operan sobre
  el mismo estado.
- `calcularLimites()` es ahora **una sola función en vivo**: filtra de las cuotas vigentes los
  créditos marcados para renovar. Se eliminaron `capitalBase`/`capitalRenovacion` como escenarios
  precalculados; `togglePrecancelar` y `setDeudaTerceros` reaplican los límites sobre el estado
  actual.
- El mock pasa de **un crédito a tres**, uno de ellos no elegible por no llegar al mínimo de
  cuotas abonadas, para que la elección tenga sentido.

La cadena causal queda visible en pantalla: liberás cuota → sube la cuota máxima → sube el
capital. Con el cliente de la demo, marcar CR-000102 libera $108.700 de cuota, las vigentes bajan
de $245.600 a $136.900, la cuota máxima sube de $379.400 a $400.000 y el capital de $2.500.000 a
$2.850.000.

La deuda con terceros se puede marcar también antes de la oferta, pero no mueve el capital: se
descuenta del monto a liquidar. Sólo aparece si el producto la habilita.

## 12. Pendientes de la reunión del 11/09

Revisados y fuera de alcance por ahora, por ser vistas nuevas:

- Log del crédito: quién lo cargó, idas y vueltas, cuántas veces volvió observado (01:19).
- Posición de cliente / cuenta corriente como vista del analista (01:38).
- Limitante por localidad: no se captura la localidad antes de la oferta.
