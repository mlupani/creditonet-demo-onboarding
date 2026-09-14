# CreditoNet — Módulo Plan de Cuotas

**Versión:** v3 — corrección de flujo 14/09/2026  
**Estado:** En diseño / consolidación funcional

---

## 1. Objetivo

El Plan de Cuotas concentra la configuración y cálculo financiero de una financiación que ya superó la evaluación de riesgo correspondiente.

El Plan no reemplaza al Motor de Riesgo.

---

## 2. Orden dentro del flujo

El orden conceptual es:

```text
Canal
  ↓
Vendedor autenticado
  ↓
Solicitud
  ↓
Datos mínimos
  ↓
Reglas universales
  ↓
Motor de Riesgo
  ↓
PASA
  ↓
Límites / condiciones
  ↓
PLAN DE CUOTAS
  ↓
Cálculo financiero
  ↓
OFERTA
```

> **Motor de Riesgo primero. Plan de Cuotas después.**

---

## 3. La grilla NO es una entidad independiente

La **grilla forma parte de la manera en que se calcula el Plan de Cuotas**.

No debe modelarse como:

```text
Plan → Grilla → Oferta
```

como si la grilla fuera un módulo o entidad funcional independiente.

La representación correcta es:

```text
Plan de Cuotas
   ↓
Lógica / parámetros de cálculo
   ↓
Grilla de financiación
   ↓
Alternativas válidas
   ↓
Oferta
```

La grilla contiene o representa combinaciones de capital, plazo, tasa y demás parámetros necesarios para encontrar una financiación válida.

---

## 4. Datos recibidos del flujo de riesgo

Antes del Plan pueden existir límites y condiciones provenientes de:

- Motor de Riesgo;
- reglas universales;
- Producto;
- Organismo;
- situación laboral;
- ingresos;
- endeudamiento;
- otras condiciones.

El Plan utiliza esos límites como restricciones para el cálculo.

---

## 5. Parámetros financieros

Entre los parámetros contemplados:

- sistema de amortización;
- tasa;
- cantidad de cuotas;
- plazo;
- vencimientos;
- período de gracia;
- IVA;
- sellos;
- gastos de otorgamiento;
- otros cargos.

Las fórmulas exactas deben respetar la definición financiera vigente.

---

## 6. Capital máximo y cuota máxima

Antes de construir la oferta pueden existir restricciones sobre:

- capital máximo;
- cuota máxima;
- salario;
- RCI;
- nivel de endeudamiento;
- situación laboral;
- otras condiciones.

El Plan debe buscar alternativas que respeten esos límites.

Ejemplo:

```text
Capital máximo permitido = $3.000.000
Cuota máxima = $350.000
```

El cálculo debe encontrar alternativas financieras que no excedan ninguno de los dos valores.

---

## 7. Cálculo mediante la grilla

La grilla es parte de la lógica del Plan.

Conceptualmente:

```text
Límites recibidos
      ↓
Parámetros del Plan
      ↓
Grilla de financiación
      ↓
Evaluar combinaciones
      ↓
Descartar las que exceden límites
      ↓
Alternativas válidas
      ↓
Oferta
```

No existe una pantalla independiente de “Grilla” para el vendedor.

---

## 8. Primera oferta

El sistema genera una primera oferta a partir de las condiciones disponibles.

Una vez obtenida esta oferta pueden aparecer operaciones opcionales.

Una de ellas es la **precancelación de créditos internos o externos**.

---

## 9. Precancelación después de la primera oferta

La precancelación no debe ejecutarse como paso obligatorio antes de la primera oferta.

El flujo es:

```text
Cálculo inicial
      ↓
PRIMERA OFERTA
      ↓
Opción de cancelar créditos
      ↓
Cliente selecciona créditos internos / externos
      ↓
Se modifica el monto
      ↓
RECALCULAR
      ↓
NUEVA OFERTA
```

La nueva oferta debe respetar nuevamente todas las condiciones y límites aplicables.

---


## 9 bis. Relación con onboarding post-oferta

El detalle funcional de Cristian establece que las siete pantallas de onboarding se activan después de la **confirmación de la oferta crediticia**. fileciteturn16file0

Por lo tanto:

```text
Plan de Cuotas
      ↓
Primera oferta
      ↓
Confirmación de oferta
      ↓
Onboarding post-oferta
```

La documentación de las siete pantallas pertenece al Módulo Onboarding, no al cálculo financiero del Plan.

El orden exacto entre confirmación, precancelación y las siete pantallas queda pendiente de confirmación.

## 10. Recalculación

La modificación de datos relevantes para la financiación debe permitir recalcular.

Por ejemplo:

```text
Oferta inicial
   ↓
Precancelación
   ↓
Nuevo monto
   ↓
Recalcular Plan
   ↓
Nueva alternativa financiera
```

El detalle de qué cambios requieren solamente recalcular el Plan y cuáles requieren volver a ejecutar reglas de riesgo debe definirse técnicamente según el impacto de cada variable.

---

## 11. Qué hace el Plan

El Plan:

- configura condiciones financieras;
- calcula cuotas;
- trabaja con capital, plazo y tasa;
- utiliza límites de riesgo como restricciones;
- utiliza la grilla como parte de su mecanismo de cálculo;
- genera alternativas financieras válidas;
- permite recalcular la oferta cuando corresponda.

---

## 12. Qué NO hace el Plan

El Plan:

- no ejecuta reglas de riesgo;
- no decide si el cliente pasa o no pasa el Motor;
- no es una entidad “grilla” independiente;
- no reemplaza las reglas institucionales;
- no aprueba definitivamente el crédito.

---

## 13. Relación con Analista

El analista aparece después de que existe una oferta/preaprobación.

```text
Plan
 ↓
Oferta
 ↓
Preaprobación
 ↓
Bandeja de análisis
 ↓
Analista
```

El analista puede revisar la operación, incluidas las condiciones y marcas generadas por reglas no bloqueantes.

---

## 14. Resumen

> **Motor = determina si la solicitud puede continuar.**  
> **Plan = calcula cómo financiarla.**  
> **Grilla = mecanismo interno del cálculo del Plan, no entidad extra.**  
> **Precancelación = opción posterior a la primera oferta que puede modificar el monto y disparar un recálculo.**
