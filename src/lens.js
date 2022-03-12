import { isFunction, isUndefined } from 'underscore';
import { cloneImpl, isLensClass } from '../src-cjs/constants.js';
import CustomStep from './custom_step.js';
import Optic from './optic.js';
import { getIterator, handleNoniterableValue, index_maybe, isLens } from './utils.js';

// Polyfill support for lenses to standard JavaScript types
import './stdlib_support/object.js';
import './stdlib_support/array.js';
import './stdlib_support/map.js';

/**
 * @typedef {Object} OptionalThrow
 * @property {*} [orThrow]  The value to `throw` in case of an error.
 */

/**
 * @typedef {Object} FallbackBindingResult
 * @property {Function} [or]  The function to return if the slot does not contain a function.
 */

/**
 * @typedef {Object} Maybe
 * @property {*} [just]  The contained value
 * @see Haskell's "Maybe" data type
 *
 * @description
 * The presence of `just` as a property indicates the "Just" construction of
 * the Maybe monad — the presence of a value (even if `undefined`).  A Maybe
 * without a `just` property is the "Nothing" construction.
 */

/**
 * @extends Optic
 * @property {Array.<*>} keys  Indexing/subscripting values to be applied successively to subjects of this lens
 */
class Lens extends Optic {
  /**
   * @summary Class for operating immutably on a specific "slot" in complex data
   * @extends Optic
   * @param {...*} key  A value to use in an application of subscripting (i.e. square bracket operator)
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
   * traversed to reach that slot in the subject's tree.
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
    super();
    this.keys = keys;
  }

  /**
   * @summary Get a combination of presence and value of this slot
   * @param {*} subject  The data to query
   * @param {...*} tail  Additional subject for repeated application
   * @return {Maybe.<*>}  Empty Object if this slot is not present in *subject*,
   *                      otherwise Object with `just` property containing value of this slot in *subject*
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
   * @template T
   * @summary Clone *subject*, setting the value of this slot within the clone
   * @param {T} subject  The input structured data
   * @param {*} newVal   The new value to inject into the slot identified by this lens
   * @return {T} A minimally changed clone of *subject* with *newVal* in this slot
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
    if (slots.length) {
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
    } else {
      cur = fn({just: subject}).just;
    }
    return cur;
  }
  
  /**
   * @summary DRYly bind a Function to the Object from which it was obtained
   * @param {*} subject  The input structured data
   * @param {Object} [options]
   * @param {boolean} [options.bindNow=true]  Bind to the target of this lens with *subject* now rather than when the result function is invoked
   * @param {*} [options.orThrow]  {@link OptionalThrow} if the slot referenced does not contain a Function; has precedence over *or*
   * @param {Function} [options.or]  {@link FallbackBindingResult}, a Function to return if the slot referenced does not contain a Function
   * @return {Function} A Function bound to the previous object in the chain used to access the Function
   *
   * @description
   * Use this to avoid the dreaded Javascript binding repetition of
   * `o.fn.bind(o)`.  Instead, use `lens('fn').bound(o)`.
   */
  bound(subject, {bindNow = true, orThrow, or} = {}) {
    const lens = this;
    function lookUpPlayers() {
      const lCopy = new Lens(...lens.keys), mname = lCopy.keys.pop();
      const mSubj = lCopy.get(subject), fn = (function() {
        try {return mSubj[mname];} catch (e) {}
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
    let target = this.target;
    if (!target) {
      target = (typeof key === 'number') ? [] : {};
    }
    return target[cloneImpl](opDesc);
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

export default Lens;
