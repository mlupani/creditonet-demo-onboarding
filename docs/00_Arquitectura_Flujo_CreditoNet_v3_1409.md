# CreditoNet — Arquitectura y Flujo Integrado

**Versión:** v3 — incorporación de detalle de onboarding 14/09/2026  
**Estado:** Documento transversal de referencia

---

## 1. Principio rector

CreditoNet integra:

1. entrada comercial;
2. identificación y datos mínimos;
3. reglas institucionales;
4. evaluación de riesgo;
5. cálculo financiero;
6. primera oferta;
7. onboarding post-oferta;
8. preaprobación;
9. análisis final.

El detalle de Cristian introduce una distinción importante: las **7 pantallas de onboarding detalladas se activan luego de la confirmación de la oferta**. Por lo tanto, no deben confundirse con los datos mínimos iniciales utilizados para evaluar el crédito. fileciteturn16file0

---

## 2. Flujo principal corregido

```text
CANAL
  ↓
VENDEDOR AUTENTICADO (ID automático)
  ↓
NUEVA SOLICITUD
  ↓
TIPO DE PERSONA
  ↓
IDENTIFICACIÓN
  ↓
PRODUCTO + ORGANISMO
  ↓
DATOS MÍNIMOS INICIALES
  ↓
REGLAS UNIVERSALES / INSTITUCIONALES
  ↓
MOTOR DE RIESGO
  ↓
PASA / NO PASA
  ↓
LÍMITES / CONDICIONES
  ↓
PLAN DE CUOTAS
  ↓
PRIMERA OFERTA
  ↓
CONFIRMACIÓN DE OFERTA
  ↓
ONBOARDING POST-OFERTA
  ↓
7 PANTALLAS
  ↓
PREAPROBACIÓN
  ↓
BANDEJA
  ↓
ANALISTA
  ↓
APROBAR / MODIFICAR / OBSERVAR / DEVOLVER
  ↓
APROBACIÓN FINAL
  ↓
CAJA Y BANCOS
```

### Las 7 pantallas post-oferta

```text
1. Datos personales
2. Datos laborales
3. Tokenización de tarjetas
4. Referencias personales
5. Garantías
6. Legajo virtual
7. Impresión de legajo
```

La documentación fuente confirma estas siete pantallas y su activación posterior a la confirmación de la oferta. fileciteturn16file0

---

## 3. Canal

Es el primer elemento del flujo comercial.

Representa por dónde la persona busca el crédito, por ejemplo:

- sucursal;
- canal digital;
- otros canales comerciales.

El canal puede determinar qué opciones de operación están disponibles.

---

## 4. Vendedor

El vendedor ya está autenticado.

No se selecciona durante el onboarding.

```text
Usuario logueado
      ↓
ID vendedor
      ↓
Solicitud
```

El ID queda asociado a la solicitud para trazabilidad, permisos y posteriores bandejas/devoluciones.

---

## 5. Datos mínimos iniciales

Antes de ejecutar el Motor se reúnen los datos mínimos requeridos.

Estos datos no deben confundirse con las siete pantallas post-oferta.

Ejemplos:

- identidad;
- situación laboral;
- ingresos;
- sueldo bruto;
- sueldo neto;
- empleador;
- otros datos necesarios para las reglas.

---

## 6. Reglas universales / institucionales

Son reglas transversales que pueden evaluarse cuando sus variables estén disponibles.

```text
Datos iniciales
     ↓
¿La regla puede evaluarse?
     ├─ Sí → evaluar
     └─ No → esperar datos
```

Ejemplos:

- condición relacionada con edad/sexo;
- nivel de endeudamiento máximo.

Una regla institucional puede descartar una solicitud antes de continuar si ya se dispone de toda la información necesaria.

---

## 7. Motor de Riesgo

Se ejecuta después de las condiciones universales aplicables.

Resultado principal:

```text
PASA / NO PASA
```

Cada regla puede ser:

- bloqueante;
- no bloqueante.

Si una regla bloqueante no pasa, el Motor no pasa.

Si una regla no bloqueante no pasa, la solicitud puede continuar y la condición queda marcada para el análisis posterior.

---

## 8. Plan de Cuotas

Si la solicitud pasa la evaluación de riesgo, se determinan límites/condiciones y se calcula la financiación.

```text
MOTOR
  ↓
LÍMITES / CONDICIONES
  ↓
PLAN DE CUOTAS
  ↓
CÁLCULO
  ↓
PRIMERA OFERTA
```

