'use strict';

const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');

const PACKAGE_ROOT = path.resolve(__dirname, '..');

function resolveNpmRunInvocation() {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath, 'run', 'verify-pack-surface', '--silent']
    };
  }

  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe');
    return {
      command: comspec,
      args: ['/d', '/s', '/c', 'npm.cmd run verify-pack-surface --silent']
    };
  }

  return {
    command: 'npm',
    args: ['run', 'verify-pack-surface', '--silent']
  };
}

test('npm pack includes the full Codex and Claude bundle surface', (t) => {
  if (!process.env.npm_execpath) {
    t.skip('package-surface verification runs under npm test / npm run so npm lifecycle env is available');
    return;
  }

  const npmInvocation = resolveNpmRunInvocation();

  const output = execFileSync(npmInvocation.command, npmInvocation.args, {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8'
  });

  assert.match(output, /Verified packed npm artifact surface/);
});
