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
 * Array.prototype.forEach if it used "rest" syntax, e.g.
 * ```js
 * values.forEach((...pair) => {
 *   const [value, index] = pair;
 *   // do something with index and value
 * });
 * ```
 * In the case of an {@link ArrayNFocal}, the index 1 value of each yielded
 * Array will be an integer index; in the case of an {@link ObjectNFocal}, the index 1
 * value of each yeilded Array will be a string key.
 *
 * This function can also be applied to a {@link Maybe} monad value obtained from
 * a monofocal optic (e.g. a {@link Lens}), in which case it yields either a
 * single element array containing the value if the input holds a `just` property
 * and does not yield, otherwise.  It is more flexible to apply
 * [maybeDo]{@link module:natural-lenses#maybeDo} or {@link Lens#getting}, as
 * these allow separate handling of the *Nothing* case.
 */
export function* eachFound(maybe_val) {
  if (!('just' in maybe_val)) {
    return;
  }
  const val = maybe_val.just;
  if (!maybe_val.multiFocal) {
    yield [val];
    return;
  }
  
  if (isArray(val)) {
    for (let i = 0; i < val.length; i++) {
      if (i in val) {
        yield [val[i], i];
      }
    }
  } else /* istanbul ignore else: unsupported case */ if (isObject(val)) {
    for (const key in val) {
      if (val.hasOwnProperty(key)) {
        yield [val[key], key];
      }
    }
  } else {
    yield [val];
  }
}

/**
 * @template T, U
 * @function module:natural-lenses#maybeDo
 * @summary Conditionally execute a function based on the construction of a {@link Maybe}
 * @param {Maybe.<T>} maybe  The input value determining which of the following arguments is invoked
 * @param {function(T): U} then  The function executed with the `just` value of *maybe*, if present
 * @param {function(): U} [orElse]  The function executed if *maybe* contains no `just` property
 * @returns {U} The result type of the invoked function
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
