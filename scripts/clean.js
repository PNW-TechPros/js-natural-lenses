const fse = require('fs-extra');
const path = require('path');

const walk = async (root, visit) => new Promise((resolve, reject) => {
  let outstanding = 1;
  
  async function process(dir) {
    const listing = await fse.opendir(dir);
    
    const subdirs = [], others = [];
    for await (const entry of listing) {
      if (entry.isDirectory()) {
        if (entry.name === '.' || entry.name === '..') {
          // skip
        } else {
          subdirs.push(entry.name);
        }
      } else {
        others.push(entry.name);
      }
    }
    try {
      await visit(dir, subdirs, others);
      for (const subdir of subdirs) {
        ++outstanding;
        process(path.join(dir, subdir));
      }
    } finally {
      if (--outstanding === 0) {
        resolve();
      }
    }
  }
  
  process(root);
});
module.exports.walk = walk;

async function main() {
  async function deleteJsFrom(dir, subdirs, contents) {
    return Promise.all(
      contents.flatMap((entry) => (
        /\.(js|map)$/.test(entry) ? [fse.remove(path.join(dir, entry))] : []
      ))
    );
  }

  await Promise.all([
    walk('cjs', deleteJsFrom),
    walk('esm', deleteJsFrom),
  ]);
  console.log("Build output removed");
}
module.exports.main = main;

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}
