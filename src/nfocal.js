import {
  each as _each, identity, isArray, isFunction, map as _map, mapObject,
  reduce as _reduce, reduceRight
} from 'underscore';
import BinderMixin from './binder_mixin.js';
import { at_maybe, cloneImpl, isLensClass } from '../src-cjs/constants.js';
import { index_maybe, isLens, lensCap } from './utils.js';

export class AbstractNFocal {
  [isLensClass] = true;

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

  present(subject) {
    return _reduce(
      this.lenses,
      (found, lens, idx) => lens.present(subject) ? found.concat(idx) : found,
      []
    );
  }

  /**
   * @summary Apply a different transform to each slot selected by this multifocal while making a clone
   * @param                                 subject     The input structured data
   * @param {Iterable<[number, Function]>}  xformArray  Iterable of lens key and transform function pairs to apply
   * @param {(Function|Object)}             opts        Options for {@link Lens#xformInClone} or a function taking the slot key and returning the options
   * @return A minimally changed clone of *subject* with the slots selected by this multifocal transformed according to the corresponding element of *fns*
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

export class ArrayNFocal extends AbstractNFocal {
  get(subject, ...tail) {
    const subjResult = this.get_maybe(subject).just;
    if (tail.length > 0) {
      return new ArrayNFocal(
        _map(subjResult, l => isLens(l) ? l : lensCap)
      ).get(...tail);
    }
    return subjResult;
  }

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

export class ObjectNFocal extends AbstractNFocal {
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
