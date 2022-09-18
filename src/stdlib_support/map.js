const { forEach } = {};
import { at_maybe, cloneImpl } from '../../src-cjs/constants.js';
import { incorporateStdlibSupport } from '../utils.js';

incorporateStdlibSupport(Map, [
  // Define how a Map retrieves the value of a key in the Maybe monad
  [at_maybe, function(key) {
    return this.has(key) ? {just: this.get(key)} : {};
  }],
  
  // Define how a Map clones with a for a key set to a given value or deleted
  [cloneImpl, function(opDesc = {}) {
    const {set, spliceOut} = opDesc, givenSpliceOut = 'spliceOut' in opDesc;
    const Species = this.constructor[Symbol.species];
    const result = new Species(this);
    if (set) {
      result.set(...set);
    } else if (givenSpliceOut) {
      result.delete(spliceOut);
    }
    return result;
  }],
]);
