# Crear eventos

Los eventos se editan en archivos de texto. No necesitas tocar JavaScript.

- `rest.txt`: eventos que pueden ocurrir al dormir.
- `silver.txt`: eventos que requieren que Silver esté contigo.
- `PLANTILLA.txt`: una ficha vacía para copiar y rellenar.

## Estructura de un evento

Cada evento empieza con `[EVENT]`. Después agrega uno o varios bloques `[MESSAGE]` y, si el jugador debe tomar decisiones, uno o varios bloques `[CHOICE]`.

```text
[EVENT]
name: Nombre del evento
type: question
weight: 2
requires companion: no
background: none

[MESSAGE]
Este es el primer párrafo.

Este es el segundo párrafo.

[CHOICE]
text: Primera opción
description: Explica qué hará esta opción.
requires item: canned_food
consume chance: 100%
trigger: none
rewards: none
result: El texto que aparece después de elegir.
```

## Campos del evento

| Campo | Para qué sirve |
| --- | --- |
| `name` | Nombre que aparece en la ventana. Es obligatorio. |
| `type` | Usa `question` si hay decisiones o `message` si solo se muestra Continuar. |
| `weight` | Peso relativo. Un evento con peso 2 tiene el doble de posibilidades que uno con peso 1. |
| `requires companion` | Usa `yes` para indicar que el evento necesita a Silver. |
| `background` | Ruta de una imagen de fondo, o `none`. |
| `trigger` | Efecto automático al continuar un evento sin opciones. |
| `use item` | Objeto requerido para continuar un evento sin opciones, o `none`. |
| `chance consuming item` | Probabilidad de consumir ese objeto, entre 0% y 100%. |
| `rewards` | Objetos que se ganan o pierden al continuar el evento. |

## Mensajes

Escribe el diálogo directamente debajo de `[MESSAGE]`. Puedes crear varios bloques `[MESSAGE]`; aparecerán en orden y separados por párrafos. No necesitas comillas.

## Opciones

Cada decisión usa su propio bloque `[CHOICE]`:

| Campo | Para qué sirve |
| --- | --- |
| `text` | Texto del botón. |
| `description` | Explicación corta que aparece debajo del botón. |
| `requires item` | Objeto necesario para elegir. Usa un ID como `canned_food` o `computer`, o `none`. |
| `consume chance` | Probabilidad de gastar el objeto requerido. Por ejemplo, `35%`. |
| `trigger` | Efecto que ocurre al elegir. |
| `rewards` | Objetos que se ganan o pierden. |
| `result` | Diálogo que aparece después de elegir. |

**Importante:** `requires item` comprueba que tengas el objeto. `consume chance` decide si se gasta. Por eso no debes poner también `-1 canned_food` en `rewards` cuando ya usaste `requires item: canned_food` y `consume chance: 100%`.

## Efectos disponibles

- `none`: no hace nada.
- `upgrade red`: mejora la red durante los próximos 3 lanzamientos.
- `break pod`: provoca daño al casco.
- `damage pod 20`: resta 20 puntos al casco.
- `repair pod 15`: recupera 15 puntos del casco.
- `break computer`: marca la computadora como rota.
- `fix computer`: repara la computadora.

## Recompensas

- `none`: sin recompensa.
- `+2 canned_food`: ganas dos comidas.
- `-1 battery`: pierdes una batería.
- Para varias recompensas, sepáralas con punto y coma: `+1 data_core; +2 canned_food`.

IDs de objetos: `canned_food`, `pill`, `flashlight`, `computer`, `battery`, `duct_tape`, `energy_drink`, `data_core`, `star_fragment`, `medkit`.

Las líneas que empiezan con `#` son comentarios. Los nombres de los campos no distinguen mayúsculas y minúsculas. Después de editar un archivo, guarda y recarga el juego.
