# CreditoNet — Módulo Onboarding

**Versión:** v4 — incorporación de detalle de pantallas 14/09/2026  
**Estado:** En diseño / consolidación funcional  
**Fuente adicional:** `Onboarding_PantallasDetalle_v1_2026-09-09.pdf` de Cristian

---

## 1. Concepto general

En CreditoNet conviene distinguir dos momentos de carga de datos:

### A. Datos mínimos iniciales

Son los datos necesarios para poder evaluar la solicitud, ejecutar las reglas aplicables, pasar el Motor de Riesgo y construir una primera oferta.

### B. Onboarding post-oferta

El documento de detalle de Cristian define **7 pantallas de carga que se activan luego de la confirmación de la oferta crediticia**. fileciteturn16file0

Por lo tanto, las 7 pantallas no deben confundirse con la carga de datos mínimos previa al Motor.

---

## 2. Flujo del módulo

Conceptualmente:

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
PLAN DE CUOTAS
  ↓
PRIMERA OFERTA
  ↓
CONFIRMACIÓN DE LA OFERTA
  ↓
ONBOARDING POST-OFERTA
  ↓
7 PANTALLAS
```

La documentación fuente no define en este archivo el orden exacto entre la confirmación de la oferta, la eventual precancelación y las siete pantallas; esa relación debe quedar pendiente de confirmación.

---

## 3. Configuración de pantallas

Las siete pantallas disponibles son:

| # | Pantalla |
|---|---|
| 1 | Datos personales |
| 2 | Datos laborales |
| 3 | Tokenización de tarjetas |
| 4 | Referencias personales |
| 5 | Garantías |
| 6 | Legajo virtual |
| 7 | Impresión de legajo |

El documento de Cristian indica que cada pantalla tiene campos con tres posibles orígenes y dos niveles de obligatoriedad. fileciteturn16file0

### Origen del dato

- **Precargado:** viene del pedido inicial o de una API pública; se muestra y puede rectificarse.
- **No modificable:** dato que disparó la oferta; no puede cambiarse en el onboarding.
- **A cargar:** dato nuevo que el vendedor debe ingresar.

### Obligatoriedad

- **Obligatorio:** debe completarse para avanzar.
- **Opcional:** no bloquea el avance.

La obligatoriedad de los campos y la habilitación de las pantallas se configuran en **Módulo Créditos por producto**, con posibles excepciones en el Organismo. fileciteturn16file0

---

# 4. Pantalla 1 — Datos personales

Reúne identificación, situación personal, domicilio y contacto.

## Datos de identificación

| Campo | Origen / comportamiento |
|---|---|
| Nombre completo | API pública / pedido inicial; rectificable si no es claro |
| DNI | Pedido inicial; rectificable |
| Fecha de nacimiento | API pública; rectificable |
| Género | API pública; rectificable |
| CUIT | API pública; rectificable |
| Situación laboral / tipo de empleo | Pedido inicial; **no modificable**, porque disparó la oferta |
| Nacionalidad | A cargar |
| Estado civil | A cargar |
| Tipo de vivienda | A cargar; desplegable desde Módulo Parámetros |
| Personas a cargo | A cargar |
| Tiene cónyuge | Sí / No |
| DNI del cónyuge | A cargar si aplica |

## Domicilio particular

- Calle
- Número
- Piso
- Departamento
- Barrio
- Entre calles
- Manzana / Bloque / Lote
- Localidad — desplegable desde Módulo Parámetros
- Provincia — desplegable desde Módulo Parámetros
- Código postal — manual / automático

## Datos de contacto

- Teléfono — característica/área: precargado, rectificable
- Teléfono — número: precargado, rectificable
- Compañía telefónica: precargada; queda pendiente ajustar su origen en la pantalla de pedido
- Teléfono alternativo — característica: opcional
- Teléfono alternativo — número: opcional
- Email: precargado, rectificable

Los campos y sus orígenes están detallados en las páginas 2 y 3 del documento fuente. fileciteturn16file0

---

# 5. Pantalla 2 — Datos laborales

Captura información del empleo actual.

La **fecha de ingreso laboral** y la **situación laboral/tipo de empleo** vienen del pedido inicial y no son modificables porque fueron utilizadas para disparar la oferta. fileciteturn16file0

## Datos del empleador

- Fecha de ingreso laboral — precargada, no modificable
- Situación laboral / tipo de empleo — precargada, no modificable
- CUIT del empleador — a cargar
- Razón social — a cargar
- Rubro de actividad laboral — a cargar
- Número de legajo — a cargar
- Cargo — a cargar
- Repartición — a cargar si aplica

## Domicilio laboral

- Calle
- Número
- Piso
- Departamento
- Barrio
- Entre calles
- Manzana / Bloque / Lote
- Localidad — desplegable desde Módulo Parámetros
- Provincia — desplegable desde Módulo Parámetros
- Código postal — manual / automático

## Teléfono laboral

- Característica/área
- Número
- Interno — si aplica
- Horario de contacto — si aplica

Detalle según página 4 del documento fuente. fileciteturn16file0

---

# 6. Pantalla 3 — Tokenización de tarjetas

Permite tokenizar una o varias tarjetas mediante integración con un proveedor tercero vía API.

La obligatoriedad se configura en Módulo Créditos por producto, con posible excepción en Organismo. Si es obligatoria, debe existir al menos una tarjeta tokenizada para avanzar. fileciteturn16file0

## Opciones

### Enviar por WhatsApp

Envía el link del formulario de tokenización al número de WhatsApp cargado por el cliente en el pedido inicial.

> Esto no significa que WhatsApp sea un módulo integrado al flujo de onboarding: según la definición funcional, se utiliza para compartir el link del formulario.

### Carga presencial

El vendedor carga los datos de la tarjeta en el momento, con la tarjeta en mano.

### Cantidad

Se pueden tokenizar una o varias tarjetas.

### Configuración

El proveedor de tokenización se define en la configuración del Producto, con excepciones posibles en el Organismo.

---

# 7. Pantalla 4 — Referencias personales

Permite cargar una o varias referencias personales.

La cantidad mínima y la obligatoriedad se configuran por Producto, con posibles excepciones en Organismo. Si es obligatoria, se requiere como mínimo una referencia para avanzar. fileciteturn16file0

## Datos

- Vínculo con el cliente — desplegable desde Módulo Parámetros
- DNI de la referencia
- Nombre completo
- Domicilio completo
- Email de contacto

Al ingresar el DNI pueden completarse automáticamente los datos mediante API, de forma equivalente al pedido inicial.

---

# 8. Pantalla 5 — Garantías

Permite cargar uno o varios garantes.

La estructura es similar a Referencias Personales. La cantidad y obligatoriedad se configuran por Producto, con excepciones en Organismo. fileciteturn16file0

## Datos

- Vínculo / relación con el cliente — desplegable desde Módulo Parámetros
- DNI del garante
- Nombre completo
- Domicilio completo
- Email de contacto

El documento indica que el garante debe firmar la documentación del préstamo y el pagaré. El circuito de firma se define en la Función 9 — Firma electrónica. fileciteturn16file0

---

# 9. Pantalla 6 — Legajo virtual

Permite cargar imágenes y documentos solicitados al cliente.

Cada botón representa un tipo de documento definido en Módulo Parámetros.

Ejemplos:

- recibo de sueldo;
- DNI frente;
- DNI dorso;
- servicio;
- otros.

La obligatoriedad y la posibilidad de cargar una o varias imágenes por concepto se configuran en Módulo Créditos por Producto, con excepciones en Organismo. fileciteturn16file0

## Configuración

### Tipo de documento

Definido desde Módulo Parámetros.

### Carga múltiple

Puede configurarse por documento:

- una imagen;
- varias imágenes.

### Obligatoriedad

Configurada por documento en Módulo Créditos.

---

# 10. Pantalla 7 — Impresión de legajo

Permite al vendedor:

- imprimir el PDF completo del legajo;
- visualizarlo directamente en pantalla.

Al presionar cualquiera de los botones, la pantalla queda marcada como completada. fileciteturn16file0

## Efecto

```text
Imprimir / Visualizar
        ↓
