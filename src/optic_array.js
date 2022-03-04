import { isEmpty, reduceRight } from 'underscore';
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
    const rval = reduceRight(
      this.lenses.slice(1),
      (subject, lens) => lens.get(subject),
      subject
    );
    return this.lenses[0].present(rval);
  }

  /**
   * @see {@link Lens#get}
   */
  get(subject, ...tail) {
    const subjResult = reduceRight(
      this.lenses,
      (subject, lens) => lens.get(subject),
      subject
    );
    if (tail.length > 0) {
      return isLens(subjResult) ? subjResult.get(...tail) : undefined;
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

  _get_maybe_internal(subject_maybe) {
    let stepSubject = subject_maybe;
    for (let i = this.lenses.length - 1; i >= 0; --i) {
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
