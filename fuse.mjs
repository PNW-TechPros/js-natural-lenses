import Lens from './esm/lens.js';
import OpticArray from './esm/optic_array.js';

export default function fuse(...lenses) {
  for (let i = 0, step = null; (step = 1) && i < lenses.length - 1; i += step) {
    const [a, b] = lenses.slice(i, i + 2);
    if (a.constructor === Lens && b.constructor === Lens) {
      lenses.splice(i, 2, Lens.fuse(a, b)); step = 0;
    }
  }
  return lenses.length === 1 ? lenses[0] : new OpticArray(lenses);
}
