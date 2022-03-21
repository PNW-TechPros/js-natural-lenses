export default function fuser({ Lens, OpticArray }) {
  return function fuse(...optics) {
    for (let i = 0, step = null; (step = 1) && i < optics.length - 1; i += step) {
      const [a, b] = optics.slice(i, i + 2);
      if (a.constructor === Lens && b.constructor === Lens) {
        optics.splice(i, 2, Lens.fuse(a, b)); step = 0;
      }
    }
    return optics.length === 1 ? optics[0] : new OpticArray(optics);
  }
}
