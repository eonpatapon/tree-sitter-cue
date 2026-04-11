#include <tree_sitter/parser.h>
#include <stdlib.h>

enum TokenType {
  MULTI_STR_CONTENT,
  MULTI_BYTES_CONTENT,
  RAW_STR_CONTENT,
  RAW_BYTES_CONTENT,
  MULTI_RAW_STR_CONTENT,
  MULTI_RAW_BYTES_CONTENT,
  RAW_STR_OPEN,
  RAW_BYTES_OPEN,
  MULTI_RAW_STR_OPEN,
  MULTI_RAW_BYTES_OPEN,
  RAW_STR_CLOSE,
  RAW_BYTES_CLOSE,
  MULTI_RAW_STR_CLOSE,
  MULTI_RAW_BYTES_CLOSE,
  RAW_INTERPOLATION_OPEN,
};

typedef struct {
  uint8_t hash_count;
} Scanner;

static void advance(TSLexer *lexer) { lexer->advance(lexer, false); }

/* Try to match exactly `expected` consecutive '#' characters. */
static bool check_hashes(TSLexer *lexer, uint8_t expected) {
  uint8_t h = 0;
  while (h < expected && lexer->lookahead == '#') {
    advance(lexer);
    h++;
  }
  return h == expected;
}

/* Scan non-raw multiline string/bytes content (unchanged from original). */
static bool scan_multiline(TSLexer *lexer, int c) {
  bool has_content = false;
  if (c == '"') {
    lexer->result_symbol = MULTI_STR_CONTENT;
  } else {
    lexer->result_symbol = MULTI_BYTES_CONTENT;
  }

  while (true) {
    switch (lexer->lookahead) {
    case '\'':
    case '"':
      lexer->mark_end(lexer);
      advance(lexer);
      if (lexer->lookahead == c) {
        advance(lexer);
        if (lexer->lookahead == c) {
          return has_content;
        }
      }
      has_content = true;
      break;
    case '\\':
      lexer->mark_end(lexer);
      advance(lexer);
      if (lexer->lookahead == '(') {
        return has_content;
      }
      advance(lexer);
      has_content = true;
      break;
    case '\0':
      if (lexer->eof(lexer)) {
        return false;
      }
      advance(lexer);
      has_content = true;
      break;
    default:
      advance(lexer);
      has_content = true;
      break;
    }
  }
}

/* Scan raw string open delimiter: one or more '#' followed by quote(s).
   Stores the hash count in scanner state. */
static bool scan_raw_open(TSLexer *lexer, Scanner *scanner,
                          const bool *valid_symbols) {
  if (lexer->lookahead != '#') return false;

  uint8_t count = 0;
  while (lexer->lookahead == '#') {
    advance(lexer);
    count++;
  }

  if (lexer->lookahead == '"') {
    advance(lexer);
    /* Check for multiline: #+" vs #+""" */
    if (lexer->lookahead == '"') {
      advance(lexer);
      if (lexer->lookahead == '"') {
        advance(lexer);
        if (valid_symbols[MULTI_RAW_STR_OPEN]) {
          scanner->hash_count = count;
          lexer->result_symbol = MULTI_RAW_STR_OPEN;
          return true;
        }
        return false;
      }
      /* Two quotes only — not a valid raw string open */
      return false;
    }
    if (valid_symbols[RAW_STR_OPEN]) {
      scanner->hash_count = count;
      lexer->result_symbol = RAW_STR_OPEN;
      return true;
    }
  } else if (lexer->lookahead == '\'') {
    advance(lexer);
    /* Check for multiline: #+' vs #+''' */
    if (lexer->lookahead == '\'') {
      advance(lexer);
      if (lexer->lookahead == '\'') {
        advance(lexer);
        if (valid_symbols[MULTI_RAW_BYTES_OPEN]) {
          scanner->hash_count = count;
          lexer->result_symbol = MULTI_RAW_BYTES_OPEN;
          return true;
        }
        return false;
      }
      return false;
    }
    if (valid_symbols[RAW_BYTES_OPEN]) {
      scanner->hash_count = count;
      lexer->result_symbol = RAW_BYTES_OPEN;
      return true;
    }
  }

  return false;
}

