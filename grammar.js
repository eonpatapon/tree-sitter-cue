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

	letter = choice(unicodeLetter, '$', '_'),

	newline = '\n',
	terminator = choice(newline, ','),

	hexDigit = /[0-9a-fA-F]/,
	octalDigit = /[0-7]/,
	decimalDigit = /[0-9]/,
	binaryDigit = /[01]/,

	multiplier = seq(
		choice("K", "M", "G", "T", "P"),
		optional('i'),
	),

	hexDigits = seq(hexDigit, repeat(seq(optional('_'), hexDigit))),
	octalDigits = seq(octalDigit, repeat(seq(optional('_'), octalDigit))),
	decimalDigits = seq(decimalDigit, repeat(seq(optional('_'), decimalDigit))),
	binaryDigits = seq(binaryDigit, repeat(seq(optional('_'), binaryDigit))),

	hexLiteral = seq('0', choice('x', 'X'), optional('_'), hexDigits),
	octalLiteral = seq('0', optional(choice('o', 'O')), optional('_'), octalDigits),
	decimalLiteral = choice('0', seq(/[1-9]/, optional(seq(optional('_'), decimalDigits)))),
	binaryLiteral = seq('0', choice('b', 'B'), optional('_'), binaryDigits),
	siLiteral = choice(
		seq(decimalLiteral, optional(repeat(seq('.', decimalLiteral))), multiplier),
		seq('.', decimalLiteral, multiplier),
	),

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

	intLiteral = choice(binaryLiteral, decimalLiteral, octalLiteral, hexLiteral, siLiteral)
	floatLiteral = choice(decimalFloatLiteral, hexFloatLiteral),

