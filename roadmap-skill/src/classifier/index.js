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
const LANDING_ROUTE_RE = /(?:^|\/)(?:contact|services|about|pricing|hero|cta|landing)(?:\/|\.)/i;

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
  const signals = [];

  if (hasWorkspaces(projectRoot)) {
    signals.push('package.json workspaces field');
    return { type: 'monorepo', confidence: 'high', signals };
  }

  const hasPy = hasFilename(files, 'pyproject.toml') || hasFilename(files, 'setup.py');
  if (hasPy && !files.some((f) => /\.[jt]sx?$/.test(f))) {
    signals.push('pyproject.toml / setup.py, no JS files');
    return { type: 'python-package', confidence: 'high', signals };
  }

  let webScore = 0;
  let landingScore = 0;
  const deps = readPackageDeps(projectRoot);

  for (const dep of deps) {
    if (WEB_DEPS.has(dep)) {
      webScore += 2;
      signals.push(`dependency: ${dep}`);
    }
  }

  for (const dir of WEB_DIRS) {
    if (hasDir(files, dir)) {
      webScore += 2;
      signals.push(`directory: ${dir.replace(/\/$/, '')}`);
    }
  }

  for (const dir of ASSET_DIRS) {
    if (hasDir(files, dir)) {
      webScore += 1;
      signals.push(`directory: ${dir.replace(/\/$/, '')}`);
    }
  }

  for (const cfg of WEB_CONFIGS) {
    if (hasFilename(files, cfg)) {
      webScore += 3;
      signals.push(`config: ${cfg}`);
    }
  }

  for (const cfg of STYLE_CONFIGS) {
    if (hasFilename(files, cfg)) {
      webScore += 1;
      signals.push(`config: ${cfg}`);
    }
  }

  if (files.some((f) => /\.css$/.test(f))) {
    webScore += 1;
    signals.push('CSS files present');
  }

  const landingRoutes = files.filter((f) => LANDING_ROUTE_RE.test(f));
  if (landingRoutes.length > 0) {
    landingScore += landingRoutes.length * 2;
    signals.push(`landing/service routes: ${landingRoutes.length}`);
  }

  if (hasFilename(files, 'favicon.ico') || hasFilename(files, 'logo.png') || hasFilename(files, 'logo.svg')) {
    landingScore += 1;
    signals.push('branding asset in public/');
  }

  if (webScore === 0 && (files.some((f) => f.startsWith('bin/')) || hasFilename(files, 'cli.js'))) {
    signals.push('bin/ directory or cli.js');
    return { type: 'cli-tool', confidence: 'medium', signals };
  }

  if (webScore === 0 && hasFilename(files, 'package.json')) {
    signals.push('package.json, no web signals');
    return { type: 'npm-package', confidence: 'low', signals };
  }

  if (webScore >= 3) {
    const type = landingScore >= 3 ? 'landing-site' : 'frontend-web';
    const confidence = webScore >= 7 ? 'high' : 'medium';
    return { type, confidence, signals };
  }

  return { type: 'unknown-generic', confidence: 'low', signals: [] };
}

module.exports = { classifyProject };
