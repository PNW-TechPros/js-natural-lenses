import lens, { fuse, isLens } from './index.mjs';
import { makeExports } from './esm/datum_plan.js';

const cjsExports = makeExports({
  fuse,
  lens,
  isLens,
});

export default cjsExports;
export const { value, others, raw, fromPOD } = cjsExports;
