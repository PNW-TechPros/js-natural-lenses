// Generated from text-template.rb
const states = Object.freeze({
  start: 1,
  step_ready: 2,
  identifier: 3,
  identifier_tail: 4,
  subscript: 5,
  dq_literal: 6,
  dq_escape: 7,
  sq_literal: 8,
  sq_escape: 9,
  number: 10,
  subscript_end: 11,
  subscript_value_emitted: 12,
  error: 0,
});
const actions = Object.freeze({
  append: 1,
  emit_value: 2,
  emit_literal: 4,
  consume_intercalated_value: 8,
  scan: 16,
});
const parserTransitions = [
  [states.step_ready, states.error, states.error, states.error, states.error, states.error, states.error, states.error, states.error, states.start, states.error, states.error, states.start, states.error, states.error],
  [states.error, states.identifier, states.subscript, states.error, states.error, states.error, states.error, states.error, states.error, states.step_ready, states.error, states.error, states.step_ready, states.error, states.error],
  [states.identifier_tail, states.error, states.error, states.identifier_tail, states.error, states.error, states.error, states.error, states.error, states.identifier, states.error, states.error, states.identifier, states.error, states.error],
  [states.identifier_tail, states.step_ready, states.step_ready, states.identifier_tail, states.identifier_tail, states.step_ready, states.step_ready, states.step_ready, states.step_ready, states.step_ready, states.step_ready, states.step_ready, states.step_ready, states.step_ready, states.step_ready],
  [states.error, states.error, states.error, states.error, states.number, states.dq_literal, states.sq_literal, states.number, states.error, states.subscript, states.error, states.error, states.subscript, states.error, states.error],
  [states.dq_literal, states.dq_literal, states.dq_literal, states.dq_literal, states.dq_literal, states.subscript_end, states.dq_literal, states.dq_literal, states.dq_escape, states.dq_literal, states.error, states.error, states.error, states.dq_literal, states.dq_literal],
  [states.dq_literal, states.dq_literal, states.dq_literal, states.dq_literal, states.dq_literal, states.dq_literal, states.dq_literal, states.dq_literal, states.dq_literal, states.dq_literal, states.error, states.error, states.error, states.dq_literal, states.dq_literal],
  [states.sq_literal, states.sq_literal, states.sq_literal, states.sq_literal, states.sq_literal, states.sq_literal, states.subscript_end, states.sq_literal, states.sq_escape, states.sq_literal, states.error, states.error, states.error, states.sq_literal, states.sq_literal],
  [states.sq_literal, states.sq_literal, states.sq_literal, states.sq_literal, states.sq_literal, states.sq_literal, states.sq_literal, states.sq_literal, states.sq_literal, states.sq_literal, states.error, states.error, states.error, states.sq_literal, states.sq_literal],
  [states.subscript_end, states.subscript_end, states.subscript_end, states.subscript_end, states.number, states.subscript_end, states.subscript_end, states.subscript_end, states.subscript_end, states.subscript_end, states.subscript_end, states.subscript_end, states.subscript_end, states.subscript_end, states.subscript_end],
  [states.error, states.error, states.error, states.error, states.error, states.error, states.error, states.error, states.error, states.subscript_end, states.error, states.error, states.subscript_end, states.subscript_value_emitted, states.error],
  [states.error, states.error, states.error, states.error, states.error, states.error, states.error, states.error, states.error, states.subscript_value_emitted, states.error, states.error, states.subscript_value_emitted, states.step_ready, states.error],
];
const parserActions = (function () {
  function _([names]) {
    return names.split(',').map(n => actions[n]).reduce((a, b) => a | b);
  }
  return [
    [_`scan`, 0, 0, 0, 0, 0, 0, 0, 0, _`scan`, 0, 0, _`scan`, 0, 0],
    [0, _`scan`, _`scan`, 0, 0, 0, 0, 0, 0, _`scan`, 0, 0, _`scan`, 0, 0],
    [_`append,scan`, 0, 0, _`append,scan`, 0, 0, 0, 0, 0, _`scan`, 0, 0, _`scan`, 0, 0],
    [_`append,scan`, _`emit_value`, _`emit_value`, _`append,scan`, _`append,scan`, _`emit_value`, _`emit_value`, _`emit_value`, _`emit_value`, _`emit_value`, _`emit_value`, _`emit_value`, _`emit_value`, _`emit_value`, _`emit_value`],
    [0, 0, 0, 0, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, 0, _`scan`, 0, 0, _`scan`, 0, 0],
    [_`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, 0, 0, 0, _`append,scan`, _`append,scan`],
    [_`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, 0, 0, 0, _`append,scan`, _`append,scan`],
    [_`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, 0, 0, 0, _`append,scan`, _`append,scan`],
    [_`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, _`append,scan`, 0, 0, 0, _`append,scan`, _`append,scan`],
    [0, 0, 0, 0, _`append,scan`, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, _`scan`, 0, 0, _`scan`, _`emit_literal`, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, _`scan`, 0, 0, _`scan`, _`scan`, 0],
  ];
})();
const parserEndActions = (function () {
  function _([names]) {
    return names.split(',').map(n => actions[n]).reduce((a, b) => a | b);
  }
  return [
    0, // start
    0, // step_ready
    0, // identifier
    _`emit_value`, // identifier_tail
    _`consume_intercalated_value`, // subscript
    0, // dq_literal
    0, // dq_escape
    0, // sq_literal
    0, // sq_escape
    0, // number
    0, // subscript_end
    0, // subscript_value_emitted
  ];
})();
const classifyChar = (function() {
  const mapping = [
    11, 11, 11, 11, 11, 11, 11, 11, 11, 12, 12, 11, 11, 12, 11, 11, 11, 11, 11,
    11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 9, 14, 5, 14, 0, 14,
    14, 6, 14, 14, 14, 14, 14, 7, 1, 14, 4, 4, 4, 4, 4, 4, 4, 4, 4,
    4, 14, 14, 14, 14, 14, 14, 14, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
    3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 8, 13, 14,
    3, 14, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
    3, 3, 3, 3, 3, 3, 3, 3, 3, 14, 14, 14, 14, 10, 10, 10, 10, 10, 10,
    10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
    10, 10, 10, 10, 10, 10, 10, 10,
  ];
  return function classifyChar(ch) {
    ch = ch.codePointAt(0);
    if (ch >= mapping.length) return 14;
    return mapping[ch];
  };
}());
const isFinalState = (function() {
  const finalStates = new Set([
    states.step_ready,
    states.identifier_tail,
  ]);
  return finalStates.has.bind(finalStates);
}());
class Parser {
  constructor() {
    this.state = states.start;
  }
  processChar(ch, actionsImpl) {
    if (this.state === states.error) {
      return false;
    }
    const chCls = classifyChar(ch);
    const newState = parserTransitions[this.state - 1][chCls];
    if (newState === states.error) {
      this.state = newState;
      return false;
    }
    const transActions = parserActions[this.state - 1][chCls];
    if (transActions & actions.append) {
      actionsImpl.append(ch);
    }
    if (transActions & actions.emit_value) {
      actionsImpl.emit_value();
    }
    if (transActions & actions.emit_literal) {
      actionsImpl.emit_literal();
    }
    if (transActions & actions.consume_intercalated_value) {
      actionsImpl.consume_intercalated_value();
    }
    if (transActions & actions.scan) {
      actionsImpl.scan();
    }
    this.state = newState;
    return true;
  }
  inputEnds(actionsImpl) {
    if (this.state === states.error) {
      return false;
    }
    const finalActions = parserEndActions[this.state - 1];
    if (finalActions & actions.append) {
      actionsImpl.append(ch);
    }
    if (finalActions & actions.emit_value) {
      actionsImpl.emit_value();
    }
    if (finalActions & actions.emit_literal) {
      actionsImpl.emit_literal();
    }
    if (finalActions & actions.consume_intercalated_value) {
      actionsImpl.consume_intercalated_value();
    }
    if (finalActions & actions.scan) {
      actionsImpl.scan();
    }
    return true;
  }
  isFinal() {
    return isFinalState(this.state);
  }
}
exports.Parser = Parser;
exports.states = states;
exports.actions = actions;
