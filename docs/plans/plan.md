# Plan — Fix 5 adoption blockers surfaced by 2026-07-15 audit

## Context

Post-session audit concluded that RoadmapSmith has real value **only in the "small dev + AI agents" segment**, but the current UX pushes churn on:

1. README doesn't segment audience → wrong installers churn in 3 days.
2. No "when NOT to use" section → same problem, other end.
3. Zero end-to-end smoke test in CI → every first-hour UX bug ships to users.
4. `NAMESPACE_STRUCTURAL_PATTERNS` hardcoded to maintainer's own project namespaces (`evh2`, `uxf`, `cls`, …) → false positives for everyone else.
5. Markup (`<!-- rs:task=slug rs:kind=… rs:verified-by=… -->`) is noisy in a file that has to stay legible as markdown.

Each recommendation below is a **separate, ship-independently unit**. Order recommends 1 → 2 → 3 → 4 → 5 by risk (docs first, code changes last).

---

## Rec 1 — Honest audience segmentation in README

### Problem
Current `README.md:5-8` opens with *"Evidence-backed roadmap workflows for AI coding agents"*. Buried lede: the "AI agents" part is the **only** justification. Someone doing solo dev without agents reads this and installs, then bounces.

### Change
Edit `C:/Users/ezesc/Github/roadmapsmith/README.md`, replace the current opening paragraph (lines 5-8) with:

```markdown
<h1 align="center">RoadmapSmith</h1>

**Who this is for:** solo devs and small teams that run AI coding agents (Claude Code, Codex) at least a few hours a week and want an **auditable trail** of what the agent claims it shipped vs what actually landed in the code.

**Who this is NOT for:** (see [When NOT to use](#when-not-to-use) below).

Two commands — `init` and `update` — turn `ROADMAP.md` into a validated, evidence-backed source of truth that survives an agent saying "done!" when nothing is done.
```

### Trade-off
Narrows the perceived audience → fewer installs, higher retention. Explicit intent.

### Verification
- `README.md` renders cleanly on GitHub (visual check).
- The demo GIF section (line 9-23) stays untouched — it's the strongest evidence for the pitch.

---

## Rec 2 — "When NOT to use" section

### Problem
No documented anti-pattern → users with Jira/Linear install thinking it complements, then discover overlap and remove. Also: solo devs on side projects don't need any of this.

### Change
Insert a new section after the "Install" block (`README.md:25-39`, before "Quick Start"):

```markdown
## When NOT to use

RoadmapSmith is opinionated tooling. It's the wrong fit if:

- **You already have Jira / Linear / Asana as source of truth.** Adding a third tracker creates drift, not clarity. Stay with what your team already trusts.
- **You don't use AI coding agents.** The killer feature is "agent claims done → validator disagrees against real files". Without an agent, a plain `TODO.md` covers 95% of the value with 5% of the overhead.
- **Your repo is >2 languages or a large monorepo.** The evidence scanner is optimized for single-primary-language repos; monorepo support is best-effort (see `pathAliases` in config).
- **You need multi-user assignment, sprints, or estimation.** RoadmapSmith is a *validation* tool, not a project-management tool. It has no concept of "assignee" or "story points".

If any of the above applies, close this tab. If none apply and you run agents daily, keep reading.
```

### Trade-off
Reads as counterintuitive marketing. Real effect: it filters. Every installer that survives this section is a much higher-quality lead.

### Verification
- Section renders on GitHub.
- Add the same block, condensed to 3 bullets, to `roadmap-skill/README.md` (npm-facing surface).

---

## Rec 3 — End-to-end smoke test in CI

### Problem
Current CI (`.github/workflows/ci.yml`) runs unit tests + pack-artifact verify + `cli.js --version`. Zero coverage of the actual user journey. Every UX bug fixed in v0.13.4–v0.13.10 (config not found, `--json` without `--audit`, ROADMAP-missing silent-write) was a **first-hour user bug** that no unit test caught.

### Change

