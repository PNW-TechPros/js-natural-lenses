import Lens from './lens.js';
import { Parser, states, actions } from '../src-cjs/tag-parser.js';

const RAW_VALUE_MARK = '⦃…⦄';
const MISSING_VALUE = new Error();

const cacheSpaceAllocations = new Map([[null, 100]]);

const lensBuilderCache = new Map();
lensBuilderCache.allocated = cacheSpaceAllocations.get(null);
/**
 * @module natural-lenses/sugar
 * @summary String template tag for constructing a Lens with JSONPath-like syntax
 * @returns {Lens} A lens constructed from the JSONPath (and intercalated values) given
 *
 * @description
 * This module is (when `require`d) or exports as default (when `import`ed) a
 * Function implementing a string template tag interpreting a subset of JSONPath
 * to construct a {@link Lens}.  The only supported JSONPath operators
 * are the single dot (`.`) and the square brackets (`[...]`); all other
 * operators would result in a non-Lens optic.  Within the square brackets,
 * only string literals (in single- or double-quotes), unsigned or negative
 * integers, and intercalated values are allowed.  Use of unquoted `@` (the
 * JSONPath *current object/element*) in the expression is not allowed, and the
 * `$` (the JSONPath *root object*) is only allowed — and required — as the
 * first character of the expression.
 *
 * When an intercalated value is used within a subscript operator, the actual
 * JavaScript value — not its string representation — is used as the step in
 * the {@link Lens}; this allows for using [`lens.Step`]{@link Step} for
 * custom stepping or arbitrary JavaScript values for keys into a Map or similar
 * container.
 *
 * This template tag processes the raw strings used in the template (to avoid
 * doubling of backslashes for escape sequences); though this means a
 * backslash-backtick combination (since backtick by itself ends the template)
 * is processed as two characters, the only valid context for this to occur —
 * due to the JSONPath syntax — is inside a string literal within square
 * brackets, in which case the backslash-backtick sequence will be interpreted
 * as a single backtick anyway.  If this causes confusion, the `\x60` escape
 * sequence can be used instead.
 *
 * # Examples
 * 
 * ```js
 * const lens = require('natural-lenses'),  A = require('natural-lenses/sugar');
 *
 * # Equivalent expressions
 *
 * const lensExplicit1 = lens('foo', 'bar'), lensSugar1 = A`$.foo.bar`;
 *
 * const lensExplicit2 = lens('street', 1), lensSugar2 = A`$.street[1]`;
 *
 * const marker = Symbol('marker');
 * const lensExplicit3 = lens('item', marker), lensSugar3 = A`$.item[${marker}]`;
 * ```
 */
export default function lensFromJSONPath(stringParts, ...values) {
  const cacheKey = stringParts.raw.join('!');
  let lensBuilder = lensBuilderCache.get(cacheKey) ||
    lensBuilderFromTemplateStrings(stringParts.raw);
  
  // Delete before setting to implement LRU caching
  lensBuilderCache.delete(cacheKey);
  lensBuilderCache.set(cacheKey, lensBuilder);
  pruneLensBuilderCache();
  
  return lensBuilder(values);
}

