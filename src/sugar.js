import Lens from './lens.js';
import { Parser, states, actions } from '../src-cjs/parser.js';

/**
 * @summary String template tag for constructing a Lens with JSONPath-like syntax
 *
 * @description
 * This string template tag allows a subset of JSONPath to be used for
 * constructing [Lenses]{@link Lens}.  The only supported JSONPath operators
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
 * for custom stepping or arbitrary JavaScript values for keys into a Map.
 *
 * This template tag processes the raw strings used in the template (to avoid
 * doubling of backslashes for escape sequences); though this means a
 * backslash-backtick combination (since backtick by itself ends the template)
 * is processed as two characters, the only valid context for this to occur —
 * due to the JSONPath syntax — is inside a string literal within square
 * brackets, in which case the backslash-backtick sequence will be interpreted
 * as a single backtick anyway.  If this causes confusion, the `\x60` escape
 * sequence can be used instead.
 */
export default function lensFromJSONPath(stringParts, values) {
  const stringsCursor = stringParts.raw[Symbol.iterator]();
  const valuesCursor = values[Symbol.iterator]();
  let {value: curString, done} = stringsCursor.next();
  if (done) {
    return lens();
  }
  
  const parser = new Parser();
  const steps = [];
  let accum = '', charCursor = curString[Symbol.iterator()](), curCharRecord;
  
  const actions = {
    append(ch) {
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
      steps.push(getNext(valuesCursor, "Too few values!"));
      curString = getNext(stringsCursor, "Too few template parts!");
      charCursor = curString[Symbol.iterator]();
      curCharRecord = charCursor.next();
      parser.state = states.subscript_value_emitted;
    },
    
    scan() {
      curCharRecord = charCursor.next();
    }
  };
  
  curCharRecord = charCursor.next();
  while (!curCharRecord.done && parser.processChar(curCharRecord.value, actions)) {
    if (curCharRecord.done) {
      parser.inputEnds(actions);
    }
  }
  
  if (!parser.isFinal()) {
    throw new Error("Path ended prematurely!");
  }
  
  if (!valuesCursor.next().done) {
    throw new Error("Too many values!")
  }
  
  return new Lens(...steps);
}

function getNext(cursor, errMsg) {
  const { value, done } = cursor.next();
  if (done) {
    throw new Error(errMsg);
  }
  return value;
}
