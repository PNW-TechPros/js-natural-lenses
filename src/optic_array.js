import { isEmpty, isUndefined, reduce, reduceRight } from 'underscore';
import Optic from './optic.js';
import { isLens, lensCap } from './utils.js';

/**
 * @extends Optic
 */
class OpticArray extends Optic {
  /**
   * @summary Aggregation of multiple lens applied in series
   *
   * @description
   * Construct this using {@link module:natural-lenses.fuse}.
   */
  constructor(lenses) {
    super();
    this.lenses = lenses;
  }

  /**
   * @inheritdoc
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
   * @inheritdoc
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
   * @inheritdoc
   */
  get_maybe(subject, ...tail) {
    const stepSubject = get_maybe_internal.call(this, {just: subject});
    const subjResult = stepSubject.just;
    if (tail.length > 0) {
      return isLens(subjResult) ? subjResult.get_maybe(...tail) : {};
    }
    return stepSubject;
  }

  /**
   * @inheritdoc
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
    }
    for (i = leadingLensCount - 1; i >= 0; i--) {
      let lensSubject = lensSubjects[i] || {};
      xformResults[i] = this.lenses[i].setInClone(lensSubject.just, xformResults[i + 1]);
    }
    return xformResults[0];
  }
}

export default OpticArray;

/**
 * @private
 * @this OpticArray
 * @param {Maybe.<*>} subject_maybe
 * @returns {Maybe.<*>}
 */
function get_maybe_internal(subject_maybe) {
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