const INTERCALATED_VALUE_PLACEHOLDER = Symbol('intercalated value');
function lensBuilderFromTemplateStrings(stringParts) {
  const stringsCursor = stringParts[Symbol.iterator]();
  let {value: curString, done} = stringsCursor.next();
  if (done) {
    return () => new Lens();
  }
  
  const parser = new Parser();
  const steps = [], ivIndexes = [];
  let accum = '', charCursor = curString[Symbol.iterator](), curCharRecord;
  let consumed = '', captureStart;
  
  const actions = {
    append(ch) {
      if (!accum) {
        captureStart = consumed.length;
      }
      accum += ch;
    },
    
    emit_value() {
      steps.push(accum);
      accum = '';
    },
    
    emit_literal() {
      steps.push(eval(accum));
      accum = '';
    },
    
    consume_intercalated_value() {
      ivIndexes.push(steps.length);
      steps.push(INTERCALATED_VALUE_PLACEHOLDER);
      consumed += RAW_VALUE_MARK;
      curString = getNext(stringsCursor, () => {
        throw new Error("Too few template parts!");
      });
      charCursor = curString[Symbol.iterator]();
      curCharRecord = charCursor.next();
      parser.state = states.subscript_value_emitted;
    },
    
    scan() {
      consumed += curCharRecord.value;
      curCharRecord = charCursor.next();
    },
  };
  
  curCharRecord = charCursor.next();
  try {
    while(!curCharRecord.done && parser.processChar(curCharRecord.value, actions)) {
      if (curCharRecord.done) {
        parser.inputEnds(actions);
      }
    }
  } catch (e) {
    if (e !== MISSING_VALUE) throw e;
  }
  
  if (!parser.state) {
    const reducedInput = stringParts.join(RAW_VALUE_MARK),
      asciiArt = `\n    ${reducedInput}\n    ${' '.repeat(consumed.length)}^\n`;
    throw Object.assign(
      new Error("JSONPath (subset) syntax error\n" + asciiArt),
      { consumed, from: reducedInput }
    );
  }
  
  if (!parser.isFinal()) {
    const reducedInput = stringParts.join(RAW_VALUE_MARK),
      asciiArt = `\n\n    ${reducedInput}\n    ${' '.repeat(captureStart) + '^'.repeat(reducedInput.length - captureStart)}\n`;
    const error = new Error("Path ended prematurely!" + (
      accum ? asciiArt : ''
    ));
    if (accum) {
      error.accumulatedText = accum;
    }
    throw error;
  }
  
  if (!stringsCursor.next().done) {
    throw new Error("Too many string parts!");
  }
  
  return (values) => {
    if (values.length !== ivIndexes.length) {
      throw new Error(`Expected ${ivIndexes.length} values, received ${values.length}`);
    }
    
    const lensSteps = [...steps];
    ivIndexes.forEach((stepsIndex, i) => {
      lensSteps[stepsIndex] = values[i];
    });
    return new Lens(...lensSteps);
  };
}

function getNext(cursor, getDefault) {
  const { value, done } = cursor.next();
  if (done) {
    return getDefault();
  }
  return value;
}

function pruneLensBuilderCache() {
  for (const key of lensBuilderCache.keys()) {
    if (lensBuilderCache.size <= lensBuilderCache.allocated) {
      break;
    }
    
    lensBuilderCache.delete(key);
  }
}

/**
 * @name module:natural-lenses/sugar#cache
 * @summary Parse Cache Control
 *
 * @description
 * 
 */
export const cache = {
  /**
   * @summary Create or update an allocation of parser cache entries
   * @param {Symbol|Object} allocationKey - Key for allocation
   * @param {Number}        size          - Number of cache slots to allocate
   *
   * @description
   * Cache allocations should be made by any package depending on this package
   * and making significant use of sugar syntax.  It can be used to either
   * temporarily boost the cache size or to more permanently boost the cache
   * size for ongoing operations.
   */
  setAllocation(allocationKey, size) {
    if (isNaN(size) || (size = Number(size)) < 0) {
      throw new Error("Cache allocation size must be a valid, non-negative number");
    }
    cacheSpaceAllocations.set(allocationKey, size);
    recomputeCacheAllocation();
  },
  
  /**
   * @summary Remove a previously placed cache allocation
   * @param {Symbol|Object} allocationKey - Key for allocation
   *
   * @description
   * If the need for a previously placed cache allocation is removed, call this
   * method with the key used to make the allocation.
   */
  cancelAllocation(allocationKey) {
    cacheSpaceAllocations.delete(allocationKey);
    recomputeCacheAllocation();
  },
  
  /**
   * @summary Current total of allocated cache slots
   * @type {number}
   */
  get totalAllocated() {
    return lensBuilderCache.allocated;
  },
  
  /**
   * @summary Current number of cache slots consumed
   * @type {number}
   */
  get used() {
    return lensBuilderCache.size;
  },
}

function recomputeCacheAllocation() {
  lensBuilderCache.allocated = [...cacheSpaceAllocations.values()].reduce(
    (r, v) => r + v,
    0
  );
  if (lensBuilderCache.size > lensBuilderCache.allocated) {
    pruneLensBuilderCache();
  }
}