**Step 1 — new test script** at `roadmap-skill/scripts/e2e-smoke.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"
git init -q
echo "console.log('hi');" > app.js
git add . && git commit -q -m "initial"

CLI="node $GITHUB_WORKSPACE/roadmap-skill/bin/cli.js"

echo "▶ init"
$CLI init --product-name "Test" --primary-user "dev" --project-root .
test -f ROADMAP.md || { echo "FAIL: ROADMAP.md not created"; exit 1; }
test -f AGENTS.md || { echo "FAIL: AGENTS.md not created"; exit 1; }

echo "▶ add-task"
$CLI update --add-task "Ship login flow" --project-root . --json > out.json
grep -q '"action": "add-task"' out.json || { echo "FAIL: add-task JSON contract"; exit 1; }

TASK_ID=$($CLI update --json --project-root . 2>/dev/null | node -e "process.stdin.on('data',b=>{const j=JSON.parse(b);console.log(j.tasks?.[0]?.id||'')}")
test -n "$TASK_ID" || { echo "FAIL: could not extract task ID"; exit 1; }

echo "▶ attest evidence"
$CLI update --task "$TASK_ID" --evidence "app.js" --project-root . --json > out.json
grep -q '"action":' out.json || { echo "FAIL: evidence JSON contract"; exit 1; }

echo "▶ audit"
$CLI update --audit --project-root . --json > out.json
grep -q '"audit"' out.json || { echo "FAIL: audit JSON payload missing"; exit 1; }

echo "▶ all E2E steps green"
```

**Step 2 — wire into `.github/workflows/ci.yml`** as a new step in the `test` job, after "CLI --version smoke test" (line 75-76):

```yaml
      - name: End-to-end smoke test
        run: bash scripts/e2e-smoke.sh
        env:
          GITHUB_WORKSPACE: ${{ github.workspace }}
```

**Step 3 — local script** in `roadmap-skill/package.json` scripts:

```json
"test:e2e": "bash scripts/e2e-smoke.sh"
```

### Trade-off
- Adds ~10s to CI. Trivial.
- Uses `bash` — won't run on Windows CI natively. **Ceiling**: if we ever add a Windows CI matrix, port to Node (rewrite as `scripts/e2e-smoke.js`).
- Only covers the golden path. **That's intentional** — it's a smoke test, not exhaustive. Extend when a new UX bug is found in the wild.

### Verification
- Run `bash roadmap-skill/scripts/e2e-smoke.sh` locally, expect all steps green.
- Push to a branch, verify CI runs and passes.
- Regression check: reintroduce the v0.13.8 bug (missing ROADMAP.md guard) temporarily and confirm the script fails loud.

---

## Rec 4 — De-hardcode namespace structural patterns

### Problem
`src/validator/index.js:74-82` hardcodes 7 namespace prefixes (`cls`, `dsg`, `evh2`, `cst`, `uxf`, `cfgo`, `doc3`) mapped to filesystem predicates specific to *this* repo's directory layout. For any other user, these predicates:

