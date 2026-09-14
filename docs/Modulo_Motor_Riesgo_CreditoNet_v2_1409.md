# CreditoNet — Módulo Motor de Riesgo

**Versión:** v2 — corrección de flujo 14/09/2026  
**Estado:** En diseño / consolidación funcional

---

## 1. Objetivo

El Motor de Riesgo ejecuta reglas configuradas para determinar si una solicitud puede continuar hacia la evaluación de una oferta.

El resultado conceptual es:

> **PASA / NO PASA**

No genera por sí mismo la cuota ni es una entidad de grilla.

---

## 2. Múltiples motores

CreditoNet puede tener múltiples Motores de Riesgo.

Cada motor puede tener:

- nombre;
- reglas;
- configuración propia.

El motor que corresponde a una solicitud depende de la parametrización del negocio y de las condiciones de la operación.

---

## 3. Reglas del motor

Una regla evalúa variables y condiciones.

Ejemplo:

```text
SI sueldo_neto >= X
Y condición_laboral = FIJO
ENTONCES regla pasa
```

Las reglas pueden consultar información de diferentes fuentes configuradas.

---

## 4. Reglas bloqueantes y no bloqueantes

Cada regla puede configurarse como:

### Bloqueante

Si la regla no se cumple:

```text
Regla no pasa
     ↓
Bloqueante
     ↓
Motor = NO PASA
```

La solicitud no continúa hacia la evaluación de oferta.

### No bloqueante

Si la regla no se cumple:

```text
Regla no pasa
     ↓
No bloqueante
     ↓
Motor puede continuar
     ↓
La regla queda marcada
     ↓
Analista la revisa al final
```

Esto permite que una condición que no pasó no descarte automáticamente el crédito, pero quede explícitamente identificada para el análisis posterior.

---


## 4 bis. Datos utilizados por el Motor vs. onboarding post-oferta

El Motor utiliza los datos disponibles en la etapa previa a la primera oferta.

Las siete pantallas detalladas del onboarding de Cristian se activan después de la confirmación de la oferta, por lo que no deben asumirse como requisito previo para ejecutar el Motor. fileciteturn16file0

Esto permite distinguir:

```text
Datos mínimos iniciales
        ↓
Motor
        ↓
Plan
        ↓
Primera oferta
        ↓
Confirmación
        ↓
Onboarding post-oferta
```

## 5. Resultado del motor

El resultado principal es:

```text
PASA
```

o

```text
NO PASA
```

Además, el motor debe conservar el detalle de las reglas ejecutadas, especialmente las reglas no bloqueantes que no se cumplieron.

Esto permite que el analista conozca qué condiciones requieren revisión.

---

## 6. Reglas universales / institucionales

Las reglas universales o institucionales son transversales al negocio.

No deben modelarse simplemente como una única regla dentro de un motor particular.

Pueden ejecutarse en diferentes momentos según cuándo estén disponibles las variables necesarias.

### Evaluación temprana

Ejemplo:

> No otorgar créditos a personas femeninas mayores de 65 años.

Si sexo y edad ya están disponibles, la regla puede ejecutarse al principio y descartar la solicitud.

### Evaluación posterior

Ejemplo:

> No otorgar cuando el nivel de endeudamiento supera el 50%.

Si el endeudamiento solo puede determinarse después de consultar información adicional y/o construir la oferta, la regla se evalúa posteriormente.

---

## 7. Ejemplo de una regla institucional como regla de riesgo

El concepto de blacklist puede existir como **dato o condición**, pero no constituye un módulo ni una categoría especial del Motor.

Por ejemplo:

```text
SI persona_en_blacklist = true
```

La regla puede configurarse como:

- bloqueante → no pasa;
- no bloqueante → continúa, pero queda marcada para análisis del analista.

Por lo tanto, **blacklist es solo un ejemplo de una condición que una regla puede evaluar**.

No debe documentarse como una funcionalidad o entidad propia del motor.

---

## 8. Fuentes de información

Las reglas pueden utilizar variables provenientes de fuentes configuradas, por ejemplo:

- datos del cliente;
- datos de la solicitud;
- información interna;
- BCRA;
- bureaus externos;
- otras fuentes disponibles.

El catálogo definitivo de fuentes queda sujeto a la definición técnica.

---

## 9. Relación con Plan de Cuotas

El Motor siempre precede al Plan de Cuotas en el flujo de evaluación.

```text
CANAL → SOLICITUD
  ↓
DATOS
  ↓
REGLAS UNIVERSALES
  ↓
MOTOR
  ↓
PASA
  ↓
LÍMITES / CONDICIONES
  ↓
PLAN DE CUOTAS
  ↓
OFERTA
```

El Motor no calcula la cuota.

El Plan no decide si el cliente pasa el riesgo.

---

## 10. Relación con Analista

El analista entra **después de la preaprobación / primera oferta**.

Las reglas no bloqueantes que no se cumplieron deben quedar identificadas para que el analista pueda:

- observarlas;
- decidir si son finalmente aceptables;
- modificar cuando corresponda;
- aprobar;
- devolver al vendedor.

---

## 11. Reglas universales en distintos momentos

El sistema debe permitir que una regla institucional se evalúe cuando existan los datos necesarios.

Conceptualmente:

```text
Inicio
  ↓
¿Tengo los datos para evaluar la regla?
  ├─ Sí → ejecutar
  └─ No → esperar

Más adelante
  ↓
Aparecen los datos
  ↓
Ejecutar regla
```

Esto evita asumir que todas las reglas deben ejecutarse exactamente en un único momento.

---

## 12. Resumen

> **Motor = ejecución de reglas de riesgo.**  
> **Resultado principal = pasa / no pasa.**  
> **Regla bloqueante que no pasa = no pasa.**  
> **Regla no bloqueante que no pasa = continúa + marca para analista.**  
> **Reglas universales = políticas transversales evaluables en distintos momentos.**
