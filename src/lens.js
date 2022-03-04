import { isFunction, isObject, isUndefined } from 'underscore';
import BinderMixin from './binder_mixin.js';
import { cloneImpl, isLensClass } from '../src-cjs/constants.js';
import CustomStep from './custom_step.js';
import { getIterator, index_maybe, isLens } from './utils.js';

// Polyfill support for lenses to standard JavaScript types
import './stdlib_support/object.js';
import './stdlib_support/array.js';
import './stdlib_support/map.js';

/**
 * @typedef {Object} OptionalThrow
 * @property {*} [orThrow]  The value to `throw` in case of an error.
 */

/**
 * @typedef {Object} Maybe
 * @property {*} [just]  The contained value
 *
 * @description
 * The presence of `just` as a property indicates the "Just" construction of
 * the Maybe monad — the presence of a value (even if `undefined`).  A Maybe
 * without a `just` property is the "Nothing" construction.
 */

class Lens {
  [isLensClass] = true;

  /**
   * @summary Class for operating immutably on a specific "slot" in complex data
   * @param {...*} keys  Values to use in repeated applications of subscripting (i.e. square bracket operator)
   *
   * @description
   * A Lens constructed as `let l = new Lens('address', 'street', 0)` represents
   * a certain slot within a complex subject value.  If we had a record
   * ```js
   * const record = {
   *   address: {
   *     street: ["123 Somewhere Ln.", "Apt. 42"]
   *   }
   * };
   * ```
   * then applying our lens with `l.get(record)` would evaluate to "123 Somewhere Ln.".
   *
   * **NOTE:** If a *key* of a Lens is a negative number and
   * the container accessed at that level is an Array, the negtive index works
   * like `Array.prototype.slice`, counting from the end of the Array.
   *
   * But Lenses offer more functionality than retrieval of values from a deeply
   * structured value — they can create a minimally cloned value deeply equal
   * to the subject but for the slot targeted by the lens and strictly equal
   * but for the slot targeted by the lens and the nodes in the input subject
   * above that slot in the subject's tree.
   *
   * When constructing a modified clone, it is possible that some step of the
   * Lens will target a slot within a container-not-existing-in-subject.  In this
   * case, the container to be created is intuited from the key that would
   * access it: an Array if the key is a number, otherwise an Object.
   *
   * Typically, instances are constructed by calling the Function exported
   * from `natural-lenses` (if `require`d) or its default export (if `import`ed),
   * conventionally named `lens`.
   */
  constructor(...keys) {
    this.keys = keys;
  }

