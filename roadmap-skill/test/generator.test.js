'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { generateRoadmapDocument } = require('../src/generator');
const { loadConfig } = require('../src/config');
const { renderBody } = require('../src/renderer');
const { createRoadmapModel } = require('../src/model');

function setupFixture(name) {
  const source = path.resolve(__dirname, 'fixtures', name);
  const target = fs.mkdtempSync(path.join(os.tmpdir(), `roadmap-skill-${name}-`));
  fs.cpSync(source, target, { recursive: true });
  return target;
}

function makeMinimalModel(overrides = {}) {
  const defaultPhasesDetailed = [
    {
      phaseNumber: 1,
      title: 'Foundation',
      priority: 'P0',
      objective: 'Foundation objective',
      steps: [{
        stepNumber: 1,
        title: 'Core',
        priority: 'P0',
        dependsOn: [],
        objective: 'Core objective',
        tasks: [{ id: 'prof-task-core-task', text: 'Core task', priority: 'P0' }],
        exitCriteria: [{ text: 'Core complete', priority: 'P0' }],
        risks: []
      }]
    },
    {
      phaseNumber: 2,
      title: 'Features',
      priority: 'P1',
      objective: 'Features objective',
      steps: [{
        stepNumber: 1,
        title: 'Feature delivery',
        priority: 'P1',
        dependsOn: [1],
        objective: 'Deliver features',
        tasks: [{ id: 'prof-task-feature-task', text: 'Feature task', priority: 'P1' }],
        exitCriteria: [{ text: 'Features done', priority: 'P1' }],
        risks: []
      }]
    },
    {
      phaseNumber: 3,
      title: 'Hardening',
      priority: 'P2',
      objective: 'Hardening objective',
      steps: [{
        stepNumber: 1,
        title: 'Harden',
        priority: 'P2',
        dependsOn: [2],
        objective: 'Harden release',
        tasks: [{ id: 'prof-task-harden-task', text: 'Harden task', priority: 'P2' }],
        exitCriteria: [{ text: 'Hardening complete', priority: 'P2' }],
        risks: []
      }]
    }
  ];

  return createRoadmapModel({
    northStar: 'Test north star',
    product: { name: 'Test', northStar: 'Test north star', ...((overrides.product) || {}) },
    currentState: {
      implemented: ['10 files'],
      scaffold: [],
      knownLimitations: [],
      implementedSummary: '10 files',
      todoSummary: '0 TODOs',
      stackSummary: 'JavaScript'
    },
    phases: { P0: [], P1: [], P2: [] },
    steps: overrides.steps || [],
    phasesDetailed: overrides.phasesDetailed || defaultPhasesDetailed,
    milestones: [{ version: 'v1.0', goal: 'Done' }],
    commandBreakdown: overrides.commandBreakdown || [],
    exitCriteria: [],
    risks: ['Risk 1'],
    antiGoals: ['Anti-goal 1'],
    successCriteria: ['Criterion 1'],
    customSections: [],
    checkedById: overrides.checkedById || {}
  });
}

