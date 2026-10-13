#!/usr/bin/env node
/*
 * Version guard: a change that ships in the plugin must come with a new version.
 *
 * Anthropic's directory scans every commit pushed to the tracked branch as a new
 * version of the plugin, but `claude plugin update` only hands users a new copy
 * when `version` in plugin.json moved. A push that changes the plugin without
 * bumping it reaches the directory and silently skips everyone who installed
 * from the marketplace. This check fails that push in CI.
 *
 * Rules, comparing --base against HEAD:
 *   1. If any file inside the plugin folder changed (outside the paths that never
 *      ship, see NON_SHIPPING), the version must be higher than at --base.
 *   2. If the version is higher and a CHANGELOG.md exists at the repo root, it
 *      must have a heading for the new version (`## 1.2.3` or `## [1.2.3]`).
 *   3. The version never goes backwards.
 *
 * Usage: node .github/scripts/version-guard.mjs --base <sha> [--plugin <dir>]
 *   --plugin  folder that holds .claude-plugin/plugin.json, relative to the repo
 *             root (default ".")
 * Without --base, or with the all-zeros sha of a branch's first push, there is
 * nothing to compare against and the check passes with a note.
 * Exit code 1 when a rule is broken.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Paths inside the plugin folder that never reach a user's install. The
// marketplace file is the catalog that lists the plugin, not part of it, and
// CLAUDE.md / AGENTS.md / .claude/ configure agents working ON the repo: an
// installed plugin never loads them.
const NON_SHIPPING = [
  /^\.claude-plugin\/marketplace\.json$/,
  /^\.claude\//,
  /^CLAUDE\.md$/,
  /^AGENTS\.md$/,
  /^CONTRIBUTING\.md$/,
  /^\.github\//,
  /^tests?\//,
  /^docs\//,
  /^graphify-out\//,
  /^CHANGELOG\.md$/,
  /^ROADMAP\.md$/,
  /^\.gitignore$/,
  /^\.gitattributes$/,
];

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : null;
};
const rawBase = arg('--base');
const base = rawBase && !/^0+$/.test(rawBase) ? rawBase : null;
const pluginDir = (arg('--plugin') ?? '.').replace(/\\/g, '/').replace(/^\.\/?/, '').replace(/\/$/, '');
const manifest = (pluginDir ? pluginDir + '/' : '') + '.claude-plugin/plugin.json';

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const parse = (v) => {
  const m = SEMVER.exec(v ?? '');
  return m ? m.slice(1).map(Number) : null;
};
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

const versionAt = (ref) => {
  const raw = ref ? git('show', `${ref}:${manifest}`) : fs.readFileSync(path.join(ROOT, manifest), 'utf8');
  return JSON.parse(raw).version;
};

const done = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  version-guard  ${msg}`);
  process.exit(ok ? 0 : 1);
};

const head = versionAt(null);
if (!parse(head)) done(false, `${manifest} version missing or not semver: ${JSON.stringify(head)}`);
if (!base) done(true, `no base to compare against; ${head} not checked`);

let prev;
try {
  prev = versionAt(base);
} catch {
  done(true, `${manifest} did not exist at ${base.slice(0, 7)}; ${head} is the first version`);
}

const changed = git('diff', '--name-only', `${base}`, 'HEAD')
  .split('\n')
  .filter(Boolean);
const inPlugin = changed
  .filter((f) => !pluginDir || f.startsWith(pluginDir + '/'))
  .map((f) => (pluginDir ? f.slice(pluginDir.length + 1) : f));
const shipping = inPlugin.filter((f) => !NON_SHIPPING.some((re) => re.test(f)));

const order = parse(prev) ? cmp(parse(head), parse(prev)) : 1;
if (order < 0) done(false, `version went backwards: ${prev} -> ${head}`);

if (order === 0) {
  if (shipping.length === 0) done(true, `${head} unchanged; nothing that ships changed`);
  const list = shipping.slice(0, 15).map((f) => `      ${f}`).join('\n');
  const more = shipping.length > 15 ? `\n      ...and ${shipping.length - 15} more` : '';
  done(
    false,
    `the plugin changed but ${manifest} is still ${head}.\n` +
      `    Bump "version" (and add it to CHANGELOG.md) so \`claude plugin update\` delivers it.\n` +
      `    Changed since ${base.slice(0, 7)}:\n${list}${more}`
  );
}

const changelog = path.join(ROOT, 'CHANGELOG.md');
if (fs.existsSync(changelog)) {
  const text = fs.readFileSync(changelog, 'utf8').replace(/\r\n/g, '\n');
  const heading = new RegExp(`^## \\[?${head.replace(/\./g, '\\.')}\\]?(\\s|$)`, 'm');
  if (!heading.test(text)) done(false, `${prev} -> ${head}, but CHANGELOG.md has no "## ${head}" heading`);
}
done(true, `${prev} -> ${head}`);
