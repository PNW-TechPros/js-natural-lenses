import { forEach, isUndefined } from 'underscore';
import { at_maybe, cloneImpl } from '../../src-cjs/constants.js';
import { incorporateStdlibSupport } from '../utils.js';

incorporateStdlibSupport(Object, [
  // Define how an Object retrieves the value of a property in the Maybe monad
  [at_maybe, function(key) {
    return (key in this) ? {just: this[key]} : {};
  }],
  
  // Define how an Object clones with a property set to a given value or deleted
  [cloneImpl, function({set, spliceOut} = {}) {
    if (spliceOut && !this.hasOwnProperty(spliceOut)) {
      return this;
    }
    const Species = this.constructor[Symbol.species] || this.constructor;
    let inst = null;
    try {
      inst = new Species();
    } catch (e) {
      const cantConstruct = new Error(
        `'${this.constructor.name}' requires arguments for instantiation; provide a [lens.clone] method`
      );
      cantConstruct.cause = e;
      throw cantConstruct;
    }
    const result = Object.assign(inst, this);
    if (set) {
      result[set[0]] = set[1];
    } else if (!isUndefined(spliceOut)) {
      delete result[spliceOut];
    }
    return result;
  }],
]);