La grilla es parte de la lógica de cálculo del Plan, no una entidad independiente.

---

## 9. Primera oferta y precancelación

La primera oferta se obtiene antes de la precancelación.

La precancelación de créditos internos o externos es opcional:

```text
PRIMERA OFERTA
      ↓
¿Desea precancelar?
      ↓
Sí
      ↓
Seleccionar créditos
      ↓
Modificar monto
      ↓
RECALCULAR
      ↓
NUEVA OFERTA
```

El detalle de onboarding de Cristian no especifica si esta opción se resuelve antes o después de la confirmación formal de la oferta ni su posición exacta respecto de las siete pantallas. **Pendiente de confirmación funcional.**

---

## 10. Onboarding post-oferta

Después de la confirmación de la oferta se activan las siete pantallas detalladas por Cristian. fileciteturn16file0

La configuración se realiza por Producto, con posibles excepciones en Organismo.

Cada campo puede ser:

- precargado;
- no modificable;
- a cargar.

Y puede ser:

- obligatorio;
- opcional.

---

## 11. Relación Producto → Organismo → Onboarding

```text
PRODUCTO
   ↓
Configuración general
   ↓
ORGANISMO
   ↓
Excepciones
   ↓
ONBOARDING APLICABLE
```

Producto configura:

- pantallas;
- orden;
- campos;
- obligatoriedad;
- integraciones;
- documentación.

Organismo puede excepcionar.

---

## 12. Onboarding post-oferta — detalle

### 1. Datos personales

Incluye identificación, domicilio y contacto.

Entre otros:

- nombre;
- DNI;
- fecha de nacimiento;
- género;
- CUIT;
- situación laboral;
- nacionalidad;
- estado civil;
- vivienda;
- personas a cargo;
- cónyuge;
- domicilio;
- teléfonos;
- email.

### 2. Datos laborales

Incluye:

- fecha de ingreso;
- situación laboral;
- CUIT empleador;
- razón social;
- rubro;
- legajo;
- cargo;
- repartición;
- domicilio laboral;
- teléfono laboral.

La fecha de ingreso y situación laboral son precargadas y no modificables porque participaron en la generación de la oferta. fileciteturn16file0

### 3. Tokenización

Puede realizarse:

- mediante link enviado por WhatsApp;
- mediante carga presencial.

Puede haber una o varias tarjetas y la obligatoriedad se configura por Producto. fileciteturn16file0

### 4. Referencias

Puede haber una o varias.

La cantidad y obligatoriedad son configurables.

### 5. Garantías

Puede haber uno o varios garantes.

La cantidad y obligatoriedad son configurables.

### 6. Legajo virtual

Carga de documentos configurados en Parámetros, con obligatoriedad y carga múltiple configurables.

### 7. Impresión de legajo

El vendedor puede imprimir o visualizar el PDF completo. Al hacerlo, la pantalla queda marcada como completada. fileciteturn16file0

---

## 13. Analista

El analista entra al final, después de la preaprobación.

Puede:

- aprobar;
- modificar;
- observar;
- revisar reglas no bloqueantes;
- devolver al vendedor.

Si corresponde modificar una oferta/producto/plan, la operación vuelve a revisión.

---

## 14. Navegación

Volver atrás significa revisar/modificar.

No significa borrar.

Los datos posteriores deben conservarse y solamente recalcular/revalidar lo que resulte afectado.

---

## 15. Responsabilidad por componente

| Componente | Responsabilidad |
|---|---|
| Canal | Punto de entrada comercial |
| Vendedor | Usuario autenticado; ID automático |
| Producto | Configuración general |
| Organismo | Particularizaciones / excepciones |
| Datos mínimos | Información inicial para evaluación |
| Reglas institucionales | Políticas transversales |
| Motor | Riesgo: pasa / no pasa |
| Plan | Cálculo financiero |
| Grilla | Mecanismo interno del Plan |
| Oferta | Primera propuesta financiera |
| Onboarding post-oferta | Completar documentación/datos posteriores |
| Bandeja | Gestión de solicitudes |
| Analista | Revisión final |
| Caja y bancos | Continuación posterior a aprobación |

---

## 16. Punto pendiente

Queda por confirmar el **orden exacto entre**:

- primera oferta;
- confirmación;
- precancelación opcional;
- siete pantallas post-oferta;
- preaprobación.

El documento de Cristian solo establece explícitamente que las siete pantallas se activan **luego de la confirmación de la oferta**. fileciteturn16file0
