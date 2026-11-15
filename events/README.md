# Crear eventos

Los eventos se editan en archivos de texto. No necesitás tocar JavaScript.

- `rest.txt`: eventos que pueden ocurrir al dormir.
- `silver.txt`: eventos que requieren que Silver este contigo.
- `PLANTILLA.txt`: una ficha vacia para copiar y rellenar.

## Estructura

Cada evento empieza con `[EVENT]`. Despues puedes añadir uno o mas bloques `[MESSAGE]` y, si el jugador debe elegir, uno o mas bloques `[CHOICE]`.

```text
[EVENT]
name: Nombre del evento
type: question
weight: 2
requires companion: no
background: none

[MESSAGE]
Este es el primer parrafo.

Este es el segundo parrafo.

[CHOICE]
text: Primera opción
description: Explica que hara está opción.
requires item: canned_food
consume chance: 100%
trigger: none
rewards: none
result: El texto que aparece despues de elegir.
```

## Datos del evento

| Campo | Para que sirve |
| --- | --- |
| `name` | Nombre que aparece en la ventana. Obligatorio. |
| `type` | `question` para mostrar opciónes o `message` para mostrar solo Continuar. |
| `weight` | Peso relativo: 2 tiene el doble de posibilidades que 1. |
| `requires companion` | Usa `yes` para que el evento solo aparezca con Silver. |
| `background` | Ruta de una imagen para el fondo o `none`. |
| `trigger` | Efecto automático al continuar un evento sin opciónes. |
| `use item` | Objeto requerido por un evento sin opciónes, o `none`. |
| `chance consuming item` | Probabilidad de consumir ese objeto, de 0% a 100%. |
| `rewards` | Objetos que se ganan o pierden al continuar. |

## Datos de cada mensaje

Escribe el diálogo directamente debajo de `[MESSAGE]`. Puedes crear varios bloques `[MESSAGE]`; se mostraran en orden y separados por parrafos. No necesitás comillas.

## Datos de cada opción

Cada opción tiene su propio bloque `[CHOICE]`:

| Campo | Para que sirve |
| --- | --- |
| `text` | Texto del boton. |
| `description` | Explicacion corta que aparece debajo del boton. |
| `requires item` | Objeto necesario para elegir. Usa un ID como `canned_food` o `computer`, o `none`. |
| `consume chance` | Posibilidad de gastar el objeto requerido. Por ejemplo, `35%`. |
| `trigger` | Efecto que ocurre al elegir. |
| `rewards` | Objetos que se ganan o pierden. |
| `result` | Dialogo que aparece despues de elegir. |

**Importante:** `requires item` comprueba que tengas el objeto. `consume chance` decide si se gasta. Por eso no tienes que poner tambien `-1 canned_food` en rewards cuando ya usaste `requires item: canned_food` y `consume chance: 100%`.

## Triggers disponibles

- `none`: no hace nada.
- `upgrade red`: mejora la red durante los próximos 3 lanzamientos.
- `break pod`: provoca daño al casco.
- `damage pod 20`: restá 20 puntos al casco.
- `repair pod 15`: recupera 15 puntos del casco.
- `break computer`: marca la computadora como rota.
- `fix computer`: repara la computadora.

## Recompensas

- `none`: sin recompensa.
- `+2 canned_food`: ganas dos comidas.
- `-1 battery`: pierdes una batería.
- Para varias recompensas, sepáralas con punto y coma: `+1 data_core; +2 canned_food`.

IDs de objetos: `canned_food`, `pill`, `flashlight`, `computer`, `battery`, `duct_tape`, `energy_drink`, `data_core`, `star_fragment`, `medkit`.

Las líneas que empiezan con `#` son comentarios. Los nombres de los campos no distinguen mayúsculas y minusculas. Despues de editar un archivo, guarda y recarga el juego.
