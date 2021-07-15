const

  PREC = {
		primary: 10,
		unary: 9,
		'/': 7, '*': 7,
		'+': 6, '-': 6,
		'==': 5, '!=': 5, '<': 5, '<=': 5, '>': 5, '>=': 5, '=~': 5, '!~': 5,
		'&&': 4,
		'||': 3,
		'&': 2,
		'|': 1,
  },

	binary_operators = ["|", "&", "||", "&&", "==", "!=", "<", "<=", ">", ">=", "=~", "!~", "+", "-", "*", "/"],
	unary_operators = ["+", "-", "!", "*", "!=", "<", "<=", ">", ">=", "=~", "!~"],

  unicodeLetter = /\p{L}/,
  unicodeDigit = /[0-9]/,

  letter = choice(unicodeLetter),

  newline = '\n',
  terminator = choice(newline, ','),

  hexDigit = /[0-9a-fA-F]/,
  octalDigit = /[0-7]/,
  decimalDigit = /[0-9]/,
  binaryDigit = /[01]/,

  hexDigits = seq(hexDigit, repeat(seq(optional('_'), hexDigit))),
  octalDigits = seq(octalDigit, repeat(seq(optional('_'), octalDigit))),
  decimalDigits = seq(decimalDigit, repeat(seq(optional('_'), decimalDigit))),
  binaryDigits = seq(binaryDigit, repeat(seq(optional('_'), binaryDigit))),

  hexLiteral = seq('0', choice('x', 'X'), optional('_'), hexDigits),
  octalLiteral = seq('0', optional(choice('o', 'O')), optional('_'), octalDigits),
  decimalLiteral = choice('0', seq(/[1-9]/, optional(seq(optional('_'), decimalDigits)))),
  binaryLiteral = seq('0', choice('b', 'B'), optional('_'), binaryDigits),

  decimalExponent = seq(choice('e', 'E'), optional(choice('+', '-')), decimalDigits),
  decimalFloatLiteral = choice(
    seq(decimalDigits, '.', optional(decimalDigits), optional(decimalExponent)),
    seq(decimalDigits, decimalExponent),
    seq('.', decimalDigits, optional(decimalExponent)),
  ),

  hexExponent = seq(choice('p', 'P'), optional(choice('+', '-')), decimalDigits),
  hexMantissa = choice(
    seq(optional('_'), hexDigits, '.', optional(hexDigits)),
    seq(optional('_'), hexDigits),
    seq('.', hexDigits),
  ),
  hexFloatLiteral = seq('0', choice('x', 'X'), hexMantissa, hexExponent),

  intLiteral = choice(binaryLiteral, decimalLiteral, octalLiteral, hexLiteral)
  floatLiteral = choice(decimalFloatLiteral, hexFloatLiteral),

