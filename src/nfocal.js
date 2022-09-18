const { isArray } = Array;
import _each from './functional/each.js';
import every from './functional/every.js';
import identity from './functional/identity.js';
import isFunction from './functional/isFunction.js';
import _map from './functional/map.js';
import mapObject from './functional/mapObject.js';
import _reduce from './functional/reduce.js';
import { StereoscopyError } from './errors.js';
import { at_maybe, cloneImpl } from '../src-cjs/constants.js';
import Optic from './optic.js';
import { index_maybe, isLens, lensCap } from './utils.js';

/**
 * @extends Optic
 * @hideconstructor
 */
export class AbstractNFocal extends Optic {
  /**
   * @summary Abstract base class for multifocal (i.e. n-focal) optics
   * @param {Array.<Optic> | Object.<string,Optic>} lenses  Optics to be aggregated
   *
   * @description
   * **NOTE:** The *lenses* argument is captured by the new AbstractNFocal-derived
   * object, meaning later changes to the object passed as *lenses* propagate
   * to the constructed AbstractNFocal.
   *
   * AbstractNFocal objects (including those of derived classes) are, themselves,
   * lensable containers of their constituent lenses.
   */
  constructor(lenses) {
    super();
    this.lenses = lenses;
  }
  
  /**
   * @member {Array.<Optic> | Object.<string,Optic>} AbstractNFocal#lenses
   * @summary [Optics]{@link Optic} aggregated by this object
   */
  
  [at_maybe](idx) {
    return index_maybe(this.lenses, idx);
  }
  
  [cloneImpl](alteration) {
    const lenses = this.lenses[cloneImpl](alteration);
    return makeNFocal(lenses);
  }

  /**
   * @summary Test which constituent lenses are present in a subject
   * @param {*} subject  The data to test
   * @returns {Array.<number|string>}  Array of keys to *this.lenses* where the presence-test result corresponds to *this.lenses* by key/index
   *
   * @description
   * AbstractNFocals never produce `undefined` from their implementation of `#get`;
   * at very least they produce and empty Array or empty Object, both of which
   * are truthy and Objects.  More helpfully, this method returns an Array of
   * the keys/indexes in *this.lenses* where the slot of the corresponding lens
   * is present in *subject*.  This result is also invariably truthy, just like
   * the result of `#get` is invariably *not* `undefined`.
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
   * @param {Iterable.<AbstractNFocal.TransformSpec>}  xformPairs  Iterable of constituent lens key and transform function pairs to apply
   * @param {(Function|Object)}                        [opts]      Options for the constituent optic's `xformInClone` or a function taking the slot key and returning the options
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
   * @param {Iterable.<AbstractNFocal.TransformSpec>}  xformPairs  Iterable of constituent lens key and transform function pairs to apply
   * @returns {T} A minimally changed clone of *subject* with the slots of this multifocal selected by keys in *xformPairs* transformed according to the corresponding Function
   *
   * @description
   * An element of *xformPairs* that targets a lens not existing in this object
   * is a no-op.  Any transform function called will be called with the slot
   * value in a {@link Maybe} monad and the result expected to provide the new value
   * in a {@link Maybe} monad: the Nothing construction (`{}`) will be passed if the
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

/**
 * @extends AbstractNFocal
 * @summary Multifocal (i.e. n-focal) building an Array
 * @hideconstructor
 */
export class ArrayNFocal extends AbstractNFocal {
  /**
   * @summary Return the length of Array of constituent lenses (also the length of the result)
   */
  get length() {
    return this.lenses.length;
  }
  
  /**
   * @inheritdoc
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
   * @inheritdoc
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
        _map(subjResult, l => isLens(l) ? l : lensCap)
      ).get_maybe(...tail);
    } else {
      return {just: subjResult, multiFocal: true};
    }
  }
  
  /* istanbul ignore next */
  /**
   * @summary Get the iterable value of this slot within some subject data
   * @param {*} subject  The data to query
   * @returns {Array.<*>} An Array of values obtained from *subject* via *this.lenses*
   *
   * @description
   * In this class, this method is synonymous with a call to [get]{@link ArrayNFocal#get} with
   * a single parameter.
   */
  getIterable(subject) {
    return this.get(subject);
  }
  
  /**
   * @template T
   * @summary Clone *subject*, setting all values corresponding to elements of this multifocal within the clone
   * @param {T}         subject  The input structured data
   * @param {Array.<*>} newVals  The new values corresponding to this multifocal's lenses
   * @returns {T} A minimally changed clone of *subject* with *newVals* distributed via *this.lenses*
   * @throws {StereoscopyError} If this object's view of *subject* cannot become *newVals*
   * @see {@link AbstractNFocal#xformInClone_maybe}
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
      Array.prototype.map.call(this.lenses, (l, i) => 
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
   * @inheritdoc
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
   * @inheritdoc
   */
  get_maybe(subject, ...tail) {
    const subjResult = this.get(subject);
    if (tail.length > 0) {
      return new ObjectNFocal(
        mapObject(subjResult, l => isLens(l) ? l : lensCap)
      ).get_maybe(...tail);
    }
    return {just: subjResult, multiFocal: true};
  }
  
  /* istanbul ignore next */
  /**
   * @summary Get an empty Array
   * @returns {Array} An empty array
   *
   * @description
   * Because an ObjectNFocal always gets an Object, there is no way to create
   * an iterable value from the "virtual slot" it accesses.  Therefore, the
   * result of the inherited implementation would always yield an empty Array
   * and just returning that value is more efficient.
   */
  getIterable() {
    return [];
  }
  
  /**
   * @template T
   * @summary Clone *subject*, setting all values corresponding to elements of this multifocal within the clone
   * @param {T}                 subject  The input structured data
   * @param {Object.<string,*>} newVals  The new values corresponding to this multifocal's lenses
   * @returns {T} A minimally changed clone of *subject* with *newVals* distributed via *this.lenses*
   * @throws {StereoscopyError} If this object's view of *subject* cannot become *newVals*
   * @see {@link AbstractNFocal#xformInClone_maybe}
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
        throw new Error(`Unrecognized value type '${typeof expectedVal}'`);
    }
    
    if (!sameValue) {
      throw new StereoscopyError("Altered slot in clone has unexpected value");
    }
  }
}
