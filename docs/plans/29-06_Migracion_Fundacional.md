# Migración Fundacional — v0.10.0

**Objetivo:** Colapsar RoadmapSmith de 11 skills + 11 comandos CLI a 2 skills (`roadmap-init`, `roadmap-update`) y 2 comandos CLI (`roadmapsmith init`, `roadmapsmith update`). Clean break, sin stubs de deprecation.

---

## Fase 1 — Validator rewrite

- [x] Reescribir `src/validator/index.js` con sistema de 3 pases: path explícito → símbolos → test imports
- [x] Eliminar heurísticas en cascada (action-verb gate, `taskDescribesChange`, `evidenceLineHasPassingSummary`, etc.)
- [x] Implementar `preservedCheckedState`: path hint encontrado + task checked → pasa con confianza low
- [x] Implementar `evidenceLines` con soporte de rutas separadas por coma
- [x] Implementar `strictValidation`: en modo strict, `preservedCheckedState` no cuenta como pass
- [x] Corregir regex de pass3 (imports CommonJS + ES6)
- [x] Bajar mínimo de tokens de 4 a 3 caracteres en pass3
- [x] Corregir `validateTasks` (síncrono, maneja `blockedByIds` del parser + inline text)
- [x] Actualizar `test/validator.test.js` (49 tests verdes)
- [x] Actualizar `test/sync.test.js` (21 tests verdes)
- [x] Actualizar `test/cli.test.js` (54 tests verdes)
- [x] Corregir `bin/cli.js`: `suppliedEvidenceResolved` usaba campos que ya no existen en el nuevo validator

**Estado:** ✅ Completo — 261/261 tests pasando

---

## Fase 2 — Nuevos módulos

- [ ] Crear `src/importer.js`: parsea `TODO.md`/`ROADMAP.md`/`NOTES.md` existentes → `Task[]`
- [ ] Crear `src/drift.js`: compara `config.northStar` contra señales del repo → `{ drifted, score, summary, details }`
- [ ] Crear `src/addTask.js`: inserta task nueva en managed block con ID estable
- [ ] Crear `test/importer.test.js`
- [ ] Crear `test/drift.test.js`
- [ ] Crear `test/addTask.test.js`
- [ ] `npm test` verde

---

## Fase 3 — CLI nuevo

- [ ] Reescribir `bin/cli.js` a ~200 líneas: solo `runInit()` y `runUpdate()`
- [ ] `roadmapsmith init`: flags `--product-name`, `--primary-user`, `--problem-statement`, `--done-criterion`, `--anti-goal`, `--preferred-stack`, `--constraint`, `--import`, `--setup-only`, `--dry-run`, `--project-root`, `--editor`, `--hosts`
- [ ] `roadmapsmith update`: flags default (refresh), `--add-task`, `--task + --evidence`, `--dry-run`, `--audit`, `--check-drift`, `--project-root`, `--json`, `--strict`
- [ ] Comandos desconocidos → `--help` + exit 1
- [ ] Reescribir `test/cli.test.js` desde cero
- [ ] `npm test` verde

---

## Fase 4 — Skills nuevas

- [ ] Crear `plugins/roadmapsmith/skills/roadmap-init/SKILL.md` (greenfield + brownfield + setup-only)
- [ ] Crear `plugins/roadmapsmith/skills/roadmap-update/SKILL.md` (add-task, evidence, refresh, drift)
- [ ] Mirror en `skills/roadmap-init/` y `skills/roadmap-update/`

---

## Fase 5 — Eliminación

- [ ] Borrar 9 skills viejas en `plugins/roadmapsmith/skills/` y mirror en `skills/`
- [ ] Borrar `src/zero.js` y `src/slash.js`
- [ ] Borrar `test/zero.test.js`, `test/slash.test.js`, `test/roadmap.showcase.test.js`
- [ ] Verificar y borrar fixtures huérfanas en `test/fixtures/`
- [ ] `npm test` verde

---

## Fase 6 — Docs + release v0.10.0

- [ ] Reescribir `roadmap-skill/README.md` (2 comandos + 2 skills)
- [ ] Reescribir `README.md` raíz + tabla "Migrating from 0.9.x"
- [ ] Actualizar `CHANGELOG.md` con sección "BREAKING CHANGES v0.10.0"
- [ ] Bump `package.json` a `0.10.0`
- [ ] Auto-release publica v0.10.0
