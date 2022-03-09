import { isArray, range, reduce } from 'underscore';

/**
 * @mixin
 * @name BinderMixin
 */
export default {
  /**
   * @function
   * @name BinderMixin#$
   * @param {string} method  Name of method to bind
   * @returns {Function} Method named by *method* bound to the Object on which this method is called
   *
   * @description
   * Because lens access can easily traverse multiple layers — especially in
   * the context of a [datum plan]{@link module:natural-lenses/datum-plan} —
   * using `Function.prototype.bind` can involve significant repetition.  This method allows
   * such binding *without* the repetition, as the method name passed is
   * looked up against the target of the {@link Lens} (or other optic) and
   * then `Function.prototype.bind`ed to that Object.
   *
   * This method is also invokable via ES6 tagged template literal syntax.
   */
  $(method) {
    // Support tagged template syntax
    if (isArray(method)) {
      method = reduce(
        range(1, arguments.length),
        (cur, i) => cur + arguments[i].toString() + method[i],
        method[0]
      );
    }
    return this[method].bind(this);
  }
};
