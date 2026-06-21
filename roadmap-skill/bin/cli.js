#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('node:readline/promises');
const { ensureTrailingNewline, parseArgv } = require('../src/utils');
const { loadConfig, resolveRoadmapFile, resolveAgentsFile, loadPlugins, readUserConfig, resolveConfigPath } = require('../src/config');
const { readTextIfExists, writeText, printDryRunDiff } = require('../src/io');
const { buildSetupFiles, applySetupFiles, inspectHostSetup, parseHosts, assertSupportedEditor } = require('../src/host');
const { getSlashAction, renderSlashPalette, resolveSlashInvocation } = require('../src/slash');
const { renderRoadmapTemplate, renderAgentsTemplate } = require('../src/templates');
const { generateRoadmapDocument } = require('../src/generator');
const { parseRoadmap, tasksInManagedBlock } = require('../src/parser');
const { buildValidationContext, validateTasks, auditValidation, CONFIDENCE_RANK, applyMinimumConfidence } = require('../src/validator');
const { applySync } = require('../src/sync');
const { buildZeroModeConfigPatch, buildZeroModeDefaults, collectZeroModeAnswers, isInteractiveTerminal } = require('../src/zero');

function printHelp() {
  console.log([
    'Usage:',
    '  Canonical commands:',
    '  roadmapsmith zero [--project-root <path>] [--config <path>]',
    '  roadmapsmith maintain [--project-root <path>] [--config <path>] [--roadmap-file <path>] [--full-regen] [--refresh-annotations]',
    '  roadmapsmith status [--roadmap-file <path>] [--project-root <path>] [--config <path>] [--json]',
    '  roadmapsmith validate [--roadmap-file <path>] [--project-root <path>] [--config <path>] [--task <id|text>] [--json] [--strict]',
    '  roadmapsmith update [--task <stable-id> --evidence <text>] [--roadmap-file <path>] [--project-root <path>] [--config <path>] [--dry-run]',
    '  roadmapsmith setup [--project-root <path>] [--config <path>] [--editor vscode] [--hosts <codex,claude>] [--dry-run]',
    '',
    '  Advanced commands:',
    '  roadmapsmith init [--roadmap-file <path>] [--agents-file <path>] [--dry-run]',
    '  roadmapsmith generate [--project-root <path>] [--config <path>] [--roadmap-file <path>] [--dry-run] [--audit] [--full-regen]',
    '  roadmapsmith sync [--roadmap-file <path>] [--project-root <path>] [--config <path>] [--dry-run] [--audit] [--refresh-annotations]',
    '  roadmapsmith /roadmap',
    '  roadmapsmith /roadmap <action>',
    '  roadmapsmith /roadmap-zero | /roadmap-maintain | /roadmap-status | /roadmap-validate | /roadmap-update | /roadmap-setup | /roadmap-init | /roadmap-generate | /roadmap-audit',
    '',
    '  Compatibility notes:',
    '  roadmapsmith doctor [--json]            # compatibility alias for status',
    '  roadmapsmith regenerate                 # deprecated alias for generate --full-regen',
    '  roadmapsmith /road <action>             # deprecated compatibility alias',
    '  roadmapsmith /roadmap-sync <action>     # deprecated legacy compatibility root'
  ].join('\n'));
}

function isEnabled(value) {
  if (value === true) return true;
  if (typeof value !== 'string') return false;
  const normalized = value.toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function formatResultLine(task, result) {
  const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics : [];
  const primaryError = diagnostics.find((item) => item.severity === 'error');
  const warnings = diagnostics.filter((item) => item.severity === 'warning');
  const status = primaryError
    ? `FAIL:${primaryError.code}`
    : (result.passed ? 'PASS' : (warnings[0] ? `WARN:${warnings[0].code}` : 'FAIL'));
  const parts = [...result.reasons];
  warnings.forEach((item) => parts.push(`WARN:${item.code} ${item.message}`));
  const reason = parts.length > 0 ? ` :: ${parts.join('; ')}` : '';
  return `${status} [${task.id}] ${task.text}${reason}`;
}

function maybeFilterTasks(tasks, filterValue) {
  if (!filterValue) return tasks;
  const normalized = String(filterValue).toLowerCase();
  return tasks.filter((task) => {
    return task.id.toLowerCase() === normalized || task.text.toLowerCase().includes(normalized);
  });
}

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
}

