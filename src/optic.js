import { isFunction, isUndefined } from 'underscore';
import BinderMixin from './binder_mixin.js';
import { isLensClass } from '../src-cjs/constants.js';
import { smartLog } from './logger.js';
import { getIterator, handleNoniterableValue, isLens } from './utils.js';

class Optic {
  [isLensClass] = true;
  
  /**
   * @class
   * @mixes BinderMixin
   */
  constructor() {}
  
  /* istanbul ignore next */
  /**
   * @abstract
   * @summary Get a combination of present and value of this slot
   * @param {*} subject  The data to query
   * @param {...*} tail  Additional subject for repeated application
   * @returns {Maybe.<*>}  The value of the slot in a Maybe moand (*Nothing* if the slot is missing in *subject*)
   *
   * @description
   * If *tail* is given and getting this slot from from *subject* yields a
   * lens-like object (as indicated by a truthy `lens.isLens` property), then `#get_maybe()`
   * is called on that lens, passing the spread of *tail*.  If the value of
   * this slot is *not* a lens, the result is an empty Object.
   */
  get_maybe() { abstractMethod(); }
  
  /**
   * @summary Get the value of this slot within subject data
   * @param {*}    subject  The data to query
   * @param {...*} tail     Additional subjects for repeated application
   * @return {*} The value of this slot, or `undefined` if this slot is not present in *subject*
   *
   * @description
   * If *tail* is given, then `#get()` is called on the result of getting this
   * slot from *subject*, passing the spread of *tail*.  This eliminates
   * repeated use of `.get` in code.  The chaining fails, returning `undefined`,
   * if this slot in *subject* is not a lens-like object (as indicated by a truthy
   * `lens.isLens` property).
   */
  get(subject, ...tail) {
    const subjResult = this.get_maybe(subject).just;
    if (tail.length > 0) {
      return isLens(subjResult) ? subjResult.get(...tail) : undefined;
    }
    return subjResult;
  }
  
  /**
   * @summary Get the (iterable) value of this slot within some subject data
   * @param {*} subject  The data to query
   * @param {Object} [options]
   * @param {*} [options.orThrow]  {@link OptionalThrow} if the value of the slot exists but is not iterable
   * @return {Iterable.<*>} An iterable of values from this slot (or an empty Array)
   *
   * @description
   * If the slot does not exist within *subject*, this method returns an empty
   * Array.  If the slot within *subject* contains a non-iterable value, this
   * method's behavior depends on *orThrow*.  If *orThrow* is `undefined`, the
   * behavior is the same as if the slot did not exist: an empty Array is
   * returned.  If *orThrow* is not `undefined`, *orThrow* is thrown; if
   * *orThrow* is an Object, its `noniterableValue` property will be set to the
   * slot's value before being thrown. 
   *
   * This method differs from {@link Optic#get} in that the returned value will always
   * be iterable; thus, the return value of this method may safely be passed
   * into any function expecting an iterable value.  One example usage is
   * constructing a `Seq` from the `immutable` package.
   *
   * Strings, though iterable, are considered scalar values; if the targeted
   * slot contains a string, the slot will be treated as non-iterable.
   */
  getIterable(subject, {orThrow} = {}) {
    const maybeVal = this.get_maybe(subject);
    if (getIterator(maybeVal.just)) {
      return maybeVal.just;
    } else {
      handleNoniterableValue(orThrow, maybeVal);
      return [];
    }
  }
  
  /**
   * @template T
   * @summary Conditionally evaluate functions depending on presence of slot
   * @param {*}              subject  The input structured data
   * @param {Object}         branches
   * @param {function(*): T} [branches.then]  Function evaluated if slot is present in *subject*
   * @param {function(): T}  [branches.else]  Function evaluated if slot is absent from *subject*
   * @returns {T} The value computed by *branches.then* or *branches.else*, or `undefined`
   *
   * @description
   * The presence of the slot determines whether *branches.then* or *branches.else*
   * is evaluated, with the result being returned from this method.  If the
   * indicated property of *branches* is missing, then `undefined` is returned.
   */
  getting(subject, {then: thenDo, else: elseDo}) {
    const maybeVal = this.get_maybe(subject),
      handler = ('just' in maybeVal ? thenDo : elseDo) || (() => {});
    return handler.call(undefined, maybeVal.just);
  }
  
