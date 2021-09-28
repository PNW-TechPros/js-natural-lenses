const _ = require('underscore');

const isLensClass = Symbol("isLens"), isLens = _.property(isLensClass);
const at_maybe = Symbol("lensAt_maybe");

Object.prototype[at_maybe] = function(key) {
  return (key in this) ? {just: this[key]} : {};
}
Array.prototype[at_maybe] = function(key) {
  if (typeof key === 'number') {
    if (key < -this.length || key >= this.length) {
      return {};
    }
    if (key < 0) {
      key = this.length + key;
    }
  }
  return (key in this) ? {just: this[key]} : {};
}

function index_maybe(subject, key) {
  return _.isObject(subject) ? subject[at_maybe](key) : {};
}

function indexedTransform(fns, key) {
  const val_maybe = index_maybe(fns, key);
  return val_maybe.just || _.identity;
}

class Binder {
  /**
   * @summary Syntactic sugar for binding a method to the instance
   * @param {String} method Name of the method to bind
   * @return {Function}     The bound method for later calling
   *
   * @description
   * This works like Python's method resolution, where the access to the
   * "attribute" (in Python terms) causes the class instance to be curried
   * as the first argument, thus "bound" to the instance.  In Javascript,
   * however, retrieving the method via property *does not* bind the instance
   * to `this` -- that happens at call time, and only binds to the instance
   * if the `.` operator is used at the point of the call.
   *
   * This is highly inconvenient for functional-style programming, as binding
   * `this` requires two references to the object: the first to get the
   * proper Function, the second to lock the `this` reference.  Instead, this
   * method allows retrieving and binding in a single call:
   *
   *     _.map(collection, myLens.$('get'))
   *
   * This syntactic sugar also works with backticks to further streamline
   * functional-style programming:
   *
   *     _.map(collection, myLens.$`get`)
   */
  $(method) {
    // Support tagged template syntax
    if (_.isArray(method)) {
      method = _.reduce(
        _.range(1, arguments.length),
        (cur, i) => cur + arguments[i].toString() + method[i],
        method[0]
      );
    }
    return this[method].bind(this);
  }
}

/**
 * @summary Class for operating immutably on a specific "slot" in complex data
 *
 * @description
 * Working with Jasascript data (especially JSON data) that is deeply nested
 * in an immutable way can be
 */
class Lens extends Binder {
  [isLensClass] = true;

  constructor(...keys) {
    super();
    this.keys = keys;
  }

