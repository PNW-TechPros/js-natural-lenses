const { spawn } = require('child_process');
const path = require('path');
const { SignalError, FailureError } = require('./subproc.js');

const gitCmd = (process.platform === 'win32') ? 'git.exe' : 'git';

function git(args, {acceptExit, cwd} = {}) {
  return new Promise(function(resolve, reject) {
    const gitProc = spawn(process.env['GIT'] || gitCmd, args, {
      cwd: cwd || path.resolve(__dirname, '../..'),
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let result = '';
    gitProc.stdout.on('data', data => {
      result += data;
    });
    gitProc.on('error', err => {
      reject(err);
    });
    gitProc.on('exit', (code, signal) => {
      if (signal !== null) {
        reject(new SignalError(signal, {
          command: 'git',
          args,
          cwd: cwd || process.cwd(),
        }));
      } else if (acceptExit ? acceptExit.call(undefined, code) : code === 0) {
        resolve(result);
      } else {
        reject(new FailureError(code, {
          command: 'git',
          args,
          cwd: cwd || process.cwd(),
        }));
      }
    });
  });
}

module.exports = git;
