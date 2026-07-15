'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  PACKAGE_ROOT,
  REPO_ROOT,
  buildReleaseCommitMessage,
  buildReleaseTag,
  prepareReleaseVersion
} = require('./release-version');
const { extractReleaseNotes, formatDate, updateChangelog } = require('./generate-changelog');

function createProcessRunner(spawn = spawnSync) {
  return {
    run(command, args, options = {}) {
      const result = spawn(command, args, {
        cwd: options.cwd,
        env: options.env || process.env,
        encoding: 'utf8'
      });

      return {
        status: typeof result.status === 'number' ? result.status : (result.error ? 1 : 0),
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        error: result.error || null
      };
    }
  };
}

function trimOutput(text) {
  return String(text || '').trim();
}

function buildCommandString(command, args) {
  return [command, ...(args || [])]
    .map((part) => (/\s/.test(String(part)) ? JSON.stringify(String(part)) : String(part)))
    .join(' ');
}

function runChecked(runner, command, args, options = {}, expectedExitCodes = [0]) {
  const result = runner.run(command, args, options);
  if (result.error) {
    throw result.error;
  }
  if (!expectedExitCodes.includes(result.status)) {
    const details = trimOutput(result.stderr) || trimOutput(result.stdout);
    throw new Error(`${buildCommandString(command, args)} exited with ${result.status}.${details ? ` ${details}` : ''}`);
  }
  return result;
}

function tryReadPublishedVersion(runner, packageRoot) {
  const result = runner.run('npm', ['view', 'roadmapsmith', 'version'], { cwd: packageRoot });
  if (result.error) {
    throw result.error;
  }
  if (result.status === 0) {
    return trimOutput(result.stdout);
  }
  if (/E404/i.test(result.stderr)) {
    return null;
  }
  throw new Error(`Failed to query npm for the published roadmapsmith version. ${trimOutput(result.stderr)}`);
}

function hasGitHubRelease(runner, repoRoot, tag) {
  const result = runner.run('gh', ['release', 'view', tag], { cwd: repoRoot, env: process.env });
  if (result.error) {
    throw result.error;
  }
  return result.status === 0;
}

function getHeadCommitSubject(runner, repoRoot) {
  return trimOutput(runChecked(runner, 'git', ['log', '-1', '--pretty=%s'], { cwd: repoRoot }).stdout);
}

function getPreviousTag(runner, repoRoot) {
  const result = runner.run('git', ['describe', '--tags', '--abbrev=0'], { cwd: repoRoot });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    return null;
  }
  return trimOutput(result.stdout);
}

function getCommitSubjects(runner, repoRoot, previousTag) {
  // v0.13.5: capture subject + body per commit so buildReleaseSection can render
  // body lines that start with `- ` as CHANGELOG sub-bullets.
  // %x1e = record separator between commits, %x1f = unit separator between subject and body.
  const args = ['log', '--pretty=%s%x1f%b%x1e', '--reverse'];
  if (previousTag) {
    args.push(`${previousTag}..HEAD`);
  }
  const output = runChecked(runner, 'git', args, { cwd: repoRoot }).stdout;
  return output
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [subject = '', body = ''] = record.split('\x1f');
      return { subject: subject.trim(), body: body.trim() };
    })
    .filter((entry) => entry.subject.length > 0);
}

