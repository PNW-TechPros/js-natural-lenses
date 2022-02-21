import { isEmpty, reduceRight } from 'underscore';
import BinderMixin from './binder_mixin.js';
import { isLens, lensCap } from './utils.js';

export default class OpticArray {
  constructor(lenses) {
    this.lenses = lenses;
  }

  present(subject) {
    if (this.lenses.length === 0) return true;
    const rval = reduceRight(
      this.lenses.slice(1),
      (subject, lens) => lens.get(subject),
      subject
    );
    return this.lenses[0].present(rval);
  }

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
