'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const CLI = path.resolve(__dirname, '..', 'bin', 'cli.js');

function run(args, cwd) {
  return execFileSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8'
  });
}

test('cli init creates roadmap and agents files', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-init-'));
  run(['init'], projectRoot);

  const roadmap = path.join(projectRoot, 'roadmap.md');
  const agents = path.join(projectRoot, 'AGENTS.md');
  assert.equal(fs.existsSync(roadmap), true);
  assert.equal(fs.existsSync(agents), true);
});

test('cli generate writes managed roadmap content', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-generate-'));
  fs.writeFileSync(path.join(projectRoot, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2));
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'src', 'index.js'), 'function main() { return true; }\n', 'utf8');

  run(['generate'], projectRoot);
  const roadmapPath = path.join(projectRoot, 'roadmap.md');
  const content = fs.readFileSync(roadmapPath, 'utf8');
  assert.match(content, /<!-- rs:managed:start -->/);
  assert.match(content, /## Release Milestones/);
});

test('cli sync dry-run does not modify file', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-sync-'));
  fs.writeFileSync(path.join(projectRoot, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2));
  fs.writeFileSync(path.join(projectRoot, 'roadmap.md'), ['## Phase P0', '- [ ] Implement missing module <!-- rs:task=implement-missing-module -->', ''].join('\n'));

  const before = fs.readFileSync(path.join(projectRoot, 'roadmap.md'), 'utf8');
  run(['sync', '--dry-run'], projectRoot);
  const after = fs.readFileSync(path.join(projectRoot, 'roadmap.md'), 'utf8');

  assert.equal(after, before);
});
