# Presupuestos reales — diseño

La pantalla de Presupuestos muestra un plan mensual separado de los movimientos reales. Incluye ingresos previstos (total manual o partidas, con opción recurrente), gasto previsto, fijos mensualizados, ahorro para objetivos, gasto real por categoría y saldo disponible. El mes siguiente muestra una copia virtual del último plan anterior y la guarda solo cuando se edita; un mes ya configurado nunca se sobrescribe.

Los recurrentes guardan importe, frecuencia, próxima fecha, categoría, destino (gasto o inversión) y estado. Las pausas y cancelaciones modifican la previsión, pero no generan ni borran movimientos reales. Las deudas registran dirección, importe pendiente, persona o entidad, vencimiento opcional y pagos manuales; no se confunden con gastos reales.

Los objetivos de ahorro guardan nombre, meta, saldo actual, fecha objetivo y cuota mensual calculada según los meses restantes. El ahorro del plan suma cuotas y una cantidad sin objetivo. Es una asignación prevista, no un movimiento ni un saldo bancario. El histórico compara objetivo previsto con ahorro real introducido manualmente, diferenciando ambos valores.

El gasto real procede únicamente de movimientos de tipo expense del mes. Las categorías usan las categorías editables del usuario. Las comparaciones y barras distinguen gastado, disponible y ahorro; si falta un ingreso o el plan es deficitario se muestra claramente, sin afirmar que el dinero está en una cuenta.

Los datos se añaden al documento local versionado que ya sincroniza Supabase. La migración conserva presupuestos y movimientos anteriores. Las copias se validan y restauran completas. No se crean tablas ni servicios de pago. Formularios y estados vacíos siguen la referencia visual móvil; las capturas son guía, no fuente de datos personales.

Verificación: pruebas de migración, cálculos de mensualización/cuotas y persistencia; test y build web; recorrido sintético en navegador; revisión independiente documentada.

La entrada a Presupuestos permanece en la pantalla principal de Gastos, siguiendo la estética y los componentes actuales de misGastos. El acceso a Recurrentes, Deudas y Objetivos se hace desde Presupuestos.


Aclaración de la usuaria 2026-10-01: las cuatro tarjetas del plan del mes se muestran en móvil como una matriz de dos columnas por dos filas, no apiladas en una sola columna.
