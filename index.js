const { mapObject } = require('underscore');
const { at_maybe, cloneImpl, isLensClass } = require('./src-cjs/constants');
const Errors = require('./cjs/errors');
const fusion = require('./cjs/fusion').default;
const Lens = require('./cjs/lens').default;
const { set: setLogger, enableAsync: asyncLogging } = require('./cjs/logger');
const { eachFound, maybeDo } = require('./cjs/utils');

let fuse = null;

/**
 * @template T
 * @callback module:natural-lenses~BlockLogger
 * @summary Temporarily log to a different logger during callback
 * @see `forBlock` method of [setLogger]{@link module:natural-lenses#setLogger}
 * @since 2.2.0
 * @param {Logger} logger       Custom logger to use, with interface like `console`
 * @param {function(): T} body  Callback to execute, logging to *logger*; receives no arguments and returns T
 * @returns {T}  Return value from *body*
 *
 * @description
 * Calling this method temporarily redirects logging output to *logger* during
 * the execution of *body*.
 *
 * ## Asynchronicity without [asyncLogging]{@link module:natural-lenses#asyncLogging}
 *
 * If *body* registers callbacks that complete after it returns, logging calls
 * will return to targeting the *status quo ante* logger (or whatever logger
 * happens to be current at the time).  There is no way for this library to
 * detect this has happend and warn about pending callbacks logging to a
 * different logger.
 * 
 * If *body* returns a *thenable* (i.e. an object with a `then` property, like
 * a Promise), *logger* will remain the target logger until the result fulfills
 * or rejects.  A warning will also be logged because the target logger for
 * the entire process is changed by this usage.
 *
 * ## Asynchronicity with [asyncLogging]{@link module:natural-lenses#asyncLogging}
 *
 * If [asyncLogging]{@link module:natural-lenses#asyncLogging} has been called
 * to install an asynchronous-context-aware engine, then *logger* will be the
 * target logger during the execution of *body* and *for any asynchronous
 * execution starting within body*, whether via callback or thenable.
 */

/**
 * @module natural-lenses
 * @summary Construct a Lens from the given indexing steps
 *
 * @param {...*} key  A name or index to use in successive subscripting (i.e. square bracket) operations
 * @returns {Lens}  The constructed lens
 *
 * @property {Function} asyncLogging        [Documentation]{@link module:natural-lenses#asyncLogging}
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
 * @property {Function} setLogger           [Documentation]{@link module:natural-lenses#setLogger}
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
   * empty (see [eachFound]{@link module:natural-lenses#eachFound}).
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
  
  /**
   * @function module:natural-lenses#setLogger
   * @summary Set a custom logger
   * @since 2.2.0
   * @param {Logger} logger  Custom logger to use, with interface like `console`
   * @returns {Logger}  The previous logger
   *
   * @property {module:natural-lenses~BlockLogger} forBlock  Set the logger only for the duration of the callback
   *
   * @description
   * Calling this function changes the "current logger"...in some regard.  If
   * [asyncLogging]{@link module:natural-lenses#asyncLogging} has not been
   * called, then the global current logger is changed; if it has been called,
   * the specific engine invoked determines what is set.  In the case of the
   * `node` engine, *logger* becomes the receiver for subsequent logging calls
   * in the synchronous context and any asynchronous contexts subsequently
   * spawned from it.  When the `node` engine is in use and this function is
   * called from an asynchronous context, the logging receiver change is local
   * to that context but propagates to any asynchronous contexts it spawns.
   */
  setLogger: {enumerable: true, get: () => setLogger},
  
  /**
   * @function module:natural-lenses#asyncLogging
   * @summary Enable asynchronous-context awareness for logger assignment
   * @since 2.2.0
   * @param {string} engine  Name of the engine to use
   * @returns The module (for chainable configuration)
   *
   * @description
   * Logging configuration is usually a global activity.  However, there are
   * cases where some specific section of the code needs to redirect its
   * logging to a different handler.
   *
   * In many languages and environments, this diversion of logging events would
   * be handled with a thread- or fiber-local variable.  JavaScript — with its
   * extensive use of closures and asynchronous callbacks/Promises — needs to
   * associate the logging diversion with the asynchronous context of the
   * code setting the logger.  There is, however, no standard way to do this.
   *
   * To bridge this gap, [natural-lenses]{@link module:natural-lenses} provides
   * *asynchronous context engines* which can be configured on demand.  Setting
   * the engine does not change the current logger, but can allow code to
   * change the logger in a more local fashion.  Configuring the appropriate
   * asynchronous context engine makes [setLogger.forBlock]{@link module:natural-lenses~BlockLogger}
   * much more adept at getting logging events to the correct handler in
   * asynchronous contexts.
   *
   * ## Engines
   * 
   * | Engine name | Implementation |
   * | :----- | :------------- |
   * | `node` | Uses `require('async_hooks').AsyncLocalStorage` |
   */
  asyncLogging: {enumerable: true, get: () => (engine) => {
    asyncLogging(engine);
    return makeLens;
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
 * @see {@link Container}
 */

/**
 * @constant
 * @name module:natural-lenses#clone
 * @type {symbol}
 * @see {@link Container}
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

/**
 * @interface Container
 *
 * @description
 * Objects implementing this interface define how they are handled as containers
 * by [Lenses]{@link Lens}.  Implementations are automatically polyfilled for
 * Object, Array, and Map.  Implementations can be polyfilled to support
 * [Immutable]{@link external:immutable} by `require`-ing or `import`ing
 * {@link module:natural-lenses/immutable} or calling
 * {@link module:natural-lenses#polyfillImmutable}.
 *
 * The names of the methods of this interface are defined by symbols from
 * {@link module:natural-lenses}.
 */

/**
 * @function
 * @name Container#[at_maybe]
 * @param {*} key - The key/index whose value to retrieve from *this* container
 * @returns {Maybe.<*>} A Maybe for the value associated with *key* in *this*
 *
 * @description
 * The *key* passed to this method will be from the *keys* of a Lens -- the kind
 * of value that should be passed for a conceptual "indexing" of the container.
 * For Object, this is a string property name.  For Array, this is an integer index,
 * where negative values count backward from the end of the Array.  For Map, the
 * argument may be any type, which is passed to `Map.prototype.has` and possibly
 * `Map.prototype.get` as a key value.
 */

/**
 * @function
 * @name Container#[clone]
 * @param {{set: {0: *, 1: *}?, spliceOut: *?}} opDesc
 * @returns {*} A modified clone of *this*
 *
 * @description
 * The intent of the method is to clone the container with some kind of
 * alteration -- either a key/index set to the given value in the clone, or a
 * key/index deleted from the clone.
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
 *
 * In a future major version, it is likely that the call interface for this
 * method will change to `function({key: *} | {key: *, just: *}): *`, where
 * presence of `just` (and its associated value) in the argument represents a
 * "setting" of *key* in the result, and absence of `just` represents omission
 * of *key* from the result.
 */