  /**
   * @summary Test for the presence of this slot in subject data
   * @param {*}        subject The data to test
   * @return {Boolean}         Whether this slot is present in *subject*
   */
  present(subject) {
    return 'just' in this.get_maybe(subject);
  }
  
  /* istanbul ignore next */
  /**
   * @template T
   * @summary Clone the input, transforming or deleting the Maybe value of this slot with a function
   * @param {T}                              subject  The input structured data
   * @param {function(Maybe.<*>): Maybe.<*>} fn       The function transforming the {@link Maybe} value of the slot
   * @return {T} A minimally changed clone of *subject* with this slot transformed per *fn*
   *
   * @description
   * The concept of this method is of applying some clear algorithm to the
   * content of the slot targeted by this Optic instance (in a {@link Maybe} monad,
   * to cover the possibility of the slot itself not existing in *subject*)
   * with the result returned in a {@link Maybe} monad (to allow for potential removal
   * of the slot).
   *
   * This implements what conceptually could, in Haskell, be described as:
   *
   *    Json -> (Maybe Json -> Maybe Json) -> Json
   *
   * "Minimally changed" means that reference-copies are used wherever possible
   * while leaving subject unchanged, and that setting the slot to the strict-
   * equal value it already has results in returning *subject*.
   */
  xformInClone_maybe() { abstractMethod(); }
  
  /**
   * @template T
   * @summary Clone the input, transforming the value within this slot with a function
   * @param {T}              subject  The input structured data
   * @param {function(*): *} fn  The function that transforms the slot value
   * @param {Object}         [opts]
   * @param {Boolean}        opts.addMissinng=false  Whether to add the slot if missing in subject
   * @return {T} A minimally changed clone of *subject* with *fn* applied to the value in this slot
   *
   * @description
   * If this slot is missing in *subject*, *fn* will not be called unless *addMissing*
   * is true, in which case fn will be called with `undefined`.
   *
   * "Minimally changed" means that reference-copies are used wherever possible
   * while leaving subject unchanged, and that setting the slot to the strict-
   * equal value it already has results in returning *subject*.
   */
  xformInClone(subject, fn, {addMissing = false} = {}) {
    return this.xformInClone_maybe(subject, (value_maybe) => {
      if ('just' in value_maybe || addMissing) {
        return {just: fn(value_maybe.just)};
      } else {
        return {};
      }
    });
  }
  
  /**
   * @template T
   * @summary Clone the input, transforming the iterable value within this slot with a function
   * @param {T}        subject  The input structured data
   * @param {Function} fn       The function that transforms the (iterable) slot value
   * @param {Object}   [options]
   * @param {*}        [options.orThrow]  {@link OptionalThrow} if the value of the slot exists but is not iterable
   * @return {T} A minimally changed clone of subject with the transformed value in this slot
   *
   * @description
   * If the slot does not exist within *subject*, *fn* is invoked on an empty
   * Array.  If the slot within *subject* contains a non-iterable value, this
   * method's behavior depends on *orThrow*.  If *orThrow* is `undefined`, the
   * behavior is the same as if the slot did not exist: an empty Array is
   * passed to *fn*.  If *orThrow* is not `undefined`, *orThrow* is thrown; if
   * *orThrow* is an Object, its `noniterableValue` property will be set to the
   * slot's value before being thrown.
   *
   * The primary differences between this method and {@link Lens#xformInClone} are that
   * this method always passes an iterable value to *fn* and always calls *fn*
   * even if the slot is missing or does not contain an iterable value (unless
   * *orThrow* is given).
   *
   * Strings, though iterable, are considered scalar values; if the targeted
   * slot contains a string, the slot will be treated as non-iterable.
   *
   * "Minimally changed" means that reference-copies are used wherever possible
   * while leaving *subject* unchanged, and that setting the slot to the strict-
   * equal value it already has results in returning *subject*.
   */
  xformIterableInClone(subject, fn, {orThrow} = {}) {
    return this.xformInClone_maybe(subject, maybeVal => {
      let input, result;
      if (getIterator(maybeVal.just)) {
        result = fn(input = maybeVal.just);
      } else {
        handleNoniterableValue(orThrow, maybeVal);
        input = [];
        if ('just' in maybeVal) {
          input.noniterableValue = maybeVal.just;
        }
        result = fn(input);
      }
      if (!getIterator(result)) {
        smartLog({
          level: 'warn',
          trace: true,
          message: "Noniterable result from fn of xformIterableInClone; substituting empty Array",
          msgId: 'e3e30f4a71fa',
          subject,
          ...this,
          opticConstructor: this.constructor,
          input,
          fn,
          result,
        });
        return {just: []};
      }
      return {just: result};
    });
  }
  
