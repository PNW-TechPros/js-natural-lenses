import _immutable from 'immutable';
const { List, Map, OrderedMap, Seq } = _immutable;
import { polyfillImmutable } from './immutable_support.js';
import Lens from './lens.js';
import LensFactory from './lens_factory.js';

/**
 * @module natural-lenses/immutable
 *
 * @description
 * Imported for its side-effects, this module integrates the {@link Lens} class
 * with the classes from the {@link https://www.npmjs.com/package/immutable|Immutable}
 * package.  This integration includes the addition of the {@link ImmutableLensMixin}
 * to the {@link Lens} class.
 */

polyfillImmutable(List);
polyfillImmutable(Map);
polyfillImmutable(OrderedMap);

export const containerFactory = {
  construct(keys) {
    const k = keys[keys.length - 1];
    return (typeof k === 'number') ? new List() : new Map();
  }
}

export const lensFactory = new LensFactory({containerFactory});

/**
 * @global
 * @mixin
 * @name ImmutableLensMixin
 */

Object.assign(Lens.prototype, {
  /**
   * @function
   * @name ImmutableLensMixin~getSeq
   * @param subject  The structured data to be queried
   * @param {Object} [options]
   * @param [options.orThrow]  {@link OptionalThrow} if the value of the slot exists but is not iterable
   * @returns {Seq}  A {@link https://immutable-js.com/docs/v3.8.2/Seq/|Seq} (from `immutable`) over the iterable value selected
   * @see Lens#getIterable
   */
  getSeq(subject, {orThrow} = {}) {
    return Seq(this.getIterable(subject, {orThrow}));
  },
});