- Silently do nothing (their task IDs won't hit these prefixes) — best case.
- Trigger false positives if a user coincidentally uses `cls-` prefix — worst case.

Either way, the maintainer's own naming convention is petrified in shipped code.

### Change

**Step 1 — move the map to config.** Add a new optional field to `roadmap-skill.config.json` schema:

```json
{
  "namespacePatterns": {
    "cls":  "classif(?:ier|y)|archetype",
    "uxf":  "renderer",
    "evh2": "validator"
  }
}
```

Each entry: `<prefix>: <regex string>`. The regex is compiled once at load time and applied against normalized file paths (same as today).

**Step 2 — edit `src/validator/index.js`:**

- Remove the hardcoded `NAMESPACE_STRUCTURAL_PATTERNS` object (lines 74-82).
- Add a builder that reads `config.namespacePatterns` (if present) and produces the predicate map at validator initialization. Empty/missing config → empty map (no namespace gate).
- Keep the `namespace-gate` cause code in the audit output — just skip the check when no patterns are configured.

**Step 3 — self-host** by copying the current 7 hardcoded entries into this repo's own `roadmap-skill.config.json`. Zero behavior change for this repo; every other user starts with a clean slate.

**Step 4 — docs.** Add a subsection to `docs/audit-remediation.md` (or wherever `--audit` semantics live) explaining when to define `namespacePatterns` and when to leave it empty. Default recommendation for new users: **leave empty**.

### Trade-off
- **Breaking change** in behavior for any repo that inherited the maintainer's naming convention. Ship in a **minor version bump** (v0.14.0), not a patch. Add a CHANGELOG note explicitly listing the removed prefixes.
- The regex-as-string surface is a small footgun (invalid regex → runtime throw). Mitigate: validate + `try/catch` at config load, fail loud with a pointer to the bad entry.

### Verification
- All existing tests still pass after moving patterns to this repo's config.
- New unit test: validator with empty `namespacePatterns` config skips the gate entirely on a task ID with prefix `cls-*` (used to hit the hardcoded pattern; now shouldn't).
- New unit test: invalid regex string in config throws at load time with actionable error.

---

## Rec 5 — Explore reducing markup weight

### Problem
Current markup shape:

```markdown
- [ ] Ship login flow <!-- rs:task=ship-login-flow rs:kind=command rs:verified-by=tsc-noemit -->
```

Every markdown-authoring surface (issues, PRs, GitHub file view, VS Code preview) shows the HTML comment inline. For 30+ tasks this becomes visual clutter that erodes the "just a markdown file" promise.

### Change — explore, don't ship blind

This one is **not a straight patch**. It's a spike + decision.

**Phase A — investigate (1 dev-day):**

Enumerate the three feasible shapes:

| Shape | Storage | Pros | Cons |
|---|---|---|---|
| A. **Status quo** — inline HTML comment | in-line per task | Explicit, roundtrip-trivial | Visually noisy |
| B. **Single trailing comment** — `<!-- rs:task=ship-login -->` and lift `rs:kind` / `rs:verified-by` to a separate `## rs:metadata` block at end of file | Split: ID inline, attrs in table | Task lines clean | Two-hop lookup; harder to hand-edit |
| C. **Zero markup** — derive stable ID from `sha256(indent + text)[:8]` + line position, store attrs in `.roadmapsmith/tasks.json` sidecar | Fully external | Perfectly clean markdown | Loses "single-file self-contained" promise; ID drifts when text is edited |

**Phase B — write a fixture** representative of a real 30-task ROADMAP.md in each shape. Show to 3 dev users. Ask: "which do you want to hand-edit?" Score.

**Phase C — decide:**

- If A wins: **do nothing**, close the recommendation with a decision log.
- If B wins: implement in v0.15.0. Migration: `roadmapsmith migrate-markup --to=split` command that rewrites existing files.
- If C wins: implement in v0.15.0. Migration: `roadmapsmith migrate-markup --to=sidecar` command.

### Trade-off / ceiling
- **This is the highest-risk recommendation.** The current markup shape is the roundtrip contract that every user has hardcoded expectations for. Changing it wrong invalidates existing ROADMAP.md files across every installation.
- **Do not ship without at least 3 external user opinions.** The maintainer's ergonomic intuition is worth 1 vote out of N, not the deciding vote.
- If no external users are available: **default to A (status quo)** and close the recommendation. Don't gamble on shape alone.

### Verification
- The decision log lands in `docs/plans/markup-shape-decision.md` regardless of outcome.
- If B or C ships: golden-master test comparing parse output before/after migration on 5 representative real-world ROADMAP.md files.

---

## Phase 1 release strategy

- **Rec 1, 2** → ship together in a docs-only patch (v0.13.11 or v0.14.0-doc).
- **Rec 3** → ship in the same patch or the next one. Zero user-facing behavior change.
- **Rec 4** → **v0.14.0 minor bump** with an explicit CHANGELOG "Breaking" section. Migration guide: "If your task IDs used `cls-`, `dsg-`, `evh2-`, `cst-`, `uxf-`, `cfgo-`, or `doc3-` prefixes and you relied on the namespace gate, add `namespacePatterns` to your config."
- **Rec 5** → spike first, decision doc first, code later (or never).

---

## Phase 2 — Adoption work (NOT covered by Recs 1-5)

Ejecutar Recs 1-5 deja el producto **listo para recibir usuarios externos**. No los trae. Este plan explícitamente NO cubre distribución, onboarding activo, signal social, ni integración deep con el agente. Los 4 items abajo son la fase siguiente — **no arrancar hasta que Phase 1 esté cerrado**. Traer tráfico a un producto con fricción quema reputación de forma irrecuperable: cada usuario que rebota se lo cuenta a 5 más.

### P2.1 — Distribución

**Problema:** hoy el tool está en modo dogfood del maintainer. Nadie fuera del círculo directo lo conoce. Sin conocimiento no hay adopción aunque el UX sea perfecto.

**Primer paso concreto** (no "hacer marketing" — 3 assets específicos):

1. **1 post técnico honesto** de 800-1500 palabras: *"Cómo audito a Claude Code con RoadmapSmith y por qué me salvó de 3 confabulaciones esta semana"*. Concretos, no marketing. Publicar en dev.to o Hashnode, cross-post a HN Show HN.
2. **1 video de 90 segundos:** split-screen `claude-code` vs `roadmapsmith update --audit` mostrando el catch del "done" falso. Twitter/X + YouTube Short.
3. **1 PR a `awesome-claude-code`** (y listas equivalentes) agregando la entry con una línea honesta.

**Trade-off:** cada asset cuesta tiempo real (PR: 30min, post: 4h, video: 3h). No en paralelo — ordenar por menor costo (PR primero, después post, después video). El video es el más caro y el que más tracción da.

**Ceiling:** un ciclo. Si a 30 días de shippear los 3 assets no hay signal (stars, issues, mentions), pivotar el pitch antes de escalar más contenido.

**Prerequisito:** Rec 1, 2, 3 hechos. Post técnico que apunta a un README malo pierde efecto en el clic.

### P2.2 — Onboarding activo (más allá de docs)

**Problema:** los docs son pasivos. Un dev nuevo lee, no configura, se olvida, vuelve en 3 días, no recuerda el flow, desinstala. Onboarding activo lo fuerza a poner al menos un dato adentro del sistema en el primer minuto → sunk cost, más probable que vuelva.

**Primer paso concreto:**

- Agregar `roadmapsmith init --interactive`. Máximo 4 preguntas: (1) ¿usás AI agents? [Claude/Codex/otro/no], (2) ¿cuántas horas/semana? [<2, 2-10, 10+], (3) ¿el repo tiene package.json / equivalente? [autodetect], (4) ¿querés que setee el hook post-agent automático? [y/n].
- En base a respuestas, generar `roadmap-skill.config.json` pre-poblado con defaults del perfil (o exit con "no somos para vos" si contestó "no" a (1)).
- Fallback: `init` sin `--interactive` sigue funcionando exactamente como hoy.

**Trade-off:** ~150 líneas al CLI (prompts + branching). Usar `readline` del stdlib, no una lib de prompts — ladder: stdlib primero.

**Ceiling:** 4 preguntas máximo. Sin wizard multi-página. Si necesitás más, el config manual es mejor UX que un wizard de 10 pasos.

**Prerequisito:** Rec 1, 2 hechos (para poder decir "no somos para vos" con autoridad; hoy sería raro sin la sección "cuándo NO").

### P2.3 — Signal social (tracción visible)

**Problema:** repo sin issues, sin discussions, sin contributors externos, sin testimonials transmite "abandonware experimental". Un dev del segmento correcto igual duda de instalar. No es marketing — es información de riesgo real (tools abandonados destruyen días).

**Primer paso concreto** (cultivar, no forzar):

- Abrir **1** GitHub Discussion titulada "¿Cómo usás RoadmapSmith?" con tu propio use case detallado. Costo: 1h, valor: signal para el próximo visitante.
- Ir a los 3 usuarios que dieron feedback en las últimas 2 releases (si los hay), pedir 1 párrafo de testimonial. Publicar en README con nombre + link a su repo (con permiso).
- Cuando llegue el primer issue no-tuyo, responder en <24h con detalle. Ese primer issue bien atendido vale más que 10 stars.
- Abrir 3 `good first issue` labels **concretos y accionables** (no "improve docs" — "add pathAliases example for pnpm monorepo").

**Trade-off:** requiere paciencia activa. No sale de un sprint. Infra social se cultiva 3-6 meses. Sin usuarios reales, los `good first issue` quedan huérfanos y transmiten peor signal que no tenerlos.

**Ceiling:** si a 6 meses no llega ni un issue externo, revaluar si el segmento existe o si hay que pivotar el posicionamiento entero.

**Prerequisito:** P2.1 (distribución) trajo tráfico primero. Sin tráfico, no hay signal social que cultivar.

### P2.4 — Integración nativa con el flujo del agente

**Problema:** hoy el flujo es *agente termina sesión → **el humano se acuerda** de correr `roadmapsmith update` → audit*. El "se acuerda" es la fuga de valor más grande del producto. El día que `update` se dispare automáticamente al final de cada sesión de Claude Code / Codex, el valor se realiza sin fricción y sin memoria.

**Primer paso concreto:**

- **Claude Code:** ya existe el hook `PostToolUse` (este repo lo usa como ejemplo en `.claude/settings.json`). Siguiente paso: un hook `SessionEnd` bien empaquetado como parte de `roadmap-init --hosts claude` para instalación automática.
- **Codex:** hook equivalente si Codex expone SessionEnd (verificar). Si no, exponer `roadmapsmith update --audit --json` como slash command instalable.
- **Ambos:** el hook corre `update --audit --json` y **solo notifica si hay `checkedWithoutEvidence` o `readyButUnchecked`**. Silent si todo está limpio — no queremos ruido en cada sesión.
- **CI-side:** un GitHub Action reutilizable (`roadmapsmith/roadmapsmith-action@v1`) que corre el audit en cada PR y postea un comment si hay drift. Publicar en Marketplace.

**Trade-off:** cada integración es un contrato con un host que puede cambiar. Hooks de Claude Code son la API más estable de las tres → empezar ahí. Codex API todavía se mueve — posponer si hay señal de churn en la spec.

**Ceiling:** silent on success, ruidoso solo cuando hay drift real. El día que el hook se vuelve chatty, el usuario lo deshabilita y perdés el canal para siempre. **Regla dura:** default silent, opt-in verbose.

**Prerequisito:** Rec 3 (E2E smoke). Un hook automático que rompa en producción por un bug de `update` es peor que no tenerlo. El E2E te da confianza para ejecutar update sin supervisión humana.

---

## Phasing summary

| Phase | Items | What it accomplishes | Timeframe |
|---|---|---|---|
| **1 — Product readiness** | Recs 1-5 | Producto listo para recibir usuarios sin quemarlos | 1-3 sprints |
| **2 — Adoption ignition** | P2.1-P2.4 | Traer usuarios + realizar el valor sin fricción | 3-9 meses, continuo |

**Regla dura:** no arrancar Phase 2 antes de cerrar Phase 1. Cada Phase 2 item asume que Phase 1 se ejecutó. Ejecutar Phase 2 sobre un producto con Phase 1 pendiente amplifica los bugs de Phase 1 con volumen — el peor escenario posible.

---

## What is intentionally NOT in this plan

- **Rewriting the validator's evidence heuristics.** They work well enough; churning them competes with Rec 4 for user attention.
- **Adding a "lite mode" that disables all markers.** Would double the surface area. If markers are too noisy, Rec 5 addresses the root cause; a lite mode addresses the symptom.
- **Any package.json / bin / API renames.** The commands (`init`, `update`) are the stable public surface. Don't touch.
- **npm publish automation changes.** Fully hands-off already; leave it.

## Files touched, at a glance

| Rec | Files |
|---|---|
| 1 | `README.md`, `roadmap-skill/README.md` |
| 2 | `README.md`, `roadmap-skill/README.md` |
| 3 | `roadmap-skill/scripts/e2e-smoke.sh` (new), `roadmap-skill/package.json`, `.github/workflows/ci.yml` |
| 4 | `roadmap-skill/src/validator/index.js`, `roadmap-skill/src/config.js`, `roadmap-skill.config.json`, `roadmap-skill/test/validator.test.js` (new tests), `docs/audit-remediation.md`, `CHANGELOG.md` |
| 5 | `docs/plans/markup-shape-decision.md` (spike output only), possibly none after |