  /**
   * @template T
   * @summary Clone *subject*, assigning the given value to this slot within the clone
   * @param {T} subject  The input structured data
   * @param {*} newVal   The new value to inject into the slot identified by this lens within the returned clone
   * @returns {T} A minimally changed clone of *subject* with *newVal* in this slot
   *
   * @description
   * Where {@link Optic#xformInClone_maybe} is about applying some algorithmic
   * transformation to the Maybe of this slot value, possibly setting or omitting
   * this slot from the resulting clone, this method is about creating a clone
   * returning the *newVal* when {@link Optic#get} of this instance is applied
   * to it.  This base implementation suffices when the `xformInClone_maybe`
   * accepts as it's transform argument (i.e. second argument) a Function
   * returning a Maybe of the slot value.
   *
   * "Minimally changed" means that reference-copies are used wherever possible
   * while leaving *subject* unchanged, and that setting the slot to the strict-equal
   * value it already has results in returning *subject*.
   */
  setInClone(subject, newVal) {
    return this.xformInClone_maybe(subject, () => ({just: newVal}));
  }
  
  /**
   * @summary DRYly bind a Function to the Object from which it was obtained
   * @param {string|symbol} methodName
   * @param {Object} options
   * @param {*} options.on  The subject of the Function binding; becomes *this* for the result
   * @param {boolean} [options.bindNow=false]  Bind to the Optic's target within *on* rather than binding to *on*
   * @param {*} [options.orThrow]  {@link OptionalThrow} if the slot referenced does not contain a Function; has precedence over *or*
   * @param {Function} [options.or]  {@link FallbackBindingResult}, a Function to return if the slot referenced does not contain a Function
   * @returns {Function}  A Function binding the *methodName* of the target of this optic to the target of this optic, or `function() {}` if no such function found
   * @see {@link Lens#bound}
   *
   * @description
   * This method is a way to avoid duplicating code referencing an object within
   * *options.on* when 1) obtaining the reference to the method's function,
   * and 2) binding that method to the object from which it was accessed.
   *
   * The return value of this method is *always* a Function; if the slot identified
   * by this optic is not present in *options.on* or does not host a method
   * named *methodName*, the trivial function (`function () {}` or equivalent)
   * will be returned.
   *
   * By default, the binding is lazy — the target of the lens within *on* is
   * evaluated when the resulting Function is invoked (though *on* itself is
   * bound in this call).  To bind the resulting Function to its target
   * immediately when this method is called, set *options.bindNow* to `true`.
   *
   * @example
   * const data = {question: "What is the ultimate answer?"};
   * const qStarts = lens('question').binding('startsWith', {on: data});
   * qStarts('What') // => true
   * data.question = "Why is a raven like a writing desk?";
   * qStarts('What') // => false
   * qStarts('Why') // => true
   *
   * @example
   * const data = {question: "What is the ultimate answer?"};
   * const qStarts = lens('question').binding('startsWith', {on: data, bindNow: true});
   * qStarts('What') // => true
   * data.question = "Why is a raven like a writing desk?";
   * qStarts('What') // => true (because qStarts bound to the target of the lens when `binding` was called)
   */
  binding(methodName, {on, bindNow = false, orThrow, or}) {
    const optic = this;
    function lookUpPlayers() {
      const mSubj = optic.get(on), fn = (function() {
        try {return mSubj[methodName];} catch (e) {}  
      }());
      return {mSubj, fn};
    }
    
    if (bindNow) {
      const {mSubj, fn} = lookUpPlayers();
      if (isFunction(fn)) {
        return fn.bind(mSubj);
      }
      if (orThrow) {
        throw orThrow;
      } else if (!isUndefined(or)) {
        return or;
      }
      return function() {};
    } else return function (...args) {
      const {mSubj, fn} = lookUpPlayers();
      if (isFunction(fn)) {
        return fn.apply(mSubj, args);
      }
      if (orThrow) {
        throw orThrow;
      } else if (!isUndefined(or)) {
        return or.apply(undefined, args);
      }
    };
  }
}
Object.assign(Optic.prototype, BinderMixin);
export default Optic;

/* istanbul ignore next */
function abstractMethod() {
  throw new Error("Abstract method not implemented by concrete class");
}
