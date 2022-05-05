import Lens from './lens.js';
import { Parser, states, actions } from '../src-cjs/tag-parser.js';

const RAW_VALUE_MARK = '⦃…⦄';
const MISSING_VALUE = new Error();

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
  const stringsCursor = stringParts.raw[Symbol.iterator]();
  const valuesCursor = values[Symbol.iterator]();
  let {value: curString, done} = stringsCursor.next();
  if (done) {
    return new Lens();
  }
  
  const parser = new Parser();
  const steps = [];
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
      steps.push(getNext(valuesCursor, () => {throw MISSING_VALUE;}));
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
    }
  };
  
  curCharRecord = charCursor.next();
  try {
    while (!curCharRecord.done && parser.processChar(curCharRecord.value, actions)) {
      if (curCharRecord.done) {
        parser.inputEnds(actions);
      }
    }
  } catch (e) {
    if (e !== MISSING_VALUE) throw e;
  }
  
  if (!parser.state) {
    const reducedInput = stringParts.raw.join(RAW_VALUE_MARK),
      asciiArt = `\n    ${reducedInput}\n    ${' '.repeat(consumed.length)}^\n`;
    throw Object.assign(
      new Error("JSONPath (subset) syntax error\n" + asciiArt),
      { consumed, from: reducedInput }
    );
  }
  
  if (!parser.isFinal()) {
    const reducedInput = stringParts.raw.join(RAW_VALUE_MARK),
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
    throw new Error("Too many strings!");
  }
  
  if (!valuesCursor.next().done) {
    throw new Error("Too many values!")
  }
  
  return new Lens(...steps);
}

function getNext(cursor, getDefault) {
  const { value, done } = cursor.next();
  if (done) {
    return getDefault();
  }
  return value;
}
