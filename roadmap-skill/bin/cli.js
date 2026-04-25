#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parseArgv } = require('../src/utils');
const { loadConfig, resolveRoadmapFile, resolveAgentsFile, loadPlugins } = require('../src/config');
const { readTextIfExists, writeText, printDryRunDiff } = require('../src/io');
const { renderRoadmapTemplate, renderAgentsTemplate } = require('../src/templates');
const { generateRoadmapDocument } = require('../src/generator');
const { parseRoadmap } = require('../src/parser');
const { buildValidationContext, validateTasks, auditValidation } = require('../src/validator');
const { applySync } = require('../src/sync');

function printHelp() {
  console.log([
    'Usage:',
    '  roadmapsmith init [--roadmap-file <path>] [--agents-file <path>] [--dry-run]',
    '  roadmapsmith generate [--project-root <path>] [--config <path>] [--roadmap-file <path>] [--dry-run] [--audit]',
    '  roadmapsmith sync [--roadmap-file <path>] [--project-root <path>] [--config <path>] [--dry-run] [--audit]',
    '  roadmapsmith validate [--roadmap-file <path>] [--project-root <path>] [--config <path>] [--task <id|text>] [--json]'
  ].join('\n'));
}

function isEnabled(value) {
  if (value === true) return true;
  if (typeof value !== 'string') return false;
  const normalized = value.toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function formatResultLine(task, result) {
  const status = result.passed ? 'PASS' : 'FAIL';
  const reason = result.reasons.length > 0 ? ` :: ${result.reasons.join('; ')}` : '';
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

async function run() {
  const parsed = parseArgv(process.argv.slice(2));
  const command = parsed.command;
  const flags = parsed.flags;

  if (!command || isEnabled(flags.help) || isEnabled(flags.h)) {
    printHelp();
    return;
  }

  if (command === 'init') {
    const projectRoot = process.cwd();
    const config = loadConfig({ projectRoot });
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
    return;
  }

  if (command === 'generate') {
    const projectRoot = path.resolve(String(flags['project-root'] || process.cwd()));
    const config = loadConfig({ projectRoot, configPath: flags.config });
    const roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);
    const plugins = loadPlugins(projectRoot, config.plugins);
    const existingContent = readTextIfExists(roadmapFile) || '';
    const dryRun = isEnabled(flags['dry-run']);

    const document = generateRoadmapDocument({
      projectRoot,
      roadmapPath: roadmapFile,
      existingContent,
      config,
      plugins
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

    if (isEnabled(flags.audit)) {
      const parsedRoadmap = parseRoadmap(document);
      const validationContext = buildValidationContext(projectRoot, config, plugins);
      const results = validateTasks(parsedRoadmap.tasks, validationContext, config, plugins);
      const audit = auditValidation(parsedRoadmap.tasks, results);
      printAudit(audit);
    }
    return;
  }

  if (command === 'sync') {
    const projectRoot = path.resolve(String(flags['project-root'] || process.cwd()));
    const config = loadConfig({ projectRoot, configPath: flags.config });
    const roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);
    const content = readTextIfExists(roadmapFile);
    if (content == null) {
      throw new Error(`Roadmap not found: ${roadmapFile}`);
    }

    const parsedRoadmap = parseRoadmap(content);
    const validationContext = buildValidationContext(projectRoot, config, loadPlugins(projectRoot, config.plugins));
    const results = validateTasks(parsedRoadmap.tasks, validationContext, config, validationContext.plugins);
    const next = applySync(content, parsedRoadmap.tasks, results);
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

    if (isEnabled(flags.audit)) {
      const audit = auditValidation(parsedRoadmap.tasks, results);
      printAudit(audit);
    }
    return;
  }

  if (command === 'validate') {
    const projectRoot = path.resolve(String(flags['project-root'] || process.cwd()));
    const config = loadConfig({ projectRoot, configPath: flags.config });
    const roadmapFile = resolveRoadmapFile(projectRoot, config, flags['roadmap-file']);
    const content = readTextIfExists(roadmapFile);
    if (content == null) {
      throw new Error(`Roadmap not found: ${roadmapFile}`);
    }

    const parsedRoadmap = parseRoadmap(content);
    const tasks = maybeFilterTasks(parsedRoadmap.tasks, flags.task);
    const validationContext = buildValidationContext(projectRoot, config, loadPlugins(projectRoot, config.plugins));
    const results = validateTasks(tasks, validationContext, config, validationContext.plugins);

    if (isEnabled(flags.json)) {
      const payload = tasks.map((task) => ({ task, result: results[task.id] }));
      console.log(JSON.stringify(payload, null, 2));
    } else {
      tasks.forEach((task) => {
        console.log(formatResultLine(task, results[task.id]));
      });
    }

    const failed = tasks.some((task) => !results[task.id].passed);
    if (failed) {
      process.exitCode = 1;
    }
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