test('generator outputs deterministic managed roadmap', () => {
  const projectRoot = setupFixture('node');
  const config = loadConfig({ projectRoot });

  const first = generateRoadmapDocument({
    projectRoot,
    roadmapPath: path.join(projectRoot, 'ROADMAP.md'),
    existingContent: '',
    config,
    plugins: []
  });

  const second = generateRoadmapDocument({
    projectRoot,
    roadmapPath: path.join(projectRoot, 'ROADMAP.md'),
    existingContent: first,
    config,
    plugins: []
  });

  assert.equal(first, second);
  assert.match(first, /## Product North Star/);
  assert.match(first, /## Phased Roadmap/);
  assert.match(first, /<!-- rs:task=/);
});

test('compact profile preserves current expected output structure', () => {
  const projectRoot = setupFixture('node');
  const config = loadConfig({ projectRoot });

  const output = generateRoadmapDocument({
    projectRoot,
    existingContent: '',
    config,
    plugins: []
  });

  assert.match(output, /## Phased Roadmap/);
  assert.match(output, /### Phase P0/);
  assert.match(output, /### Phase P1/);
  assert.match(output, /### Phase P2/);
  assert.match(output, /<!-- rs:task=/);
  assert.doesNotMatch(output, /## 1\. Product North Star/);
});

test('professional profile renders all 12 required sections', () => {
  const projectRoot = setupFixture('node');
  const config = { ...loadConfig({ projectRoot }), roadmapProfile: 'professional', product: { name: 'TestPro' } };

  const output = generateRoadmapDocument({
    projectRoot,
    existingContent: '',
    config,
    plugins: []
  });

  for (let i = 1; i <= 12; i += 1) {
    assert.match(output, new RegExp(`## ${i}\\.`), `Section ${i} missing`);
  }
});

test('professional profile renders Section 4 as Phase → Step → Task hierarchy', () => {
  const model = makeMinimalModel();
  const output = renderBody(model, 'professional');

  assert.match(output, /### Phase 1:/, 'Missing Phase 1 header');
  assert.match(output, /### Phase 2:/, 'Missing Phase 2 header');
  assert.match(output, /#### Step 1\.1:/, 'Missing Step 1.1 header');
  assert.match(output, /\*\*Tasks:\*\*/, 'Missing Tasks section');
  assert.doesNotMatch(output, /### Phase P0/, 'Compact phase headers must not appear in professional output');
});

test('professional Section 4 phases render in phaseNumber order regardless of priority', () => {
  const phasesDetailed = [
    {
      phaseNumber: 1, title: 'Alpha', priority: 'P2', objective: '',
      steps: [{ stepNumber: 1, title: 'A1', priority: 'P2', dependsOn: [], objective: '', tasks: [], exitCriteria: [], risks: [] }]
    },
    {
      phaseNumber: 2, title: 'Beta', priority: 'P3', objective: '',
      steps: [{ stepNumber: 1, title: 'B1', priority: 'P3', dependsOn: [], objective: '', tasks: [], exitCriteria: [], risks: [] }]
    },
    {
      phaseNumber: 3, title: 'Gamma', priority: 'P0', objective: '',
      steps: [{ stepNumber: 1, title: 'G1', priority: 'P0', dependsOn: [], objective: '', tasks: [], exitCriteria: [], risks: [] }]
    }
  ];
  const model = makeMinimalModel({ phasesDetailed });
  const output = renderBody(model, 'professional');

  const ph1Pos = output.indexOf('### Phase 1:');
  const ph2Pos = output.indexOf('### Phase 2:');
  const ph3Pos = output.indexOf('### Phase 3:');
  assert.ok(ph1Pos < ph2Pos, 'Phase 1 must appear before Phase 2');
  assert.ok(ph2Pos < ph3Pos, 'Phase 2 must appear before Phase 3');
  assert.match(output, /### Phase 3: Gamma[\s\S]*?\*\*Phase Priority:\*\* `\[P0\]`/);
});

test('checked task state survives regeneration in compact mode', () => {
  const projectRoot = setupFixture('node');
  const config = loadConfig({ projectRoot });

  const first = generateRoadmapDocument({ projectRoot, existingContent: '', config, plugins: [] });
  const taskIdMatch = first.match(/<!-- rs:task=([a-z0-9-]+) -->/);
  assert.ok(taskIdMatch, 'Expected at least one rs:task ID');
  const taskId = taskIdMatch[1];

  const withChecked = first.replace(
    new RegExp(`- \\[ \\] (.*?) <!-- rs:task=${taskId} -->`),
    `- [x] $1 <!-- rs:task=${taskId} -->`
  );

  const regenerated = generateRoadmapDocument({ projectRoot, existingContent: withChecked, config, plugins: [] });
  assert.match(regenerated, new RegExp(`- \\[x\\] .*<!-- rs:task=${taskId} -->`));
});

test('checked task state survives regeneration in professional mode', () => {
  const projectRoot = setupFixture('node');
  const config = { ...loadConfig({ projectRoot }), roadmapProfile: 'professional', product: { name: 'TestPro' } };

  const first = generateRoadmapDocument({ projectRoot, existingContent: '', config, plugins: [] });
  const taskIdMatch = first.match(/<!-- rs:task=([a-z0-9-]+) -->/);
  assert.ok(taskIdMatch, 'Expected at least one rs:task ID');
  const taskId = taskIdMatch[1];

  const withChecked = first.replace(
    new RegExp(`- \\[ \\] (.*?) <!-- rs:task=${taskId} -->`),
    `- [x] $1 <!-- rs:task=${taskId} -->`
  );

  const regenerated = generateRoadmapDocument({ projectRoot, existingContent: withChecked, config, plugins: [] });
  assert.match(regenerated, new RegExp(`- \\[x\\] .*<!-- rs:task=${taskId} -->`));
});

test('config product.northStar overrides generic default in professional mode', () => {
  const projectRoot = setupFixture('node');
  const config = {
    ...loadConfig({ projectRoot }),
    roadmapProfile: 'professional',
    product: { name: 'TestPro', northStar: 'My custom north star for testing' }
  };

  const output = generateRoadmapDocument({ projectRoot, existingContent: '', config, plugins: [] });
  assert.match(output, /My custom north star for testing/);
});

test('professional output includes stable rs:task IDs with prof- prefix', () => {
  const projectRoot = setupFixture('node');
  const config = { ...loadConfig({ projectRoot }), roadmapProfile: 'professional', product: { name: 'TestPro' } };

  const output = generateRoadmapDocument({ projectRoot, existingContent: '', config, plugins: [] });
  assert.match(output, /rs:task=prof-/, 'Expected prof- prefixed rs:task IDs from professional renderer');
});

test('enterprise profile throws a clear error', () => {
  const model = makeMinimalModel();
  assert.throws(
    () => renderBody(model, 'enterprise'),
    (err) => {
      assert.ok(err.message.includes('enterprise'), 'Error should mention "enterprise"');
      assert.ok(err.message.includes('not yet implemented'), 'Error should mention "not yet implemented"');
      return true;
    }
  );
});

test('task-level priorities are displayed in professional output', () => {
  const phasesDetailed = [{
    phaseNumber: 1, title: 'Test', priority: 'P1', objective: '',
    steps: [{
      stepNumber: 1, title: 'Step', priority: 'P2', dependsOn: [], objective: '',
      tasks: [
        { id: 'prof-task-high-prio', text: 'High priority task', priority: 'P0' },
        { id: 'prof-task-low-prio', text: 'Low priority task', priority: 'P2' }
      ],
      exitCriteria: [],
      risks: []
    }]
  }];
  const model = makeMinimalModel({ phasesDetailed });
  const output = renderBody(model, 'professional');

  assert.match(output, /`\[P0\]` High priority task/, 'P0 task must show [P0] label');
  assert.match(output, /`\[P2\]` Low priority task/, 'P2 task must show [P2] label');
});

test('Step priority and Task priority can differ', () => {
  const phasesDetailed = [{
    phaseNumber: 1, title: 'Test', priority: 'P1', objective: '',
    steps: [{
      stepNumber: 1, title: 'Low priority step', priority: 'P2', dependsOn: [], objective: '',
      tasks: [
        { id: 'prof-task-urgent-in-low-step', text: 'Urgent task in low-priority step', priority: 'P0' }
      ],
      exitCriteria: [],
      risks: []
    }]
  }];
  const model = makeMinimalModel({ phasesDetailed });
  const output = renderBody(model, 'professional');

  assert.match(output, /\*\*Step Priority:\*\* `\[P2\]`/, 'Step header must show P2');
  assert.match(output, /`\[P0\]` Urgent task in low-priority step/, 'Task must show P0 inside P2 step');
});

test('Known Limitations does not include doc-only TODO mentions', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-doc-todo-'));
  fs.mkdirSync(path.join(projectRoot, 'src'));
  fs.writeFileSync(path.join(projectRoot, 'README.md'), '# Test\n\nTODO: add more docs here\nTODO: document this feature\n');
  fs.writeFileSync(path.join(projectRoot, 'package.json'), JSON.stringify({ name: 'test-pkg', version: '1.0.0' }));

  const config = { ...loadConfig({ projectRoot }), roadmapProfile: 'professional', product: { name: 'Test' } };
  const output = generateRoadmapDocument({ projectRoot, existingContent: '', config, plugins: [] });

  const knownLimitSection = output.match(/### Known Limitations([\s\S]*?)###/);
  if (knownLimitSection) {
    assert.doesNotMatch(knownLimitSection[1], /add more docs here/, 'Doc-only TODO must not appear in Known Limitations');
  }
});

test('Command/Module Maturity lists actual modules not generic placeholder', () => {
  const model = makeMinimalModel({ commandBreakdown: ['Module: generator', 'Module: parser', 'Module: renderer'] });
  const output = renderBody(model, 'professional');

  assert.doesNotMatch(output, /Identify command\/module boundaries for the next increment/,
    'Should not show generic placeholder when modules are detected');
  assert.match(output, /### generator/, 'Expected generator subsection');
  assert.match(output, /### parser/, 'Expected parser subsection');
});

test('checked state survives regeneration with task priority labels', () => {
  const phasesDetailed = [{
    phaseNumber: 1, title: 'Foundation', priority: 'P0', objective: '',
    steps: [{
      stepNumber: 1, title: 'Core', priority: 'P0', dependsOn: [], objective: '',
      tasks: [{ id: 'prof-task-test-priority-task', text: 'Priority task', priority: 'P0' }],
      exitCriteria: [],
      risks: []
    }]
  }];
  const model = makeMinimalModel({ phasesDetailed });
  const first = renderBody(model, 'professional');

  const withChecked = first.replace(
    /- \[ \] `\[P0\]` Priority task <!-- rs:task=prof-task-test-priority-task -->/,
    '- [x] `[P0]` Priority task <!-- rs:task=prof-task-test-priority-task -->'
  );

  const checkedById = { 'prof-task-test-priority-task': true };
  const model2 = makeMinimalModel({ phasesDetailed, checkedById });
  const regenerated = renderBody(model2, 'professional');

  assert.match(regenerated, /- \[x\] `\[P0\]` Priority task <!-- rs:task=prof-task-test-priority-task -->/);
});

test('sections 5-12 render priority labels on actionable items', () => {
  const projectRoot = setupFixture('node');
  const config = {
    ...loadConfig({ projectRoot }),
    roadmapProfile: 'professional',
    product: {
      name: 'TestPro',
      risks: ['A known risk'],
      successCriteria: ['Tests pass']
    }
  };

  const output = generateRoadmapDocument({ projectRoot, existingContent: '', config, plugins: [] });

  assert.match(output, /`\[P0\]`[\s\S]*<!-- rs:task=prof-/, 'Expected P0 priority labels on prof- task IDs in sections 5-12');
});