function printReadinessSummary(summary) {
  if (!summary || typeof summary !== 'object') {
    return;
  }

  console.log('\nStructured readiness summary:');
  console.log(`- Workspace readiness: ${summary.workspaceReady ? 'ready' : 'needs setup'}`);
  console.log(`- Codex readiness: ${summary.codexReady ? 'ready' : 'needs setup'}`);
  console.log(`- Claude readiness: ${summary.claudeReady ? 'ready' : 'needs setup'}`);
  console.log(`- Canonical native surfaces: ${summary.canonicalSurfaceReady ? 'ready' : 'needs attention'}`);
  if (Array.isArray(summary.advancedSurfaceWarnings) && summary.advancedSurfaceWarnings.length > 0) {
    summary.advancedSurfaceWarnings.forEach((warning) => {
      console.log(`- Advanced warning: ${warning}`);
    });
  }
}

function formatSurfaceLabel(surfaceKey) {
  return surfaceKey
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (character) => character.toUpperCase());
}

function printNativeSurfaceStatus(surfaces) {
  if (!surfaces || typeof surfaces !== 'object') {
    return;
  }

  console.log('\nNative slash surfaces:');
  for (const [surfaceKey, surface] of Object.entries(surfaces)) {
    const label = formatSurfaceLabel(surfaceKey);
    console.log(`- ${label}: ${surface.ready ? 'ready' : 'needs attention'} (${surface.message})`);
    console.log(`  Source: ${surface.source}`);
    console.log(`  Verification: ${surface.verification}`);
    if (Array.isArray(surface.missingCommands) && surface.missingCommands.length > 0) {
      console.log(`  Missing commands: ${surface.missingCommands.join(', ')}`);
    }
    if (Array.isArray(surface.duplicates) && surface.duplicates.length > 0) {
      const duplicateSummary = surface.duplicates
        .map((duplicate) => `${duplicate.command}${duplicate.reason ? ` (${duplicate.reason})` : ''}`)
        .join(', ');
      console.log(`  Duplicates: ${duplicateSummary}`);
    }
  }
}

function formatSetupVerb(result, dryRun) {
  if (dryRun) {
    return result.before == null ? 'Would create' : 'Would update';
  }
  return result.before == null ? 'Created' : 'Updated';
}

function runInitCommand(projectRoot, config, flags) {
  const roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);
  const agentsFile = resolveAgentsFile(projectRoot, config, flags['agents-file']);
  const dryRun = isEnabled(flags['dry-run']);

  const roadmapExists = fs.existsSync(roadmapFile);
  const agentsExists = fs.existsSync(agentsFile);

  if (!roadmapExists) {
    const roadmap = renderRoadmapTemplate();
    const result = writeText(roadmapFile, roadmap, { dryRun });
    if (dryRun && result.changed) {
      printDryRunDiff(roadmapFile, result.before, result.after);
    }
    console.log(`${dryRun ? 'Would create' : 'Created'} ${roadmapFile}`);
  } else {
    console.log(`Skipped existing ${roadmapFile}`);
  }

  if (!agentsExists) {
    const agents = renderAgentsTemplate({ roadmapPath: path.basename(roadmapFile) });
    const result = writeText(agentsFile, agents, { dryRun });
    if (dryRun && result.changed) {
      printDryRunDiff(agentsFile, result.before, result.after);
    }
    console.log(`${dryRun ? 'Would create' : 'Created'} ${agentsFile}`);
  } else {
    console.log(`Skipped existing ${agentsFile}`);
  }
}

function runGenerateCommand(projectRoot, config, flags, options = {}) {
  const roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);
  const plugins = loadPlugins(projectRoot, config.plugins);
  const existingContent = readTextIfExists(roadmapFile) || '';
  const dryRun = isEnabled(flags['dry-run']);

  const document = generateRoadmapDocument({
    projectRoot,
    roadmapPath: roadmapFile,
    existingContent,
    config,
    plugins,
    preserveManagedBlock: options.preserveManagedBlock === true,
    forceFullRegenerate: options.forceFullRegenerate === true || isEnabled(flags['full-regen'])
  });

  const writeResult = writeText(roadmapFile, document, { dryRun });
  if (dryRun) {
    if (writeResult.changed) {
      printDryRunDiff(roadmapFile, writeResult.before, writeResult.after);
    } else {
      console.log(`No changes for ${roadmapFile}`);
    }
  } else {
    console.log(writeResult.changed ? `Updated ${roadmapFile}` : `No changes for ${roadmapFile}`);
  }

  if (options.audit || isEnabled(flags.audit)) {
    const parsedRoadmap = parseRoadmap(document);
    const validationContext = buildValidationContext(projectRoot, config, plugins);
    const results = validateTasks(parsedRoadmap.tasks, validationContext, config, plugins);
    const audit = auditValidation(parsedRoadmap.tasks, results);
    printAudit(audit);
  }
}

