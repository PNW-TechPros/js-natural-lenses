const { at_maybe, cloneImpl, isLensClass } = require('./src-cjs/constants');
const Lens = require('./cjs/lens').default;
const { eachFound, maybeDo } = require('./cjs/utils');

/**
 * Construct a Lens from the given indexing steps
 *
 * A Lens is a way to safely apply the indexing (i.e. square-bracket) operator
 * repeatedly, and to clone-with-changes a complex value to assist programming
 * in an immutable-data style.
 */
function makeLens(...keys) {
  return new Lens(...keys);
}
Object.defineProperties(makeLens, {
  at_maybe: {enumerable: true, value: at_maybe},
  clone: {enumerable: true, value: cloneImpl},
  eachFound: {enumerable: true, value: eachFound},
  isLens: {enumerable: true, value: isLensClass},
  maybeDo: {enumerable: true, value: maybeDo},
  
  fuse: {enumerable: true, get: () => (...lenses) => {
    for (let i = 0, step = null; (step = 1) && i < lenses.length - 1; i += step) {
      const [a, b] = lenses.slice(i, i + 2);
      if (a.constructor === Lens && b.constructor === Lens) {
        lenses.splice(i, 2, Lens.fuse(a, b)); step = 0;
      }
    }
    if (lenses.length === 1) return lenses[0];
    const OpticArray = require('./cjs/optic_array').default;
    return new OpticArray(lenses);
  }},
  
  /**
   * Construct a multifocal lens
   *
   * Where a standard lens looks at a single *slot* within a JSONic object, a
   * multifocal lens consists of multiple lenses (standard or multifocal) whose
   * results are aggregated into a single value, which can be a dictionary-like
   * Object or an Array.
   *
   * Pass an Array of lenses to create a multifocal lens that outputs an Array,
   * where the position of each lens in the input Array corresponds to the
   * output position of the data (when *getting* with the multifocal lens).  When
   * *getting* in a Maybe context (`#get_maybe`), the result will always be an
   * Object with a `just` property, though some elements of the Array may be
   * empty.
   *
   * Pass an Object with lens values to create a multifocal lens outputting an
   * Object, which will bear the same properties as the input Object and whose
   * values are the values in the data referenced by the corresponding lens (when
   * *getting* using this multifocal lens).
   *
   * Be aware that the `xformInClone` method on these kinds of multifocal lenses
   * works differently on Object-based and Array-based multifocals, and both are
   * different from a basic Lens.
   */
  nfocal: {enumerable: true, get: () => (lenses) => {
    return require('./cjs/nfocal').makeNFocal(lenses);
  }},
  
  Factory: {enumerable: true, get: () => require('./cjs/lens_factory').default},
  JsContainerFactory: {enumerable: true, get: () => require('./cjs/js_container_factory').default},
  jsContainers: {enumerable: true, get: () => require('./cjs/js_container_factory').DEFAULT_FACTORY},
  polyfillImmutable: {enumerable: true, get: () => require('./cjs/immutable_support').polyfillImmutable},
  Step: {enumerable: true, get: () => require('./cjs/custom_step').default},
});

module.exports = makeLens;
