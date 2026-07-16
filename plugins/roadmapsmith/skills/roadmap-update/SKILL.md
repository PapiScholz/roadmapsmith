---
name: roadmap-update
description: Update ROADMAP.md truthfully based on real code. Full-scan the repo, evaluate evidence per task, propose a diff for user approval. Never flips [x] without verifiable evidence in code.
---

# roadmap-update

**Trigger (manual):** user types `/roadmap-update`, or says "actualizá el roadmap", "update the roadmap", or equivalent.

**Trigger (proactivo):** al terminar una tarea en la sesión actual que parezca coincidir con una task de ROADMAP.md, proponer el update antes de responder al user.

Este skill es hermano de `roadmap-init`. Ambos comparten las mismas invariantes al final.

## Procedimiento

### 1. Locate ROADMAP.md

Buscar en este orden:
1. `ROADMAP.md` (repo root)
2. `roadmap.md` (repo root)
3. `docs/roadmap.md`
4. `TODO.md` (último recurso)

Si ninguno existe, decirle al user: "no encuentro ROADMAP.md. Corré `/roadmap-init` primero" y parar.

### 2. Full scan del estado actual

- Read el ROADMAP.md completo. Extraer TODAS las líneas de task (`- [ ] ...` y `- [x] ...`), preservando `<!-- rs:task=... -->` markers si existen.
- Glob code files: `**/*.{js,ts,jsx,tsx,py,go,rs,rb,java,kt,swift,cs,php}` excluyendo `node_modules .git dist build .next coverage __pycache__ .venv .worktrees`.
- Read `package.json` / `pyproject.toml` / `Cargo.toml` para nombre, deps, scripts.
- `git log --oneline -20` para commits recientes.

### 3. Evaluar evidence por task (multi-signal)

Para cada task, combinar estas señales:

- **Grep**: extraer 2-3 keywords significativos del texto (nombres propios, function names, paths). Buscar en los code files.
- **File/function match**: si la task menciona un archivo o función específica (ej: `src/auth.js`, `loginUser()`), verificar que exista.
- **Session context**: si en el chat actual ya leíste/escribiste files que matchean la task, contar como señal.
- **Git log**: si un commit reciente menciona la task, weight it.

Asignar un nivel de evidence a cada task:
- **strong**: múltiples señales convergen en files específicos
- **weak**: 1 sola señal, ambigua o genérica
- **none**: cero señal en el repo
- **ambiguous**: > 5 candidatos, no confident

### 4. Manejar ambigüedad

Si una task tiene evidence `ambiguous` (>5 candidatos posibles), NO DECIDIR autónomo. En el diff proposal, listar los top 3 candidatos y preguntar al user:

"'<task text>' — ¿se refiere a alguno de estos? [1: <fileA>] [2: <fileB>] [3: <fileC>] [ninguna]"

Esperar respuesta antes de decidir el diff para esa task.

### 5. Construir el diff proposal (NO APLICAR AÚN)

Reglas de transición por task:
- `[ ]` + `strong` → propose flip a `[x]`
- `[x]` + `none` → propose flip a `[ ]` con WARNING "marcada sin evidence"
- `[ ]` + `weak` → mantener `[ ]`, notar "weak evidence, considerá agregar Evidence: line"
- `[x]` + `weak` → mantener `[x]`, notar "weak backing, agregá Evidence: line para consolidar"
- Task obsoleta (files/features que ya no existen) → propose BORRAR con confirmación explícita
- TODOs / partial features detectados en el repo que no están en el ROADMAP → propose AGREGAR nueva task

### 6. Presentar diff + esperar OK

Mostrar al user:
1. El reporte estructurado (template abajo).
2. El diff completo de cambios propuestos.
3. Pregunta explícita: "aplico estos cambios? (ok / no / detalle)".

Comportamiento por respuesta:
- `ok` → paso 7.
- `no` → descartar todo, no escribir.
- `detalle <n>` o rechazo específico → iterar el diff aplicando solo lo aceptado.

### 7. Escribir y confirmar

Aplicar los cambios aprobados a ROADMAP.md via Edit tool. Preservar formatting, indentation, y markers exactos.

Emitir el reporte final estructurado confirmando lo que se escribió.

## Invariantes (jamás violar)

- **NUNCA** flipear `[x]` sin evidence verificable (nivel `strong`).
- **NUNCA** modificar ROADMAP.md sin mostrar el diff completo y esperar OK del user.
- **NUNCA** borrar una task sin confirmación explícita del user.
- **NUNCA** inventar tasks basadas solo en el chat de la sesión. Solo agregar tasks si hay señal fuerte en el REPO (TODO comments, features parciales visibles en código).
- **NUNCA** trabajar sin haber leído el ROADMAP.md actual primero.
- Si el ROADMAP existente es "plano" (sin markers ni metadata), respetarlo. No agregar HTML comments ni metadata rica sin permiso explícito del user.
- Trabajar con TODO el ROADMAP en cada corrida (full scan). Nunca incremental sin decirle al user.

## Template del reporte estructurado

Emitir SIEMPRE al final del update, incluso cuando cero cambios. Secciones vacías se rellenan con "(ninguno)" — nunca omitir una sección.

```
═══ roadmap-update report ═══

DONE (marcadas [x] esta corrida):
  - <task text>

PENDING (siguen [ ]):
  - <task text> (weak evidence: <file>)

WARNINGS:
  - Ambigüedad no resuelta: <task text> (esperando respuesta del user)
  - Task [x] sin evidence: <task text> (sugerido revertir a [ ])
  - Task obsoleta: <task text> (propuesta borrar)

NEW (propuestas para agregar):
  - <task text> (motivo: <TODO en src/foo.js:42>)

═══ end report ═══
```
