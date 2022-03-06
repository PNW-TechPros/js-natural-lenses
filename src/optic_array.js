import { isEmpty, isUndefined, reduce, reduceRight } from 'underscore';
import BinderMixin from './binder_mixin.js';
import { isLens, lensCap } from './utils.js';

class OpticArray {
  /**
   * @summary Aggregation of multiple lens applied in series
   *
   * @description
   * Construct this using {@link module:natural-lenses.fuse}.
   */
  constructor(lenses) {
    this.lenses = lenses;
  }

  /**
   * @see {@link Lens#present}
   */
  present(subject) {
    if (this.lenses.length === 0) return true;
    const throughLenses = this.lenses.slice(), finalLens = throughLenses.pop();
    const rval = reduce(
      throughLenses,
      (subject, lens) => lens.get(subject),
      subject
    );
    return finalLens.present(rval);
  }

  /**
   * @see {@link Lens#get}
   */
  get(subject, ...tail) {
    const subjResult = reduce(
      this.lenses,
      (subject, lens) => lens.get(subject),
      subject
    );
    if (tail.length > 0) {
      return isLens(subjResult) ? subjResult.get(...tail) : undefined
    }
    return subjResult;
  }

  /**
   * @see {@link Lens#get_maybe}
   */
  get_maybe(subject, ...tail) {
    const stepSubject = this._get_maybe_internal({just: subject});
    const subjResult = stepSubject.just;
    if (tail.length > 0) {
      return isLens(subjResult) ? subjResult.get_maybe(...tail) : undefined;
    }
    return stepSubject;
  }

  /**
   * @see {@link Lens#xformInClone_maybe}
   */
  xformInClone_maybe(subject, fn) {
    var i;
    const lensSubjects = new Array(this.lenses.length);
    lensSubjects[0] = {just: subject};
    
    const leadingLensCount = this.lenses.length - 1;
    for (i = 0; i < leadingLensCount; i++) {
      const l = this.lenses[i];
      lensSubjects[i + 1] = l.get_maybe(lensSubjects[i].just);
      if (!('just' in lensSubjects[i + 1])) {
        break;
      }
    }
    
    const xformResults = new Array(this.lenses.length);
    i = this.lenses.length - 1;
    const xformInput_maybe = (lensSubjects[i] || {});
    xformResults[i] = this.lenses[i].xformInClone_maybe(xformInput_maybe.just, fn);
    if ('just' in xformInput_maybe) {
      if (xformResults[i] === xformInput_maybe.just) {
        return subject;
      }
    } else if (isUndefined(xformResults[i])) {
      return subject;
    }
    for (i = leadingLensCount - 1; i >= 0; i--) {
      let lensSubject = lensSubjects[i] || {};
      xformResults[i] = this.lenses[i].setInClone(lensSubject.just, xformResults[i + 1]);
    }
    return xformResults[0];
  }
  
  /**
   * @see {@link Lens@xformInClone}
   */
  xformInClone(subject, fn, {addMissing = false} = {}) {
    return this.xformInClone(subject, val_maybe => {
      if (('just' in val_maybe) || addMissing) {
        return {just: fn(val_maybe.just)};
      } else {
        return {};
      }
    });
  }
  
  /**
   * @see {@link Lens#setInClone}
   */
  setInClone(subject, newVal) {
    return this.xformInClone(subject, () => newVal);
  }

  _get_maybe_internal(subject_maybe) {
    let stepSubject = subject_maybe;
    for (let i = 0; i < this.lenses.length; i++) {
      const lens = this.lenses[i];
      stepSubject = lens.get_maybe(stepSubject.just);
      if (isEmpty(stepSubject.just)) {
        return {};
      }
    }
    return stepSubject;
  }
}
Object.assign(OpticArray.prototype, BinderMixin);

export default OpticArray;