  /**
   * @summary Test for the presence of this slot in subject data
   * @param            subject The data to test
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
   * @param subject The data to query
   * @param tail    Additional subjects for repeated application
   * @return        The value of this slot, or `undefined` if this slot is not present in *subject*
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
   * @param subject The data to query
   * @return        Empty Object if this slot is not present in *subject*,
   *                otherwise Object with `just` property containing value of this slot in *subject*
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
      const k = this.keys[i], next_maybe = index_maybe(cur, k);
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
   * @summary Clone the input, setting the value of this slot within the clone
   * @param subject The input structured data
   * @param newVal  The new value to inject into the slot identified by this lens
   * @return        A minimally changed clone of subject with newVal in this slot
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
      const slot = slots[i] = new Slot(cur, k);
      const next_maybe = slot.get_maybe();
      if ('just' in next_maybe) {
        cur = next_maybe.just;
      } else {
        cur = (typeof k === 'number') ? [] : {};
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
   * @summary Clone the input, transforming the value within this slot with a function
   * @param            subject             The input structured data
   * @param {Function} fn                  The function that transforms the slot value
   * @param {Boolean}  addMissinng=false   Whether to add the slot if missing in subject
   * @return                               A minimally changed clone of subject with the transformed value in this slot
   *
   * @description
   * If this slot is missing in subject, fn will not be called unless addMissing
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
      const slot = slots[i] = new Slot(cur, k);
      const next_maybe = slot.get_maybe();
      if ('just' in next_maybe) {
        cur = next_maybe.just;
      } else if (addMissing) {
        cur = (typeof k === 'number') ? [] : {};
      } else {
        return subject;
      }
    }
    const prevVal = slots[slots.length - 1].get();
    cur = fn(prevVal);
    if (cur === prevVal) {
      return subject;
    }
    for (let i = slots.length - 1; i >= 0; i--) {
      cur = slots[i].cloneAndSet(cur);
    }
    return cur;
  }

  /**
   * @summary Clone the input, transforming or deleting the Maybe value of this slot with a function
   * @param            subject  The input structured data
   * @param {Function} fn       The function transforming the Maybe value of the slot
   * @return                    A minimally changed clone of subject with this slot transformed per fn
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
      const slot = slots[i] = new Slot(cur, k);
      const next_maybe = slot.get_maybe();
      if ('just' in next_maybe) {
        cur = next_maybe.just;
      } else {
        cur = (typeof k === 'number') ? [] : {};
        present = false;
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
   * @summary DRYly bind a Function to the Object from which it was obtained
   * @param subject  The input structured data
   * @return         A Function bound to the previous object in the chain used to access the Function
   *
   * @description
   * Use this to avoid the dreaded Javascript binding repetition of
   * `o.fn.bind(o)`.  Instead, use `makeLens('fn').bound(o)`.
   */
  bound(subject, {orThrow, or} = {}) {
    const lCopy = new Lens(...this.keys), mname = lCopy.keys.pop();
    const mSubj = lCopy.get(subject);
    if (_.isObject(mSubj)) {
      const fn = mSubj[mname];
      if (_.isFunction(fn)) {
        return fn.bind(mSubj);
      }
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
   */
  static fuse(first, ...others) {
    return new Lens(...first.keys.concat(..._.map(others, l => l.keys)));
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
    const rval = this.cloneTarget();
    rval[this.key] = val;
    return rval;
  }

  cloneOmitting() {
    if (Array.isArray(this.target)) {
      if (typeof this.key === 'number') {
        if (this.key === this.target.length - 1) {
          return this.cloneTarget({pop: true});
        }
        if (this.key === -1 && this.target.length > 0) {
          return this.cloneTarget({pop: true});
        }
        if (this.key >= rval.length || this.key < -rval.length) {
          return this.target;
        }
        const rval = this.cloneTarget();
        if (this.key >= 0) {
          rval[this.key] = undefined;
        } else {
          rval[rval.length + this.key] = undefined;
        }
        return rval;
      }
    } else {
      if (this.target.hasOwnProperty(this.key)) {
        const rval = this.cloneTarget();
        delete rval[this.key];
        return rval;
      }
    }
    return this.target;
  }

  cloneTarget({pop = false} = {}) {
    const explicitCloner = this.target[makeLens.clone];
    if (explicitCloner) {
      const rval = explicitCloner.call(this.target);
      if (pop) {
        rval.pop();
      }
      return rval;
    }
    if (Array.isArray(this.target)) {
      const rval = pop ? this.target.slice(0, -1) : this.target.concat();
      for (let k of _.keys(this.target)) {
        if (isNaN(k)) {
          rval[k] = this.target[k];
        }
      }
      return rval;
    }
    if (this.target.constructor !== Object) {
      throw `'${this.target.constructor.name}' is not cloneable; provide a [lens.clone] method or use a plain Object`;
    }
    return Object.assign({}, this.target);
  }
}

const lensCap = {
  get: function () {},
  get_maybe: function() {return {};}
};

class AbstractNFocal extends Binder {
  [isLensClass] = true;

  constructor(lenses) {
    super();
    this.lenses = lenses;
  }

  [at_maybe](idx) {
    return index_maybe(this.lenses, idx);
  }

  present(subject) {
    return _.reduce(
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
  xformInClone(subject, xformArray, opts) {
    if (!_.isFunction(opts)) {
      opts = _.identity.bind(null, opts);
    }
    return _.reduce(
      xformArray,
      (cur, [key, xform]) => {
        const lens = self.lenses[key];
        return lens ? lens.xformInClone(cur, xform, opts(key)) : cur;
      },
      subject
    );
  }

  xformInClone_maybe(subject, xformArray) {
    return _.reduce(
      xformArray,
      (cur, [key, xform]) => {
        const lens = self.lenses[key];
        return lens ? lens.xformInClone_maybe(cur, xform) : cur;
      },
      subject
    );
  }
}

class ArrayNFocal extends AbstractNFocal {
  get(subject, ...tail) {
    const subjResult = _.map(this.lenses, lens => lens.get(subject));
    if (tail.length > 0) {
      return new ArrayNFocal(
        _.map(subjResult, l => isLens(l) ? l : lensCap)
      ).get(...tail);
    }
    return subjResult;
  }

  get_maybe(subject, ...tail) {
    const subjResult_maybes = _.map(this.lenses, lens => lens.get_maybe(subject));
    const subjResult = _.map(subjResult_maybes, mr => mr.just);
    if (tail.length > 0) {
      return new ArrayNFocal(
        _.map(subjResult, r => isLens(r.just) ? r.just : lensCap)
      ).get_maybe(...tail);
    } else {
      return {just: subjResult};
    }
  }
}

class ObjectNFocal extends AbstractNFocal {
  get(subject, ...tail) {
    const subjResult = {};
    _.each(this.lenses, (lens, prop) => {
      const propVal_maybe = lens.get_maybe(subject);
      if ('just' in propVal_maybe) {
        subjResult[prop] = propVal_maybe.just;
      }
    });
    if (tail.length > 0) {
      return new ObjectNFocal(
        _.mapObject(subjResult, l => isLens(l) ? l : lensCap)
      ).get(...tail);
    }
    return subjResult;
  }

  get_maybe(subject, ...tail) {
    const subjResult = this.get(subject);
    if (tail.length > 0) {
      return new ObjectNFocal(
        _.mapObject(subjResult, r => isLens(r.just) ? r.just : lensCap)
      ).get_maybe(...tail);
    }
    return {just: subjResult};
  }
}

class OpticArray extends Binder {
  constructor(lenses) {
    super();
    this.lenses = lenses;
  }

  present() {return true;}

  get(subject, ...tail) {
    const subjResult = _.reduceRight(
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
      if (_.isEmpty(stepSubject.just)) {
        return {};
      }
    }
    return stepSubject;
  }
}

/**
 * Construct a Lens from the given indexing steps
 *
 * A Lens is a way to safely apply the indexing (i.e. square-bracket) operator
 * repeatedly, and to clone-with-changes a complex value to assist programming
 * in an immutable-data style.
 */
function makeLens(...keys) {
  return new Lens(...keys);
}
makeLens.fuse = function(...lenses) {
  for (let i = 0, step = null; (step = 1) && i < lenses.length - 1; i += step) {
    const [a, b] = lenses.slice(i, i + 2);
    if (a.constructor === Lens && b.constructor === Lens) {
      lenses.splice(i, 2, Lens.fuse(a, b)); step = 0;
    }
  }
  return (lenses.length === 1) ? lenses[0] : new OpticArray(lenses);
};
/**
 * Construct a multifocal lens
 *
 * Where a standard lens looks at a single *slot* within a JSONic object, a
 * multifocal lens consists of multiple lenses (standard or multifocal) whose
 * results are aggregated into a single value, which can be a dictionary-like
 * Object or an Array.
 *
 * Pass an Array of lenses to create a multifocal lens that outputs an Array,
 * where the position of each lens in the input Array corresponds to the
 * output position of the data (when *getting* with the multifocal lens).  When
 * *getting* in a Maybe context (`#get_maybe`), the result will always be an
 * Object with a `just` property, though some elements of the Array may be
 * empty.
 *
 * Pass an Object with lens values to create a multifocal lens outputting an
 * Object, which will bear the same properties as the input Object and whose
 * values are the values in the data referenced by the corresponding lens (when
 * *getting* using this multifocal lens).
 *
 * Be aware that the `xformInClone` method on these kinds of multifocal lenses
 * works differently on Object-based and Array-based multifocals, and both are
 * different from a basic Lens.
 */
makeLens.nfocal = function(lenses) {
  if (_.isArray(lenses)) {
    return new ArrayNFocal(lenses);
  } else {
    return new ObjectNFocal(lenses);
  }
};
makeLens.clone = Symbol("cloneForLens");
makeLens.isLens = isLensClass;
makeLens.at_maybe = at_maybe;
makeLens.eachFound = function*(maybe_val) {
  if (maybe_val.just && maybe_val.just[Symbol.iterator]) {
    for (let key of maybe_val.just) {
      if (key in maybe_val.just) {
        yield [maybe_val.just[key], key];
      }
    }
  } else if ('just' in maybe_val){
    yield [maybe_val.just];
  }
};
makeLens.maybeDo = function(maybe, then, orElse) {
  return ('just' in maybe) ? then(maybe.just) : (orElse ? orElse() : undefined);
};

module.exports = makeLens;

// lens(2, 'a').xform(collection, v => v.concat().splice(1, 1, 13, 14))
// lens.nfocal(lens(1), lens(2)).get()
// lens(0).get(lens.nfocal(lens(1), lens(2))).get([2,4,6,8])
// lens(0).get(lens.nfocal(lens(1), lens(2)), [2,4,6,8])