function runRegenerateCommand(projectRoot, config, flags, options = {}) {
  runGenerateCommand(projectRoot, config, flags, {
    ...options,
    forceFullRegenerate: true
  });
}

function runSyncCommand(projectRoot, config, flags, options = {}) {
  const roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);
  const content = readTextIfExists(roadmapFile);
  if (content == null) {
    throw new Error(`Roadmap not found: ${roadmapFile}`);
  }

  const parsedRoadmap = parseRoadmap(content);
  const syncTasks = tasksInManagedBlock(parsedRoadmap);
  const validationContext = buildValidationContext(projectRoot, config, loadPlugins(projectRoot, config.plugins));
  const results = validateTasks(syncTasks, validationContext, config, validationContext.plugins);
  applyMinimumConfidence(results, config.validation?.minimumConfidence);
  const forceRefresh = isEnabled(flags['refresh-annotations']);
  const next = applySync(content, syncTasks, results, { forceRefresh });
  const dryRun = isEnabled(flags['dry-run']);
  const writeResult = writeText(roadmapFile, next, { dryRun });

  if (dryRun) {
    if (writeResult.changed) {
      printDryRunDiff(roadmapFile, writeResult.before, writeResult.after);
    } else {
      console.log(`No changes for ${roadmapFile}`);
    }
  } else {
    console.log(writeResult.changed ? `Updated ${roadmapFile}` : `No changes for ${roadmapFile}`);
  }

  if (options.audit || isEnabled(flags.audit)) {
    const audit = auditValidation(syncTasks, results);
    printAudit(audit);
  }
}

function addEvidenceToTask(content, task, evidenceText) {
  const lines = String(content || '').split(/\r?\n/);
  const evidenceLine = `${task.indent || ''}  - Evidence: ${evidenceText}`;
  if (Array.isArray(task.evidenceLines) && task.evidenceLines.length > 0) {
    lines[task.evidenceLines[0].lineIndex] = evidenceLine;
    return ensureTrailingNewline(lines.join('\n'));
  }

  const insertionIndex = task.warningLineIndex != null
    ? task.warningLineIndex
    : task.lastChildLineIndex + 1;
  lines.splice(insertionIndex, 0, evidenceLine);
  return ensureTrailingNewline(lines.join('\n'));
}

function runUpdateCommand(projectRoot, config, flags) {
  const hasTask = flags.task != null;
  const hasEvidence = flags.evidence != null;
  if (!hasTask && !hasEvidence) {
    runSyncCommand(projectRoot, config, flags);
    return;
  }
  if (!hasTask || !hasEvidence || Array.isArray(flags.task) || Array.isArray(flags.evidence)) {
    throw new Error('update requires exactly one --task <stable-id> and one --evidence <text> value');
  }

  const taskId = String(flags.task).trim();
  const evidenceText = String(flags.evidence).trim();
  if (!taskId || !evidenceText || /[\r\n]/.test(evidenceText)) {
    throw new Error('update requires a non-empty single-line --task and --evidence value');
  }

  const roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);
  const content = readTextIfExists(roadmapFile);
  if (content == null) {
    throw new Error(`Roadmap not found: ${roadmapFile}`);
  }

  const parsedRoadmap = parseRoadmap(content);
  const matches = tasksInManagedBlock(parsedRoadmap).filter((task) => task.id === taskId);
  if (matches.length !== 1) {
    throw new Error(matches.length === 0
      ? `Roadmap task not found: ${taskId}`
      : `Roadmap task ID is ambiguous: ${taskId}`);
  }

  const draft = addEvidenceToTask(content, matches[0], evidenceText);
  const draftTask = tasksInManagedBlock(parseRoadmap(draft)).find((task) => task.id === taskId);
  const validationContext = buildValidationContext(projectRoot, config, loadPlugins(projectRoot, config.plugins));
  const result = validateTasks([draftTask], validationContext, config, validationContext.plugins)[taskId];
  const errors = (result.diagnostics || []).filter((item) => item.severity === 'error');
  const suppliedEvidenceResolved = result.evidence.authoritative && result.evidence.authoritativeFiles.length > 0;
  if (!suppliedEvidenceResolved || !result.passed || result.confidence !== 'high' || errors.length > 0) {
    const reasons = result.reasons.length > 0 ? `: ${result.reasons.join('; ')}` : '';
    throw new Error(`Task ${taskId} was not updated; supplied evidence must resolve in the repository and validate at high confidence${reasons}`);
  }

  const next = applySync(draft, [draftTask], { [taskId]: result });
  const dryRun = isEnabled(flags['dry-run']);
  const writeResult = writeText(roadmapFile, next, { dryRun });
  if (dryRun) {
    if (writeResult.changed) {
      printDryRunDiff(roadmapFile, writeResult.before, writeResult.after);
    } else {
      console.log(`No changes for ${roadmapFile}`);
    }
  } else {
    console.log(writeResult.changed ? `Updated ${roadmapFile}` : `No changes for ${roadmapFile}`);
  }
}

