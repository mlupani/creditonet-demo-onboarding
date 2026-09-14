# CreditoNet — Módulo Organismo

**Versión:** v3 — corrección de flujo 14/09/2026  
**Estado:** En diseño / consolidación funcional

---

## 1. Objetivo

El Organismo representa la entidad, convenio o colectivo al que se aplica una configuración particular de crédito.

Ejemplos:

- Policía;
- docentes;
- jubilados;
- empleados de una empresa;
- otros colectivos.

---

## 2. Relación Producto → Organismo

El Producto establece la configuración general.

El Organismo puede particularizarla mediante excepciones.

```text
PRODUCTO
   ↓
ORGANISMO
   ↓
Configuración particular aplicable
```

Esto evita duplicar productos cuando un organismo necesita pequeñas diferencias.

---

## 3. Canal y vendedor

El **Canal es el primer elemento del flujo de la solicitud** y representa dónde o por qué medio la persona busca el crédito.

El canal puede condicionar qué combinaciones de producto/organismo están disponibles.

El **vendedor no se selecciona**:

```text
Canal
      ↓
Usuario autenticado
      ↓
ID vendedor
      ↓
Solicitud
```

La solicitud conserva automáticamente el ID del vendedor logueado.

---

## 4. Excepciones

El Organismo puede particularizar configuraciones generales del Producto cuando corresponda.

Ejemplos:

- pantallas de onboarding;
- obligatoriedad de campos;
- documentación;
- firma;
- canales habilitados;
- operaciones;
- renovación;
- vencimientos;
- cancelaciones;
- legajo;
- notificaciones;
- condiciones específicas.

La granularidad exacta de cada excepción debe respetar la parametrización definida por el sistema.

---


## 4 bis. Excepciones sobre las 7 pantallas de onboarding post-oferta

El Organismo puede excepcionar la configuración general del Producto sobre las pantallas post-oferta.

Según el detalle funcional:

- habilitación de pantallas;
- obligatoriedad de campos;
- cantidad de referencias;
- cantidad de garantes;
- obligatoriedad de tokenización;
- documentación;
- obligatoriedad de documentos;
- carga múltiple por documento.

Las excepciones deben entenderse como modificaciones sobre la configuración del Producto. fileciteturn16file0

## 5. Relación con Motor de Riesgo

Puede existir más de un Motor de Riesgo.

La selección del motor se realiza considerando la configuración del crédito y las condiciones del cliente, por ejemplo:

- producto;
- organismo;
- situación laboral;
- condición de cliente;
- otras variables configuradas.

No debe interpretarse que el organismo contiene necesariamente un único motor.

---

## 6. Relación con Plan de Cuotas

Una vez que la solicitud supera la evaluación de riesgo y se determinan los límites correspondientes, entra el cálculo financiero del Plan de Cuotas.

```text
Producto + Organismo
        ↓
Datos cliente
        ↓
Reglas universales
        ↓
Motor de Riesgo
        ↓
Límites
        ↓
Plan de Cuotas
        ↓
Oferta
```

---

## 7. Precancelación

La cancelación de créditos internos o externos aparece **después de la primera oferta**.

```text
Oferta inicial
    ↓
Opción de precancelación
    ↓
Selección de créditos a cancelar
    ↓
Nuevo monto
    ↓
Recalcular
    ↓
Nueva oferta
```

No debe modelarse como un paso obligatorio previo al primer cálculo de oferta.

---

## 8. Resumen

> **Producto = configuración general.**  
> **Organismo = configuración particular / excepciones.**  
> **Canal = punto de entrada comercial.**  
> **Vendedor = usuario autenticado cuyo ID se toma automáticamente.**
