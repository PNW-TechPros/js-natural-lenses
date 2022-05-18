const { spawn } = require('child_process');
const fs = require('fs').promises;
const { tmpdir } = require('os');
const path = require('path');
const _ = require('underscore');
const lens = require('../index.js');

const VERSION = (function() {
  const result = require('../package.json').version.split('.');
  result.toString = function() {
    return this.join('.');
  };
  ['major', 'minor', 'patch'].forEach((n, i) => {
    Object.defineProperty(result, n, {
      enumerable: true,
      get: function() {return this[i];}
    });
  });
  return result;
}());

const objectPropertiesRetrievalCode = `(function(obj) {
  const result = new Set();
  while (obj) {
    Object.getOwnPropertyNames(obj).forEach(name => result.add(name));
    obj = Object.getPrototypeOf(obj);
  }
  return result;
})`;
module.exports.objectPropertiesRetrievalCode = objectPropertiesRetrievalCode;

const getAllPropertyNames = eval(objectPropertiesRetrievalCode);
module.exports.getAllPropertyNames = getAllPropertyNames;

var versionApiMapPromise = null;
module.exports.getVersionApiMap = async function() {
  if (versionApiMapPromise) return versionApiMapPromise;
  return (versionApiMapPromise = new Promise(function(resolve, reject) {
    buildVersionApiMap().then(resolve, reject);
  }));
};

async function buildVersionApiMap() {
  const workDir = await fs.mkdtemp(path.join(tmpdir(), 'natural-lenses-'));
  function workPath(subpath) {
    return path.join(workDir, subpath);
  }
  
  try {
    const result = new Map(await Promise.all(previousMinorVersions().map(
      version => getLensProperties(workPath(version), version).then(props => [version, props])
    )));
    result.set(
      VERSION.slice(0, 2).join('.'),
      getAllPropertyNames(lens())
    );
    return result;
  } finally {
    await fs.rmdir(workDir, {recursive: true});
  }
}
module.exports.buildVersionApiMap = buildVersionApiMap;

function previousMinorVersions() {
  return _.range(0, VERSION.minor).map(
    minorVer => `${VERSION.major}.${minorVer}`
  );
}
module.exports.previousMinorVersions = previousMinorVersions;

async function getLensProperties(workDir, version) {
  function workPath(subpath) {
    return path.join(workDir, subpath);
  }
  
  await fs.mkdir(workDir, {recursive: true});
  await fs.writeFile(workPath('package.json'), JSON.stringify({
    dependencies: {
      "natural-lenses": `~${version}.0`,
    },
  }));
  
  const propsModule = workPath('lens-props.js');
  await Promise.all([
    runNpmInstall(workDir),
    fs.writeFile(propsModule, `
      const getProps = ${objectPropertiesRetrievalCode}, lens = require('natural-lenses');
      module.exports = getProps(lens());
    `),
  ]);
  
  return require(propsModule);
}
module.exports.getLensProperties = getLensProperties;

class NpmSignalError extends Error {
  constructor(signal, stderr) {
    super(signal);
    this.signal = signal;
    this.stderr = stderr;
  }
}

class NpmFailureError extends Error {
  constructor(code, stderr) {
    super(`exited with code ${code}`);
    this.code = code;
    this.stderr = stderr;
  }
}

async function runNpmInstall(dir) {
  return new Promise(function(resolve, reject) {
    const npm = spawn('npm', ['install'], {
      cwd: dir,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    
    let errMsg = '';
    npm.stderr.on('data', chunk => {
      errMsg += errMsg;
    });
    
    npm.on('exit', (code, signal) => {
      if (signal) {
        return reject(new NpmSignalError(signal, errMsg));
      }
      if (code !== 0) {
        return reject(new NpmFailureError(code, errMsg));
      }
      resolve();
    });
    
    npm.on('error', reject);
    
    npm.on
  });
}
