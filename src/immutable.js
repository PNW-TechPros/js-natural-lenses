import _immutable from 'immutable';
const { List, Map, OrderedMap, Seq } = _immutable;
import { polyfillImmutable } from './immutable_support.js';
import LensFactory from './lens_factory.js';
import Optic from './optic.js';

/**
 * @external immutable
 * @see https://www.npmjs.com/package/immutable
 * @see module:natural-lenses/immutable
 * @see {@tutorial immutable-support}
 *
 * @description
 * `natural-lenses` has optional support for the
 * [`immutable`](https://www.npmjs.com/package/immutable) package through
 * {@link module:natural-lenses/immutable}.
 */

/**
 * @class Map
 * @memberof external:immutable
 *
 * @description
 * `natural-lenses` treats this class quite similarly to the native Map class,
 * especially since `natural-lenses` only directly implements immutable-data
 * style "modifications" (i.e. clone-with-changes), so the update mechanism for
 * [immutable.Map]{@link external:immutable.Map} fits very well.
 */

/**
 * @class OrderedMap
 * @memberof external:immutable
 *
 * @description
 * `natural-lenses` treats this class quite similarly to the native Map class,
 * especially since `natural-lenses` only directly implements immutable-data
 * style "modifications" (i.e. clone-with-changes), so the update mechanism for
 * [immutable.OrderedMap]{@link external:immutable.OrderedMap} fits very well.
 */

/**
 * @class List
 * @memberof external:immutable
 *
 * @description
 * `natural-lenses` tries to treat this class as similarly as it can to the
 * native Array class.  The one difficulty that exists in this case is that
 * [immutable.List]{@link external:immutable.List} does not support value
 * sparseness (i.e. "empty" elements).  Where `natural-lenses` would produce
 * a cloned Array with an empty element, for [immutable.List]{@link external:immutable.List}
 * it will instead store `undefined` in the target slot of the clone. 
 */

/**
 * @module natural-lenses/immutable
 *
 * @property {Object} containerFactory  A factory for [immutable]{@link external:immutable} containers
 * @property {Factory} lensFactory  A factory for [Lenses]{@link Lens} using [immutable]{@link external:immutable} data types
 *
 * @description
 * This module provides support for the {@link external:immutable} package both
 * by side effects that implement {@link Lens} functionality in {@link external:immutable}
 * containers and also by its exported properties.  Side effects of importing or
 * requiring this module also include the addition of the {@link ImmutableLensMixin}
 * to the {@link Lens} class.
 */

polyfillImmutable(List);
polyfillImmutable(Map);
polyfillImmutable(OrderedMap);

/**
 * @constant
 * @name module:natural-lenses/immutable#containerFactory
 */
export const containerFactory = {
  construct(keys) {
    const k = keys[keys.length - 1];
    return (typeof k === 'number') ? new List() : new Map();
  }
}

/**
 * @constant
 * @name module:natural-lenses/immutable#lensFactory
 */
export const lensFactory = new LensFactory({containerFactory});

/**
 * @global
 * @mixin
 * @name ImmutableLensMixin
 */

Object.assign(Optic.prototype, {
  /**
   * @function
   * @name ImmutableLensMixin~getSeq
   * @param subject  The structured data to be queried
   * @param {Object} [options]
   * @param [options.orThrow]  {@link OptionalThrow} if the value of the slot exists but is not iterable
   * @returns {Seq}  A {@link https://immutable-js.com/docs/v3.8.2/Seq/|Seq} (from `immutable`) over the iterable value selected
   * @see Optic#getIterable
   */
  getSeq(subject, {orThrow} = {}) {
    return Seq(this.getIterable(subject, {orThrow}));
  },
});
