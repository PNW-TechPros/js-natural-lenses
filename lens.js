const _ = require('underscore');

const isLensClass = Symbol("isLens"), isLens = _.property(isLensClass);
const at_maybe = Symbol("lens.at_maybe");
const cloneImpl = Symbol("lens.clone");
const $iterator = _.property(Symbol.iterator);
function getIterator(val) {
  if (_.isString(val)) {
    return;
  }
  return $iterator(val);
}

Object.assign(Object.prototype, {
  [at_maybe]: function (key) {
    return (key in this) ? {just: this[key]} : {};
  },
  [cloneImpl]: function ({set, spliceOut}) {
    if (spliceOut && !this.hasOwnProperty(spliceOut)) {
      return this;
    }
    const Species = this.constructor[Symbol.species] || this.constructor;
    let inst = null;
    try {
      inst = new Species();
    } catch (e) {
      const cantConstruct = new Error(
        `'${this.constructor.name}' requires arguments for instantiation; provide a [lens.clone] method`
      );
      cantConstruct.cause = e;
      throw cantConstruct;
    }
    const result = Object.assign(inst, this);
    if (set) {
      result[set[0]] = set[1];
    } else if (spliceOut) {
      delete result[spliceOut];
    }
    return result;
  },
});
Object.assign(Array.prototype, {
  [at_maybe]: function (key) {
    if (typeof key === 'number') {
      if (key < -this.length || key >= this.length) {
        return {};
      }
      if (key < 0) {
        key = this.length + key;
      }
    }
    return (key in this) ? {just: this[key]} : {};
  },
  [cloneImpl]: function ({set, spliceOut}) {
    if (set) {
      const result = this.concat();
      result[set[0]] = set[1];
      return result;
    } else if (spliceOut) {
      const i = spliceOut < 0 ? this.length + spliceOut : spliceOut;
      if (i < 0 || i >= this.length || !(i in this)) {
        return this;
      }
      if (i === this.length - 1) {
        return this.slice(0, i);
      }
      const Species = this.constructor[Symbol.species];
      return (new Species()).concat(
        this.slice(0, spliceOut),
        new Array(1),
        this.slice(spliceOut + 1)
      );
    }
    return this.concat();
  },
});
Object.assign(Map.prototype, {
  [at_maybe]: function (key) {
    return this.has(key) ? {just: this.get(key)} : {};
  },
  [cloneImpl]: function ({set, spliceOut}) {
    if (spliceOut && !this.has(spliceOut)) {
      return this;
    }
    const Species = this.constructor[Symbol.species];
    const result = new Species(this);
    if (set) {
      result.set(...set);
    } else if (spliceOut) {
      result.delete(spliceOut);
    }
    return result;
  },
});

function index_maybe(subject, key) {
  return _.isObject(subject) ? subject[at_maybe](key) : {};
}

