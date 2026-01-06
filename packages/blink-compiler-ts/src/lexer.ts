/**
 * Lexer for Blink Rule Language (BRL/BCL/BDL)
 * Converts source code into a stream of tokens.
 */

export interface Span {
  start: number;
  end: number;
}

export enum TokenKind {
  // Keywords
  Component = 'Component',
  Rule = 'Rule',
  On = 'On',
  Trigger = 'Trigger',
  Event = 'Event',
  Entity = 'Entity',
  If = 'If',
  Else = 'Else',
  For = 'For',
  While = 'While',
  Fn = 'Fn',
  Return = 'Return',
  True = 'True',
  False = 'False',
  Null = 'Null',
  Schedule = 'Schedule',
  Cancel = 'Cancel',
  Recurring = 'Recurring',
  Module = 'Module',
  Import = 'Import',
  When = 'When',
  Create = 'Create',
  Delete = 'Delete',
  Has = 'Has',
  Let = 'Let',
  In = 'In',
  Choice = 'Choice',
  New = 'New',
  Clone = 'Clone',
  Having = 'Having',
  Entities = 'Entities',
  
  // Types
  TypeString = 'TypeString',
  TypeBoolean = 'TypeBoolean',
  TypeInteger = 'TypeInteger',
  TypeFloat = 'TypeFloat',
  TypeDecimal = 'TypeDecimal',
  TypeId = 'TypeId',
  TypeList = 'TypeList',
  TypeNumber = 'TypeNumber',
  
  // Identifiers and literals
  Identifier = 'Identifier',
  EntityRef = 'EntityRef',
  StringLiteral = 'StringLiteral',
  StringLiteralSingle = 'StringLiteralSingle',
  DecimalLiteral = 'DecimalLiteral',
  FloatLiteral = 'FloatLiteral',
  IntegerLiteral = 'IntegerLiteral',
  
  // Delimiters
  LBrace = 'LBrace',
  RBrace = 'RBrace',
  LParen = 'LParen',
  RParen = 'RParen',
  LBracket = 'LBracket',
  RBracket = 'RBracket',
  Comma = 'Comma',
  Colon = 'Colon',
  Semicolon = 'Semicolon',
  Dot = 'Dot',
  Question = 'Question',
  
  // Operators
  Plus = 'Plus',
  Minus = 'Minus',
  Star = 'Star',
  Slash = 'Slash',
  Percent = 'Percent',
  Eq = 'Eq',
  EqEq = 'EqEq',
  NotEq = 'NotEq',
  Lt = 'Lt',
  LtEq = 'LtEq',
  Gt = 'Gt',
  GtEq = 'GtEq',
  AndAnd = 'AndAnd',
  OrOr = 'OrOr',
  Not = 'Not',
  And = 'And',
  PlusEq = 'PlusEq',
  MinusEq = 'MinusEq',
  StarEq = 'StarEq',
  SlashEq = 'SlashEq',
  Arrow = 'Arrow',
  
  // End of file
  EOF = 'EOF',
}

export interface Token {
  kind: TokenKind;
  text: string;
  span: Span;
}

const KEYWORDS: Record<string, TokenKind> = {
  'component': TokenKind.Component,
  'rule': TokenKind.Rule,
  'on': TokenKind.On,
  'trigger': TokenKind.Trigger,
  'event': TokenKind.Event,
  'entity': TokenKind.Entity,
  'if': TokenKind.If,
  'else': TokenKind.Else,
  'for': TokenKind.For,
  'while': TokenKind.While,
  'fn': TokenKind.Fn,
  'return': TokenKind.Return,
  'true': TokenKind.True,
  'false': TokenKind.False,
  'null': TokenKind.Null,
  'schedule': TokenKind.Schedule,
  'cancel': TokenKind.Cancel,
  'recurring': TokenKind.Recurring,
  'module': TokenKind.Module,
  'import': TokenKind.Import,
  'when': TokenKind.When,
  'create': TokenKind.Create,
  'delete': TokenKind.Delete,
  'has': TokenKind.Has,
  'let': TokenKind.Let,
  'in': TokenKind.In,
  'choice': TokenKind.Choice,
  'new': TokenKind.New,
  'clone': TokenKind.Clone,
  'having': TokenKind.Having,
  'entities': TokenKind.Entities,
  // Types
  'string': TokenKind.TypeString,
  'boolean': TokenKind.TypeBoolean,
  'integer': TokenKind.TypeInteger,
  'float': TokenKind.TypeFloat,
  'decimal': TokenKind.TypeDecimal,
  'id': TokenKind.TypeId,
  'list': TokenKind.TypeList,
  'number': TokenKind.TypeNumber,
};

