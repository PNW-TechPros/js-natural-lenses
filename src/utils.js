import { isArray, isObject, isString, property } from 'underscore';
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
  } else if (isObject(val)) {
    for (const key in val) {
      if (val.hasOwnProperty(key)) {
        yield [val[key], key];
      }
    }
  } else {
    yield [val];
  }
}

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
