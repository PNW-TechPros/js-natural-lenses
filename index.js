const { mapObject } = require('underscore');
const { at_maybe, cloneImpl, isLensClass } = require('./src-cjs/constants');
const Errors = require('./cjs/errors');
const fusion = require('./cjs/fusion').default;
const Lens = require('./cjs/lens').default;
const { eachFound, maybeDo } = require('./cjs/utils');

let fuse = null;

/**
 * @module natural-lenses
 * @summary Construct a Lens from the given indexing steps
 *
 * @param {...*} key  A name or index to use in successive subscripting (i.e. square bracket) operations
 * @returns {Lens}  The constructed lens
 *
 * @property {symbol}   at_maybe            Key for method implementing retrieval from a container
 * @property {symbol}   clone               Key for method implementing cloning of a container with modifications
 * @property {Function} eachFound           [Documentation]{@link module:natural-lenses#eachFound}
 * @property {Function} Factory             [Class]{@link Factory} for customized lens creation
 * @property {Function} fuse                [Documentation]{@link module:natural-lenses#fuse}
 * @property {symbol}   isLens              Key for testing objects for "lens-ness"
 * @property {Function} JsContainerFactory  [Class]{@link JsContainerFactory} for customized container creation
 * @property {Object}   jsContainers        {@link JsContainerFactory} for standard JavaScript containers (Map and Array)
 * @property {Function} maybeDo             [Documentation]{@link module:natural-lenses#maybeDo}
 * @property {Function} nfocal              [Construct]{@link module:natural-lenses#nfocal} a multifocal lens
 * @property {Function} polyfillImmutable   [Documentation]{@link module:natural-lenses#polyfillImmutable}
 * @property {Function} Step                [Class]{@link Step} for customized Lens steps
 *
 * @description
 * This module is (when `require`d) or exports as default (when `import`ed) a
 * Function accepting an arbitrary number of keys and returning a {@link Lens}.
 *
 * A Lens is a way to safely apply the indexing (i.e. square-bracket) operator
 * repeatedly, and to clone-with-changes a complex value to assist programming
 * in an immutable-data style.
 *
 * In addition to the properties enumerated here, all error classes are also
 * exposed as properties or named exports.
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
  ...mapObject(Errors, (cls) => ({enumerable: true, value: cls})),
  
  /**
   * @function module:natural-lenses#fuse
   * @summary Fuse multiple optics into a single, sequential application
   * @param {...Optic} optic  Optic object to fuse
   * @returns {Lens|OpticArray}  A single {@link Optic} joining the *optics*
   *
   * @description
   * To understand the slot reference of the returned optic, consider the
   * *getting* model: `optics[0]` will be applied to the input data, and
   * for all other optics (i > 0), `optics[i]` will be applied to the
   * result from `optics[i - 1]`.  In other words, each optic *gets* something
   * within the optic to its left, with the leftmost *getting* from the
   * input data.  Modifications affect the same slot.
   *
   * If all *optics* are [Lenses]{@link Lens}, the result will be a Lens.  This
   * does not apply for Lens-derived objects (e.g. from [Factories]{@link Factory}) —
   * if such are passed, the result will always be an OpticArray.
   */
  fuse: {enumerable: true, get: () => {
    const OpticArray = require('./cjs/optic_array.js').default;
    fuse = fuse || fusion({ Lens, OpticArray });
    return fuse;
  }},
  
  /**
   * @function module:natural-lenses#nfocal
   * @summary Construct a multifocal lens
   * @param {Array.<Optic> | Object.<string,Optic>} lenses  Collection of [Lenses]{@link Lens} to combine
   * @returns {ArrayNFocal|ObjectNFocal}
   *
   * @description
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
   * works differently from a basic Lens, since multifocals can have a
   * "stereoscopic" view of data.  Instead of a single transformation function,
   * `xformInClone` (and it's `_maybe` variant) accept an iterable of key/transform
   * pairs (where the key is an integer index in the case of an Array multifocal).
   * This allows full control over the order in which transformations are applied
   * to the input data, resolving the issue of "stereoscopic conflict".
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

/**
 * @constant
 * @name module:natural-lenses#at_maybe
 * @type {symbol}
 *
 * @description
 * This constant is a key used for querying a method from container objects of
 * type `function(*): {@link Maybe}.<*>`.  The value passed to this method will be
 * a *key* from a Lens -- the kind of value that should be passed for a
 * conceptual "indexing" of the container.  For Object, this is a string property
 * name.  For Array, this is an integer index, where negative values count
 * backward from the end of the Array.  For Map, this uses `Map.prototype.has`
 * and `Map.prototype.get`.
 */

/**
 * @constant
 * @name module:natural-lenses#clone
 * @type {symbol}
 *
 * @description
 * This constant is a key used for querying a method from container objects of
 * type `function({set: {0: *, 1: *}?, spliceOut: *?}): *`.  The intent of the
 * method is to clone the container with some kind of alteration -- either
 * a key/index set to the given value in the clone, or a key/index deleted
 * from the clone.
 *
 * If the operation description passed contains a `set` property,
 * the value of that property should be an Array where element 0 is a key or
 * index into the container and element 1 is the value to set (cf. arguments
 * to `Map.prototype.set`).
 *
 * If the operation description passed contains a `spliceOut` property,
 * the value of that property should be a key or index to delete from the
 * container.  Where possible, the result should be to leave the container
 * in a state where `container[at_maybe](key)` returns `{}` (a *Nothing*).
 * This is specifically a problem for [immutable.List]{@link external:immutable.List},
 * which offers only a dense presentation of elements: every non-negative index
 * less than `size` is a valid and "contained" entry.  The implementation provided
 * by this library for implementing this method on
 * [immutable.List]{@link external:immutable.List} sets the value of the entry
 * in the clone to `undefined`.
 *
 * In the provided implemenation for Array, negative indexes are interpreted
 * counting backward from the end of the Array, as with `Array.prototype.slice`.
 *
 * `Symbol.species` is honored for determining the constructor used for the
 * clone; Object is a special case that defaults to Object if `Symbol.species`
 * is not present.
 */

/**
 * @constant
 * @name module:natural-lenses#isLens
 * @type {symbol}
 *
 * @description
 * This property is set on every kind of object to be recognized by this
 * library as implementing lens-like behavior.  Setting this property to
 * any truthy value on your own objects will cause this library to treat it
 * in many ways like a {@link Lens}.
 */

module.exports = makeLens;