export class LexerError extends Error {
  constructor(public position: number, message: string) {
    super(message);
    this.name = 'LexerError';
  }
}

export class Lexer {
  private source: string;
  private pos: number = 0;
  private tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    while (!this.isAtEnd()) {
      this.skipWhitespaceAndComments();
      if (this.isAtEnd()) break;
      
      const token = this.scanToken();
      if (token) {
        this.tokens.push(token);
      }
    }
    
    this.tokens.push({
      kind: TokenKind.EOF,
      text: '',
      span: { start: this.pos, end: this.pos },
    });
    
    return this.tokens;
  }

  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private peek(): string {
    return this.source[this.pos] || '';
  }

  private peekNext(): string {
    return this.source[this.pos + 1] || '';
  }

  private advance(): string {
    return this.source[this.pos++] || '';
  }

  private skipWhitespaceAndComments(): void {
    while (!this.isAtEnd()) {
      const c = this.peek();
      
      // Whitespace
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
        this.advance();
        continue;
      }
      
      // Single-line comment
      if (c === '/' && this.peekNext() === '/') {
        while (!this.isAtEnd() && this.peek() !== '\n') {
          this.advance();
        }
        continue;
      }
      
      // Multi-line comment
      if (c === '/' && this.peekNext() === '*') {
        this.advance(); // /
        this.advance(); // *
        while (!this.isAtEnd()) {
          if (this.peek() === '*' && this.peekNext() === '/') {
            this.advance(); // *
            this.advance(); // /
            break;
          }
          this.advance();
        }
        continue;
      }
      
      break;
    }
  }

  private scanToken(): Token | null {
    const start = this.pos;
    const c = this.advance();
    
    // Single-character tokens
    switch (c) {
      case '{': return this.makeToken(TokenKind.LBrace, start);
      case '}': return this.makeToken(TokenKind.RBrace, start);
      case '(': return this.makeToken(TokenKind.LParen, start);
      case ')': return this.makeToken(TokenKind.RParen, start);
      case '[': return this.makeToken(TokenKind.LBracket, start);
      case ']': return this.makeToken(TokenKind.RBracket, start);
      case ',': return this.makeToken(TokenKind.Comma, start);
      case ':': return this.makeToken(TokenKind.Colon, start);
      case ';': return this.makeToken(TokenKind.Semicolon, start);
      case '.': return this.makeToken(TokenKind.Dot, start);
      case '?': return this.makeToken(TokenKind.Question, start);
      case '%': return this.makeToken(TokenKind.Percent, start);
    }
    
    // Two-character tokens
    if (c === '+') {
      if (this.peek() === '=') {
        this.advance();
        return this.makeToken(TokenKind.PlusEq, start);
      }
      return this.makeToken(TokenKind.Plus, start);
    }
    
    if (c === '-') {
      if (this.peek() === '=') {
        this.advance();
        return this.makeToken(TokenKind.MinusEq, start);
      }
      if (this.peek() === '>') {
        this.advance();
        return this.makeToken(TokenKind.Arrow, start);
      }
      return this.makeToken(TokenKind.Minus, start);
    }
    
    if (c === '*') {
      if (this.peek() === '=') {
        this.advance();
        return this.makeToken(TokenKind.StarEq, start);
      }
      return this.makeToken(TokenKind.Star, start);
    }
    
    if (c === '/') {
      if (this.peek() === '=') {
        this.advance();
        return this.makeToken(TokenKind.SlashEq, start);
      }
      return this.makeToken(TokenKind.Slash, start);
    }
    
    if (c === '=') {
      if (this.peek() === '=') {
        this.advance();
        return this.makeToken(TokenKind.EqEq, start);
      }
      return this.makeToken(TokenKind.Eq, start);
    }
    
    if (c === '!') {
      if (this.peek() === '=') {
        this.advance();
        return this.makeToken(TokenKind.NotEq, start);
      }
      return this.makeToken(TokenKind.Not, start);
    }
    
    if (c === '<') {
      if (this.peek() === '=') {
        this.advance();
        return this.makeToken(TokenKind.LtEq, start);
      }
      return this.makeToken(TokenKind.Lt, start);
    }
    
    if (c === '>') {
      if (this.peek() === '=') {
        this.advance();
        return this.makeToken(TokenKind.GtEq, start);
      }
      return this.makeToken(TokenKind.Gt, start);
    }
    
    if (c === '&') {
      if (this.peek() === '&') {
        this.advance();
        return this.makeToken(TokenKind.AndAnd, start);
      }
      return this.makeToken(TokenKind.And, start);
    }
    
    if (c === '|') {
      if (this.peek() === '|') {
        this.advance();
        return this.makeToken(TokenKind.OrOr, start);
      }
      throw new LexerError(start, `Unexpected character '|' at position ${start}`);
    }
    
    // String literals
    if (c === '"') {
      return this.scanStringLiteral(start, '"');
    }
    
    if (c === "'") {
      return this.scanStringLiteral(start, "'");
    }
    
    // Entity reference (@name)
    if (c === '@') {
      return this.scanEntityRef(start);
    }
    
    // Number literals
    if (this.isDigit(c)) {
      return this.scanNumber(start, c);
    }
    
    // Identifiers and keywords
    if (this.isAlpha(c)) {
      return this.scanIdentifier(start, c);
    }
    
    throw new LexerError(start, `Unexpected character '${c}' at position ${start}`);
  }

  private makeToken(kind: TokenKind, start: number): Token {
    return {
      kind,
      text: this.source.slice(start, this.pos),
      span: { start, end: this.pos },
    };
  }

  private scanStringLiteral(start: number, quote: string): Token {
    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance(); // Skip escape character
        if (!this.isAtEnd()) {
          this.advance(); // Skip escaped character
        }
      } else {
        this.advance();
      }
    }
    
    if (this.isAtEnd()) {
      throw new LexerError(start, `Unterminated string literal starting at position ${start}`);
    }
    
    this.advance(); // Closing quote
    
    return {
      kind: quote === '"' ? TokenKind.StringLiteral : TokenKind.StringLiteralSingle,
      text: this.source.slice(start, this.pos),
      span: { start, end: this.pos },
    };
  }

  private scanEntityRef(start: number): Token {
    while (this.isAlphaNumeric(this.peek())) {
      this.advance();
    }
    
    return {
      kind: TokenKind.EntityRef,
      text: this.source.slice(start, this.pos),
      span: { start, end: this.pos },
    };
  }

  private scanNumber(start: number, firstDigit: string): Token {
    let text = firstDigit;
    
    while (this.isDigit(this.peek())) {
      text += this.advance();
    }
    
    // Check for decimal point
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      text += this.advance(); // .
      while (this.isDigit(this.peek())) {
        text += this.advance();
      }
      
      // Check for decimal suffix
      if (this.peek() === 'd') {
        text += this.advance();
        return {
          kind: TokenKind.DecimalLiteral,
          text: this.source.slice(start, this.pos),
          span: { start, end: this.pos },
        };
      }
      
      return {
        kind: TokenKind.FloatLiteral,
        text: this.source.slice(start, this.pos),
        span: { start, end: this.pos },
      };
    }
    
    return {
      kind: TokenKind.IntegerLiteral,
      text: this.source.slice(start, this.pos),
      span: { start, end: this.pos },
    };
  }

  private scanIdentifier(start: number, firstChar: string): Token {
    let text = firstChar;
    
    while (this.isAlphaNumeric(this.peek())) {
      text += this.advance();
    }
    
    const kind = KEYWORDS[text] ?? TokenKind.Identifier;
    
    return {
      kind,
      text: this.source.slice(start, this.pos),
      span: { start, end: this.pos },
    };
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isAlpha(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }
}

/**
 * Tokenize BRL/BCL/BDL source code
 */
export function tokenize(source: string): Token[] {
  const lexer = new Lexer(source);
  return lexer.tokenize();
}
