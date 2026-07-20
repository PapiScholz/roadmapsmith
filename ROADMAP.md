<!-- rs:managed:start -->
# RoadmapSmith Roadmap

## 1. Product North Star

Make every software project ship with a living, evidence-backed roadmap — zero manual maintenance.

**Primary user:** Solo developers and small teams using AI coding agents (Claude Code, Codex).

**Target outcome:** One command generates a production-grade, evidence-validated `ROADMAP.md` that stays accurate as the project evolves.

## 2. Estado actual — v0.9.39

- [x] CLI con 11 comandos (init, generate, sync, validate, maintain, zero, setup, doctor, status, regenerate, update) <!-- rs:task=current-cli-11-commands rs:kind=rollup -->
- [x] 11 skills instalables vía plugin <!-- rs:task=current-11-skills rs:kind=rollup -->
- [x] Validator multi-pass con evidencia de código, tests y artefactos <!-- rs:task=current-validator-multipass rs:kind=rollup -->
- [x] Parser con IDs estables (`rs:task=slug`) y managed block <!-- rs:task=current-parser-stable-ids rs:kind=rollup -->
- [x] Renderer compact y professional (12 secciones) <!-- rs:task=current-renderer-dual-profile rs:kind=rollup -->
- [x] Auto-release via GitHub Actions <!-- rs:task=current-auto-release rs:kind=rollup -->
- [x] Publicado en Codex Marketplace <!-- rs:task=current-codex-marketplace rs:kind=rollup -->
- [x] Integración Claude PostToolUse hook + VS Code tasks <!-- rs:task=current-host-integration rs:kind=rollup -->

## 3. Migración Fundacional — v0.10.0

Ver to-do completo en [`docs/plans/29-06_Migracion_Fundacional.md`](docs/plans/29-06_Migracion_Fundacional.md).

- [x] Fase 1: Validator rewrite (3 pases, sin heurísticas) <!-- rs:task=mig-fase1-validator-rewrite rs:kind=rollup -->
- [x] Fase 2: Nuevos módulos — importer, drift, addTask (ver plan doc) <!-- rs:task=mig-fase2-nuevos-modulos rs:kind=rollup -->
- [x] Fase 3: CLI nuevo (solo init + update, ~250 líneas) <!-- rs:task=mig-fase3-cli-nuevo rs:kind=rollup -->
- [x] Fase 4: Skills nuevas (roadmap-init, roadmap-update) <!-- rs:task=mig-fase4-skills-nuevas rs:kind=rollup -->
- [x] Fase 5: Eliminación de 9 skills + comandos legacy <!-- rs:task=mig-fase5-eliminacion rs:kind=rollup -->
- [x] Fase 6: Docs + release v0.10.0 <!-- rs:task=mig-fase6-release rs:kind=rollup -->

<!-- rs:managed:end -->

## 4. Pending Work

Trabajo pendiente real fuera del managed block. `generate` no toca esta sección.

- [x] `[P0]` Release v0.12.1: bump `roadmap-skill/package.json`, add CHANGELOG entry cubriendo rs:kind=rollup en generator + Section 6 boilerplate cut, tag y publish npm <!-- rs:task=release-0-12-1 -->
  - ✅ evidence: legacy/roadmap-skill/package.json (moved en pivote v1.0.0)
- [x] `[P1]` Agregar entrada al `CHANGELOG.md` para v0.12.1 con los dos cambios del refactor: generator marca descriptive tasks como rollup por default; Section 6 corta boilerplate "Document/Add test coverage" cuando no hay moduleMetadata <!-- rs:task=changelog-0-12-1 -->
  - ✅ evidence: CHANGELOG.md
- [ ] `[P2]` Enforcement mecánico del proactive trigger de `/roadmap-update` (experimental): PostToolUse hook que después de N Edit/Write operations en una sesión sugiere correr el skill. Hoy el trigger depende de que el agente se acuerde y en la práctica se cae. Pending real-world validation antes de shipear. <!-- rs:task=proactive-trigger-hook -->
  - ⚠️ no implementation evidence yet — deferred desde v1.1 autofeedback (Q3)

## 5. Deferred Backlog

Ítems conscientemente NO shippeados. Movidos acá desde autofeedback runs para no perder trazabilidad. Se levantan solo si aparece un user real que los pida.

- [ ] `[P3]` **Fix classifier legacy** — agregar type `claude-skill-plugin` + config override `projectType` en `legacy/roadmap-skill/src/classifier/index.js`. Descartado en v1.3 porque la CLI legacy está deprecada (`install.js:25` redirige a `roadmapsmith@0.14`) y arreglarla es re-invertir en path muerto. Levantar si un user reporta uso activo. <!-- rs:task=legacy-classifier-skill-type -->
- [ ] `[P3]` **Renderer legacy: Risks/Anti-Goals como statements en lugar de checkboxes** — en `legacy/roadmap-skill/src/renderer/professional.js:273–293` los renderiza como `- [ ] [P0] ${risk}` cuando semánticamente no son tasks completables. Mismo argumento del ítem anterior (legacy deprecated). <!-- rs:task=legacy-renderer-risks-statements -->
- [ ] `[P3]` **Renderer legacy: de-duplicar managed block con secciones human-authored** — cuando el user ya escribió Anti-Goals/Risks/Assumptions/Exit Criteria en la parte de arriba del ROADMAP, el generator repite versiones genéricas sin agregar contexto. Requiere que el generator LEA la parte human-authored antes de renderizar el managed block. Deferred con el resto del legacy. <!-- rs:task=legacy-renderer-dedup-human-sections -->
- [ ] `[P3]` **Generator legacy: leer git tags para auto-flip de milestones** — hoy `DEFAULT_CONFIG.milestones` (v0.1/v0.2/v0.3/v1.0) aparece `[ ]` por diseño; con `git tag --list` matching v0.1.0..v1.0.0 se podrían auto-flippear. Deferred porque el generator no se shippa en v1.0+. <!-- rs:task=legacy-generator-git-tag-milestones -->