/* Scan simple (non-multiline) raw string/bytes content.
   Also handles close delimiter and interpolation open when at boundary. */
static bool scan_raw_simple(TSLexer *lexer, Scanner *scanner,
                            const bool *valid_symbols, int c) {
  enum TokenType content_type = (c == '"') ? RAW_STR_CONTENT : RAW_BYTES_CONTENT;
  enum TokenType close_type = (c == '"') ? RAW_STR_CLOSE : RAW_BYTES_CLOSE;
  uint8_t hash_count = scanner->hash_count;
  bool has_content = false;

  while (true) {
    switch (lexer->lookahead) {
    case '"':
    case '\'':
      if (lexer->lookahead == c) {
        lexer->mark_end(lexer);
        advance(lexer);
        if (check_hashes(lexer, hash_count)) {
          /* At closing delimiter */
          if (has_content && valid_symbols[content_type]) {
            lexer->result_symbol = content_type;
            return true;
          }
          if (valid_symbols[close_type]) {
            lexer->mark_end(lexer);
            lexer->result_symbol = close_type;
            scanner->hash_count = 0;
            return true;
          }
          return false;
        }
        /* Not a closing delimiter — quote is content */
        has_content = true;
      } else {
        advance(lexer);
        has_content = true;
      }
      break;

    case '\\':
      lexer->mark_end(lexer);
      advance(lexer);
      if (check_hashes(lexer, hash_count) && lexer->lookahead == '(') {
        /* Interpolation boundary */
        if (has_content && valid_symbols[content_type]) {
          lexer->result_symbol = content_type;
          return true;
        }
        if (valid_symbols[RAW_INTERPOLATION_OPEN]) {
          advance(lexer); /* consume '(' */
          lexer->mark_end(lexer);
          lexer->result_symbol = RAW_INTERPOLATION_OPEN;
          return true;
        }
        return false;
      }
      has_content = true;
      break;

    case '\0':
      if (lexer->eof(lexer)) return false;
      advance(lexer);
      has_content = true;
      break;

    default:
      advance(lexer);
      has_content = true;
      break;
    }
  }
}

/* Scan multiline raw string/bytes content.
   Also handles close delimiter and interpolation open when at boundary. */
static bool scan_raw_multiline(TSLexer *lexer, Scanner *scanner,
                               const bool *valid_symbols, int c) {
  enum TokenType content_type =
      (c == '"') ? MULTI_RAW_STR_CONTENT : MULTI_RAW_BYTES_CONTENT;
  enum TokenType close_type =
      (c == '"') ? MULTI_RAW_STR_CLOSE : MULTI_RAW_BYTES_CLOSE;
  uint8_t hash_count = scanner->hash_count;
  bool has_content = false;

  while (true) {
    switch (lexer->lookahead) {
    case '"':
    case '\'':
      if (lexer->lookahead == c) {
        lexer->mark_end(lexer);
        advance(lexer);
        if (lexer->lookahead == c) {
          advance(lexer);
          if (lexer->lookahead == c) {
            advance(lexer);
            /* Triple quote found — check for hash suffix */
            if (check_hashes(lexer, hash_count)) {
              if (has_content && valid_symbols[content_type]) {
                lexer->result_symbol = content_type;
                return true;
              }
              if (valid_symbols[close_type]) {
                lexer->mark_end(lexer);
                lexer->result_symbol = close_type;
                scanner->hash_count = 0;
                return true;
              }
              return false;
            }
          }
        }
        /* Not a closing triple-quote+hashes — content */
        has_content = true;
      } else {
        advance(lexer);
        has_content = true;
      }
      break;

    case '\\':
      lexer->mark_end(lexer);
      advance(lexer);
      if (check_hashes(lexer, hash_count) && lexer->lookahead == '(') {
        if (has_content && valid_symbols[content_type]) {
          lexer->result_symbol = content_type;
          return true;
        }
        if (valid_symbols[RAW_INTERPOLATION_OPEN]) {
          advance(lexer); /* consume '(' */
          lexer->mark_end(lexer);
          lexer->result_symbol = RAW_INTERPOLATION_OPEN;
          return true;
        }
        return false;
      }
      has_content = true;
      break;

    case '\0':
      if (lexer->eof(lexer)) return false;
      advance(lexer);
      has_content = true;
      break;

    default:
      advance(lexer);
      has_content = true;
      break;
    }
  }
}

