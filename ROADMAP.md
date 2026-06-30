<!-- rs:managed:start -->
# RoadmapSmith Roadmap

## 1. Product North Star

Make every software project ship with a living, evidence-backed roadmap — zero manual maintenance.

**Primary user:** Solo developers and small teams using AI coding agents (Claude Code, Codex).

**Target outcome:** One command generates a production-grade, evidence-validated `ROADMAP.md` that stays accurate as the project evolves.

## 2. Estado actual — v0.9.39

- [x] CLI con 11 comandos (init, generate, sync, validate, maintain, zero, setup, doctor, status, regenerate, update) <!-- rs:task=current-cli-11-commands -->
- [x] 11 skills instalables vía plugin <!-- rs:task=current-11-skills -->
- [x] Validator multi-pass con evidencia de código, tests y artefactos <!-- rs:task=current-validator-multipass -->
- [x] Parser con IDs estables (`rs:task=slug`) y managed block <!-- rs:task=current-parser-stable-ids -->
- [x] Renderer compact y professional (12 secciones) <!-- rs:task=current-renderer-dual-profile -->
- [x] Auto-release via GitHub Actions <!-- rs:task=current-auto-release -->
- [x] Publicado en Codex Marketplace <!-- rs:task=current-codex-marketplace -->
- [x] Integración Claude PostToolUse hook + VS Code tasks <!-- rs:task=current-host-integration -->

## 3. Migración Fundacional — v0.10.0

Ver to-do completo en [`docs/plans/29-06_Migracion_Fundacional.md`](docs/plans/29-06_Migracion_Fundacional.md).

- [x] Fase 1: Validator rewrite (3 pases, sin heurísticas) <!-- rs:task=mig-fase1-validator-rewrite -->
- [x] Fase 2: Nuevos módulos — importer, drift, addTask (ver plan doc) <!-- rs:task=mig-fase2-nuevos-modulos -->
- [x] Fase 3: CLI nuevo (solo init + update, ~250 líneas) <!-- rs:task=mig-fase3-cli-nuevo -->
- [x] Fase 4: Skills nuevas (roadmap-init, roadmap-update) <!-- rs:task=mig-fase4-skills-nuevas -->
- [x] Fase 5: Eliminación de 9 skills + comandos legacy <!-- rs:task=mig-fase5-eliminacion -->
- [x] Fase 6: Docs + release v0.10.0 <!-- rs:task=mig-fase6-release -->

<!-- rs:managed:end -->
