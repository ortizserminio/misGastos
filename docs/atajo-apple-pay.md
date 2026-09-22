# Atajo de misGastos: importe, comercio y banco

## Qué está preparado y qué no

La integración de esta entrega usa un receptor HTTP propio. No es una acción nativa de iOS ni un archivo `.shortcut` firmado. En Atajos se configura con acciones estándar de Apple. El servidor local de desarrollo no está accesible desde el iPhone: para uso diario automático hará falta un receptor HTTPS disponible y configurado con seguridad. No se ha desplegado ni probado con pagos reales o teléfono bloqueado.

Las capturas de referencia muestran **Importe**, **Comercio** y **Tarjeta o pase**. No acreditan una propiedad bancaria separada. En misGastos `banco` puede ser texto explícito o resolverse mediante una asociación exacta `tarjeta → banco` configurada en Ajustes. Visa y Mastercard no identifican el banco.

## Variables del atajo

| Variable misGastos | Valor en Atajos | Ejemplo sintético |
|---|---|---|
| importe | Propiedad Importe de Entrada de atajo | `12,50` |
| comercio | Propiedad Comercio de Entrada de atajo | `Comercio de prueba` |
| tarjeta | Propiedad Tarjeta o pase, si expone texto utilizable | `Tarjeta de prueba` |
| banco | Texto fijo si se dedica una automatización a una tarjeta; o se omite y lo resuelve el receptor | `Banco de prueba` |
| fecha | Fecha formateada `yyyy-MM-dd` | `2026-09-22` |
| idEvento | UUID generado una sola vez para esa ejecución | UUID sin datos personales |

Antes de automatizar, revisar en el dispositivo qué representación entrega Tarjeta o pase y asociarla exactamente. Si no existe esa propiedad o llega vacía, usar una automatización por tarjeta con banco fijo. No asegurar extracción automática de banco sin esta prueba.

## Receta de configuración futura

1. En Atajos, crear automatización personal de transacción/Cartera y seleccionar la tarjeta deseada. Los nombres concretos dependen de iOS.
2. Extraer individualmente Importe y Comercio de la entrada. No enviar el objeto completo como cantidad.
3. Añadir tarjeta o banco fijo según la tabla. Crear en misGastos la asociación antes de enviar solo tarjeta.
4. Generar UUID y fecha una vez. Si se implementan reintentos, guardar ese mismo UUID y esa carga, no generar otro.
5. Usar **Obtener contenido de URL**, método **POST**, sobre `https://TU-RECEPTOR/api/shortcut`. Esta dirección es un marcador, no un servicio existente.
6. Encabezados: `Content-Type: application/json` y `Authorization: Bearer TU_TOKEN`. Guardar el token en el atajo privado, nunca en la URL ni en un atajo compartido públicamente.
7. Cuerpo JSON: campos de la tabla. Con `banco` explícito válido no se necesita la asociación de tarjeta; si se envía solo tarjeta y no existe asociación, se rechaza.
8. Mostrar éxito solo después de una respuesta satisfactoria. Si hay error, conservar datos para corregir/reintentar. No ocultar un 401, 409 o 422 bajo una notificación de éxito.
9. Configurar ejecución automática únicamente después de comprobar el flujo manual con datos sintéticos. La pantalla local no instala ni activa la automatización del iPhone.

Ejemplo sin credenciales:

```json
{
  "importe": "12,50",
  "comercio": "Comercio de prueba",
  "tarjeta": "Tarjeta de prueba",
  "banco": "Banco de prueba",
  "fecha": "2026-09-22",
  "idEvento": "a3eb0b88-1d60-4912-aa95-4169c9e6b808"
}
```

## Respuestas y duplicados

- `201`: registrado, con ID, importe en céntimos, comercio, banco y fuente `shortcut`.
- `200` con `duplicate: true`: ese evento ya existía; no crea otro gasto.
- `401`: token ausente o incorrecto.
- `409`: mismo ID de evento usado con datos distintos; revisar, no generar otro ID para ocultar el conflicto.
- `422`: dato inválido o tarjeta sin banco asociado.

La idempotencia protege reintentos del mismo evento. Dos automatizaciones independientes que generen UUID distintos para un mismo pago no se identifican automáticamente como iguales. No instalar dos automatizaciones para la misma tarjeta sin una estrategia común de identificación.

## Pruebas necesarias para declarar listo el uso diario

Primero probar receptor, banco y duplicados con el simulador local y datos sintéticos. Después elegir alojamiento HTTPS y configurar autenticación, aislamiento de datos, límites y copias. Finalmente comprobar manualmente Atajos en el iPhone: valores disponibles, red, respuesta de error, reintento y ejecución bloqueada. La última prueba depende del dispositivo y no está sustituida por pruebas de escritorio.

Referencias: [Apple: disparadores de transacciones](https://support.apple.com/en-bh/guide/shortcuts/apd65c67538a/ios), [Apple: peticiones API desde Atajos](https://support.apple.com/en-lamr/guide/shortcuts/apd58d46713f/ios), [Apple: App Intents](https://developer.apple.com/documentation/appintents).