const BinderMixin = {
  '$': function(method) {
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
 * @summary Defines a custom step in a Lens
 *
 * @description
 * If standard logic for accessing data deeper in the conceptual structure
 * is not adequate, an instance of this class may be passed as a step in a
 * Lens, which will allow the Lens to have custom behavior.
 *
 * To construct this object, pass three Functions:
 * 
 * 1. A Function that returns a Maybe value for the slot within the container
 *    it is passed.
 * 2. A Function taking the current value of the container and applying a `set`
 *    or `spliceOut` operation, returning a modified clone
 * 3. A Function to construct a pristine instance of the container this step
 *    navigates
 *
 * Passing `null` for any of these functions will limit the functionality of
 * the lens: skipping either `construct` or `updatedClone` will prevent the lens
 * from constructing a missing container, skipping `updatedClone` will
 * additionally prevent the lens from modifying an existing container, and
 * skipping `get_maybe` will prevent retrieving or transforming values in
 * a subject.
 */
class CustomStep {
  constructor(get_maybe, updatedClone, construct) {
    Object.assign(this, {construct, updatedClone, get_maybe});
  }
}

/**
 * @summary Class for operating immutably on a specific "slot" in complex data
 *
 * @description
 * Working with Jasascript data (especially JSON data) that is deeply nested
 * in an immutable way can be
 */
class Lens {
  [isLensClass] = true;

  constructor(...keys) {
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
   * @param subject  The data to query
   * @param orThrow  A value to throw if the slot does not contains a non-iterable value
   * @return         An iterable of values from this slot (or an empty Array)
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
  
  *ifFound(subject) {
    const maybeVal = this.get_maybe(subject);
    if ('just' in maybeVal) {
      yield maybeVal.just;
    }
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
   * @summary Clone the input, transforming the iterable value within this slot with a function
   * @param            subject  The input structured data
   * @param {Function} fn       The function that transforms the (iterable) slot value
   * @param            orThrow  A value to throw if the slot contains a non-iterable value
   * @return                    A minimally changed clone of subject with the transformed value in this slot
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
   * The primary differences between this method and Lens#xformInClone are that
   * this method always passes an iterable value to *fn* and always calls *fn*
   * even if the slot is missing or does not contain an iterable value (unless
   * *orThrow* is given).
   *
   * Strings, though iterable, are considered scalar values; if the targeted
   * slot contains a string, the slot will be treated as non-iterable.
   *
   * "Minimally changed" means that reference-copies are used wherever possible
   * while leaving subject unchanged, and that setting the slot to the strict-
   * equal value it already has results in returning subject.
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
   * @param subject  The input structured data
   * @return         A Function bound to the previous object in the chain used to access the Function
   *
   * @description
   * Use this to avoid the dreaded Javascript binding repetition of
   * `o.fn.bind(o)`.  Instead, use `makeLens('fn').bound(o)`.
   */
  bound(subject, {orThrow, or} = {}) {
    const lCopy = new Lens(...this.keys), mname = lCopy.keys.pop();
    const mSubj = lCopy.get(subject), fn = (function() {
      try {return mSubj[mname];} catch (e) {}
    }());
    if (_.isFunction(fn)) {
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
   */
  static fuse(...lenses) {
    if (!lenses.every(l => l.constructor === Lens)) {
      throw "Expected all arguments to be exactly Lens (no derived classes)";
    }
    return new Lens(...lenses.flatMap(l => l.keys));
  }
  
  /**
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

class CCCLens extends Lens {
  constructor(...keys) {
    super(...keys);
    this._containerFactory = null;
  }
  
  _constructFor(depth) {
    return this._containerFactory.construct(this.keys.slice(0, depth + 1));
  }
}

const jsContainerFactoryInstanceContainerTypes = new WeakMap();
/**
 * @summary A class to construct alternative sequential/mapping typings based on key type
 * @description
 * Use containers with the interfaces of the Array and ES6 Map classes as the
 * constructed containers based on the type of the key to be used for indexing
 * the container: a number indicates an Array and anything else uses a Map.
 *
 * Pass an instance of this class as the containerFactory option when
 * constructing a LensFactory. The container types to be used can be customized
 * when constructing this factory.
 */
class JsContainerFactory {
  constructor(containerTypes = {Map, Array}) {
    jsContainerFactoryInstanceContainerTypes.set(this, {...containerTypes});
  }
  
  get containerTypes() {
    return {
      Map, Array,
      ...(jsContainerFactoryInstanceContainerTypes.get(this) || {})
    };
  }
  
  construct(keys) {
    const types = jsContainerFactoryInstanceContainerTypes.get(this);
    const k = keys[keys.length - 1];
    return (typeof k === 'number')
      ? new (types.Array || Array)()
      : new (types.Map || Map)();
  }
}
const jsContainers = new JsContainerFactory();

function ImmutableMixin({spliceOutWithDelete = false}) {
  return {
    [at_maybe]: function (key) {
      return this.has(key) ? {just: this.get(key)} : {};
    },
    [cloneImpl]: function ({pop, set, spliceOut}) {
      if (pop) {
        return this.pop();
      }
      if (set) {
        return this.set(...set);
      }
      if (spliceOut) {
        return spliceOutWithDelete ? this.delete(spliceOut) : this.set(spliceOut, undefined);
      }
      return this;
    },
  };
}
function polyfillImmutable(containerType) {
  const isList = containerType.isList;
  const proto = containerType.prototype,
    mixins = ImmutableMixin({spliceOutWithDelete: !isList});
  _.forEach(
    Object.getOwnPropertySymbols(mixins),
    (name) => {
      if (!proto.hasOwnProperty(name)) proto[name] = mixins[name];
    }
  )
}

/**
 * @summary A factory for Lens-derived objects with customized container construction
 * @description
 * When POD container types (Object and Array) are not the desired types to 
 * construct in a clone -- as with use of immutable containers -- this class
 * can be used to build lenses that *do* build the desired types of objects.
 * 
 * This class is often used in conjunction with a JsContainerFactory object
 * implementing the container factory.
 */
class LensFactory {
  constructor({containerFactory = jsContainers} = {}) {
    this.containerFactory = containerFactory;
  }
  
  lens(...keys) {
    const result = new CCCLens(...keys);
    result._containerFactory = this.containerFactory;
    return result;
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

  cloneTarget({set, spliceOut} = {}) {
    return this.target[makeLens.clone]({set, spliceOut});
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

const lensCap = {
  [isLensClass]: true,
  get: function () {},
  get_maybe: function() {return {};}
};

class AbstractNFocal {
  [isLensClass] = true;

  constructor(lenses) {
    this.lenses = lenses;
  }

  [at_maybe](idx) {
    return index_maybe(this.lenses, idx);
  }
  
  [cloneImpl](alteration) {
    return makeLens.nfocal(this.lenses[cloneImpl](alteration));
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
  xformInClone(subject, xformArray, opts = {}) {
    if (!_.isFunction(opts)) {
      opts = _.identity.bind(null, opts);
    }
    return _.reduce(
      xformArray,
      (cur, [key, xform]) => {
        const lens = this.lenses[key];
        return lens ? lens.xformInClone(cur, xform, opts(key)) : cur;
      },
      subject
    );
  }

  xformInClone_maybe(subject, xformArray) {
    return _.reduce(
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

class ArrayNFocal extends AbstractNFocal {
  get(subject, ...tail) {
    const subjResult = this.get_maybe(subject).just;
    if (tail.length > 0) {
      return new ArrayNFocal(
        _.map(subjResult, l => isLens(l) ? l : lensCap)
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
        _.map(subjResult, r => isLens(r.just) ? r.just : lensCap)
      ).get_maybe(...tail);
    } else {
      return {just: subjResult, multiFocal: true};
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
    return {just: subjResult, multiFocal: true};
  }
}

class OpticArray {
  constructor(lenses) {
    this.lenses = lenses;
  }

  present(subject) {
    if (this.lenses.length === 0) return true;
    const rval = _.reduceRight(
      this.lenses.slice(1),
      (subject, lens) => lens.get(subject),
      subject
    );
    return this.lenses[0].present(rval);
  }

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
Object.assign(OpticArray.prototype, BinderMixin);

function handleNoniterableValue(excVal, maybeVal) {
  if (_.isUndefined(excVal) || !('just' in maybeVal)) {
    return;
  }
  if (_.isObject(excVal)) {
    excVal.noniterableValue = maybeVal.just;
  }
  throw excVal;
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
makeLens.clone = cloneImpl;
makeLens.isLens = isLensClass;
makeLens.at_maybe = at_maybe;
makeLens.eachFound = function*(maybe_val) {
  if (!('just' in maybe_val)) {
    return;
  }
  const val = maybe_val.just;
  if (!maybe_val.multiFocal) {
    yield [val];
    return;
  }
  
  if (_.isArray(val)) {
    for (let i = 0; i < val.length; i++) {
      if (i in val) {
        yield [val[i], i];
      }
    }
  } else if (_.isObject(val)) {
    for (var key in val) {
      if (val.hasOwnProperty(key)) {
        yield [val[key], key];
      }
    }
  } else {
    yield [val];
  }
};
makeLens.maybeDo = function(maybe, then, orElse) {
  return ('just' in maybe) ? then(maybe.just) : (orElse ? orElse() : undefined);
};
makeLens.Step = CustomStep;
Object.assign(makeLens, {
  Factory: LensFactory,
  JsContainerFactory,
  jsContainers,
  polyfillImmutable,
});

module.exports = makeLens;

// lens(2, 'a').xform(collection, v => v.concat().splice(1, 1, 13, 14))
// lens.nfocal(lens(1), lens(2)).get()
// lens(0).get(lens.nfocal(lens(1), lens(2))).get([2,4,6,8])
// lens(0).get(lens.nfocal(lens(1), lens(2)), [2,4,6,8])
