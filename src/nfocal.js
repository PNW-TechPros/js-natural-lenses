import {
  each as _each, every, identity, isArray, isFunction, map as _map, mapObject,
  reduce as _reduce, reduceRight
} from 'underscore';
import BinderMixin from './binder_mixin.js';
import { StereoscopyError } from './errors.js';
import { at_maybe, cloneImpl, isLensClass } from '../src-cjs/constants.js';
import { index_maybe, isLens, lensCap } from './utils.js';

/**
 * @property {Array | Object} lenses  [Lenses]{@link Lens} aggregated by this object
 */
export class AbstractNFocal {
  [isLensClass] = true;

  /**
   * @summary Abstract base class for multifocal (i.e. n-focal) optics
   * @param {Array|Object} lenses  Lenses to be aggregated
   *
   * @property {Array|Object} lenses  Lenses of the aggregation
   *
   * @description
   * **NOTE:** The *lenses* argument is captured by the new AbstractNFocal-derived
   * object, meaning later changes to the object passed as *lenses* propagate
   * to the constructed AbstractNFocal.
   */
  constructor(lenses) {
    this.lenses = lenses;
  }
  
  [at_maybe](idx) {
    return index_maybe(this.lenses, idx);
  }
  
  [cloneImpl](alteration) {
    const lenses = this.lenses[cloneImpl](alteration);
    return makeNFocal(lenses);
  }

  /**
   * @see {@link Lens#present}
   */
  present(subject) {
    return _reduce(
      this.lenses,
      (found, lens, idx) => lens.present(subject) ? found.concat(idx) : found,
      []
    );
  }
  
  /**
   * @typedef {Array} AbstractNFocal.TransformSpec
   * @property {*}        0 - lens index/key
   * @property {Function} 1 - transform function to apply
   *
   * @description
   * Indicates a transform Function and the index/key of the Lens identifying
   * the slot over which to apply the transform.
   */

  /**
   * @template T
   * @summary Apply transforms to selected slots within this multifocal while making a clone
   * @param {T}                                        subject     The input structured data
   * @param {Iterable.<AbstractNFocal.TransformSpec>}  xformPairs  Iterable of lens key and transform function pairs to apply
   * @param {(Function|Object)}                        [opts]      Options for {@link Lens#xformInClone} or a function taking the slot key and returning the options
   * @return {T} A minimally changed clone of *subject* with the slots of this multifocal selected by *xformPairs* transformed according to the corresponding Function
   *
   * @description
   * An element of *xformPairs* that targets a lens not existing in this object
   * is a no-op.  Behavior for an *xformPairs* element targeting a non-existent
   * slot in *subject* depends on *opts*.
   *
   * Transforms are applied in the order in which they occur in *xformPairs*.
   */
  xformInClone(subject, xformArray, opts = {}) {
    if (!isFunction(opts)) {
      opts = identity.bind(null, opts);
    }
    return _reduce(
      xformArray,
      (cur, [key, xform]) => {
        const lens = this.lenses[key];
        return lens ? lens.xformInClone(cur, xform, opts(key)) : cur;
      },
      subject
    );
  }

  /**
   * @template T
   * @summary Apply transforms to selected slots (using a Maybe monad) within this multifocal while making a clone
   * @param {T}                                        subject     The input structured data
   * @param {Iterable.<AbstractNFocal.TransformSpec>}  xformPairs  Iterable of lens key and transform function pairs to apply
   * @returns {T} A minimally changed clone of *subject* with the slots of this multifocal selected by keys in *xformPairs* transformed according to the corresponding Function
   *
   * @description
   * An element of *xformPairs* that targets a lens not existing in this object
   * is a no-op.  Any transform function called will be called with the slot
   * value in a Maybe monad and the result expected to provide the new value
   * in a Maybe monad: the Nothing construction (`{}`) will be passed if the
   * slot does not exist in *subject* and return of the Nothing construct
   * will cause the clone to omit the targeted slot.
   *
   * Transforms are applied in the order in which they occur in *xformPairs*.
   */
  xformInClone_maybe(subject, xformArray) {
    return _reduce(
      xformArray,
      (cur, [key, xform]) => {
        const lens = this.lenses[key];
        return lens ? lens.xformInClone_maybe(cur, xform) : cur;
      },
      subject
    );
  }
  
}
Object.assign(AbstractNFocal.prototype, BinderMixin);

/**
 * @extends AbstractNFocal
 * @summary Multifocal (i.e. n-focal) building an Array
 */
export class ArrayNFocal extends AbstractNFocal {
  /**
   * @see {@link Lens#get}
   */
  get(subject, ...tail) {
    const subjResult = this.get_maybe(subject).just;
    if (tail.length > 0) {
      return new ArrayNFocal(
        _map(subjResult, l => isLens(l) ? l : lensCap)
      ).get(...tail);
    }
    return subjResult;
  }

  /**
   * @see {@link Lens#get_maybe}
   */
  get_maybe(subject, ...tail) {
    const subjResult = new Array(this.lenses.length);
    for (var i = 0; i < this.lenses.length; i++) {
      const iVal_maybe = this.lenses[i].get_maybe(subject);
      if ('just' in iVal_maybe) {
        subjResult[i] = iVal_maybe.just;
      }
    }
    if (tail.length > 0) {
      return new ArrayNFocal(
        _map(subjResult, r => isLens(r.just) ? r.just : lensCap)
      ).get_maybe(...tail);
    } else {
      return {just: subjResult, multiFocal: true};
    }
  }
  
