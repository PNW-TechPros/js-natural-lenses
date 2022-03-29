const { spawn } = require('child_process');
const { Mutex } = require('async-mutex');

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
async function git(args, { captureOutput = false } = {}) {
  return gitMutex.runExclusive(() => new Promise(function(resolve, reject) {
    const gitProg = progName('git'), subcmd = args.find(a => !a.startsWith('-'));
    const gitProc = spawn(gitProg, args, {
      stdio: ['ignore', captureOutput ? 'pipe' : 'inherit', 'inherit'],
    });
    function reportError(errType, detail) {
      reject(new errType(`${gitProg} ${subcmd}`, detail));
    }
    
    let output = '';
    if (captureOutput) {
      gitProc.stdout.on('data', data => {
        output += data;
      });
    }
    
    gitProc.on('error', (err) => {
      reject(err);
    });
    gitProc.on('exit', (code, signal) => {
      if (code === 0) {
        if (captureOutput) {
          resolve(output);
        } else {
          resolve();
        }
      } else if (signal) {
        reportError(SignalError, signal);
      } else {
        reportError(FailureError, code);
      }
    });
  }));
}

async function gitOutput(args, options = {}) {
  return git(args, {...options, captureOutput: true });
}

async function main() {
  const tagname = `v${process.env.npm_package_version}`;
  console.log(`Publishing tag '${tagname}'...`)
  let { repository } = require('../package.json');
  if (repository.type !== 'git') {
    console.warn(`[WARNING] Cannot push version tag to '${repository.type}' repository (only 'git' is supported)`);
    return;
  }
  if (repository.url.startsWith('git+')) {
    repository = {
      ...repository,
      url: repository.url.slice(4),
    };
  }
  await git(['tag', tagname]);
  await git(['push', 'origin', tagname]);
  const mainRepoVerification = await gitOutput(
    ['ls-remote', repository.url, `refs/tags/${tagname}`]
  );
  let wasPublished = false;
  if (mainRepoVerification) {
    const localTagResolution = (await gitOutput(
      ['rev-parse', `refs/tags/${tagname}`]
    )).trim();
    wasPublished = mainRepoVerification.split('\t')[0] === localTagResolution;
  }
  if (wasPublished) {
    console.log(`Tag '${tagname}' published.`)
  } else {
    console.error(`[*ERROR*] Tag '${tagname}' was pushed to origin, but not published at ${repository.url}.`)
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}
