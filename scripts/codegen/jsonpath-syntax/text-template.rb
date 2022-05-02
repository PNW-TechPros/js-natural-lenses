require 'fair_cg'
require 'json'

class JsonPathTemplateParser < FairCG::FiniteAutomaton
  action :append, char: 'ch'
  action :emit_value
  action :emit_literal # value should be eval'd
  action :consume_intercalated_value
  action :scan
  
  WS = " \t\n\r"
  
  state :start do
    transition('$' => :step_ready) {scan}
    transition(WS => :start) {scan}
  end
  
  state :step_ready, final: true do
    transition('.' => :identifier) {scan}
    transition('[' => :subscript) {scan}
    transition(WS => :step_ready) {scan}
  end
  
  state :identifier do
    transition('A-Za-z$_' => :identifier_tail) {append; scan}
    transition(WS => :identifier) {scan}
  end
  
  state :identifier_tail, final: true do
    transition('A-Za-z$_0-9' => :identifier_tail) {append; scan}
    at_end {emit_value}
    transition(:default => :step_ready) {emit_value}
  end
  
  state :subscript do
    at_end {consume_intercalated_value} # If a value is consumed, jump to :subscript_value_emitted
    transition('"' => :dq_literal) {append; scan}
    transition("'" => :sq_literal) {append; scan}
    transition('-0-9' => :number) {append; scan}
    transition(WS => :subscript) {scan}
  end
  
  state :dq_literal do
    transition('"' => :subscript_end) {append; scan}
    transition('\\' => :dq_escape) {append; scan}
    transition(0x00...0x20 => :error)
    transition(0x7f..0x9f => :error)
    transition(:default => :dq_literal) {append; scan}
  end
  
  state :dq_escape do
    transition(0x00...0x20 => :error)
    transition(0x7f..0x9f => :error)
    transition(:default => :dq_literal) {append; scan}
  end
  
  state :sq_literal do
    transition("'" => :subscript_end) {append; scan}
    transition('\\' => :sq_escape) {append; scan}
    transition(0x00...0x20 => :error)
    transition(0x7f..0x9f => :error)
    transition(:default => :sq_literal) {append; scan}
  end
  
  state :sq_escape do
    transition(0x00...0x20 => :error)
    transition(0x7f..0x9f => :error)
    transition(:default => :sq_literal) {append; scan}
  end
  
  state :number do
    transition('0-9' => :number) {append; scan}
    transition(:default => :subscript_end)
  end
  
  state :subscript_end do
    transition(WS => :subscript_end) {scan}
    transition(']' => :subscript_value_emitted) {emit_literal}
  end
  
  state :subscript_value_emitted do
    transition(WS => :subscript_value_emitted) {scan}
    transition(']' => :step_ready) {scan}
  end
end

