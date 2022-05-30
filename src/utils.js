import { isArray, isObject, isString, isUndefined, property } from 'underscore';
import { isLensClass, at_maybe } from '../src-cjs/constants.js';

export const isLens = property(isLensClass);
export const $iterator = property(Symbol.iterator);

export function index_maybe(subject, key) {
  return isObject(subject) ? subject[at_maybe](key) : {};
}
export function getIterator(val) {
  if (isString(val)) {
    return;
  }
  return $iterator(val);
}

/**
 * @typedef {Array} FoundPair
 * @property {*} 0  Value of found item
 * @property {number|string} [1]  Index or key of found item
 */

/**
 * @generator
 * @function module:natural-lenses#eachFound
 * @summary Iterate over Maybe monad contained value(s)
 * @param {Maybe.<*>} maybe_val  Maybe monad of value or iterable value
 * @yields {FoundPair}  Pairs of value and key
 * @see {@link module:natural-lenses#maybeDo}
 *
 * @description
 * When called on the result of [getting a multifocal into a Maybe monad]{@link AbstractNFocal#get_maybe},
 * this function iterates found values (and only the found values), yielding the
 * pair of the value and index for each, like the arguments to the callback of
 * `Array.prototype.forEach` if it used "rest" syntax, e.g.
 * ```js
 * values.forEach((...pair) => {
 *   const [value, index] = pair;
 *   // do something with index and value
 * });
 * ```
 * When called on the `get_maybe`-result of an {@link ArrayNFocal}, the index 1
 * value of each yielded Array will be an integer index; with an {@link ObjectNFocal},
 * the index 1 value of each yeilded Array will be a string key.
 *
 * This function can also be applied to a {@link Maybe} monad value obtained from
 * a monofocal optic (e.g. a {@link Lens}), in which case it yields either a
 * single element array containing the value if the input holds a `just` property
 * and does not yield, otherwise.  It is more flexible to apply
 * [maybeDo]{@link module:natural-lenses#maybeDo} or {@link Optic#getting}, as
 * these allow separate handling of the *Nothing* case.
 */
export function eachFound(maybe_val) {
  if (!('just' in maybe_val)) {
    return makeIterable(() => ({done: true}));
  }
  const val = maybe_val.just;
  if (!maybe_val.multiFocal) {
    let i = 0;
    return makeIterable(() => {
      if (i === 0) {
        ++i;
        return {done: false, value: [val]};
      } else {
        return {done: true};
      }
    });
  }
  
  if (isArray(val)) {
    let i = 0;
    return makeIterable(() => {
      while (i < val.length && !(i in val)) {
        ++i;
      }
      if (i < val.length) {
        const iterVal = [val[i], i];
        ++i;
        return {done: false, value: iterVal};
      } else {
        return {done: true};
      }
    });
  } else /* istanbul ignore else: unsupported case */ if (isObject(val)) {
    const entries = Object.entries(val);
    let i = 0;
    return makeIterable(() => {
      if (i >= entries.length) {
        return {done: true};
      }
      const iterVal = {done: false, value: entries[i].reverse()};
      ++i;
      return iterVal;
    });
  } else {
    let i = 0;
    return makeIterable(() => {
      if (i === 0) {
        ++i;
        return {done: false, value: [val]};
      } else {
        return {done: true};
      }
    });
  }
}

function makeIterable(next) {
  return {[Symbol.iterator]: () => ({ next })};
}

/**
 * @template T, U
 * @function module:natural-lenses#maybeDo
 * @summary Conditionally execute a function based on the construction of a {@link Maybe}
 * @param {Maybe.<T>} maybe  The input value determining which of the following arguments is invoked
 * @param {function(T): U} then  The function executed with the `just` value of *maybe*, if present
 * @param {function(): U} [orElse]  The function executed if *maybe* contains no `just` property
 * @returns {U} The result type of the invoked function
 * @see Optic#getting
 *
 * @description
 * This function resembles an `if` statement around the "*Just*-ness" of a {@link Maybe}
 * value: the *then* Function gets called if *maybe* has a `just` and the *orElse*
 * Function if not.  Because of the usual intent of this conditional situation,
 * `maybe.just` value is passed to *then* if *then* is called.
 *
 * Whichever of *then* or *orElse* is called, its return value becomes the return
 * value of this function call.
 */
export function maybeDo(maybe, then, orElse) {
  return ('just' in maybe) ? then(maybe.just) : (orElse ? orElse() : undefined);
}

export const lensCap = {
  [isLensClass]: true,
  get: function () {},
  get_maybe: function() {return {};}
};

export function incorporateStdlibSupport(targetClass, methods) {
  const classProto = targetClass.prototype;
  methods.forEach(([sym, method]) => {
    if (!classProto.hasOwnProperty(sym)) {
      Object.defineProperty(classProto, sym, {
        configurable: true,
        writable: true,
        value: method,
      });
    }
  });
}

export function handleNoniterableValue(excVal, maybeVal) {
  if (isUndefined(excVal) || !('just' in maybeVal)) {
    return;
  }
  if (isObject(excVal)) {
    excVal.noniterableValue = maybeVal.just;
  }
  throw excVal;
}
