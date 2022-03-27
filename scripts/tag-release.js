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
async function git(args) {
  return gitMutex.runExclusive(() => new Promise(function(resolve, reject) {
    const gitProg = progName('git'), subcmd = args.find(a => !a.startsWith('-'));
    const gitProc = spawn(gitProg, args, {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    function reportError(errType, detail) {
      reject(new errType(`${gitProg} ${subcmd}`, detail));
    }
    
    gitProc.on('error', (err) => {
      reject(err);
    });
    gitProc.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
      } else if (signal) {
        reportError(SignalError, signal);
      } else {
        reportError(FailureError, code);
      }
    });
  }));
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
  await git(['push', repository.url, tagname]);
  console.log(`Tag '${tagname}' published.`)
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}
