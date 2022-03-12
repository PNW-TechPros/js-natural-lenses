import { forEach, isUndefined } from 'underscore';
import { at_maybe, cloneImpl } from '../../src-cjs/constants.js';
import { incorporateStdlibSupport } from '../utils.js';

incorporateStdlibSupport(Array, [
  // Define how an Array retrieves the element at an index/key in the Maybe monad
  [at_maybe, function(key) {
    if (typeof key === 'number') {
      if (key < -this.length || key >= this.length) {
        return {};
      }
      if (key < 0) {
        key = this.length + key;
      }
    }
    return (key in this) ? {just: this[key]} : {};
  }],
  
  // Define how an Array clones with an element set to a given value or spliced out
  [cloneImpl, function({set, spliceOut} = {}) {
    if (set) {
      const result = this.concat();
      let [key, value] = set;
      if (typeof key === 'number' && key < 0) key = this.length + key;
      result[key] = value;
      return result;
    } else if (typeof spliceOut === 'number') {
      const i = spliceOut < 0 ? this.length + spliceOut : spliceOut;
      if (i < 0 || i >= this.length || !(i in this)) {
        return this.concat();
      }
      if (i === this.length - 1) {
        return this.slice(0, i);
      }
      const Species = this.constructor[Symbol.species];
      return (new Species()).concat(
        this.slice(0, spliceOut),
        new Array(1),
        this.slice(spliceOut + 1)
      );
    } else if (!isUndefined(spliceOut)) {
      const result = this.concat();
      delete result[spliceOut];
      return result;
    }
    return this.concat();
  }]
]);