Pantalla completada ✓
        ↓
Queda registrada la disponibilidad del documento para el cliente
```

El legajo contiene los datos cargados en las pantallas anteriores.

---

# 11. Configuración desde Módulo Créditos

El detalle de Cristian confirma que el Módulo Créditos debe permitir parametrizar, por Producto:

- habilitación de cada pantalla;
- orden de las pantallas;
- obligatoriedad de campos;
- cantidad de referencias;
- cantidad de garantías;
- obligatoriedad de tokenización;
- proveedor de tokenización;
- tipos de documentos;
- obligatoriedad de documentos;
- carga múltiple por documento.

El Organismo puede establecer excepciones sobre estas configuraciones. fileciteturn16file0

---

# 12. Relación con Producto

Producto define la configuración general del onboarding post-oferta:

```text
PRODUCTO
   ↓
Pantallas habilitadas
   ↓
Orden
   ↓
Campos
   ↓
Obligatoriedad
   ↓
Integraciones / documentos
```

---

# 13. Relación con Organismo

El Organismo puede establecer excepciones sobre la configuración del Producto.

Ejemplos:

- agregar/quitar una pantalla;
- modificar obligatoriedad;
- modificar cantidad de referencias;
- modificar cantidad de garantes;
- excepcionar tokenización;
- modificar documentación.

---

# 14. Relación con Módulo Parámetros

El onboarding consume catálogos definidos en Parámetros, por ejemplo:

- tipo de vivienda;
- localidades;
- provincias;
- vínculos de referencias;
- vínculos de garantes;
- tipos de documentos.

---

# 15. Navegación

Volver atrás significa revisar o modificar, no reiniciar.

```text
Pantalla 1 → Pantalla 2 → Pantalla 3 → ...
                  ↑
               volver
                  ↓
             modificar
                  ↓
        continuar conservando datos
```

Los datos posteriores no deben eliminarse automáticamente al retroceder.

---

# 16. Punto importante sobre el flujo

El documento de detalle de Cristian establece explícitamente que estas **7 pantallas se activan luego de la confirmación de la oferta crediticia**. fileciteturn16file0

Por eso, el flujo principal debe diferenciar:

```text
DATOS MÍNIMOS
   ↓
MOTOR
   ↓
PLAN
   ↓
PRIMERA OFERTA
   ↓
CONFIRMACIÓN
   ↓
ONBOARDING POST-OFERTA
   ↓
7 PANTALLAS
```

El documento no determina en qué punto exacto respecto de estas siete pantallas se ubica la precancelación posterior a la primera oferta. Ese punto queda pendiente de confirmación.

---

## 17. Resumen

> **Datos mínimos iniciales** sirven para evaluar y generar la oferta.  
> **Las 7 pantallas de onboarding detallado** se activan después de la confirmación de la oferta.  
> **Producto configura** pantallas/campos/obligatoriedad.  
> **Organismo puede excepcionar.**  
> **Parámetros provee catálogos.**
