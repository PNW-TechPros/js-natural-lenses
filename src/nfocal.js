import {
  each as _each, identity, isArray, isFunction, map as _map, mapObject,
  reduce as _reduce, reduceRight
} from 'underscore';
import BinderMixin from './binder_mixin.js';
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
}

export function makeNFocal(lenses) {
  return new (isArray(lenses) ? ArrayNFocal : ObjectNFocal)(lenses);
}
