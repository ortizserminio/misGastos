# Estándar visual: tipografía y radios

La interfaz usa Instrument Sans. Los tamaños se eligen por función, con los tokens de `apps/web/src/tokens.css`.

| Token | Móvil | Interlineado | Uso |
| --- | ---: | ---: | --- |
| `--text-caption` | 12px | 16px | Pills, navegación inferior, ejes, notas y badges |
| `--text-label` | 13px | 18px | Metadatos de listas, etiquetas y eyebrows |
| `--text-body` | 15px | 22px | Texto, filas y botones |
| `--text-input` | 16px | 22px | Inputs, selects y textareas |
| `--text-title-s` | 18px | 24px | Títulos de tarjetas y secciones |
| `--text-title-m` | 22px | 28px | Títulos de hojas, modales y bloques grandes |
| `--text-title-l` | 28px | 34px | Títulos de página |
| `--text-amount` | 26px | 32px | Importes secundarios destacados |
| `--text-display` | 40px | 44px | Importe principal de pantalla |
| `--text-hero` | 44px | 48px | Cifra editable de nuevo movimiento |

En escritorio, `--text-title-l` mide 32px, `--text-display` 48px y `--text-hero` 54px. Los demás tamaños se mantienen.

Usa peso 400 en texto, 500 en etiquetas y títulos de fila, y 600 en títulos e importes. El espaciado entre letras es `0`, salvo `-0.01em` para títulos de 22px o más e importes. Los importes usan `var(--font-num)` y cifras tabulares.

Radios: `--radius-s` (10px) para controles, `--radius-m` (14px) para tarjetas, `--radius-l` (20px) para hojas y modales, `999px` para pills y `50%` para círculos.

Comprueba las reglas con `node scripts/type-check.mjs`.
