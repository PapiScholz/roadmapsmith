'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildReleaseSection,
  updateChangelog,
  UNRELEASED_PLACEHOLDER
} = require('../scripts/generate-changelog');
const {
  prepareReleaseVersion
} = require('../scripts/release-version');
const {
  runAutoRelease
} = require('../scripts/auto-release');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createReleaseFixture(version = '1.2.3') {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmapsmith-release-'));
  const packageRoot = path.join(repoRoot, 'roadmap-skill');
  fs.mkdirSync(packageRoot, { recursive: true });

  writeJson(path.join(packageRoot, 'package.json'), {
    name: 'roadmapsmith',
    version,
    description: 'test package',
    author: 'PapiScholz',
    license: 'MIT',
    homepage: 'https://example.com',
    repository: {
      type: 'git',
      url: 'https://example.com/repo.git'
    },
    keywords: ['roadmap'],
    files: []
  });
  writeJson(path.join(packageRoot, 'package-lock.json'), {
    name: 'roadmapsmith',
    version,
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': {
        name: 'roadmapsmith',
        version
      }
    }
  });

  fs.writeFileSync(
    path.join(packageRoot, 'CHANGELOG.md'),
    [
      '# Changelog',
      '',
      '## Unreleased',
      '',
      '- None yet.',
      '',
      `## v${version} - 2026-06-17`,
      '',
      '### Changed',
      '- Previous release.',
      ''
    ].join('\n'),
    'utf8'
  );

  writeJson(path.join(repoRoot, 'skills.json'), {
    install: {
      command: 'npx skills add'
    },
    skills: [
      { name: 'roadmap', path: 'skills/roadmap', version }
    ]
  });
  writeJson(path.join(repoRoot, '.claude-plugin', 'plugin.json'), {
    name: 'roadmapsmith',
    version
  });
  writeJson(path.join(repoRoot, '.codex-plugin', 'plugin.json'), {
    name: 'roadmapsmith',
    version,
    interface: {
      displayName: 'RoadmapSmith'
    }
  });
  writeJson(path.join(repoRoot, 'plugins', 'roadmapsmith', '.codex-plugin', 'plugin.json'), {
    name: 'roadmapsmith',
    version
  });

  return { repoRoot, packageRoot };
}

function createRunner(handlers, calls) {
  return {
    run(command, args, options = {}) {
      const key = [command, ...(args || [])].join(' ');
      calls.push({ command, args, cwd: options.cwd, key });
      const handler = handlers[key];
      if (!handler) {
        return { status: 0, stdout: '', stderr: '', error: null };
      }
      const result = typeof handler === 'function' ? handler({ command, args, options, calls }) : handler;
      return {
        status: typeof result.status === 'number' ? result.status : 0,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        error: result.error || null
      };
    }
  };
}

test('prepareReleaseVersion bumps patch and syncs version surfaces', () => {
  const fixture = createReleaseFixture('1.2.3');
  const result = prepareReleaseVersion({
    repoRoot: fixture.repoRoot,
    packageRoot: fixture.packageRoot,
    commitMessage: 'feat: publish automatically on main',
    write: true
  });

  assert.equal(result.mode, 'normal');
  assert.equal(result.previousVersion, '1.2.3');
  assert.equal(result.version, '1.2.4');

  const packageJson = JSON.parse(fs.readFileSync(path.join(fixture.packageRoot, 'package.json'), 'utf8'));
  const packageLock = JSON.parse(fs.readFileSync(path.join(fixture.packageRoot, 'package-lock.json'), 'utf8'));
  const skillsManifest = JSON.parse(fs.readFileSync(path.join(fixture.repoRoot, 'skills.json'), 'utf8'));
  const claudePlugin = JSON.parse(fs.readFileSync(path.join(fixture.repoRoot, '.claude-plugin', 'plugin.json'), 'utf8'));
  const codexPlugin = JSON.parse(fs.readFileSync(path.join(fixture.repoRoot, '.codex-plugin', 'plugin.json'), 'utf8'));
  const marketplacePlugin = JSON.parse(fs.readFileSync(path.join(fixture.repoRoot, 'plugins', 'roadmapsmith', '.codex-plugin', 'plugin.json'), 'utf8'));

  assert.equal(packageJson.version, '1.2.4');
  assert.equal(packageLock.version, '1.2.4');
  assert.equal(packageLock.packages[''].version, '1.2.4');
  assert.equal(skillsManifest.skills[0].version, '1.2.4');
  assert.equal(claudePlugin.version, '1.2.4');
  assert.equal(codexPlugin.version, '1.2.4');
  assert.equal(marketplacePlugin.version, '1.2.4');
});

