'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPlugins, collectPluginContributions } = require('../src/config');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rs-plugin-test-'));
}

function writePlugin(dir, filename, content) {
  const pluginPath = path.join(dir, filename);
  fs.writeFileSync(pluginPath, content, 'utf8');
  return pluginPath;
}

test('loadPlugins returns plugin with name, path, and module for a valid plugin', () => {
  const dir = makeTmpDir();
  try {
    writePlugin(dir, 'my-plugin.js', `'use strict';\nmodule.exports = { registerTaskDetectors: () => [] };\n`);
    const plugins = loadPlugins(dir, ['./my-plugin.js']);
    assert.equal(plugins.length, 1);
    assert.equal(plugins[0].name, 'my-plugin.js');
    assert.equal(typeof plugins[0].module.registerTaskDetectors, 'function');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('loadPlugins returns empty array when plugin entries list is empty', () => {
  const plugins = loadPlugins('/any/root', []);
  assert.equal(plugins.length, 0);
});

test('loadPlugins throws when plugin file does not exist', () => {
  const dir = makeTmpDir();
  try {
    assert.throws(
      () => loadPlugins(dir, ['./nonexistent.js']),
      /Cannot find module/
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('collectPluginContributions collects items from a valid hook', () => {
  const plugins = [{
    name: 'test-plugin.js',
    path: '/mock',
    module: {
      registerTaskDetectors: () => [
        { id: 'custom-task-1', text: 'Custom task', checked: false }
      ]
    }
  }];

  const results = collectPluginContributions(plugins, 'registerTaskDetectors', {});
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'custom-task-1');
});

test('collectPluginContributions passes context object to hook', () => {
  let received;
  const plugins = [{
    name: 'ctx-plugin.js',
    path: '/mock',
    module: {
      registerTaskDetectors: (ctx) => { received = ctx; return []; }
    }
  }];

  const context = { projectRoot: '/my/project', files: ['src/index.js'] };
  collectPluginContributions(plugins, 'registerTaskDetectors', context);
  assert.deepEqual(received, context);
});

test('collectPluginContributions skips plugin when hook is not defined', () => {
  const plugins = [{
    name: 'partial-plugin.js',
    path: '/mock',
    module: { registerValidators: () => [] }
  }];

  const results = collectPluginContributions(plugins, 'registerTaskDetectors', {});
  assert.equal(results.length, 0);
});

test('collectPluginContributions skips hook return values that are not arrays', () => {
  const plugins = [{
    name: 'bad-return-plugin.js',
    path: '/mock',
    module: { registerTaskDetectors: () => 'not-an-array' }
  }];

  const results = collectPluginContributions(plugins, 'registerTaskDetectors', {});
  assert.equal(results.length, 0);
});

test('collectPluginContributions throws clear error identifying the failing plugin and hook', () => {
  const plugins = [{
    name: 'broken-plugin.js',
    path: '/mock',
    module: {
      registerTaskDetectors: () => { throw new Error('internal failure'); }
    }
  }];

  assert.throws(
    () => collectPluginContributions(plugins, 'registerTaskDetectors', {}),
    /Plugin "broken-plugin.js" failed in hook "registerTaskDetectors": internal failure/
  );
});

test('collectPluginContributions collects from multiple plugins in order', () => {
  const plugins = [
    {
      name: 'plugin-a.js',
      path: '/mock-a',
      module: { registerTaskDetectors: () => [{ id: 'a-1', text: 'Alpha task', checked: false }] }
    },
    {
      name: 'plugin-b.js',
      path: '/mock-b',
      module: { registerTaskDetectors: () => [{ id: 'b-1', text: 'Beta task', checked: false }] }
    }
  ];

  const results = collectPluginContributions(plugins, 'registerTaskDetectors', {});
  assert.equal(results.length, 2);
  assert.equal(results[0].id, 'a-1');
  assert.equal(results[1].id, 'b-1');
});