  /**
   * @template T
   * @summary Clone *subject*, setting all values corresponding to elements of this multifocal within the clone
   * @see {@link Lens#setInClone}
   * @param {T}         subject  The input structured data
   * @param {Array.<*>} newVals  The new values corresponding to this multifocal's lenses
   * @returns {T} A minimally changed clone of *subject* with *newVals* distributed via *this.lenses*
   * @throws {StereoscopyError} If this object's view of *subject* cannot become *newVals*
   *
   * @description
   * Similar in concept to {@link Lens#setInClone}, this method creates a modified
   * clone of *subject* such that applying this optic to the new value produces
   * a value deep-equal to *newVals*.  Due to the multifocal nature, it is possible
   * that no such result can be created, which results in a {@link StereoscopyError}.
   *
   * It is possible to delete the target of one or more of *this.lenses* by
   * passing *newVals* with *empty* elements or with fewer elements than
   * in *this.lenses*.  The easiest way to accomplish this is to create the
   * Array of new values, then use `delete` on the indexes whose corresponding
   * slots should be removed from *subject*.
   */
  setInClone(subject, newVals) {
    const valSource = newVals || [];
    const result = this.xformInClone_maybe(
      subject,
      _map(this.lenses, (l, i) => 
        [i, () => (i in valSource) ? {just: valSource[i]} : {}]
      )
    );
    checkSet.call(this, result, newVals);
    return result;
  }
}

/**
 * @extends AbstractNFocal
 * @summary Multifocal (i.e. n-focal) building an Object
 */
export class ObjectNFocal extends AbstractNFocal {
  /**
   * @see {@link Lens#get}
   */
  get(subject, ...tail) {
    const subjResult = {};
    _each(this.lenses, (lens, prop) => {
      const propVal_maybe = lens.get_maybe(subject);
      if ('just' in propVal_maybe) {
        subjResult[prop] = propVal_maybe.just;
      }
    });
    if (tail.length > 0) {
      return new ObjectNFocal(
        mapObject(subjResult, l => isLens(l) ? l : lensCap)
      ).get(...tail);
    }
    return subjResult;
  }

  /**
   * @see {@link Lens#get_maybe}
   */
  get_maybe(subject, ...tail) {
    const subjResult = this.get(subject);
    if (tail.length > 0) {
      return new ObjectNFocal(
        mapObject(subjResult, r => isLens(r.just) ? r.just : lensCap)
      ).get_maybe(...tail);
    }
    return {just: subjResult, multiFocal: true};
  }
  
  /**
   * @template T
   * @summary Clone *subject*, setting all values corresponding to elements of this multifocal within the clone
   * @see {@link Lens#setInClone}
   * @param {T}                 subject  The input structured data
   * @param {Object.<string,*>} newVals  The new values corresponding to this multifocal's lenses
   * @returns {T} A minimally changed clone of *subject* with *newVals* distributed via *this.lenses*
   * @throws {StereoscopyError} If this object's view of *subject* cannot become *newVals*
   *
   * @description
   * Similar in concept to {@link Lens#setInClone}, this method creates a modified
   * clone of *subject* such that applying this optic to the new value produces
   * a value deep-equal to *newVals*.  Due to the multifocal nature, it is possible
   * that no such result can be created, which results in a {@link StereoscopyError}.
   *
   * The slot corresponding to any constituent lens whose name is left out of
   * *newVals* will be deleted from the clone of *subject*.
   */
  setInClone(subject, newVal) {
    const valSource = newVal || {};
    const result = this.xformInClone_maybe(
      subject,
      mapObject(this.lenses, (l, k) => 
        [k, () => (k in valSource) ? {just: valSource[k]} : {}]
      )
    );
    checkSet.call(this, result, newVal);
    return result;
  }
}

export function makeNFocal(lenses) {
  return new (isArray(lenses) ? ArrayNFocal : ObjectNFocal)(lenses);
}

/**
 * @private
 * @this AbstractNFocal
 * @param {Object|Array} result
 * @param {Object|Array} expectedVal
 * @throws {StereoscopyError} Thrown if this object's view of *result* is inconsistent with *expectedVal*
 * @description
 * Many parts of this method are never expected to execute, but are in
 * place in case of unexpected results from other operations.
 */
function checkSet(result, expectedVal) {
  const checkVal_maybe = this.get_maybe(result);
  /* istanbul ignore if */
  if (!('just' in checkVal_maybe)) {
    throw new StereoscopyError("Slot not present when it should be");
  } else {
    let sameValue = false;
    switch (typeof expectedVal) {
      /* istanbul ignore next */
      case 'bigint':
      /* istanbul ignore next */
      case 'boolean':
      /* istanbul ignore next */
      case 'function':
      /* istanbul ignore next */
      case 'number':
      /* istanbul ignore next */
      case 'string':
      /* istanbul ignore next */
      case 'symbol':
      /* istanbul ignore next */
      case 'undefined':
        sameValue = Object.is(expectedVal, checkVal_maybe.just);
        break;
      case 'object':
        /* istanbul ignore if */
        if (expectedVal === null) {
          sameValue = (checkVal_maybe.just === null);
        } else {
          sameValue = every(expectedVal, (v, k) =>
            Object.is(checkVal_maybe.just[k], v)
          ) && every(Object.keys(checkVal_maybe.just), k => k in expectedVal);
        }
        break;
      
      /* istanbul ignore next */
      default:
        throw `Unrecognized value type '${typeof expectedVal}'`;
    }
    
    if (!sameValue) {
      throw new StereoscopyError("Altered slot in clone has unexpected value");
    }
  }
}