test('prepareReleaseVersion keeps release commits in repair mode without bumping twice', () => {
  const fixture = createReleaseFixture('1.2.4');
  const result = prepareReleaseVersion({
    repoRoot: fixture.repoRoot,
    packageRoot: fixture.packageRoot,
    commitMessage: 'chore(release): v1.2.4 [skip ci]',
    write: true
  });

  const packageJson = JSON.parse(fs.readFileSync(path.join(fixture.packageRoot, 'package.json'), 'utf8'));
  assert.equal(result.mode, 'repair');
  assert.equal(result.version, '1.2.4');
  assert.equal(packageJson.version, '1.2.4');
  assert.deepEqual(result.changedFiles, []);
});

test('buildReleaseSection groups commits and falls back to Changed while excluding release commits', () => {
  const section = buildReleaseSection({
    version: '1.2.4',
    date: '2026-06-18',
    subjects: [
      'feat(cli): add release automation',
      'fix(ci): keep release idempotent',
      'docs: explain auto patching',
      'ship the docs cleanup',
      'chore(release): v1.2.4 [skip ci]'
    ]
  });

  assert.match(section, /## v1\.2\.4 - 2026-06-18/);
  assert.match(section, /### Added/);
  assert.match(section, /- \(cli\) add release automation/);
  assert.match(section, /### Fixed/);
  assert.match(section, /- \(ci\) keep release idempotent/);
  assert.match(section, /### Changed/);
  assert.match(section, /- explain auto patching/);
  assert.match(section, /- ship the docs cleanup/);
  assert.doesNotMatch(section, /chore\(release\)/);
});

test('updateChangelog resets Unreleased and inserts the generated version section', () => {
  const content = [
    '# Changelog',
    '',
    '## Unreleased',
    '',
    '### Added',
    '- Placeholder',
    '',
    '## v1.2.3 - 2026-06-17',
    '',
    '### Changed',
    '- Previous release.',
    ''
  ].join('\n');

  const updated = updateChangelog({
    version: '1.2.4',
    date: '2026-06-18',
    subjects: ['feat: add automated publishing'],
    existingContent: content
  });

  assert.match(updated.content, new RegExp(`## Unreleased\\n\\n${UNRELEASED_PLACEHOLDER.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}`));
  assert.match(updated.content, /## v1\.2\.4 - 2026-06-18/);
  assert.match(updated.content, /### Added/);
  assert.match(updated.notes, /## v1\.2\.4 - 2026-06-18/);
});

test('runAutoRelease normal mode simulates bump, commit, publish, and GitHub Release creation', () => {
  const fixture = createReleaseFixture('1.2.3');
  const calls = [];
  const runner = createRunner({
    'git log -1 --pretty=%s': { stdout: 'feat: auto patch releases\n' },
    'git describe --tags --abbrev=0': { stdout: 'v1.2.3\n' },
    'git log --pretty=%s --reverse v1.2.3..HEAD': {
      stdout: 'feat: auto patch releases\nfix: keep release idempotent\ndocs: explain main publish contract\n'
    },
    'git rev-parse -q --verify refs/tags/v1.2.4': { status: 1, stderr: 'missing\n' },
    'npm view roadmapsmith version': { stdout: '1.2.3\n' },
    'gh release view v1.2.4': { status: 1, stderr: 'missing release\n' }
  }, calls);

  const report = runAutoRelease({
    runner,
    repoRoot: fixture.repoRoot,
    packageRoot: fixture.packageRoot,
    now: new Date('2026-06-18T10:00:00Z')
  });

  assert.equal(report.mode, 'normal');
  assert.equal(report.version, '1.2.4');
  assert.equal(JSON.parse(fs.readFileSync(path.join(fixture.packageRoot, 'package.json'), 'utf8')).version, '1.2.4');
  assert.match(fs.readFileSync(path.join(fixture.packageRoot, 'CHANGELOG.md'), 'utf8'), /## v1\.2\.4 - 2026-06-18/);
  assert.ok(calls.some((call) => call.key === 'git commit -m chore(release): v1.2.4 [skip ci]'));
  assert.ok(calls.some((call) => call.key === 'npm publish --access public'));
  assert.ok(calls.some((call) => call.key.startsWith('gh release create v1.2.4 --title v1.2.4 --notes-file ')));
});

test('runAutoRelease repair mode republishes missing artifacts without a second bump or commit', () => {
  const fixture = createReleaseFixture('1.2.4');
  fs.writeFileSync(
    path.join(fixture.packageRoot, 'CHANGELOG.md'),
    [
      '# Changelog',
      '',
      '## Unreleased',
      '',
      '- None yet.',
      '',
      '## v1.2.4 - 2026-06-18',
      '',
      '### Changed',
      '- Maintenance release.',
      ''
    ].join('\n'),
    'utf8'
  );

  const calls = [];
  const runner = createRunner({
    'git log -1 --pretty=%s': { stdout: 'chore(release): v1.2.4 [skip ci]\n' },
    'git rev-parse -q --verify refs/tags/v1.2.4': { stdout: 'refs/tags/v1.2.4\n' },
    'npm view roadmapsmith version': { stdout: '1.2.3\n' },
    'gh release view v1.2.4': { status: 1, stderr: 'missing release\n' }
  }, calls);

  const report = runAutoRelease({
    runner,
    repoRoot: fixture.repoRoot,
    packageRoot: fixture.packageRoot,
    now: new Date('2026-06-18T10:00:00Z')
  });

  assert.equal(report.mode, 'repair');
  assert.equal(report.version, '1.2.4');
  assert.equal(JSON.parse(fs.readFileSync(path.join(fixture.packageRoot, 'package.json'), 'utf8')).version, '1.2.4');
  assert.ok(!calls.some((call) => call.command === 'git' && call.args[0] === 'commit'));
  assert.ok(!calls.some((call) => call.command === 'git' && call.args[0] === 'add'));
  assert.ok(calls.some((call) => call.key === 'npm publish --access public'));
  assert.ok(calls.some((call) => call.key.startsWith('gh release create v1.2.4 --title v1.2.4 --notes-file ')));
});

test('release workflow contract keeps auto-release on push to main with serialized release concurrency', () => {
  const workflow = fs.readFileSync(path.join(REPO_ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');

  assert.match(workflow, /on:\s*\n\s*push:\s*\n\s*branches:\s*\n\s*-\s*main/);
  assert.match(workflow, /if:\s*github\.ref == 'refs\/heads\/main' && github\.event_name == 'push'/);
  assert.match(workflow, /concurrency:\s*\n\s*group:\s*release-main/);
  assert.match(workflow, /node roadmap-skill\/scripts\/auto-release\.js/);
});

test('release docs describe automatic patch publishing on every main push', () => {
  const docs = [
    fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8'),
    fs.readFileSync(path.join(REPO_ROOT, 'roadmap-skill', 'README.md'), 'utf8'),
    fs.readFileSync(path.join(REPO_ROOT, 'docs', 'release-readiness.md'), 'utf8'),
    fs.readFileSync(path.join(REPO_ROOT, 'docs', 'release-ux-gate.md'), 'utf8')
  ].join('\n');

  assert.match(docs, /every successful push to `main` publishes a new patch release/i);
  assert.doesNotMatch(docs, /npm version patch\s+# or minor \/ major/i);
});