module.exports = grammar({
  name: 'cue',

  extras: $ => [
    $.comment,
    /\s/
  ],

  externals: $ => [
    $._str_content,
    $._ind_str_content,
  ],

	// conflicts: $ => [
	// 	[$._package_identifier, $._operand_name],
	// ],

	word: $ => $.identifier,

  rules: {
    source_file: $ => repeat(choice(
      $.package_clause,
      $.import_declaration,
			seq($._declaration, terminator),
    )),

    _package_identifier: $ => alias($.identifier, $.package_identifier),

    package_clause: $ => seq(
      'package',
      $._package_identifier
    ),

    import_declaration: $ => seq(
      'import',
      choice(
        $.import_spec,
        $.import_spec_list
      )
    ),

    import_spec: $ => seq(
      optional(field('name', choice(
        $.dot,
        $.blank_identifier,
        $._package_identifier
      ))),
      field('path', $._string_lit)
    ),

    import_spec_list: $ => seq(
      '(',
      repeat(seq(
        $.import_spec,
        terminator
      )),
      ')'
    ),

    dot: $ => '.',

    blank_identifier: $ => '_',

    identifier: $ => token(seq(
			optional(choice('_#', '#', '_')),
			letter,
			repeat(choice(letter, unicodeDigit, '$')),
    )),
		
		// identifier: $ => choice(
		// 	$._identifier,
		// 	$.hidden_identifier,
		// 	$.definition,
		// 	$.hidden_definition,
		// ),

		// _identifier: $ => token(seq(
		// 	letter, repeat(choice(letter, unicodeDigit, '$'))
		// )),

		// // https://github.com/tree-sitter/tree-sitter/issues/449
		// hidden_identifier: $ => token(seq(
		// 	'_', field('name', seq(letter, repeat(choice(letter, unicodeDigit, '$'))))
		// )),

		// definition: $ => token(seq(
		// 	'#', field('name', seq(letter, repeat(choice(letter, unicodeDigit, '$'))))
		// )),

		// hidden_definition: $ => token(seq(
		// 	'_#', field('name', seq(letter, repeat(choice(letter, unicodeDigit, '$'))))
		// )),

		qualified_identifier: $ => seq(
			$._package_identifier,
			$.dot,
			$.identifier
		),

    _string_lit: $ => choice(
      $.string_lit,
      $.raw_string_lit,
      $.indented_string_lit,
      $.raw_indented_string_lit,
    ),

    raw_string_lit: $ => seq('#"', optional($._str_content),'"#'),

    string_lit: $ => seq('"', optional($._string_parts), '"'),

    _string_parts: $ => repeat1(choice(
			$._str_content,
			$.interpolation,
		)),

    raw_indented_string_lit: $ => seq('#"""', optional($._ind_str_content), '"""#'),

    indented_string_lit: $ => seq('"""', optional($._ind_string_parts), '"""'),

    _ind_string_parts: $ => repeat1(choice(
			$._ind_str_content,
			$.interpolation,
		)),

    interpolation: $ => seq('\\(', $._expression, ')'),

		builtin: $ => choice(
			'len',
			'close',
			'and',
			'or',
			'div',
			'mod',
			'quo',
			'rem',
		),

		number_type: $ => 'number',

		float_type: $ => choice('float', 'float32', 'float64'),

		uint_type: $ => choice('uint', 'uint8', 'uint16', 'uint32', 'uint64', 'uint128'),

		int_type: $ => choice('int', 'int8', 'int16', 'int32', 'int64', 'int128'),

		string_type: $ => 'string',

		bytes_type: $ => 'bytes',

		bool_type: $ => 'bool',

		top_lit: $ => token('_'),

    bottom_lit: $ => token('_|_'),

    null_lit: $ => token('null'),

    bool_lit: $ => token(choice(
      'true',
      'false',
    )),

    int_lit: $ => token(intLiteral),

    float_lit: $ => token(floatLiteral),

		_declaration: $ => choice(
			$.field,
			$.ellipsis,
			$._embedding,
			$.let_clause,
			// TODO: $._attribute,
		),

		_list_elem: $ => choice(
			$.ellipsis,
			seq($._embedding, optional(repeat(seq(',', $._embedding))), optional(seq(',', $.ellipsis)))
		),

		list_lit: $ => seq('[', repeat($._list_elem), ']'),

		struct_lit: $ => seq('{', repeat(seq($._declaration, optional(terminator))), '}'),

		ellipsis: $ => prec.left(seq(
			'...',
			optional($._expression),
		)),

		_embedding: $ => choice(
			$.comprehension,
			$._alias_expr,
		),

		_label_name: $ => choice(
			$.identifier,
			$.string_lit,
		),

		_label_expr: $ => prec.left(1, choice(
			seq($._label_name, optional("?")),
			seq('[', $._alias_expr, ']'),
		)),

		label: $ => seq(
			optional(seq($.identifier, '=')),
			$._label_expr,
		),
		
    field: $ => prec(1, seq(
      repeat1(seq($.label, ':')),
			$._value
    )),

		_value: $=> alias($._alias_expr, $.value),

		for_clause: $ => seq(
			'for',
			choice($.identifier, $.blank_identifier),
			optional(seq(',', choice($.identifier, $.blank_identifier))),
			'in', $._expression,
		),

		guard_clause: $ => seq('if', field('condition', $._expression)),

		let_clause: $ => seq('let', field('left', $.identifier), '=', field('right', $._expression)),

		_clause: $ => choice($.for_clause, $.guard_clause, $.let_clause),

		comprehension: $ => seq(
			choice($.for_clause, $.guard_clause),
			repeat(seq(optional(','), $._clause)),
			$.struct_lit,
		),

		_alias_expr: $ => seq(
			optional(seq(field('alias', $.identifier), '=')),
			$._expression,
		),

		_expression: $ => prec.left(1, choice(
			prec(PREC.primary, $._primary_expression),
			prec(PREC.unary, $.unary_expression),
			$.binary_expression,
		)),

    binary_expression: $ => choice(...binary_operators.map(operator =>
			prec.left(PREC[operator], seq(
				field('left', $._expression),
				field('operator', operator),
				field('right', $._expression),
			))
		)),

		unary_expression: $ => choice(...unary_operators.map(operator => seq(
				field('operator', token(operator)),
				field('operand', $._expression),
		))),

		_primary_expression: $ => choice(
			$._operand,
			$.index_expression,
			$.selector_expression,
			$.call_expression,
		),

		_operand: $ => choice(
			$.identifier,
			$.builtin,
			$._literal,
			seq('(', $._expression, ')'),
		),

		index_expression: $ => seq($._primary_expression, $.index),

		selector_expression: $ =>	seq($._primary_expression, $.selector),
		
		call_expression: $ => seq($._primary_expression, $.arguments),

		selector: $ => seq($.dot, choice($.identifier, $.string_lit)),

		index: $ => seq(token.immediate('['), $._expression, ']'),

		arguments: $ => seq(
			'(', $.argument, repeat(seq(',', $.argument)), ')'
		),
		argument: $ => $._expression,

		_literal: $ => choice(
			$.struct_lit,
			$.list_lit,
			$._string_lit,
			$.string_type,
			$.int_lit,
			$.int_type,
			$.uint_type,
			$.float_lit,
			$.float_type,
			$.null_lit,
			$.bool_lit,
			$.bool_type,
			$.top_lit,
			$.bottom_lit,
		),

    comment: $ => token(choice(
      seq('//', /.*/),
    ))

  }
});