function printHumanStatus(payload) {
  console.log('RoadmapSmith status\n');
  console.log(`Project root: ${payload.projectRoot}`);
  console.log(`CLI resolution: ${payload.cli.kind}${payload.cli.path ? ` (${payload.cli.path})` : ''}${payload.cli.ready ? '' : ' [missing]'}`);
  console.log(`Roadmap file: ${payload.roadmap.exists ? 'ready' : 'missing'} (${payload.roadmap.path})`);
  console.log(`Agent rules: ${payload.agents.exists ? 'ready' : 'missing'} (${payload.agents.path})`);
  console.log(`VS Code launcher: ${payload.vscode.launcher.exists ? 'ready' : 'missing'} (${payload.vscode.launcher.path})`);
  console.log(`VS Code task wrappers: ${payload.vscode.wrappers.ready ? 'ready' : 'incomplete'} (${payload.vscode.wrappers.presentCount}/${payload.vscode.wrappers.expectedCount} files)`);
  console.log(`VS Code tasks: ${payload.vscode.tasks.ready ? 'ready' : 'incomplete'} (${payload.vscode.tasks.presentLabels.length}/${payload.vscode.tasks.expectedLabels.length} tasks)`);
  console.log(`Node runtime: ${payload.runtime.ready ? `ready (${payload.runtime.kind}${payload.runtime.path ? `: ${payload.runtime.path}` : ''})` : 'missing'}`);
  if (!payload.vscode.tasks.ready && payload.vscode.tasks.missingLabels.length > 0) {
    console.log(`Missing VS Code tasks: ${payload.vscode.tasks.missingLabels.join(', ')}`);
  }
  if (Array.isArray(payload.vscode.tasks.missingAdvancedLabels) && payload.vscode.tasks.missingAdvancedLabels.length > 0) {
    console.log(`Missing advanced VS Code tasks: ${payload.vscode.tasks.missingAdvancedLabels.join(', ')}`);
  }
  if (!payload.vscode.wrappers.ready) {
    console.log(`Missing task wrapper files: ${payload.vscode.wrappers.missingPaths.join(', ')}`);
  }
  console.log(`Codex readiness: ${payload.hosts.codex.ready ? 'ready' : 'needs setup'} (${payload.hosts.codex.message})`);
  console.log(`Claude readiness: ${payload.hosts.claude.ready ? 'ready' : 'needs setup'} (${payload.hosts.claude.message})`);
  printReadinessSummary(payload.summary);
  printNativeSurfaceStatus(payload.surfaces);
  console.log('\nRecommended entrypoints: roadmapsmith zero (empty repo), roadmapsmith maintain (existing repo), roadmapsmith update (canonical checklist refresh/task completion).');
  console.log('Compatibility note: roadmapsmith doctor mirrors this payload for existing automation.');
  if (!payload.cli.ready) {
    console.log('\nInstalling the skill alone does not expose the CLI in VS Code. Install the CLI and rerun roadmapsmith setup.');
  }
  if (!payload.runtime.ready) {
    console.log('\nThe VS Code task runtime is missing. Install Node.js or set ROADMAPSMITH_NODE, then rerun RoadmapSmith: Status.');
  }
}