module.exports = grammar({
	name: 'cue',

	extras: $ => [
		$.comment,
		/\s/
	],

	externals: $ => [
		$._multi_str_content,
		$._multi_bytes_content,
		$._raw_str_content,
		$._raw_bytes_content,
		$._multi_raw_str_content,
		$._multi_raw_bytes_content,
	],

	 conflicts: $ => [
		[$._list_elem],
		[$.qualified_identifier, $._operand],
		[$._package_identifier, $._operand],
		[$._embedding, $._label_alias_expr],
	 ],

	word: $ => $.identifier,

	rules: {
		source_file: $ => seq(
			optional($.attribute),
			optional($.package_clause),
			optional(repeat($.import_declaration)),
			repeat(seq($._declaration, terminator)),
		),

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
			repeat(choice(letter, unicodeDigit)),
		)),

		attribute: $ => seq(
			'@', $.identifier, '(', repeat($.attr_token), ')'
		),
		attr_token: $ => /[^\(\)\[\]{}]+/,

		// identifier: $ => choice(
		//	$._identifier,
		//	$.hidden_identifier,
		//	$.definition,
		//	$.hidden_definition,
		// ),

		// _identifier: $ => token(seq(
		//	letter, repeat(choice(letter, unicodeDigit, '$'))
		// )),

		// // https://github.com/tree-sitter/tree-sitter/issues/449
		// hidden_identifier: $ => token(seq(
		//	'_', field('name', seq(letter, repeat(choice(letter, unicodeDigit, '$'))))
		// )),

		// definition: $ => token(seq(
		//	'#', field('name', seq(letter, repeat(choice(letter, unicodeDigit, '$'))))
		// )),

		// hidden_definition: $ => token(seq(
		//	'_#', field('name', seq(letter, repeat(choice(letter, unicodeDigit, '$'))))
		// )),

		qualified_identifier: $ => seq(
			$._package_identifier,
			$.dot,
			$.identifier
		),

		escape_char: $ => token.immediate(seq(
			'\\',
			seq(choice('a', 'b', 'f', 'n', 'r', 't', 'v', '\\', "'", '"')),
		)),

		escape_byte: $ => token.immediate(seq(
			'\\',
			optional('#'),
			choice(
				/\d{2,3}/, // octal byte value
				/x[0-9a-fA-F]{2,}/, // hex byte value
			)
		)),

		escape_unicode: $ => token.immediate(seq(
			'\\',
			optional('#'),
			choice(
				/u[0-9a-fA-F]{4}/,
				/U[0-9a-fA-F]{8}/,
			),
		)),

		_string_lit: $ => choice(
			$.simple_string_lit,
			$.multiline_string_lit,
			$.simple_bytes_lit,
			$.multiline_bytes_lit,
			$.simple_raw_string_lit,
			$.multiline_raw_string_lit,
			$.simple_raw_bytes_lit,
			$.multiline_raw_bytes_lit,
		),

		simple_string_lit: $ => seq(
			'"',
			repeat(choice(
				token.immediate(prec(1, /[^"\n\\]+/)),
				$.interpolation,
				$.escape_unicode,
				$.escape_char,
			)),
			'"'
		),

		simple_raw_string_lit: $ => seq(
			'#"',
			repeat(choice(
				$._raw_str_content,
				$.raw_interpolation,
			)),
			'"#',
		),

		simple_bytes_lit: $ => seq(
			"'",
			repeat(choice(
				token.immediate(prec(1, /[^'\n\\]+/)),
				$.interpolation,
				$.escape_byte,
				$.escape_unicode,
				$.escape_char,
			)),
			"'",
		),

		simple_raw_bytes_lit: $ => seq(
			"#'",
			repeat(choice(
				$._raw_bytes_content,
				$.raw_interpolation,
			)),
			"'#",
		),

		multiline_string_lit: $ => seq(
			token('"""'),
			repeat(choice(
				$._multi_str_content,
				$.interpolation,
				// $.escape_char,
				// $.escape_unicode,
			)),
			token('"""'),
		),

		multiline_raw_string_lit: $ => seq(
			token('#"""'),
			repeat(choice(
				$._multi_raw_str_content,
				$.raw_interpolation,
			)),
			token('"""#'),
		),

		multiline_bytes_lit: $ => seq(
			token("'''"),
			repeat(choice(
				$._multi_bytes_content,
				$.interpolation,
				// $.escape_byte,
				// $.escape_unicode,
				// $.escape_char,
			)),
			token("'''"),
		),

		multiline_raw_bytes_lit: $ => seq(
			token("#'''"),
			repeat(choice(
				$._multi_raw_bytes_content,
				$.raw_interpolation,
			)),
			token("'''#"),
		),

		interpolation: $ => seq('\\(', $._expression, ')'),

		raw_interpolation: $ => seq('\\#(', $._expression, ')'),

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

		null: $ => 'null',
		true: $ => 'true',
		false: $ => 'false',

		int_lit: $ => token(intLiteral),

		float_lit: $ => token(floatLiteral),

		_declaration: $ => choice(
			$.field,
			$.ellipsis,
			$._embedding,
			$.let_clause,
		),

		_list_elem: $ => choice(
			$.ellipsis,
			seq($._embedding, optional(repeat(seq(',', $._embedding))), optional(seq(',', $.ellipsis)), optional(','))
		),

		list_lit: $ => seq('[', repeat($._list_elem), ']'),

		struct_lit: $ => seq('{', repeat(seq(choice($._declaration, $.attribute), optional(terminator))), '}'),

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
			$.simple_string_lit,
		),

		_label_alias_expr: $=> alias($._alias_expr, $.optional),

		_label_expr: $ => prec.left(1, choice(
			seq($._label_name, optional("?")),
			seq('[', $._label_alias_expr, ']'),
		)),

		label: $ => choice(
			seq(
				optional(seq(field('alias', $.identifier), '=')),
				$._label_expr,
			),
			$.dynamic,
		),

		dynamic: $ => seq('(', $._expression, ')'),

		field: $ => prec.left(1, seq(
			repeat1(seq($.label, ':')),
			$._value,
			optional($.attribute),
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
			$.unary_expression,
			$.binary_expression,
		)),

		binary_expression: $ => choice(...binary_operators.map(operator =>
			prec.left(PREC[operator], seq(
				field('left', $._expression),
				field('operator', operator),
				field('right', $._expression),
			))
		)),

		unary_expression: $ => choice(...unary_operators.map(operator => prec(PREC.unary, seq(
				field('operator', token(operator)),
				field('operand', $._expression),
		)))),

		_primary_expression: $ => choice(
			$._operand,
			$.index_expression,
			$.selector_expression,
			$.call_expression,
		),

		_operand: $ => choice(
			$.identifier,
			$._literal,
			seq('(', $._expression, ')'),
		),

		_call_operand: $ => choice(
			$.builtin,
			$.qualified_identifier,
		),

		index_expression: $ => seq($._primary_expression, $.index),

		selector_expression: $ =>	seq($._primary_expression, $.selector),

		call_expression: $ => seq($._call_operand, $.arguments),

		selector: $ => seq($.dot, choice($.identifier, $.simple_string_lit)),

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
			$.bytes_type,
			$.number_type,
			$.int_lit,
			$.int_type,
			$.uint_type,
			$.float_lit,
			$.float_type,
			$.null,
			$.true,
			$.false,
			$.bool_type,
			$.top_lit,
			$.bottom_lit,
		),

		comment: $ => token(choice(
			seq('//', /.*/),
		))

	}
});
