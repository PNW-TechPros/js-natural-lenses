const lens = require('./index.js');
module.exports = require('./cjs/datum_plan.js').makeExports({
  lens,
  fuse: lens.fuse,
  isLens: lens.isLens,
});
