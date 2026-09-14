# CreditoNet — Módulo Producto

**Versión:** v5 — corrección de flujo 14/09/2026  
**Estado:** En diseño / consolidación funcional  
**Base:** documentación funcional previa + correcciones consolidadas del flujo.

---

## 1. Objetivo

El Producto representa la configuración general de una línea de crédito dentro de CreditoNet.

El Producto define **premisas y condiciones generales** que utilizarán los demás componentes del flujo. No realiza por sí mismo el cálculo financiero ni ejecuta el análisis de riesgo.

---

## 2. Principio general

> **PRODUCTO = configuración general del crédito.**  
> **ORGANISMO = particularizaciones / excepciones de esa configuración.**

El Producto puede habilitar determinadas configuraciones de onboarding, operaciones, canales, firma, documentación, renovación y demás condiciones generales.

---

## 3. Relación con Canal

El **Canal** es el punto de entrada comercial de la solicitud y, conceptualmente, el primer elemento del flujo.

Representa el medio o lugar a través del cual la persona busca obtener el crédito.

Ejemplos conceptuales:

- sucursal;
- canal digital;
- otro canal comercial habilitado.

El canal se determina **al principio del flujo**, antes de la carga de la solicitud.

El canal puede ser relevante para determinar qué productos, organismos o configuraciones están disponibles.

> **Importante:** el canal no es el vendedor.

---

## 4. Relación con Vendedor

El vendedor **no se selecciona durante el onboarding**.

El vendedor ya se encuentra autenticado en CreditoNet y el sistema obtiene su identidad a partir de la sesión:

```text
Canal
      ↓
Vendedor logueado
      ↓
ID del vendedor
      ↓
Solicitud
```

Por lo tanto, el ID del vendedor debe quedar asociado automáticamente a la solicitud.

El sistema puede utilizar posteriormente ese ID para:

- trazabilidad;
- bandejas;
- permisos;
- seguimiento de solicitudes;
- devolución de solicitudes por parte del analista.

---

## 5. Relación con Organismo

Un Producto puede estar disponible para uno o varios organismos.

El Organismo permite particularizar la configuración general del Producto mediante excepciones cuando corresponda.

Conceptualmente:

```text
PRODUCTO
   ↓
ORGANISMO
   ↓
Configuración aplicable
```

---

## 6. Relación con Motores de Riesgo

Dentro del Módulo Créditos pueden existir múltiples Motores de Riesgo.

Cada motor tiene:

- nombre;
- reglas;
- configuración propia.

La selección del motor que corresponde ejecutar depende de la configuración del crédito y de las condiciones del cliente.

No existe un único motor global obligatorio.

La relación exacta Producto + Organismo + condiciones del cliente determina qué motor corresponde, según la parametrización vigente.

---

## 7. Configuración de Onboarding

El Producto puede definir premisas generales para el onboarding:

- pantallas;
- orden;
- campos;
- obligatoriedad;
- documentos;
- referencias;
- tarjetas;
- requerimientos adicionales.

El Organismo puede establecer excepciones.

---


## 7 bis. Configuración detallada del onboarding post-oferta

El detalle de pantallas de Cristian confirma que el Producto debe poder configurar por pantalla:

- habilitación;
- orden;
- campos;
- obligatoriedad;
- cantidad de referencias;
- cantidad de garantías;
- obligatoriedad de tokenización;
- proveedor de tokenización;
- tipos de documentos;
- obligatoriedad de documentos;
- carga múltiple por documento.

Las siete pantallas se activan después de la confirmación de la oferta. fileciteturn16file0

Las pantallas son:

1. Datos personales
2. Datos laborales
3. Tokenización de tarjetas
4. Referencias personales
5. Garantías
6. Legajo virtual
7. Impresión de legajo

### Datos personales

El Producto debe contemplar la configuración de los campos que sean obligatorios u opcionales, sin alterar el origen funcional definido para los datos.

### Tokenización

La configuración contempla la obligatoriedad y el proveedor tercero de tokenización.

### Referencias y garantías

La configuración contempla cantidad y obligatoriedad.

### Legajo virtual

La configuración contempla obligatoriedad por documento y si cada concepto admite una o varias imágenes.

## 8. Operaciones configurables

El Producto puede establecer condiciones generales para:

- créditos paralelos;
- renovación;
- cambio del primer vencimiento;
- cancelación de deudas de terceros;
- cancelación anticipada;
- cargos y bonificaciones.

### Precancelación de créditos

La precancelación de créditos **internos o externos no se realiza antes de obtener la primera oferta**.

El flujo es:

```text
Primera oferta
      ↓
Se informa la posibilidad de precancelar
      ↓
Cliente decide si quiere cancelar créditos
      ↓
Se incorporan las cancelaciones
      ↓
Se modifica el monto disponible / solicitado
      ↓
Se recalcula
      ↓
Nueva oferta
```

---

## 9. Firma y documentación

El Producto puede definir si requiere firma electrónica y qué documentación forma parte de la operación.

Estas configuraciones se utilizan en etapas posteriores del flujo.

---

## 10. Qué NO hace el Producto

El Producto:

- no ejecuta reglas de riesgo;
- no determina si el cliente pasa el motor;
- no calcula la cuota;
- no es la grilla;
- no genera por sí solo la oferta final;
- no determina al analista.

---

## 11. Resumen

```text
CANAL
  ↓
VENDEDOR AUTENTICADO (ID automático)
  ↓
PRODUCTO
  ↓
ORGANISMO
  ↓
DATOS DEL CLIENTE
  ↓
REGLAS UNIVERSALES / INSTITUCIONALES
  ↓
MOTOR DE RIESGO
  ↓
PLAN DE CUOTAS
  ↓
OFERTA
```

El canal es el inicio comercial. El vendedor se obtiene automáticamente de la sesión autenticada.
