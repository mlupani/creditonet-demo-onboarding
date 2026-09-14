# Revisión — Onboarding Pantallas Detalle v1 (Cristian)

**Fecha:** 14/09/2026

## Conclusión

Sí, este documento debe incorporarse a la documentación funcional. No es solamente un detalle de UI: define datos, orígenes, obligatoriedad y configuraciones que afectan directamente a Producto, Organismo, Parámetros y Onboarding.

### Hallazgo principal

El documento introduce una distinción que debemos conservar en el flujo:

- **Datos mínimos iniciales:** necesarios para evaluar el crédito.
- **7 pantallas de onboarding post-oferta:** se activan después de la confirmación de la oferta.

Esto evita mezclar la carga previa al Motor con la carga posterior a la oferta.

## Incorporaciones realizadas

### Onboarding
Se incorporaron las 7 pantallas y el detalle de campos/comportamientos:

1. Datos personales
2. Datos laborales
3. Tokenización de tarjetas
4. Referencias personales
5. Garantías
6. Legajo virtual
7. Impresión de legajo

### Producto
Se incorporó que Producto configura:
- habilitación y orden de pantallas;
- obligatoriedad;
- cantidad de referencias;
- cantidad de garantías;
- tokenización/proveedor;
- documentos;
- obligatoriedad y carga múltiple.

### Organismo
Se incorporó el alcance de las excepciones sobre esas configuraciones.

### Parámetros
Se dejó explícita la dependencia de catálogos como:
- tipo de vivienda;
- localidades;
- provincias;
- vínculos;
- tipos de documentos.

### Motor
Se aclaró que las 7 pantallas detalladas son post-oferta y no deben confundirse con los datos mínimos utilizados por el Motor.

### Plan
Se agregó la relación:

```text
Plan → Primera oferta → Confirmación → Onboarding post-oferta
```

## Punto que NO debemos inventar

El PDF no define el orden exacto entre:

- primera oferta;
- confirmación;
- precancelación;
- 7 pantallas;
- preaprobación.

Por eso ese punto queda marcado como **pendiente de confirmación**, en lugar de asumir un orden que la fuente no establece.

## Observación adicional

La pantalla de tokenización indica una opción de “Enviar por WhatsApp”. Esto debe entenderse como envío de un link del formulario al número del cliente, no como que WhatsApp sea una integración estructural del flujo de crédito.

## Archivos actualizados

- `00_Arquitectura_Flujo_CreditoNet_v3_1409.md`
- `Modulo_Onboarding_CreditoNet_v4_1409.md`
- `Modulo_Producto_CreditoNet_v5_1409.md`
- `Modulo_Organismo_CreditoNet_v3_1409.md`
- `Modulo_Motor_Riesgo_CreditoNet_v2_1409.md`
- `Modulo_Plan_Cuotas_CreditoNet_v3_1409.md`