function runStatusCommand(projectRoot, config, flags, options = {}) {
  const roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);
  const agentsFile = resolveAgentsFile(projectRoot, config, flags['agents-file']);
  const payload = inspectHostSetup(projectRoot, { roadmapFile, agentsFile, currentCliPath: __filename });

  if (options.json) {
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  } else {
    printHumanStatus(payload);
  }

  const ready = payload.cli.ready && payload.roadmap.exists && payload.agents.exists && payload.vscode.tasks.ready && payload.runtime.ready && payload.claude.ready;
  if (!ready) {
    process.exitCode = 1;
  }
}

async function runZeroCommand(projectRoot, flags) {
  const configPath = resolveConfigPath({ projectRoot, configPath: flags.config });
  const config = loadConfig({ projectRoot, configPath: flags.config });
  if (!isInteractiveTerminal(process.stdin, process.stdout)) {
    throw new Error('Zero Mode requires an interactive terminal. Run roadmapsmith zero from a terminal session, or add a config/brief workflow before retrying in non-interactive mode.');
  }

  const defaults = buildZeroModeDefaults(projectRoot, config);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    console.log('RoadmapSmith Zero Mode');
    console.log('Answer the discovery interview to generate the first roadmap.\n');
    const answers = await collectZeroModeAnswers((prompt) => rl.question(prompt), defaults);
    const existingUserConfig = readUserConfig({ projectRoot, configPath: flags.config });
    const nextUserConfig = buildZeroModeConfigPatch(projectRoot, existingUserConfig, answers);
    writeText(configPath, JSON.stringify(nextUserConfig, null, 2));
    console.log(`Updated ${configPath}`);
    const nextConfig = loadConfig({ projectRoot, configPath: flags.config });
    runInitCommand(projectRoot, nextConfig, flags);
    runGenerateCommand(projectRoot, nextConfig, flags);
  } finally {
    rl.close();
  }
}

function runMaintainCommand(projectRoot, flags) {
  const config = loadConfig({ projectRoot, configPath: flags.config });
  const fullRegen = isEnabled(flags['full-regen']);
  runGenerateCommand(projectRoot, config, flags, {
    preserveManagedBlock: !fullRegen,
    forceFullRegenerate: fullRegen
  });
  runSyncCommand(projectRoot, config, { ...flags, audit: true }, { audit: true });
}

