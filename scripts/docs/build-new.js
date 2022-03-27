const { spawn } = require('child_process');
const ejs = require('ejs');
const fsx = require('fs-extra');
const path = require('path');
const git = require('./git.js');
const { SignalError, FailureError } = require('./subproc.js');

class DocsWorktree {
  static async furnishFor(callback) {
    const verHash = (await git(['rev-parse', 'HEAD'])).trim();
    
    // Add a git worktree to `.git/docs-${verHash}` on a new branch named `docs-${verHash}` starting from "origin/docs"
    const dir = `.git/docs-${verHash}`, branch = `docs-${verHash}`;
    await git(['worktree', 'add', '-b', branch, dir, "origin/docs"]);
    
    try {
      const wt = new DocsWorktree(dir);
      wt.verHash = verHash;
      return await callback.call(undefined, wt);
    } finally {
      await git(['worktree', 'remove', '-f', dir]);
      await git(['branch', '-D', branch]);
    }
  }
  
  constructor(wtDir) {
    this.dir = wtDir;
  }
  
  async docsExist(version) {
    try {
      await fsx.access(this.relPath(version, 'index.html'), fsx.constants.R_OK);
      return true;
    } catch (e) {
      return e && e.code === 'EACCES';
    }
    return false;
  }
  
  git(args, opts) {
    return git(args, {cwd: this.dir, ...opts});
  }
  
  relPath(...parts) {
    return path.resolve(this.dir, ...parts);
  }
}

async function fileReadable(filePath) {
  return fsx.access(filePath, fsx.constants.R_OK).then(
    () => true,
    () => false
  );
}

async function buildVersionsPage({ wt, version }) {
  // have to do this inside an async function
  const { compareSemVer, isValidSemVer } = await import('semver-parser');
  
  const dir = await fsx.opendir(wt.dir, {encoding: 'utf8'});
  const availableVersions = [];
  for await (const dirent of dir) {
    if (
      dirent.isDirectory() && isValidSemVer(dirent.name) &&
      await fileReadable(wt.relPath(dirent.name, 'index.html'))
    ) {
      availableVersions.push(dirent.name);
    }
  }
  availableVersions.sort((a, b) => compareSemVer(b, a));
  return new Promise(function(resolve, reject) {
    ejs.renderFile(path.resolve(__dirname, 'versions.tmpl'), {
      pkgVersion: version,
      availableVersions,
    }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

const SHELL_SPECIALS = /[\\'"^|<>&$%*\[\]{}!;]/;

async function npmRun(command, commandSuffix, {shell} = {}) {
  const { scripts } = require('../../package.json');
  
  if (!(command in scripts)) {
    throw new Error(`"${command}" is not a 'script' from package.json`);
  }
  let execStr = scripts[command];
  if (commandSuffix) {
    if (SHELL_SPECIALS.test(commandSuffix) && !shell) {
      throw new Error(`When 'commandSuffix' contains shell-special characters, the 'shell' option must be specified.`);
    }
    execStr += ' ' + commandSuffix;
  }
  
  await new Promise(function(resolve, reject) {
    const child = spawn(execStr, [], {
      shell: shell || true,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('error', err => {
      reject(err);
    });
    child.on('exit', (code, signal) => {
      if (signal !== null) {
        reject(new SignalError(signal));
      } else if (code !== 0) {
        reject(new FailureError(code));
      } else {
        resolve();
      }
    });
  });
}

async function main() {
  // Read the current version from package.json
  const { name: pkgName, version } = require('../../package.json');
  
  await git(['fetch', 'origin']);
  await DocsWorktree.furnishFor(async (wt) => {
    if (await wt.docsExist(version)) {
      throw `Version ${version} already has documents at origin.`;
    }
    
    // Build the documentation (npm run make:doc)
    await npmRun('make:doc');
    
    // Copy the version from doc/natural-lenses to the worktree
    const docsSrcPath = path.resolve(__dirname, '../../doc', pkgName, version),
      docsDestPath = wt.relPath(version);
    await fsx.mkdirp(docsDestPath);
    await fsx.copy(docsSrcPath, docsDestPath);
    
    // TODO: Build the index.html redirector and versions.html
    const thisDocURL = `./${version}/index.html`;
    const indexPromise = fsx.writeFile(
      wt.relPath('index.html'),
      `<!DOCTYPE html>\n` +
      `<html>` +
        `<head>` +
        `<meta http-equiv="refresh" content="0;URL=${thisDocURL}" />` +
        `<title>${pkgName} Documentation Redirection</title>` +
        `</head>` +
        `<body>` +
          `The most recent version (${version}) of the documentation ` +
          `for ${pkgName} is <a href="${thisDocURL}">here</a>.` +
        `</body>` +
      `</html>`
    );
    const versionsPagePromise = fsx.writeFile(
      wt.relPath('versions.html'),
      await buildVersionsPage({ version, wt })
    );
    await Promise.all([indexPromise, versionsPagePromise]);
    
    // Index all files added to the worktree
    await wt.git(['add', '-A']);
    
    // Commit new documentation added
    await wt.git(['commit',
      '-m', `Add documentation for version ${version}`,
      '-m', `Generated from commit ${wt.verHash}.`,
    ]);
    
    // Force-create branch "docs-next" from HEAD
    await wt.git(['branch', '-f', 'docs-next', 'HEAD']);
  });
}

Object.assign(exports, {
  buildVersionsPage,
  main,
});

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}