module JsGenerator
  def generate(options = {})
    options = options.dup
    dest = options.delete(:to) || $stdout
    
    dest.puts(options[:message].to_s.gsub(/^/, '// ')) if options[:message]
    generate_implementation(dest)
  end
  
  def code_name(name)
    name.to_s
  end
  
  def generate_actions_enum(code)               # actions
    code_action_names = []
    code.puts "const actions = Object.freeze({"
    machine_def.actions.each do |name, action|
      name = code_name(name)
      raise "Action name collision (#{name})" if code_action_names.include?(name)
      code_action_names << name
      code.puts "  #{name}: #{1 << action.order_key},"
    end
    code.puts "});"
  end
  
  def generate_state_enum(code)                 # states
    code.puts "const states = Object.freeze({"
    (machine_def.state_names | [:error]).each_with_index do |name, i|
      if name == :error
        code.puts "  error: 0,"
        next
      end
      name = code_name(name)
      code.puts "  #{name}: #{i + 1},"
    end
    code.puts "});"
  end
  
  def generate_transition_table(code)           # parserTransitions
    code.puts "const parserTransitions = ["
    machine_def.state_names.each do |name|
      info = machine_def.state_info(name)
      states = []
      machine_def.character_classes.each do |cc|
        states << info.transition_for(cc[0]).end_state
      end
      states << info.transition_for(:other).end_state
      states.collect! {|s| "states.#{code_name(s)}"}
      code.puts "  [" + states.join(', ') + "],"
    end
    code.puts "];"
  end
  
  def generate_actions_table(code)              # parserActions
    code.puts "const parserActions = (function () {"
    code.puts %(  function _([names]) {)
    code.puts %(    return names.split(',').map(n => actions[n]).reduce((a, b) => a | b);)
    code.puts %(  })
    code.puts "  return ["
    machine_def.state_names.each do |name|
      info = machine_def.state_info(name)
      actions = []
      machine_def.character_classes.each do |cc|
        actions << info.transition_for(cc[0]).actions
      end
      actions << info.transition_for(:other).actions
      actions.collect! {|ta| ta.empty? ? 0 : %(_`#{ta.map {|a| code_name(a)}.join(',')}`)}
      code.puts "    [" + actions.join(', ') + "],"
    end
    code.puts "  ];"
    code.puts "})();"
  end
  
  def generate_end_actions_table(code)          # parserEndActions
    code.puts "const parserEndActions = (function () {"
    code.puts %(  function _([names]) {)
    code.puts %(    return names.split(',').map(n => actions[n]).reduce((a, b) => a | b);)
    code.puts %(  })
    code.puts "  return ["
    machine_def.state_names.each do |name|
      info = machine_def.state_info(name)
      actions = "0"
      info.at_end_actions.tap do |action_array|
        break if action_array.empty?
        actions = %(_`#{action_array.map {|a| code_name(a)}.join(',')}`)
      end
      code.puts "    #{actions}, // #{name}"\
    end
    code.puts "  ];"
    code.puts "})();"
  end
  
  def generate_char_classification_fn(code)     # classifyChar
    ccs = machine_def.character_classes
    cmap_array = [ccs.length] * (ccs.flatten.max + 1)
    ccs.each_with_index do |cc, i|
      cc.each do |ch|
        cmap_array[ch] = i
      end
    end
    
    code.puts "const classifyChar = (function() {"
    code.puts "  const mapping = ["
    cmap_array.each_slice(76 / (Math.log10(cmap_array.max).ceil + 2)).each do |chunk|
      code.puts "    " + chunk.map {|cc| "#{cc},"}.join(' ')
    end
    code.puts "  ];"
    code.puts "  return function classifyChar(ch) {"
    code.puts "    ch = ch.codePointAt(0);"
    code.puts "    if (ch >= mapping.length) return #{ccs.length};"
    code.puts "    return mapping[ch];"
    code.puts "  };"
    code.puts "}());"
  end
  
  def generate_final_states_fn(code)               # isFinalState
    final_states = machine_def.state_names.select do |name|
      machine_def.state_info(name).final
    end
    code.puts "const isFinalState = (function() {"
    code.puts "  const finalStates = new Set(["
    final_states.each do |state_name|
      code.puts "    states.#{code_name state_name},"
    end
    code.puts "  ]);"
    code.puts "  return finalStates.has.bind(finalStates);"
    code.puts "}());"
  end
  
  def generate_implementation(code)
    code.puts "// Generated from #{__FILE__}"
    generate_state_enum(code)
    generate_actions_enum(code)
    generate_transition_table(code)
    generate_actions_table(code)
    generate_end_actions_table(code)
    generate_char_classification_fn(code)
    generate_final_states_fn(code)
    
    code.puts "class Parser {"
    code.puts "  constructor() {"
    code.puts "    this.state = states.#{code_name machine_def.start_state};"
    code.puts "  }"
    code.puts "  processChar(ch, actionsImpl) {"
    unless machine_def.state_info(:error)
      code.puts "    if (this.state === states.error) {"
      code.puts "      return false;"
      code.puts "    }"
    end
    code.puts "    const chCls = classifyChar(ch);"
    code.puts "    const newState = parserTransitions[this.state - 1][chCls];"
    code.puts "    if (newState === states.error) {"
    code.puts "      this.state = newState;"
    code.puts "      return false;"
    code.puts "    }"
    code.puts "    const transActions = parserActions[this.state - 1][chCls];"
    machine_def.actions_in_order.each do |action|
      code.puts "    if (transActions & actions.#{code_name action.name}) {"
      code.puts "      actionsImpl.#{code_name action.name}(#{"ch" if action.options[:char]});"
      code.puts "    }"
    end
    code.puts "    this.state = newState;"
    code.puts "    return true;"
    code.puts "  }"
    code.puts "  inputEnds(actionsImpl) {"
    unless machine_def.state_info(:error)
      code.puts "    if (this.state === states.error) {"
      code.puts "      return false;"
      code.puts "    }"
    end
    code.puts "    const finalActions = parserEndActions[this.state - 1];"
    machine_def.actions_in_order.each do |action|
      code.puts "    if (finalActions & actions.#{code_name action.name}) {"
      code.puts "      actionsImpl.#{code_name action.name}(#{"ch" if action.options[:char]});"
      code.puts "    }"
    end
    code.puts "    return true;"
    code.puts "  }"
    code.puts "  isFinal() {"
    code.puts "    return isFinalState(this.state);"
    code.puts "  }"
    code.puts "}"
    
    %w[Parser states actions].each do |export_name|
      code.puts "exports.#{export_name} = #{export_name};"
    end
  end
end

class JsonPathTemplateParserJsGenerator < JsonPathTemplateParser
  extend_with JsGenerator
  
  def self.generate!
    output_path = File.join(
      *(__dir__ ? [__dir__, '..', '..', '..', 'src-cjs'] : ['.']),
      "tag-parser.js"
    )
    File.open(output_path, 'w') do |outf|
      JsonPathTemplateParserJsGenerator.generate to: outf
    end
    puts "Parser written to #{output_path}"
  end
end

JsonPathTemplateParserJsGenerator.generate! if __FILE__ == $0
