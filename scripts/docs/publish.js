const git = require('./git.js');

async function main() {
  console.log(await git(['push', 'origin', 'docs-next:docs']));
}

Object.assign(exports, {
  main,
});

if (require.main === module) {
  main().catch(err => {
    console.error(err);
  });
}