static bool scan(TSLexer *lexer, Scanner *scanner, const bool *valid_symbols) {
  /*
   * Guard: in error recovery mode tree-sitter sets ALL valid_symbols to true.
   * Bail out so the grammar-level lexer can handle tokens normally.
   * We detect this by checking that mutually exclusive symbols are all valid.
   */
  if (valid_symbols[MULTI_STR_CONTENT] && valid_symbols[RAW_STR_OPEN] &&
      valid_symbols[RAW_STR_CLOSE]) {
    return false;
  }

  /* Raw string open delimiters — must be checked before multiline content
   * to prevent '#' from being consumed by the identifier rule.
   * We must skip whitespace here because the external scanner is called
   * before tree-sitter's automatic whitespace skipping. */
  if (valid_symbols[RAW_STR_OPEN] || valid_symbols[RAW_BYTES_OPEN] ||
      valid_symbols[MULTI_RAW_STR_OPEN] ||
      valid_symbols[MULTI_RAW_BYTES_OPEN]) {
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
           lexer->lookahead == '\n' || lexer->lookahead == '\r') {
      lexer->advance(lexer, true); /* skip whitespace */
    }
    if (lexer->lookahead == '#') {
      return scan_raw_open(lexer, scanner, valid_symbols);
    }
  }

  /* Non-raw multiline strings (no hash state needed) */
  if (valid_symbols[MULTI_STR_CONTENT]) {
    return scan_multiline(lexer, '"');
  }
  if (valid_symbols[MULTI_BYTES_CONTENT]) {
    return scan_multiline(lexer, '\'');
  }

  /* Simple raw content / close / interpolation */
  if (valid_symbols[RAW_STR_CONTENT] || valid_symbols[RAW_STR_CLOSE]) {
    return scan_raw_simple(lexer, scanner, valid_symbols, '"');
  }
  if (valid_symbols[RAW_BYTES_CONTENT] || valid_symbols[RAW_BYTES_CLOSE]) {
    return scan_raw_simple(lexer, scanner, valid_symbols, '\'');
  }

  /* Multiline raw content / close / interpolation */
  if (valid_symbols[MULTI_RAW_STR_CONTENT] ||
      valid_symbols[MULTI_RAW_STR_CLOSE]) {
    return scan_raw_multiline(lexer, scanner, valid_symbols, '"');
  }
  if (valid_symbols[MULTI_RAW_BYTES_CONTENT] ||
      valid_symbols[MULTI_RAW_BYTES_CLOSE]) {
    return scan_raw_multiline(lexer, scanner, valid_symbols, '\'');
  }

  return false;
}

/* Public API */

#ifdef __cplusplus
extern "C" {
#endif

void *tree_sitter_cue_external_scanner_create() {
  Scanner *scanner = calloc(1, sizeof(Scanner));
  return scanner;
}

bool tree_sitter_cue_external_scanner_scan(void *payload, TSLexer *lexer,
                                           const bool *valid_symbols) {
  Scanner *scanner = (Scanner *)payload;
  return scan(lexer, scanner, valid_symbols);
}

unsigned tree_sitter_cue_external_scanner_serialize(void *payload,
                                                    char *buffer) {
  Scanner *scanner = (Scanner *)payload;
  buffer[0] = (char)scanner->hash_count;
  return 1;
}

void tree_sitter_cue_external_scanner_deserialize(void *payload,
                                                  const char *buffer,
                                                  unsigned length) {
  Scanner *scanner = (Scanner *)payload;
  scanner->hash_count = (length > 0) ? (uint8_t)buffer[0] : 0;
}

void tree_sitter_cue_external_scanner_destroy(void *payload) { free(payload); }

#ifdef __cplusplus
}
#endif
