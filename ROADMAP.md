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
  - ✅ evidence: roadmap-skill/package.json
- [ ] `[P1]` Documentar semántica del marker `rs:kind=rollup` en `docs/` (cuándo usarlo, cómo el validator lo respeta, cómo el generator lo emite por default después de v0.12.1) <!-- rs:task=doc-rs-kind-rollup -->
  - ⚠️ attempted but validation failed: missing referenced file(s): docs/ → if this is a monorepo, add pathAliases in roadmap-skill.config.json
- [x] `[P1]` Agregar entrada al `CHANGELOG.md` para v0.12.1 con los dos cambios del refactor: generator marca descriptive tasks como rollup por default; Section 6 corta boilerplate "Document/Add test coverage" cuando no hay moduleMetadata <!-- rs:task=changelog-0-12-1 -->
  - ✅ evidence: CHANGELOG.md
- [ ] `[P1]` Wire el dogfood demo en el flujo principal: `scripts/demo/run.sh` + `scripts/demo/README.md` + pointer en root README (sección "See it in action") <!-- rs:task=wire-dogfood-demo-docs -->
  - ⚠️ no implementation evidence found yet: file reference shows implementation location, not confirmed completion → if implementation is complete, mark [x] and re-run with --evidence-only
- [ ] `[P2]` Agregar tests unitarios para los helpers `taskLineWithPriority` y `exitLine` en `roadmap-skill/src/renderer/professional.js` — hoy solo tienen coverage vía integration tests <!-- rs:task=test-taskline-helpers -->
  - ⚠️ no implementation evidence found yet: file reference shows implementation location, not confirmed completion → if implementation is complete, mark [x] and re-run with --evidence-only
- [ ] `[P2]` Agregar un ejemplo de `moduleMetadata` config a `roadmap-skill.config.json` o a docs, para que el nuevo state-line de Section 6 apunte a algo concreto ("Add \`moduleMetadata.X\` to config") <!-- rs:task=example-module-metadata-config -->
  - ⚠️ no implementation evidence found yet: file reference shows implementation location, not confirmed completion → if implementation is complete, mark [x] and re-run with --evidence-only