function ensureLocalTag(runner, repoRoot, tag) {
  const existing = runner.run('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], { cwd: repoRoot });
  if (existing.error) {
    throw existing.error;
  }
  if (existing.status === 0) {
    return false;
  }
  runChecked(runner, 'git', ['tag', tag], { cwd: repoRoot });
  return true;
}

function buildReleaseBranchName(version) {
  return `release/v${version}`;
}

function writeReleaseNotesFile(notes) {
  const filePath = path.join(os.tmpdir(), `roadmapsmith-release-notes-${process.pid}.md`);
  fs.writeFileSync(filePath, `${String(notes || '').trim()}\n`, 'utf8');
  return filePath;
}

function ensurePublishedArtifacts(runner, options = {}) {
  const {
    repoRoot = REPO_ROOT,
    packageRoot = PACKAGE_ROOT,
    version,
    notes
  } = options;

  const tag = buildReleaseTag(version);
  const publishedVersion = tryReadPublishedVersion(runner, packageRoot);
  const published = publishedVersion === version;
  const gitHubReleasePresent = hasGitHubRelease(runner, repoRoot, tag);
  const notesFile = writeReleaseNotesFile(notes || `Release ${tag}`);

  if (!published) {
    runChecked(runner, 'npm', ['publish', '--access', 'public'], { cwd: packageRoot });
  }

  if (!gitHubReleasePresent) {
    runChecked(runner, 'gh', ['release', 'create', tag, '--title', tag, '--notes-file', notesFile], {
      cwd: repoRoot,
      env: process.env
    });
  }

  return {
    tag,
    publishedVersion,
    published,
    gitHubReleasePresent,
    publishNeeded: !published,
    githubReleaseNeeded: !gitHubReleasePresent,
    notesFile
  };
}

function pushReleaseBranch(runner, repoRoot, branchName) {
  runChecked(runner, 'git', ['push', '--force-with-lease', 'origin', `HEAD:refs/heads/${branchName}`], { cwd: repoRoot });
}

function findOpenPullRequest(runner, repoRoot, branchName) {
  const result = runChecked(runner, 'gh', [
    'pr',
    'list',
    '--state',
    'open',
    '--base',
    'main',
    '--head',
    branchName,
    '--json',
    'number,url,title'
  ], {
    cwd: repoRoot,
    env: process.env
  });

  const pullRequests = JSON.parse(result.stdout || '[]');
  return pullRequests[0] || null;
}

function ensureReleasePullRequest(runner, options = {}) {
  const {
    repoRoot = REPO_ROOT,
    branchName,
    version,
    notes
  } = options;

  const existing = findOpenPullRequest(runner, repoRoot, branchName);
  if (existing) {
    return {
      number: existing.number,
      url: existing.url,
      title: existing.title,
      created: false
    };
  }

  const body = [
    '## Summary',
    `- automated release PR for ${buildReleaseTag(version)}`,
    '- bumps package metadata and resets the changelog through the protected-branch path',
    '- merges back into `main` as the bot release commit, then the follow-up `main` run publishes npm and the GitHub Release in repair mode',
    '',
    '## Notes',
    notes || `Release ${buildReleaseTag(version)}`
  ].join('\n');

  const result = runChecked(runner, 'gh', [
    'pr',
    'create',
    '--base',
    'main',
    '--head',
    branchName,
    '--title',
    buildReleaseCommitMessage(version),
    '--body',
    body
  ], {
    cwd: repoRoot,
    env: process.env
  });

  return {
    number: null,
    url: trimOutput(result.stdout),
    title: buildReleaseCommitMessage(version),
    created: true
  };
}

function commitReleaseState(runner, repoRoot, version) {
  const files = [
    'roadmap-skill/package.json',
    'roadmap-skill/package-lock.json',
    'roadmap-skill/CHANGELOG.md',
    'skills.json',
    '.claude-plugin/plugin.json',
    '.codex-plugin/plugin.json',
    'plugins/roadmapsmith/.codex-plugin/plugin.json'
  ];

  runChecked(runner, 'git', ['add', '--', ...files], { cwd: repoRoot });
  runChecked(runner, 'git', ['commit', '-m', buildReleaseCommitMessage(version)], { cwd: repoRoot });
}

function runAutoRelease(options = {}) {
  const {
    runner = createProcessRunner(),
    repoRoot = REPO_ROOT,
    packageRoot = PACKAGE_ROOT,
    now = new Date()
  } = options;

  runChecked(runner, 'git', ['fetch', '--tags', 'origin', 'main'], { cwd: repoRoot });

  const commitMessage = getHeadCommitSubject(runner, repoRoot);
  const versionResult = prepareReleaseVersion({
    repoRoot,
    packageRoot,
    commitMessage,
    write: true
  });

  let notes;
  let previousTag = null;
  let releaseBranch = null;
  let pullRequest = null;
  let publication = null;

  if (versionResult.mode === 'normal') {
    previousTag = getPreviousTag(runner, repoRoot);
    const subjects = getCommitSubjects(runner, repoRoot, previousTag);
    notes = updateChangelog({
      packageRoot,
      version: versionResult.version,
      date: formatDate(now),
      subjects,
      write: true
    }).notes;

    releaseBranch = buildReleaseBranchName(versionResult.version);
    runChecked(runner, 'git', ['checkout', '-B', releaseBranch], { cwd: repoRoot });
    commitReleaseState(runner, repoRoot, versionResult.version);
    pushReleaseBranch(runner, repoRoot, releaseBranch);
    pullRequest = ensureReleasePullRequest(runner, {
      repoRoot,
      branchName: releaseBranch,
      version: versionResult.version,
      notes
    });
  } else {
    ensureLocalTag(runner, repoRoot, versionResult.tag);
    runChecked(runner, 'git', ['push', 'origin', `refs/tags/${versionResult.tag}`], { cwd: repoRoot });
    const changelogContent = fs.readFileSync(path.join(packageRoot, 'CHANGELOG.md'), 'utf8');
    notes = extractReleaseNotes(changelogContent, versionResult.version);
    publication = ensurePublishedArtifacts(runner, {
      repoRoot,
      packageRoot,
      version: versionResult.version,
      notes
    });
  }

  return {
    mode: versionResult.mode,
    previousVersion: versionResult.previousVersion,
    version: versionResult.version,
    tag: versionResult.tag,
    previousTag,
    releaseBranch,
    pullRequest,
    publication
  };
}

function main(argv = process.argv.slice(2)) {
  const json = argv.includes('--json');
  const report = runAutoRelease();

  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  process.stdout.write(`mode=${report.mode} version=${report.version} tag=${report.tag}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  PACKAGE_ROOT,
  REPO_ROOT,
  buildCommandString,
  commitReleaseState,
  createProcessRunner,
  ensureLocalTag,
  ensurePublishedArtifacts,
  ensureReleasePullRequest,
  findOpenPullRequest,
  getCommitSubjects,
  getHeadCommitSubject,
  getPreviousTag,
  hasGitHubRelease,
  main,
  buildReleaseBranchName,
  pushReleaseBranch,
  runAutoRelease,
  runChecked,
  tryReadPublishedVersion,
  writeReleaseNotesFile
};
