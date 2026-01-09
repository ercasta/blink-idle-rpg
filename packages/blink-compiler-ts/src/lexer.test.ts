/**
 * Lexer Tests for Blink Compiler
 * Tests tokenization of all token types in BRL/BCL/BDL
 */

import { tokenize, Token, TokenKind, LexerError } from './lexer';

describe('Lexer', () => {
  // Helper to get token kinds from tokens array
  const getKinds = (tokens: Token[]): TokenKind[] => tokens.map(t => t.kind);
  const getTexts = (tokens: Token[]): string[] => tokens.map(t => t.text);

  describe('Keywords', () => {
    it('should tokenize component keyword', () => {
      const tokens = tokenize('component');
      expect(tokens).toHaveLength(2); // keyword + EOF
      expect(tokens[0].kind).toBe(TokenKind.Component);
    });

    it('should tokenize rule keyword', () => {
      const tokens = tokenize('rule');
      expect(tokens[0].kind).toBe(TokenKind.Rule);
    });

    it('should tokenize control flow keywords', () => {
      const tokens = tokenize('if else for while');
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.If);
      expect(kinds).toContain(TokenKind.Else);
      expect(kinds).toContain(TokenKind.For);
      expect(kinds).toContain(TokenKind.While);
    });

    it('should tokenize entity-related keywords', () => {
      const tokens = tokenize('entity new clone');
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.Entity);
      expect(kinds).toContain(TokenKind.New);
      expect(kinds).toContain(TokenKind.Clone);
    });

    it('should tokenize function keywords', () => {
      const tokens = tokenize('fn choice return');
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.Fn);
      expect(kinds).toContain(TokenKind.Choice);
      expect(kinds).toContain(TokenKind.Return);
    });

    it('should tokenize scheduling keywords', () => {
      const tokens = tokenize('schedule cancel recurring');
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.Schedule);
      expect(kinds).toContain(TokenKind.Cancel);
      expect(kinds).toContain(TokenKind.Recurring);
    });

    it('should tokenize boolean literals', () => {
      const tokens = tokenize('true false null');
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.True);
      expect(kinds).toContain(TokenKind.False);
      expect(kinds).toContain(TokenKind.Null);
    });

    it('should tokenize entities having keywords', () => {
      const tokens = tokenize('entities having');
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.Entities);
      expect(kinds).toContain(TokenKind.Having);
    });
  });

  describe('Types', () => {
    it('should tokenize primitive types', () => {
      const tokens = tokenize('string boolean integer float decimal number id');
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.TypeString);
      expect(kinds).toContain(TokenKind.TypeBoolean);
      expect(kinds).toContain(TokenKind.TypeInteger);
      expect(kinds).toContain(TokenKind.TypeFloat);
      expect(kinds).toContain(TokenKind.TypeDecimal);
      expect(kinds).toContain(TokenKind.TypeNumber);
      expect(kinds).toContain(TokenKind.TypeId);
    });

    it('should tokenize list type', () => {
      const tokens = tokenize('list');
      expect(tokens[0].kind).toBe(TokenKind.TypeList);
    });
  });

  describe('Identifiers', () => {
    it('should tokenize simple identifiers', () => {
      const tokens = tokenize('health damage attackSpeed');
      expect(tokens[0].kind).toBe(TokenKind.Identifier);
      expect(tokens[0].text).toBe('health');
      expect(tokens[1].kind).toBe(TokenKind.Identifier);
      expect(tokens[1].text).toBe('damage');
    });

    it('should tokenize identifiers with underscores', () => {
      const tokens = tokenize('enemy_health max_damage');
      expect(tokens[0].kind).toBe(TokenKind.Identifier);
      expect(tokens[0].text).toBe('enemy_health');
    });

    it('should tokenize identifiers starting with underscore', () => {
      const tokens = tokenize('_privateVar');
      expect(tokens[0].kind).toBe(TokenKind.Identifier);
      expect(tokens[0].text).toBe('_privateVar');
    });
  });

  describe('Entity References', () => {
    it('should tokenize entity references with @', () => {
      const tokens = tokenize('@warrior @mage @enemy');
      expect(tokens[0].kind).toBe(TokenKind.EntityRef);
      expect(tokens[0].text).toBe('@warrior');
      expect(tokens[1].kind).toBe(TokenKind.EntityRef);
      expect(tokens[1].text).toBe('@mage');
    });
  });

  describe('Literals', () => {
    it('should tokenize integer literals', () => {
      const tokens = tokenize('42 0 100 999999');
      expect(tokens[0].kind).toBe(TokenKind.IntegerLiteral);
      expect(tokens[0].text).toBe('42');
      expect(tokens[2].kind).toBe(TokenKind.IntegerLiteral);
      expect(tokens[2].text).toBe('100');
    });

    it('should tokenize float literals', () => {
      const tokens = tokenize('3.14 0.5 100.0');
      expect(tokens[0].kind).toBe(TokenKind.FloatLiteral);
      expect(tokens[0].text).toBe('3.14');
    });

    it('should tokenize decimal literals with d suffix', () => {
      const tokens = tokenize('3.14d 100.0d');
      expect(tokens[0].kind).toBe(TokenKind.DecimalLiteral);
      expect(tokens[0].text).toBe('3.14d');
    });

    it('should tokenize double-quoted strings', () => {
      const tokens = tokenize('"hello world" "test"');
      expect(tokens[0].kind).toBe(TokenKind.StringLiteral);
      expect(tokens[0].text).toBe('"hello world"');
    });

    it('should tokenize single-quoted strings', () => {
      const tokens = tokenize("'hello' 'test'");
      expect(tokens[0].kind).toBe(TokenKind.StringLiteralSingle);
      expect(tokens[0].text).toBe("'hello'");
    });

    it('should handle escape sequences in strings', () => {
      const tokens = tokenize('"hello\\nworld" "tab\\there"');
      expect(tokens[0].kind).toBe(TokenKind.StringLiteral);
      expect(tokens[0].text).toBe('"hello\\nworld"');
    });
  });

  describe('Delimiters', () => {
    it('should tokenize braces', () => {
      const tokens = tokenize('{ }');
      expect(tokens[0].kind).toBe(TokenKind.LBrace);
      expect(tokens[1].kind).toBe(TokenKind.RBrace);
    });

    it('should tokenize parentheses', () => {
      const tokens = tokenize('( )');
      expect(tokens[0].kind).toBe(TokenKind.LParen);
      expect(tokens[1].kind).toBe(TokenKind.RParen);
    });

    it('should tokenize brackets', () => {
      const tokens = tokenize('[ ]');
      expect(tokens[0].kind).toBe(TokenKind.LBracket);
      expect(tokens[1].kind).toBe(TokenKind.RBracket);
    });

    it('should tokenize punctuation', () => {
      const tokens = tokenize(', : ; . ?');
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.Comma);
      expect(kinds).toContain(TokenKind.Colon);
      expect(kinds).toContain(TokenKind.Semicolon);
      expect(kinds).toContain(TokenKind.Dot);
      expect(kinds).toContain(TokenKind.Question);
    });
  });

  describe('Operators', () => {
    it('should tokenize arithmetic operators', () => {
      const tokens = tokenize('+ - * / %');
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.Plus);
      expect(kinds).toContain(TokenKind.Minus);
      expect(kinds).toContain(TokenKind.Star);
      expect(kinds).toContain(TokenKind.Slash);
      expect(kinds).toContain(TokenKind.Percent);
    });

    it('should tokenize comparison operators', () => {
      const tokens = tokenize('== != < <= > >=');
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.EqEq);
      expect(kinds).toContain(TokenKind.NotEq);
      expect(kinds).toContain(TokenKind.Lt);
      expect(kinds).toContain(TokenKind.LtEq);
      expect(kinds).toContain(TokenKind.Gt);
      expect(kinds).toContain(TokenKind.GtEq);
    });

    it('should tokenize logical operators', () => {
      const tokens = tokenize('&& || !');
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.AndAnd);
      expect(kinds).toContain(TokenKind.OrOr);
      expect(kinds).toContain(TokenKind.Not);
    });

    it('should tokenize assignment operators', () => {
      const tokens = tokenize('= += -= *= /=');
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.Eq);
      expect(kinds).toContain(TokenKind.PlusEq);
      expect(kinds).toContain(TokenKind.MinusEq);
      expect(kinds).toContain(TokenKind.StarEq);
      expect(kinds).toContain(TokenKind.SlashEq);
    });

    it('should tokenize arrow operator', () => {
      const tokens = tokenize('->');
      expect(tokens[0].kind).toBe(TokenKind.Arrow);
    });

    it('should tokenize type composition operator', () => {
      const tokens = tokenize('&');
      expect(tokens[0].kind).toBe(TokenKind.And);
    });
  });

  describe('Comments', () => {
    it('should skip single-line comments', () => {
      const tokens = tokenize('health // this is a comment\ndamage');
      expect(tokens).toHaveLength(3); // health, damage, EOF
      expect(tokens[0].text).toBe('health');
      expect(tokens[1].text).toBe('damage');
    });

    it('should skip multi-line comments', () => {
      const tokens = tokenize('health /* this is\na multi-line\ncomment */ damage');
      expect(tokens).toHaveLength(3);
      expect(tokens[0].text).toBe('health');
      expect(tokens[1].text).toBe('damage');
    });
  });

  describe('Complex tokenization', () => {
    it('should tokenize a component definition', () => {
      const source = `component Health {
        current: integer
        max: integer
      }`;
      const tokens = tokenize(source);
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.Component);
      expect(kinds).toContain(TokenKind.Identifier);
      expect(kinds).toContain(TokenKind.LBrace);
      expect(kinds).toContain(TokenKind.Colon);
      expect(kinds).toContain(TokenKind.TypeInteger);
      expect(kinds).toContain(TokenKind.RBrace);
    });

    it('should tokenize a rule definition', () => {
      const source = `rule attack_rule on DoAttack {
        entity.Health.current -= 10
      }`;
      const tokens = tokenize(source);
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.Rule);
      expect(kinds).toContain(TokenKind.On);
      expect(kinds).toContain(TokenKind.Dot);
      expect(kinds).toContain(TokenKind.MinusEq);
      expect(kinds).toContain(TokenKind.IntegerLiteral);
    });

    it('should tokenize function definition', () => {
      const source = `fn calculate_damage(base: float, bonus: float): float {
        return base + bonus
      }`;
      const tokens = tokenize(source);
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.Fn);
      expect(kinds).toContain(TokenKind.LParen);
      expect(kinds).toContain(TokenKind.TypeFloat);
      expect(kinds).toContain(TokenKind.Return);
      expect(kinds).toContain(TokenKind.Plus);
    });

    it('should tokenize entity definition', () => {
      const source = `entity {
        Health { current: 100, max: 100 }
        Combat { damage: 20 }
      }`;
      const tokens = tokenize(source);
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.Entity);
      expect(kinds).toContain(TokenKind.LBrace);
      expect(kinds).toContain(TokenKind.Colon);
      expect(kinds).toContain(TokenKind.IntegerLiteral);
    });

    it('should tokenize schedule statement', () => {
      const source = `schedule [delay: 2.0] DoAttack { source: entity }`;
      const tokens = tokenize(source);
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.Schedule);
      expect(kinds).toContain(TokenKind.LBracket);
      expect(kinds).toContain(TokenKind.FloatLiteral);
      expect(kinds).toContain(TokenKind.RBracket);
    });

    it('should tokenize for loop', () => {
      const source = `for enemy in enemies { enemy.Health.current -= 10 }`;
      const tokens = tokenize(source);
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.For);
      expect(kinds).toContain(TokenKind.In);
    });

    it('should tokenize entities having expression', () => {
      const source = `let enemies = entities having Enemy`;
      const tokens = tokenize(source);
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.Let);
      expect(kinds).toContain(TokenKind.Entities);
      expect(kinds).toContain(TokenKind.Having);
    });

    it('should tokenize choice function', () => {
      const source = `choice fn select_target(enemies: list): id { return enemies[0] }`;
      const tokens = tokenize(source);
      const kinds = getKinds(tokens);
      expect(kinds).toContain(TokenKind.Choice);
      expect(kinds).toContain(TokenKind.Fn);
      expect(kinds).toContain(TokenKind.TypeList);
      expect(kinds).toContain(TokenKind.TypeId);
    });
  });

  describe('Error handling', () => {
    it('should throw on unterminated string', () => {
      expect(() => tokenize('"unterminated string')).toThrow(LexerError);
    });

    it('should throw on unexpected character', () => {
      expect(() => tokenize('|')).toThrow(LexerError);
    });
  });

  describe('Whitespace handling', () => {
    it('should handle various whitespace correctly', () => {
      const tokens = tokenize('  health   damage  \n\t  max  \r\n');
      expect(tokens).toHaveLength(4); // 3 identifiers + EOF
      expect(tokens[0].text).toBe('health');
      expect(tokens[1].text).toBe('damage');
      expect(tokens[2].text).toBe('max');
    });

    it('should track correct span positions', () => {
      const tokens = tokenize('ab cd');
      expect(tokens[0].span.start).toBe(0);
      expect(tokens[0].span.end).toBe(2);
      expect(tokens[1].span.start).toBe(3);
      expect(tokens[1].span.end).toBe(5);
    });
  });
});
