const { spawn } = require('child_process');
const { Mutex } = require('async-mutex');
const fse = require('fs-extra');

const CI_HOST = 'github.com';
const CI_WORKFLOW = 'ci-tests.yml';

function progName(base) {
  return (process.platform === 'win32') ? `${base}.exe` : base;
}

class FailureError extends Error {
  constructor(progDesc, code) {
    super(`'${progDesc}' exited with code ${code}`);
    this.code = code;
  }
}

class SignalError extends Error {
  constructor(progDesc, signal) {
    super(`'${progDesc}' terminated with signal ${signal}`);
    this.signal = signal;
  }
}

const gitMutex = new Mutex();
async function gitOutput(args) {
  return gitMutex.runExclusive(() => new Promise(function(resolve, reject) {
    const gitProg = progName('git'), subcmd = args.find(a => !a.startsWith('-'));
    const gitProc = spawn(gitProg, args, {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    function reportError(errType, detail) {
      reject(new errType(`${gitProg} ${subcmd}`, detail));
    }
    
    let output = '';
    gitProc.stdout.on('data', (data) => {
      output += data;
    });
    gitProc.on('error', (err) => {
      reject(err);
    });
    gitProc.on('exit', (code, signal) => {
      if (code === 0) {
        resolve(output);
      } else if (signal) {
        reportError(SignalError, signal);
      } else {
        reportError(FailureError, code);
      }
    });
  }));
}
exports.gitOutput = gitOutput;

async function gitStatusLines() {
  const output = await gitOutput(['status', '--porcelain=2']);
  const lines = output.split('\n');
  if (lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

async function isDirty() {
  const statLines = await gitStatusLines();
  return statLines.some(line => /^[12u?]/.test(line));
}

async function isLocal() {
  const pubBranches = await gitOutput(['branch', '-r', '--contains', 'HEAD']);
  return pubBranches.split('\n').findIndex(l => /^\s*origin\//.test(l)) < 0;
}

const branchOfCurrentVersion = (function() {
  const version = process.env.npm_package_version;
  const branch = 'version/' + version.replace(/\..*/, '.x');
  return branch;
}());

function getRepositoryInfo() {
  let { repository } = require('../package.json');
  if (repository.type !== 'git') {
    return { type: repository.type };
  }
  if (repository.url.startsWith('git+')) {
    repository = {
      ...repository,
      url: repository.url.slice(4),
    };
  }
  return repository;
}

async function isOffVersionBranch() {
  const repository = getRepositoryInfo();
  if (repository.type !== 'git') {
    return true; // This function is very broken if git is not the VCS for this library
  }
  const remoteRef = (await gitOutput(
    ['ls-remote', repository.url, `refs/heads/${branchOfCurrentVersion}`]
  )).trim();
  if (!remoteRef) {
    return true;
  }
  const [ remoteVerBranchHash ] = remoteRef.split('\t');
  const logOutput = await gitOutput(
    ['log', '-n1', '--oneline', `${remoteVerBranchHash}..HEAD`]
  );
  return !!logOutput;
}

const urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&/=]*[-a-zA-Z0-9(@:%_\+.~#?&/=])?/;

function ensureGlobalFlag(flags) {
  return flags.includes('g') ? flags : flags + 'g';
}

async function isWrongCIBadge() {
  const readme = await fse.readFile('README.md', 'utf8'),
    repository = getRepositoryInfo();
  if (!repository.url) {
    return true;
  }
  const repoMatch = /^(?:git\+)?https:\/\/github.com\/([a-zA-Z0-9.-]+\/[a-zA-Z0-9.-]+)$/.exec(repository.url);
  if (!repoMatch) {
    return true;
  }
  const accountAndRepo = (function() {
    const captured = repoMatch[1];
    return captured.endsWith('.git') ? captured.slice(0, -4) : captured;
  }());
  const readmeUrls = readme.match(
    new RegExp(urlPattern.source, ensureGlobalFlag(urlPattern.flags))
  );
  return !readmeUrls.some(url => {
    url = new URL(url);
    if (url.host !== CI_HOST) return false;
    if (url.pathname !== `/${accountAndRepo}/actions/workflows/${CI_WORKFLOW}/badge.svg`) return false;
    if (url.searchParams.get('branch') !== branchOfCurrentVersion) return false;
    return true;
  })
}

async function main() {
  let errors = 0;
  function check(tester, message) {
    return Promise.resolve(tester()).then(testResult => {
      if (testResult) {
        ++errors;
        console.error('[*ERROR*]', message);
      }
      return testResult;
    });
  }
  const pkgVer = process.env.npm_package_version;
  const tasks = [
    check(isDirty, "Working tree has local modifications or untracked files."),
    // check(isLocal, "HEAD commit has not been published to a remote."),
    check(isOffVersionBranch,
      `HEAD (version ${pkgVer}) is not in '${branchOfCurrentVersion}' of project repository.`),
    check(isWrongCIBadge, `README.md uses the wrong branch for the CI badge.`),
  ];
  await Promise.all(tasks);
  process.exitCode = (errors > 0) ? 1 : 0;
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}