async function run() {
  const parsed = parseArgv(process.argv.slice(2));
  const command = parsed.command;
  const flags = parsed.flags;
  let effectiveCommand = command;

  if (isEnabled(flags.version) || isEnabled(flags.v)) {
    const pkg = require(path.join(__dirname, '..', 'package.json'));
    process.stdout.write(pkg.version + '\n');
    process.exit(0);
  }

  if (!command || isEnabled(flags.help) || isEnabled(flags.h)) {
    printHelp();
    return;
  }

  const slashInvocation = resolveSlashInvocation(command, parsed.args);
  if (slashInvocation) {
    if (slashInvocation.kind === 'palette') {
      process.stdout.write(renderSlashPalette(slashInvocation) + '\n');
      return;
    }

    const slashAction = getSlashAction(slashInvocation.actionId);
    if (!slashAction) {
      process.stdout.write(renderSlashPalette(slashInvocation) + '\n');
      return;
    }

    if (slashInvocation.deprecated && slashInvocation.deprecationMessage) {
      process.stderr.write(`${slashInvocation.deprecationMessage}\n`);
    }

    if (slashAction.id === 'status') {
      const projectRoot = path.resolve(String(flags['project-root'] || process.cwd()));
      const config = loadConfig({ projectRoot, configPath: flags.config });
      runStatusCommand(projectRoot, config, flags, { json: isEnabled(flags.json) });
      return;
    }

    if (slashAction.id === 'audit') {
      flags.audit = true;
      effectiveCommand = 'sync';
    } else {
      effectiveCommand = slashAction.id;
    }
  }

  if (effectiveCommand === 'zero') {
    const projectRoot = path.resolve(String(flags['project-root'] || process.cwd()));
    await runZeroCommand(projectRoot, flags);
    return;
  }

  if (effectiveCommand === 'maintain') {
    const projectRoot = path.resolve(String(flags['project-root'] || process.cwd()));
    runMaintainCommand(projectRoot, flags);
    return;
  }

  if (effectiveCommand === 'init') {
    const projectRoot = path.resolve(String(flags['project-root'] || process.cwd()));
    const config = loadConfig({ projectRoot, configPath: flags.config });
    runInitCommand(projectRoot, config, flags);
    return;
  }

  if (effectiveCommand === 'generate') {
    const projectRoot = path.resolve(String(flags['project-root'] || process.cwd()));
    const config = loadConfig({ projectRoot, configPath: flags.config });
    runGenerateCommand(projectRoot, config, flags);
    return;
  }

  if (effectiveCommand === 'regenerate') {
    const projectRoot = path.resolve(String(flags['project-root'] || process.cwd()));
    const config = loadConfig({ projectRoot, configPath: flags.config });
    process.stderr.write('The regenerate command is deprecated. Use generate --full-regen for the public destructive rebuild path.\n');
    runRegenerateCommand(projectRoot, config, flags);
    return;
  }

  if (effectiveCommand === 'setup') {
    const projectRoot = path.resolve(String(flags['project-root'] || process.cwd()));
    loadConfig({ projectRoot, configPath: flags.config });
    const editor = assertSupportedEditor(flags.editor || 'vscode');
    const hosts = parseHosts(flags.hosts || 'codex,claude');
    const dryRun = isEnabled(flags['dry-run']);
    const setupPlan = buildSetupFiles(projectRoot, { editor, hosts });
    const results = applySetupFiles(setupPlan, { dryRun });

    results.forEach((result) => {
      if (dryRun && result.changed) {
        printDryRunDiff(result.path, result.before, result.after);
      }
      if (!result.changed) {
        console.log(`No changes for ${result.path}`);
        return;
      }
      console.log(`${formatSetupVerb(result, dryRun)} ${result.path}`);
    });

    return;
  }

  if (effectiveCommand === 'sync') {
    const projectRoot = path.resolve(String(flags['project-root'] || process.cwd()));
    const config = loadConfig({ projectRoot, configPath: flags.config });
    runSyncCommand(projectRoot, config, flags);
    return;
  }

  if (effectiveCommand === 'update') {
    const projectRoot = path.resolve(String(flags['project-root'] || process.cwd()));
    const config = loadConfig({ projectRoot, configPath: flags.config });
    runUpdateCommand(projectRoot, config, flags);
    return;
  }

  if (effectiveCommand === 'validate') {
    const projectRoot = path.resolve(String(flags['project-root'] || process.cwd()));
    const config = loadConfig({ projectRoot, configPath: flags.config });
    const roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);
    const content = readTextIfExists(roadmapFile);
    if (content == null) {
      throw new Error(`Roadmap not found: ${roadmapFile}`);
    }

    const parsedRoadmap = parseRoadmap(content);
    const tasks = maybeFilterTasks(parsedRoadmap.tasks, flags.task);
    const validationContext = buildValidationContext(projectRoot, config, loadPlugins(projectRoot, config.plugins), {
      strictValidation: isEnabled(flags.strict)
    });
    const results = validateTasks(tasks, validationContext, config, validationContext.plugins);

    const minRank = CONFIDENCE_RANK[config.validation && config.validation.minimumConfidence] ?? 0;
    const visibleTasks = tasks.filter((task) => (CONFIDENCE_RANK[results[task.id].confidence] ?? 0) >= minRank);

    if (isEnabled(flags.json)) {
      const payload = visibleTasks.map((task) => ({ task, result: results[task.id] }));
      console.log(JSON.stringify(payload, null, 2));
    } else {
      visibleTasks.forEach((task) => {
        console.log(formatResultLine(task, results[task.id]));
      });
    }

    const failed = visibleTasks.some((task) => !results[task.id].passed);
    if (failed) {
      process.exitCode = 1;
    }
    return;
  }

  if (effectiveCommand === 'status' || effectiveCommand === 'doctor') {
    const projectRoot = path.resolve(String(flags['project-root'] || process.cwd()));
    let ok = true;
    const jsonMode = isEnabled(flags.json);
    const log = jsonMode ? () => {} : console.log;
    const logError = jsonMode ? () => {} : console.error;

    let config;
    let roadmapFile = null;
    let agentsFile = null;
    try {
      config = loadConfig({ projectRoot, configPath: flags.config });
      log('[ok] Config loaded without errors');
    } catch (error) {
      logError(`[fail] Config error: ${error.message}`);
      ok = false;
    }

    if (config) {
      roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);
      if (fs.existsSync(roadmapFile)) {
        log(`[ok] ROADMAP file found: ${roadmapFile}`);
      } else {
        logError(`[fail] ROADMAP file not found: ${roadmapFile}`);
        ok = false;
      }

      agentsFile = resolveAgentsFile(projectRoot, config, flags['agents-file']);
      if (fs.existsSync(agentsFile)) {
        log(`[ok] Agent rules file found: ${agentsFile}`);
      } else {
        logError(`[fail] Agent rules file not found: ${agentsFile}`);
        ok = false;
      }
    }

    let hostStatus = null;
    if (config) {
      try {
        hostStatus = inspectHostSetup(projectRoot, { roadmapFile, agentsFile });
      } catch (error) {
        logError(`[fail] Host integration error: ${error.message}`);
        ok = false;
      }
    }

    if (hostStatus) {
      if (hostStatus.cli.ready) {
        log(`[ok] CLI resolution: ${hostStatus.cli.kind}${hostStatus.cli.path ? ` (${hostStatus.cli.path})` : ''}`);
      } else {
        logError('[fail] CLI resolution: missing local package and global command');
        ok = false;
      }

      if (hostStatus.vscode.launcher.exists) {
        log(`[ok] VS Code launcher found: ${hostStatus.vscode.launcher.path}`);
      } else {
        logError(`[fail] VS Code launcher missing: ${hostStatus.vscode.launcher.path}`);
        ok = false;
      }

      if (hostStatus.vscode.wrappers.ready) {
        log(`[ok] VS Code task wrappers ready: ${hostStatus.vscode.wrappers.presentCount}/${hostStatus.vscode.wrappers.expectedCount} files`);
      } else {
        logError(`[fail] VS Code task wrappers incomplete: missing ${hostStatus.vscode.wrappers.missingPaths.join(', ') || 'wrapper files'}`);
        ok = false;
      }

      if (hostStatus.vscode.tasks.ready) {
        log(`[ok] VS Code tasks ready: ${hostStatus.vscode.tasks.presentLabels.length}/${hostStatus.vscode.tasks.expectedLabels.length} tasks`);
      } else {
        logError(`[fail] VS Code tasks incomplete: missing ${hostStatus.vscode.tasks.missingLabels.join(', ') || 'managed labels'}`);
        ok = false;
      }
      if (Array.isArray(hostStatus.vscode.tasks.missingAdvancedLabels) && hostStatus.vscode.tasks.missingAdvancedLabels.length > 0) {
        log(`[warn] Advanced VS Code tasks missing: ${hostStatus.vscode.tasks.missingAdvancedLabels.join(', ')}`);
      }

      if (hostStatus.runtime.ready) {
        log(`[ok] Node runtime: ${hostStatus.runtime.kind}${hostStatus.runtime.path ? ` (${hostStatus.runtime.path})` : ''}`);
      } else {
        logError('[fail] Node runtime missing for VS Code task execution');
        ok = false;
      }

      if (hostStatus.claude.ready) {
        log(`[ok] Claude hook ready: ${hostStatus.claude.hookFile.path}`);
      } else {
        logError(`[fail] Claude hook incomplete: ${hostStatus.hosts.claude.message}`);
        ok = false;
      }

      if (hostStatus.surfaces) {
        Object.entries(hostStatus.surfaces).forEach(([surfaceKey, surface]) => {
          const prefix = surface.ready ? '[ok]' : '[warn]';
          log(`${prefix} ${formatSurfaceLabel(surfaceKey)}: ${surface.message}`);
          if (Array.isArray(surface.duplicates) && surface.duplicates.length > 0) {
            const duplicateSummary = surface.duplicates.map((duplicate) => duplicate.command).join(', ');
            log(`[warn] ${formatSurfaceLabel(surfaceKey)} duplicates: ${duplicateSummary}`);
          }
        });
      }
    }

    if (jsonMode) {
      process.stdout.write(JSON.stringify(hostStatus || {
        projectRoot,
        error: 'doctor failed before host inspection'
      }, null, 2) + '\n');
    }

    if (!ok) {
      process.exitCode = 1;
      return;
    }
    log('doctor: all checks passed');
    return;
  }

  throw new Error(`Unknown command: ${effectiveCommand}`);
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
