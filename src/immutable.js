import _immutable from 'immutable';
const { List, Map, OrderedMap, Seq } = _immutable;
import { polyfillImmutable } from './immutable_support.js';
import Lens from './lens.js';
import LensFactory from './lens_factory.js';

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

Object.assign(Lens.prototype, {
  getSeq: function(subject, {orThrow} = {}) {
    return Seq(this.getIterable(subject, {orThrow}));
  },
});