  /**
   * @summary Test for the presence of this slot in subject data
   * @param {*}        subject The data to test
   * @return {Boolean}         Whether this slot is present in *subject*
   */
  present(subject) {
    let cur = subject;
    for (let i = 0; i < this.keys.length; i++) {
      const k = this.keys[i], next_maybe = index_maybe(cur, k);
      if ('just' in next_maybe) {
        cur = next_maybe.just;
      } else {
        return false;
      }
    }
    return true;
  }

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
   * if this slot in *subject* is not a Lens (as indicated by a truthy
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
   * @summary Get a combination of presence and value of this slot
   * @param {*} subject  The data to query
   * @param {...*} tail  Additional subject for repeated application
   * @return {Maybe}  Empty Object if this slot is not present in *subject*,
   *                  otherwise Object with `just` property containing value of this slot in *subject*
   *
   * @description
   * This implements the Maybe monad (familiar from Haskell), where Nothing is
   * represented as an empty Object and Just is represented as an Object with a
   * `just` property containing the value in the slot.
   *
   * If *tail* is given and getting this slot from from *subject* yields a
   * Lens (as indicated by a truthy `lens.isLens` property), then `#get_maybe()`
   * is called on that Lens, passing the spread of *tail*.  If the value of
   * this slot is *not* a Lens, the result is an empty Object.
   */
  get_maybe(subject, ...tail) {
    let cur = subject;
    for (let i = 0; i < this.keys.length; i++) {
      const k = this.keys[i];
      const next_maybe = (function() {
        if (k instanceof CustomStep) {
          return k.get_maybe(cur);
        } else {
          return index_maybe(cur, k);
        }
      }());
      if ('just' in next_maybe) {
        cur = next_maybe.just;
      } else {
        return {}
      }
    }
    if (tail.length > 0) {
      return isLens(cur) ? cur.get_maybe(...tail) : {};
    }
    return {just: cur};
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
   * This method differs from Lens#get in that the returned value will always
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
   * @param {Object}         dispatch
   * @param {function(*): T} [dispatch.then]  Function evaluated if slot is present in *subject*
   * @param {function(): T}  [dispatch.else]  Function evaluated if slot is absent from *subject*
   * @returns {T} The value computed by *dispatch.then* or *dispatch.else*, or `undefined`
   *
   * @description
   * The presence of the slot determines whether *dispatch.then* or *dispatch.else*
   * is evaluated, with the result being returned from this method.  If the
   * indicated property of *dispatch* is missing, then `undefined` is returned.
   */
  getting(subject, {then: thenDo, else: elseDo}) {
    const maybeVal = this.get_maybe(subject),
      handler = ('just' in maybeVal ? thenDo : elseDo) || (() => {});
    return handler.call(undefined, maybeVal.just);
  }

  /**
   * @template T
   * @summary Clone the input, setting the value of this slot within the clone
   * @param {T} subject  The input structured data
   * @param {*} newVal   The new value to inject into the slot identified by this lens
   * @return {T} A minimally changed clone of subject with newVal in this slot
   *
   * @description
   * "Minimally changed" means that reference-copies are used wherever possible
   * while leaving subject unchanged, and that setting the slot to the strict-
   * equal value it already has results in returning subject.
   */
  setInClone(subject, newVal) {
    const slots = new Array(this.keys.length);
    let cur = subject;
    for (let i = 0; i < this.keys.length; i++) {
      const k = this.keys[i];
      const slot = slots[i] = makeSlot(cur, k);
      const next_maybe = slot.get_maybe();
      if ('just' in next_maybe) {
        cur = next_maybe.just;
      } else if (i + 1 < this.keys.length) {
        cur = this._constructFor(i + 1);
      }
    }
    if (slots[slots.length - 1].get() === newVal) {
      return subject;
    }
    cur = newVal;
    for (let i = slots.length - 1; i >= 0; i--) {
      cur = slots[i].cloneAndSet(cur);
    }
    return cur;
  }

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
   * If this slot is missing in subject, fn will not be called unless *addMissing*
   * is true, in which case fn will be called with undefined.
   *
   * "Minimally changed" means that reference-copies are used wherever possible
   * while leaving subject unchanged, and that setting the slot to the strict-
   * equal value it already has results in returning subject.
   */
  xformInClone(subject, fn, {addMissing = false} = {}) {
    const slots = new Array(this.keys.length);
    let cur = subject;
    for (let i = 0; i < this.keys.length; i++) {
      const k = this.keys[i];
      const slot = slots[i] = makeSlot(cur, k);
      const next_maybe = slot.get_maybe();
      if ('just' in next_maybe) {
        cur = next_maybe.just;
      } else if (addMissing) {
        if (i + 1 < this.keys.length) {
          cur = this._constructFor(i + 1);
        }
      } else {
        return subject;
      }
    }
    if (slots.length) {
      const prevVal = slots[slots.length - 1].get();
      cur = fn(prevVal);
      if (cur === prevVal) {
        return subject;
      }
      for (let i = slots.length - 1; i >= 0; i--) {
        cur = slots[i].cloneAndSet(cur);
      }
    } else {
      cur = fn(subject);
    }
    return cur;
  }

  /**
   * @template T
   * @summary Clone the input, transforming or deleting the Maybe value of this slot with a function
   * @param {T}                      subject  The input structured data
   * @param {function(Maybe): Maybe} fn       The function transforming the {@link Maybe} value of the slot
   * @return {T} A minimally changed clone of *subject* with this slot transformed per *fn*
   *
   * @description
   * The value given to *fn* will be the result of {@link Lens#get_maybe}, which
   * indicates absence of this slot in *subject* by omitting the `just` property,
   * which otherwise contains the value of this slot in *subject*.  The value
   * returned by *fn* is the result that should be returned by calling
   * {@link Lens#get_maybe} of this slot on the modified clone: if no `just`
   * property is returned by *fn*, the slot is deleted from the clone, and
   * the value of the `just` property is otherwise set for this slot in the
   * clone.
   *
   * This implements what would, in Haskell, be described as:
   *
   *    Json -> (Maybe Json -> Maybe Json) -> Json
   *
   * "Minimally changed" means that reference-copies are used wherever possible
   * while leaving subject unchanged, and that setting the slot to the strict-
   * equal value it already has results in returning subject.
   */
  xformInClone_maybe(subject, fn) {
    const slots = new Array(this.keys.length);
    let cur = subject, present = true;
    for (let i = 0; i < this.keys.length; i++) {
      const k = this.keys[i];
      const slot = slots[i] = makeSlot(cur, k);
      const next_maybe = slot.get_maybe();
      if ('just' in next_maybe) {
        cur = next_maybe.just;
      } else {
        present = false;
        if (i + 1 < this.keys.length) {
          cur = this._constructFor(i + 1);
        }
      }
    }
    const prevVal = slots[slots.length - 1].get();
    const maybe_val = fn(present ? {just: prevVal} : {});
    const setting = 'just' in maybe_val;
    if (present && !setting) {
      cur = slots[slots.length - 1].cloneOmitting();
      if (cur === slots[slots.length - 1].subject) {
        return subject;
      }
      for (let i = slots.length - 2; i >= 0; i--) {
        cur = slots[i].cloneAndSet(cur);
      }
    } else if (setting) {
      if (present && prevVal === maybe_val.just) {
        return subject;
      }
      cur = maybe_val.just;
      for (let i = slots.length - 1; i >= 0; i--) {
        cur = slots[i].cloneAndSet(cur);
      }
    } else {
      return subject;
    }
    return cur;
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
    return this.xformInClone_maybe(subject, (maybeVal) => {
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
        log({
          level: 'warn',
          message: "Noniterable result from fn of xformIterableInClone; substituting empty Array",
          subject,
          keys: this.keys,
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
   * @summary DRYly bind a Function to the Object from which it was obtained
   * @param {*} subject  The input structured data
   * @param {Object} [options]
   * @param {*} [options.orThrow]  {@link OptionalThrow} if the slot referenced does not contain a Function; has precedence over *or*
   * @param {*} [options.or]  A value to return if the slot referenced does not contain a Function
   * @return {Function} A Function bound to the previous object in the chain used to access the Function
   *
   * @description
   * Use this to avoid the dreaded Javascript binding repetition of
   * `o.fn.bind(o)`.  Instead, use `lens('fn').bound(o)`.
   */
  bound(subject, {orThrow, or} = {}) {
    const lCopy = new Lens(...this.keys), mname = lCopy.keys.pop();
    const mSubj = lCopy.get(subject), fn = (function() {
      try {return mSubj[mname];} catch (e) {}
    }());
    if (isFunction(fn)) {
      return fn.bind(mSubj);
    }
    if (orThrow) {
      throw orThrow;
    } else if (or) {
      return or;
    }
    return function() {};
  }

  /**
   * Combine the effects of multiple Lenses
   *
   * It is preferred to use {@link module:natural-lenses#fuse}
   */
  static fuse(...lenses) {
    if (!lenses.every(l => l.constructor === Lens)) {
      throw "Expected all arguments to be exactly Lens (no derived classes)";
    }
    return new Lens(...lenses.flatMap(l => l.keys));
  }
  
  /*
   * @package
   * @summary Construct a container for a clone given the depth
   */
  _constructFor(depth) {
    const key = this.keys[depth];
    if (key instanceof CustomStep) {
      return key.construct();
    }
    return (typeof key === 'number') ? [] : {};
  }
}
Object.assign(Lens.prototype, BinderMixin);

class Slot {
  constructor(target, key) {
    this.target = target;
    this.key = key;
  }

  get() {
    return this.get_maybe().just;
  }

  get_maybe() {
    return index_maybe(this.target, this.key);
  }

  cloneAndSet(val) {
    const rval = this.cloneTarget({set: [this.key, val]});
    return rval;
  }

  cloneOmitting() {
    const rval = this.cloneTarget({spliceOut: this.key});
    return rval;
  }

  cloneTarget(opDesc /* {set, spliceOut} */ = {}) {
    return this.target[cloneImpl](opDesc);
  }
}

class CSSlot {
  constructor(target, customStep) {
    this.target = target;
    this.customStep = customStep;
  }
  
  get() {
    return this.get_maybe().just;
  }
  
  get_maybe() {
    return this.customStep.get_maybe(this.target);
  }
  
  cloneAndSet(val) {
    return this.customStep.updatedClone(this.target, {just: val});
  }
  
  cloneOmitting() {
    return this.customStep.updatedClone(this.target, {});
  }
}

function makeSlot(cur, k) {
  return new ((k instanceof CustomStep) ? CSSlot : Slot)(cur, k);
}

function log(info) {
  console[info.level || 'info'](info);
}

function handleNoniterableValue(excVal, maybeVal) {
  if (isUndefined(excVal) || !('just' in maybeVal)) {
    return;
  }
  if (isObject(excVal)) {
    excVal.noniterableValue = maybeVal.just;
  }
  throw excVal;
}

export default Lens;
