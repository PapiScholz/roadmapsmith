'use strict';

const fs = require('fs');
const path = require('path');

const WEB_DIRS = ['app/', 'pages/', 'components/', 'src/app/', 'src/pages/', 'src/components/'];
const ASSET_DIRS = ['public/', 'assets/', 'static/'];
const WEB_CONFIGS = [
  'next.config.js', 'next.config.ts', 'next.config.mjs',
  'vite.config.js', 'vite.config.ts',
  'astro.config.mjs', 'astro.config.ts'
];
const STYLE_CONFIGS = ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs'];
const WEB_DEPS = new Set(['next', 'react', 'vue', 'svelte', 'astro', 'vite', 'nuxt', 'gatsby', 'remix', '@remix-run/react']);
const ELECTRON_DEPS = new Set(['electron', 'electron-builder', 'electron-forge', '@electron-forge/cli', 'electron-updater']);
const ELECTRON_CONFIGS = [
  'electron-builder.json',
  'electron-builder.yml',
  'electron-builder.yaml',
  'forge.config.js',
  'forge.config.ts'
];
const LANDING_ROUTE_RE = /(?:^|\/)(?:contact|services|about|pricing|hero|cta|landing)(?:\/|\.)/i;
const FIXTURE_PATH_RE = /(^|\/)(?:test|tests)\/fixtures\//i;

function readPackageDeps(projectRoot) {
  if (!projectRoot) return [];
  try {
    const raw = fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw);
    return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  } catch {
    return [];
  }
}

function hasDir(files, prefix) {
  return files.some((f) => f.startsWith(prefix));
}

function hasFilename(files, name) {
  return files.some((f) => f === name || f.endsWith('/' + name));
}

function hasWorkspaces(projectRoot) {
  if (!projectRoot) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    return Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0;
  } catch {
    return false;
  }
}

function classifyProject({ projectRoot, files }) {
  const candidateFiles = Array.isArray(files)
    ? files.filter((file) => !FIXTURE_PATH_RE.test(String(file || '')))
    : [];
  const signals = [];

  if (hasWorkspaces(projectRoot)) {
    signals.push('package.json workspaces field');
    return { type: 'monorepo', confidence: 'high', signals };
  }

  const hasPy = hasFilename(candidateFiles, 'pyproject.toml') || hasFilename(candidateFiles, 'setup.py');
  if (hasPy && !candidateFiles.some((f) => /\.[jt]sx?$/.test(f))) {
    signals.push('pyproject.toml / setup.py, no JS files');
    return { type: 'python-package', confidence: 'high', signals };
  }

  let webScore = 0;
  let landingScore = 0;
  let electronScore = 0;
  const deps = readPackageDeps(projectRoot);

  for (const dep of deps) {
    if (ELECTRON_DEPS.has(dep)) {
      electronScore += 3;
      signals.push(`dependency: ${dep}`);
    }
    if (WEB_DEPS.has(dep)) {
      webScore += 2;
      signals.push(`dependency: ${dep}`);
    }
  }

  for (const dir of WEB_DIRS) {
    if (hasDir(candidateFiles, dir)) {
      webScore += 2;
      signals.push(`directory: ${dir.replace(/\/$/, '')}`);
    }
  }

  for (const dir of ASSET_DIRS) {
    if (hasDir(candidateFiles, dir)) {
      webScore += 1;
      signals.push(`directory: ${dir.replace(/\/$/, '')}`);
    }
  }

  if (hasDir(candidateFiles, 'electron/')) {
    electronScore += 3;
    signals.push('directory: electron');
  }

  if (candidateFiles.some((file) => /^electron\/.+\.(js|ts|cjs|mjs)$/.test(file))) {
    electronScore += 2;
    signals.push('electron main/preload sources');
  }

  for (const cfg of ELECTRON_CONFIGS) {
    if (hasFilename(candidateFiles, cfg)) {
      electronScore += 2;
      signals.push(`config: ${cfg}`);
    }
  }

  for (const cfg of WEB_CONFIGS) {
    if (hasFilename(candidateFiles, cfg)) {
      webScore += 3;
      signals.push(`config: ${cfg}`);
    }
  }

  for (const cfg of STYLE_CONFIGS) {
    if (hasFilename(candidateFiles, cfg)) {
      webScore += 1;
      signals.push(`config: ${cfg}`);
    }
  }

  if (candidateFiles.some((f) => /\.css$/.test(f))) {
    webScore += 1;
    signals.push('CSS files present');
  }

  const landingRoutes = candidateFiles.filter((f) => LANDING_ROUTE_RE.test(f));
  if (landingRoutes.length > 0) {
    landingScore += landingRoutes.length * 2;
    signals.push(`landing/service routes: ${landingRoutes.length}`);
  }

  if (hasFilename(candidateFiles, 'favicon.ico') || hasFilename(candidateFiles, 'logo.png') || hasFilename(candidateFiles, 'logo.svg')) {
    landingScore += 1;
    signals.push('branding asset in public/');
  }

  if (webScore === 0 && (candidateFiles.some((f) => f.startsWith('bin/')) || hasFilename(candidateFiles, 'cli.js'))) {
    signals.push('bin/ directory or cli.js');
    return { type: 'cli-tool', confidence: 'medium', signals };
  }

  if (webScore === 0 && hasFilename(candidateFiles, 'package.json')) {
    signals.push('package.json, no web signals');
    return { type: 'npm-package', confidence: 'low', signals };
  }

  if (electronScore >= 3) {
    const confidence = electronScore >= 6 ? 'high' : 'medium';
    return { type: 'electron-app', confidence, signals };
  }

  if (webScore >= 3) {
    const type = landingScore >= 3 ? 'landing-site' : 'frontend-web';
    const confidence = webScore >= 7 ? 'high' : 'medium';
    return { type, confidence, signals };
  }

  return { type: 'unknown-generic', confidence: 'low', signals: [] };
}

module.exports = { classifyProject };
