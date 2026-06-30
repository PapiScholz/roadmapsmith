#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { renderRoadmapTemplate, renderAgentsTemplate } = require('../src/templates');
const { resolveRoadmapFile, loadConfig, loadPlugins } = require('../src/config');
const { readTextIfExists, writeText } = require('../src/io');
const { importTasks } = require('../src/importer');
const { addTask } = require('../src/addTask');
const { detectDrift } = require('../src/drift');
const { parseRoadmap } = require('../src/parser');
const { generateRoadmapDocument, scanProject } = require('../src/generator');
const { validateTasks, buildValidationContext, auditValidation } = require('../src/validator');
const { applySync } = require('../src/sync');
const { buildSetupFiles, applySetupFiles, parseHosts, assertSupportedEditor } = require('../src/host');
const { parseArgv } = require('../src/utils');

function isEnabled(v) {
  return v === true || v === 'true' || v === '1' || v === 'yes';
}

// ─── Help ─────────────────────────────────────────────────────────────────────

const HELP = `roadmapsmith — living evidence-backed roadmap tool

Commands:
  init     Create ROADMAP.md and AGENTS.md in a project
  update   Refresh or modify an existing ROADMAP.md

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
  --audit                       Show validation audit after refresh
  --check-drift                 Check alignment of northStar vs repo state
  --strict                      Use strict validation mode
  --dry-run                     Preview without writing
  --json                        Output in JSON format
  --project-root <path>         Project root (default: cwd)`.trim();

// ─── runInit ──────────────────────────────────────────────────────────────────

function runInit(projectRoot, config, flags) {
  const dryRun = isEnabled(flags['dry-run']);
  const setupOnly = isEnabled(flags['setup-only']);

  if (!setupOnly) {
    const roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);
    const agentsFile = path.resolve(projectRoot, flags['agents-file'] || 'AGENTS.md');

    if (!fs.existsSync(roadmapFile)) {
      const replacements = {
        productName: flags['product-name'] || 'Project Roadmap',
        productNorthStar: 'Ship validated increments with transparent completion evidence and deterministic planning artifacts.',
        problemStatement: flags['problem-statement'] ? `\n\n**Problem being solved:** ${flags['problem-statement']}` : '',
        primaryUser: flags['primary-user'] ? `\n\n**Primary user:** ${flags['primary-user']}` : '',
      };

      let content = renderRoadmapTemplate(replacements);

      const importFiles = [flags['import']].flat().filter(Boolean);
      if (importFiles.length > 0) {
        const imported = importTasks(importFiles);
        for (const task of imported) {
          content = addTask(task.text, content, {});
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

function printAudit(audit) {
  console.log(`Audit summary: ${audit.checkedWithoutEvidence.length} checked-without-evidence, ${audit.readyButUnchecked.length} ready-but-unchecked.`);
  if (audit.checkedWithoutEvidence.length > 0) {
    console.log('Checked without evidence:');
    audit.checkedWithoutEvidence.forEach((item) => {
      console.log(`- [${item.task.id}] ${item.task.text}`);
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
}

// ─── runUpdate ────────────────────────────────────────────────────────────────

function runUpdate(projectRoot, config, flags) {
  const dryRun = isEnabled(flags['dry-run']);
  const useJson = isEnabled(flags.json);
  const strict = isEnabled(flags.strict);
  const roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);

  if (flags['add-task']) {
    const existing = readTextIfExists(roadmapFile) || '';
    const updated = addTask(flags['add-task'], existing, {});
    writeText(roadmapFile, updated, { dryRun });
    console.log(`${dryRun ? 'Would add' : 'Added'} task: ${flags['add-task']}`);
    return;
  }

  if (flags.task && flags.evidence) {
    const existing = readTextIfExists(roadmapFile) || '';
    const { tasks } = parseRoadmap(existing);
    const target = tasks.find((t) => t.markerId === flags.task || t.id === flags.task);
    if (!target) {
      console.error(`Task not found: ${flags.task}`);
      process.exitCode = 1;
      return;
    }
    const lines = existing.split('\n');
    const insertAt = (target.lastChildLineIndex != null ? target.lastChildLineIndex : target.lineIndex) + 1;
    lines.splice(insertAt, 0, `  - Evidence: ${flags.evidence}`);
    writeText(roadmapFile, lines.join('\n'), { dryRun });
    console.log(`${dryRun ? 'Would add' : 'Added'} evidence to ${flags.task}`);
    return;
  }

  if (isEnabled(flags['check-drift'])) {
    const northStar = config && config.product && config.product.northStar;
    if (!northStar) {
      console.error('No northStar configured. Set product.northStar in roadmap-skill.config.json');
      process.exitCode = 1;
      return;
    }
    const scan = scanProject(projectRoot);
    const drift = detectDrift(northStar, {
      languages: scan.languages,
      testFrameworks: scan.testFrameworks,
      modules: scan.modules,
      projectType: scan.projectType
    });
    if (useJson) {
      console.log(JSON.stringify(drift, null, 2));
    } else {
      console.log(`Drift score: ${drift.score}/100 — ${drift.drifted ? 'DRIFTED' : 'aligned'}`);
      console.log(drift.summary);
      drift.details.forEach((d) => console.log(`  - ${d}`));
    }
    return;
  }

  // Default: refresh existing tasks (parse → validate → apply)
  const existingContent = readTextIfExists(roadmapFile) || '';
  const plugins = loadPlugins(projectRoot, config.plugins || []);
  const context = buildValidationContext(projectRoot, config, plugins, { strictValidation: strict });

  const { tasks } = parseRoadmap(existingContent);
  const resultMap = validateTasks(tasks, context, config, plugins);
  const { content: synced, changes } = applySync(existingContent, tasks, resultMap, { forceRefresh: true });

  writeText(roadmapFile, synced, { dryRun });
  console.log(`${dryRun ? 'Would update' : 'Updated'} ${roadmapFile}`);

  if (isEnabled(flags.audit)) {
    const audit = auditValidation(tasks, resultMap, changes);
    if (useJson) {
      console.log(JSON.stringify(audit, null, 2));
    } else {
      printAudit(audit);
    }
    if (audit.checkedWithoutEvidence.length > 0 || audit.readyButUnchecked.length > 0) {
      process.exitCode = 2;
    }
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

function main() {
  const { flags, command: cmd } = parseArgv(process.argv.slice(2));

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
    runInit(projectRoot, config, flags);
  } else if (cmd === 'update') {
    runUpdate(projectRoot, config, flags);
  } else {
    console.error(`Unknown command: ${cmd || '(none)'}\n\n${HELP}`);
    process.exitCode = 1;
  }
}

main();
