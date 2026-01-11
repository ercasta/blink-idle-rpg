/**
 * Parser for Blink Rule Language (BRL/BCL/BDL)
 * Converts a stream of tokens into an Abstract Syntax Tree (AST).
 */

import { Token, TokenKind, Span } from './lexer';
import * as AST from './ast';

export class ParseError extends Error {
  constructor(
    public position: number,
    message: string
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): AST.Module {
    const items: AST.Item[] = [];
    
    while (!this.isAtEnd()) {
      items.push(this.parseItem());
    }
    
    return { items };
  }

  private isAtEnd(): boolean {
    return this.peek().kind === TokenKind.EOF;
  }

  private peek(): Token {
    return this.tokens[this.pos] || { kind: TokenKind.EOF, text: '', span: { start: 0, end: 0 } };
  }

  private peekNext(): Token {
    return this.tokens[this.pos + 1] || { kind: TokenKind.EOF, text: '', span: { start: 0, end: 0 } };
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      return this.tokens[this.pos++];
    }
    return this.peek();
  }

  private check(kind: TokenKind): boolean {
    return this.peek().kind === kind;
  }

  private consume(kind: TokenKind, expected: string): Token {
    if (this.check(kind)) {
      return this.advance();
    }
    const token = this.peek();
    throw new ParseError(
      token.span.start,
      `Expected ${expected}, got '${token.text}' at position ${token.span.start}`
    );
  }

  private parseItem(): AST.Item {
    const token = this.peek();
    
    switch (token.kind) {
      case TokenKind.Component:
        return this.parseComponent();
      case TokenKind.Rule:
        return this.parseRule();
      case TokenKind.Fn:
        return this.parseFunction(false);
      case TokenKind.Choice:
        return this.parseChoiceFunction();
      case TokenKind.Import:
        return this.parseImport();
      case TokenKind.Module:
        return this.parseModuleDef();
      case TokenKind.Let:
        // Entity definitions must use: let name: id = new entity { ... }
        return this.parseEntityDeclaration();
      default:
        throw new ParseError(
          token.span.start,
          `Unexpected token '${token.text}' at position ${token.span.start}. ` +
          `Entities must be declared with: let name: id = new entity { ... }`
        );
    }
  }

  // ===== Component Parsing =====

  private parseComponent(): AST.ComponentDef {
    const start = this.consume(TokenKind.Component, 'component').span.start;
    const name = this.consume(TokenKind.Identifier, 'component name').text;
    
    this.consume(TokenKind.LBrace, '{');
    
    const fields: AST.FieldDef[] = [];
    while (!this.check(TokenKind.RBrace) && !this.isAtEnd()) {
      fields.push(this.parseFieldDef());
    }
    
    const end = this.consume(TokenKind.RBrace, '}').span.end;
    
    return {
      type: 'component',
      name,
      fields,
      span: { start, end },
    };
  }

  private parseFieldDef(): AST.FieldDef {
    const nameToken = this.parseFieldNameToken();
    const start = nameToken.span.start;
    
    this.consume(TokenKind.Colon, ':');
    const fieldType = this.parseType();
    
    const optional = this.check(TokenKind.Question);
    if (optional) {
      this.advance();
    }
    
    const end = this.tokens[this.pos - 1]?.span.end ?? start;
    
    return {
      name: nameToken.text,
      fieldType: optional ? { type: 'optional', inner: fieldType } : fieldType,
      optional,
      span: { start, end },
    };
  }

  private parseFieldNameToken(): Token {
    const token = this.peek();
    // Allow certain keywords as field names
    if (
      token.kind === TokenKind.Identifier ||
      token.kind === TokenKind.Entity ||
      token.kind === TokenKind.Event ||
      token.kind === TokenKind.TypeId
    ) {
      return this.advance();
    }
    return this.consume(TokenKind.Identifier, 'field name');
  }

  private parseType(): AST.TypeExpr {
    const token = this.advance();
    
    switch (token.kind) {
      case TokenKind.TypeString:
        return { type: 'string' };
      case TokenKind.TypeBoolean:
        return { type: 'boolean' };
      case TokenKind.TypeInteger:
        return { type: 'integer' };
      case TokenKind.TypeFloat:
        return { type: 'float' };
      case TokenKind.TypeDecimal:
        return { type: 'decimal' };
      case TokenKind.TypeNumber:
        return { type: 'number' };
      case TokenKind.TypeId:
        return { type: 'id' };
      case TokenKind.TypeList:
        if (this.check(TokenKind.Lt)) {
          this.advance();
          const element = this.parseType();
          this.consume(TokenKind.Gt, '>');
          return { type: 'list', element };
        }
        // Shorthand: `list` means `list<id>`
        return { type: 'list', element: { type: 'id' } };
      case TokenKind.Identifier:
        return { type: 'component', name: token.text };
      default:
        throw new ParseError(
          token.span.start,
          `Expected type, got '${token.text}'`
        );
    }
  }

  private parseCompositeType(): AST.TypeExpr {
    const firstType = this.parseType();
    
    if (this.check(TokenKind.And)) {
      const types: AST.TypeExpr[] = [firstType];
      
      while (this.check(TokenKind.And)) {
        this.advance();
        types.push(this.parseType());
      }
      
      return { type: 'composite', types };
    }
    
    return firstType;
  }

  // ===== Rule Parsing =====

  private parseRule(): AST.RuleDef {
    const start = this.consume(TokenKind.Rule, 'rule').span.start;
    
    // Optional rule name
    let name: string | null = null;
    if (this.check(TokenKind.Identifier)) {
      // Need to lookahead to distinguish rule name from event name
      // Syntax: 'rule [name] on EventType(param: id) { ... }'
      // If we see "identifier on", it's a rule name
      const nextIsOn = this.peekNext().kind === TokenKind.On;
      if (nextIsOn) {
        name = this.advance().text;
      }
    }
    
    this.consume(TokenKind.On, 'on');
    const triggerEvent = this.consume(TokenKind.Identifier, 'event name').text;
    
    // Mandatory typed event parameter: (paramName: type)
    this.consume(TokenKind.LParen, '(');
    const paramStart = this.peek().span.start;
    const paramName = this.consume(TokenKind.Identifier, 'event parameter name').text;
    this.consume(TokenKind.Colon, ':');
    const paramType = this.parseType();
    this.consume(TokenKind.RParen, ')');
    const paramEnd = this.tokens[this.pos - 1]?.span.end ?? paramStart;
    
    const eventParam: AST.ParamDef = {
      name: paramName,
      paramType,
      span: { start: paramStart, end: paramEnd },
    };
    
    // Optional condition with 'when'
    let condition: AST.Expr | null = null;
    if (this.check(TokenKind.When)) {
      this.advance();
      condition = this.parseExpression();
    }
    
    // Optional priority
    let priority: number | null = null;
    if (this.check(TokenKind.LBracket)) {
      this.advance();
      this.consume(TokenKind.Identifier, 'priority');
      this.consume(TokenKind.Colon, ':');
      const priorityToken = this.consume(TokenKind.IntegerLiteral, 'priority value');
      priority = parseInt(priorityToken.text, 10);
      this.consume(TokenKind.RBracket, ']');
    }
    
    const body = this.parseBlock();
    
    return {
      type: 'rule',
      name,
      triggerEvent,
      eventParam,
      condition,
      priority,
      body,
      span: { start, end: body.span.end },
    };
  }

  // ===== Function Parsing =====

  private parseFunction(isChoice: boolean): AST.FunctionDef {
    const start = this.consume(TokenKind.Fn, 'fn').span.start;
    const name = this.consume(TokenKind.Identifier, 'function name').text;
    
    const params = this.parseParams();
    
    // Optional return type
    let returnType: AST.TypeExpr | null = null;
    if (this.check(TokenKind.Colon)) {
      this.advance();
      returnType = this.parseType();
    }
    
    const body = this.parseBlock();
    
    return {
      type: 'function',
      name,
      params,
      returnType,
      body,
      isChoice,
      span: { start, end: body.span.end },
    };
  }

  private parseChoiceFunction(): AST.FunctionDef {
    const start = this.consume(TokenKind.Choice, 'choice').span.start;
    this.consume(TokenKind.Fn, 'fn');
    const name = this.consume(TokenKind.Identifier, 'function name').text;
    
    const params = this.parseChoiceParams();
    
    // Optional return type
    let returnType: AST.TypeExpr | null = null;
    if (this.check(TokenKind.Colon)) {
      this.advance();
      returnType = this.parseType();
    }
    
    const body = this.parseBlock();
    
    return {
      type: 'function',
      name,
      params,
      returnType,
      body,
      isChoice: true,
      span: { start, end: body.span.end },
    };
  }

  private parseParams(): AST.ParamDef[] {
    this.consume(TokenKind.LParen, '(');
    
    const params: AST.ParamDef[] = [];
    while (!this.check(TokenKind.RParen) && !this.isAtEnd()) {
      const paramStart = this.peek().span.start;
      const paramName = this.consume(TokenKind.Identifier, 'parameter name').text;
      this.consume(TokenKind.Colon, ':');
      const paramType = this.parseType();
      const paramEnd = this.tokens[this.pos - 1]?.span.end ?? paramStart;
      
      params.push({
        name: paramName,
        paramType,
        span: { start: paramStart, end: paramEnd },
      });
      
      if (this.check(TokenKind.Comma)) {
        this.advance();
      }
    }
    
    this.consume(TokenKind.RParen, ')');
    return params;
  }

  private parseChoiceParams(): AST.ParamDef[] {
    this.consume(TokenKind.LParen, '(');
    
    const params: AST.ParamDef[] = [];
    while (!this.check(TokenKind.RParen) && !this.isAtEnd()) {
      const paramStart = this.peek().span.start;
      const paramName = this.consume(TokenKind.Identifier, 'parameter name').text;
      this.consume(TokenKind.Colon, ':');
      const paramType = this.parseCompositeType();
      const paramEnd = this.tokens[this.pos - 1]?.span.end ?? paramStart;
      
      params.push({
        name: paramName,
        paramType,
        span: { start: paramStart, end: paramEnd },
      });
      
      if (this.check(TokenKind.Comma)) {
        this.advance();
      }
    }
    
    this.consume(TokenKind.RParen, ')');
    return params;
  }

  // ===== Import Parsing =====

  private parseImport(): AST.ImportDef {
    const start = this.consume(TokenKind.Import, 'import').span.start;
    
    const path: string[] = [];
    path.push(this.consume(TokenKind.Identifier, 'module path').text);
    
    while (this.check(TokenKind.Dot)) {
      this.advance();
      path.push(this.consume(TokenKind.Identifier, 'module path segment').text);
    }
    
    // Optional specific imports
    let items: string[] | null = null;
    if (this.check(TokenKind.LBrace)) {
      this.advance();
      items = [];
      while (!this.check(TokenKind.RBrace) && !this.isAtEnd()) {
        items.push(this.consume(TokenKind.Identifier, 'import item').text);
        if (this.check(TokenKind.Comma)) {
          this.advance();
        }
      }
      this.consume(TokenKind.RBrace, '}');
    }
    
    const end = this.tokens[this.pos - 1]?.span.end ?? start;
    
    return {
      type: 'import',
      path,
      items,
      span: { start, end },
    };
  }

  // ===== Module Definition =====

  private parseModuleDef(): AST.ModuleDef {
    const start = this.consume(TokenKind.Module, 'module').span.start;
    const name = this.consume(TokenKind.Identifier, 'module name').text;
    
    this.consume(TokenKind.LBrace, '{');
    
    const items: AST.Item[] = [];
    while (!this.check(TokenKind.RBrace) && !this.isAtEnd()) {
      items.push(this.parseItem());
    }
    
    const end = this.consume(TokenKind.RBrace, '}').span.end;
    
    return {
      type: 'module',
      name,
      items,
      span: { start, end },
    };
  }

  // ===== Entity Parsing =====

  /**
   * Parse entity declaration: let name: id = new entity { ... }
   * This is the only supported syntax for entity creation.
   */
  private parseEntityDeclaration(): AST.EntityDef {
    const start = this.consume(TokenKind.Let, 'let').span.start;
    const variable = this.consume(TokenKind.Identifier, 'entity name').text;
    
    // Enforce type annotation must be 'id'
    this.consume(TokenKind.Colon, ':');
    const typeToken = this.peek();
    if (typeToken.kind !== TokenKind.TypeId) {
      throw new ParseError(
        typeToken.span.start,
        `Entity declarations must have type 'id', got '${typeToken.text}'`
      );
    }
    this.advance();
    
    this.consume(TokenKind.Eq, '=');
    this.consume(TokenKind.New, 'new');
    this.consume(TokenKind.Entity, 'entity');
    
    // Optional component initialization block
    const components: AST.ComponentInit[] = [];
    const boundFunctions: AST.BoundFunctionDef[] = [];
    
    if (this.check(TokenKind.LBrace)) {
      this.advance();
      
      while (!this.check(TokenKind.RBrace) && !this.isAtEnd()) {
        if (this.check(TokenKind.Dot)) {
          boundFunctions.push(this.parseBoundFunction());
        } else {
          components.push(this.parseComponentInit());
        }
      }
      
      this.consume(TokenKind.RBrace, '}');
    }
    
    const end = this.tokens[this.pos - 1]?.span.end ?? start;
    
    return {
      type: 'entity',
      variable,
      components,
      boundFunctions,
      span: { start, end },
    };
  }

  private parseBoundFunction(): AST.BoundFunctionDef {
    const start = this.consume(TokenKind.Dot, '.').span.start;
    const name = this.consume(TokenKind.Identifier, 'function name').text;
    
    this.consume(TokenKind.Eq, '=');
    this.consume(TokenKind.Choice, 'choice');
    
    const params = this.parseChoiceParams();
    
    // Optional return type
    let returnType: AST.TypeExpr | null = null;
    if (this.check(TokenKind.Colon)) {
      this.advance();
      returnType = this.parseType();
    }
    
    const body = this.parseBlock();
    
    return {
      name,
      params,
      returnType,
      body,
      span: { start, end: body.span.end },
    };
  }

  private parseComponentInit(): AST.ComponentInit {
    const nameToken = this.consume(TokenKind.Identifier, 'component name');
    const start = nameToken.span.start;
    
    this.consume(TokenKind.LBrace, '{');
    
    const fields: [string, AST.Expr][] = [];
    while (!this.check(TokenKind.RBrace) && !this.isAtEnd()) {
      const fieldNameToken = this.parseFieldNameToken();
      this.consume(TokenKind.Colon, ':');
      const fieldValue = this.parseExpression();
      fields.push([fieldNameToken.text, fieldValue]);
    }
    
    const end = this.consume(TokenKind.RBrace, '}').span.end;
    
    return {
      name: nameToken.text,
      fields,
      span: { start, end },
    };
  }

  // ===== Block Parsing =====

  private parseBlock(): AST.Block {
    const start = this.consume(TokenKind.LBrace, '{').span.start;
    
    const statements: AST.Statement[] = [];
    while (!this.check(TokenKind.RBrace) && !this.isAtEnd()) {
      statements.push(this.parseStatement());
    }
    
    const end = this.consume(TokenKind.RBrace, '}').span.end;
    
    return {
      statements,
      span: { start, end },
    };
  }

  // ===== Statement Parsing =====

  private parseStatement(): AST.Statement {
    const token = this.peek();
    
    switch (token.kind) {
      case TokenKind.Let:
        return this.parseLetStatement();
      case TokenKind.If:
        return this.parseIfStatement();
      case TokenKind.For:
        return this.parseForStatement();
      case TokenKind.While:
        return this.parseWhileStatement();
      case TokenKind.Return:
        return this.parseReturnStatement();
      case TokenKind.Schedule:
        return this.parseScheduleStatement();
      case TokenKind.Cancel:
        return this.parseCancelStatement();
      case TokenKind.Create:
        return this.parseCreateStatement();
      case TokenKind.Delete:
        return this.parseDeleteStatement();
      default:
        return this.parseExpressionOrAssignment();
    }
  }

  private parseLetStatement(): AST.LetStatement {
    const start = this.consume(TokenKind.Let, 'let').span.start;
    const name = this.consume(TokenKind.Identifier, 'variable name').text;
    
    // Mandatory type annotation
    this.consume(TokenKind.Colon, ': (type annotation required)');
    const typeAnnotation = this.parseType();
    
    this.consume(TokenKind.Eq, '=');
    const value = this.parseExpression();
    
    const end = this.tokens[this.pos - 1]?.span.end ?? start;
    
    return {
      type: 'let',
      name,
      typeAnnotation,
      value,
      span: { start, end },
    };
  }

  private parseIfStatement(): AST.IfStatement {
    const start = this.consume(TokenKind.If, 'if').span.start;
    const condition = this.parseExpression();
    const thenBlock = this.parseBlock();
    
    let elseBlock: AST.ElseClause | null = null;
    if (this.check(TokenKind.Else)) {
      this.advance();
      if (this.check(TokenKind.If)) {
        elseBlock = { type: 'else_if', statement: this.parseIfStatement() };
      } else {
        elseBlock = { type: 'else', block: this.parseBlock() };
      }
    }
    
    const end = elseBlock
      ? (elseBlock.type === 'else_if' ? elseBlock.statement.span.end : elseBlock.block.span.end)
      : thenBlock.span.end;
    
    return {
      type: 'if',
      condition,
      thenBlock,
      elseBlock,
      span: { start, end },
    };
  }

  private parseForStatement(): AST.ForStatement {
    const start = this.consume(TokenKind.For, 'for').span.start;
    const variable = this.consume(TokenKind.Identifier, 'loop variable').text;
    this.consume(TokenKind.In, 'in');
    const iterable = this.parseExpression();
    const body = this.parseBlock();
    
    return {
      type: 'for',
      variable,
      iterable,
      body,
      span: { start, end: body.span.end },
    };
  }

  private parseWhileStatement(): AST.WhileStatement {
    const start = this.consume(TokenKind.While, 'while').span.start;
    const condition = this.parseExpression();
    const body = this.parseBlock();
    
    return {
      type: 'while',
      condition,
      body,
      span: { start, end: body.span.end },
    };
  }

  private parseReturnStatement(): AST.ReturnStatement {
    const start = this.consume(TokenKind.Return, 'return').span.start;
    
    // Check if there's a value to return
    let value: AST.Expr | null = null;
    if (!this.check(TokenKind.RBrace) && !this.isAtEnd()) {
      const token = this.peek();
      if (!this.isStatementStart(token.kind)) {
        value = this.parseExpression();
      }
    }
    
    const end = this.tokens[this.pos - 1]?.span.end ?? start;
    
    return {
      type: 'return',
      value,
      span: { start, end },
    };
  }

  private isStatementStart(kind: TokenKind): boolean {
    return [
      TokenKind.Let, TokenKind.If, TokenKind.For, TokenKind.While,
      TokenKind.Return, TokenKind.Schedule, TokenKind.Cancel,
      TokenKind.Create, TokenKind.Delete,
    ].includes(kind);
  }

  private parseScheduleStatement(): AST.ScheduleStatement {
    const start = this.consume(TokenKind.Schedule, 'schedule').span.start;
    
    const recurring = this.check(TokenKind.Recurring);
    if (recurring) {
      this.advance();
    }
    
    // Optional [delay: N] or [interval: N]
    let delay: AST.Expr | null = null;
    let interval: AST.Expr | null = null;
    
    if (this.check(TokenKind.LBracket)) {
      this.advance();
      const paramName = this.consume(TokenKind.Identifier, 'delay or interval').text;
      this.consume(TokenKind.Colon, ':');
      const value = this.parseExpression();
      
      if (paramName === 'delay') {
        delay = value;
      } else if (paramName === 'interval') {
        interval = value;
      }
      
      this.consume(TokenKind.RBracket, ']');
    }
    
    const eventName = this.consume(TokenKind.Identifier, 'event name').text;
    this.consume(TokenKind.LBrace, '{');
    
    const fields: [string, AST.Expr][] = [];
    while (!this.check(TokenKind.RBrace) && !this.isAtEnd()) {
      const fieldName = this.consume(TokenKind.Identifier, 'field name').text;
      this.consume(TokenKind.Colon, ':');
      const fieldValue = this.parseExpression();
      fields.push([fieldName, fieldValue]);
    }
    
    const end = this.consume(TokenKind.RBrace, '}').span.end;
    
    return {
      type: 'schedule',
      recurring,
      delay,
      interval,
      eventName,
      fields,
      span: { start, end },
    };
  }

  private parseCancelStatement(): AST.CancelStatement {
    const start = this.consume(TokenKind.Cancel, 'cancel').span.start;
    const target = this.parseExpression();
    
    const end = this.tokens[this.pos - 1]?.span.end ?? start;
    
    return {
      type: 'cancel',
      target,
      span: { start, end },
    };
  }

  private parseCreateStatement(): AST.CreateStatement {
    const start = this.consume(TokenKind.Create, 'create').span.start;
    this.consume(TokenKind.Entity, 'entity');
    this.consume(TokenKind.LBrace, '{');
    
    const components: AST.ComponentInit[] = [];
    while (!this.check(TokenKind.RBrace) && !this.isAtEnd()) {
      components.push(this.parseComponentInit());
    }
    
    const end = this.consume(TokenKind.RBrace, '}').span.end;
    
    return {
      type: 'create',
      components,
      span: { start, end },
    };
  }

  private parseDeleteStatement(): AST.DeleteStatement {
    const start = this.consume(TokenKind.Delete, 'delete').span.start;
    const entity = this.parseExpression();
    
    const end = this.tokens[this.pos - 1]?.span.end ?? start;
    
    return {
      type: 'delete',
      entity,
      span: { start, end },
    };
  }

  private parseExpressionOrAssignment(): AST.Statement {
    const expr = this.parseExpression();
    
    // Check for assignment operators
    const token = this.peek();
    let op: AST.AssignOp | null = null;
    
    switch (token.kind) {
      case TokenKind.Eq:
        op = 'assign';
        break;
      case TokenKind.PlusEq:
        op = 'add_assign';
        break;
      case TokenKind.MinusEq:
        op = 'sub_assign';
        break;
      case TokenKind.StarEq:
        op = 'mul_assign';
        break;
      case TokenKind.SlashEq:
        op = 'div_assign';
        break;
    }
    
    if (op) {
      this.advance();
      const value = this.parseExpression();
      
      return {
        type: 'assignment',
        target: expr,
        op,
        value,
        span: { start: expr.span.start, end: value.span.end },
      };
    }
    
    return {
      type: 'expr',
      expr,
      span: expr.span,
    };
  }

  // ===== Expression Parsing =====

  private parseExpression(): AST.Expr {
    return this.parseOrExpr();
  }

  private parseOrExpr(): AST.Expr {
    let left = this.parseAndExpr();
    
    while (this.check(TokenKind.OrOr)) {
      this.advance();
      const right = this.parseAndExpr();
      left = {
        type: 'binary',
        left,
        op: 'or',
        right,
        span: { start: left.span.start, end: right.span.end },
      };
    }
    
    return left;
  }

  private parseAndExpr(): AST.Expr {
    let left = this.parseEqualityExpr();
    
    while (this.check(TokenKind.AndAnd)) {
      this.advance();
      const right = this.parseEqualityExpr();
      left = {
        type: 'binary',
        left,
        op: 'and',
        right,
        span: { start: left.span.start, end: right.span.end },
      };
    }
    
    return left;
  }

  private parseEqualityExpr(): AST.Expr {
    let left = this.parseComparisonExpr();
    
    while (true) {
      const token = this.peek();
      let op: AST.BinaryOp | null = null;
      
      if (token.kind === TokenKind.EqEq) op = 'eq';
      else if (token.kind === TokenKind.NotEq) op = 'neq';
      else break;
      
      this.advance();
      const right = this.parseComparisonExpr();
      left = {
        type: 'binary',
        left,
        op,
        right,
        span: { start: left.span.start, end: right.span.end },
      };
    }
    
    return left;
  }

  private parseComparisonExpr(): AST.Expr {
    let left = this.parseAdditiveExpr();
    
    while (true) {
      const token = this.peek();
      let op: AST.BinaryOp | null = null;
      
      if (token.kind === TokenKind.Lt) op = 'lt';
      else if (token.kind === TokenKind.LtEq) op = 'lte';
      else if (token.kind === TokenKind.Gt) op = 'gt';
      else if (token.kind === TokenKind.GtEq) op = 'gte';
      else break;
      
      this.advance();
      const right = this.parseAdditiveExpr();
      left = {
        type: 'binary',
        left,
        op,
        right,
        span: { start: left.span.start, end: right.span.end },
      };
    }
    
    return left;
  }

  private parseAdditiveExpr(): AST.Expr {
    let left = this.parseMultiplicativeExpr();
    
    while (true) {
      const token = this.peek();
      let op: AST.BinaryOp | null = null;
      
      if (token.kind === TokenKind.Plus) op = 'add';
      else if (token.kind === TokenKind.Minus) op = 'sub';
      else break;
      
      this.advance();
      const right = this.parseMultiplicativeExpr();
      left = {
        type: 'binary',
        left,
        op,
        right,
        span: { start: left.span.start, end: right.span.end },
      };
    }
    
    return left;
  }

  private parseMultiplicativeExpr(): AST.Expr {
    let left = this.parseUnaryExpr();
    
    while (true) {
      const token = this.peek();
      let op: AST.BinaryOp | null = null;
      
      if (token.kind === TokenKind.Star) op = 'mul';
      else if (token.kind === TokenKind.Slash) op = 'div';
      else if (token.kind === TokenKind.Percent) op = 'mod';
      else break;
      
      this.advance();
      const right = this.parseUnaryExpr();
      left = {
        type: 'binary',
        left,
        op,
        right,
        span: { start: left.span.start, end: right.span.end },
      };
    }
    
    return left;
  }

  private parseUnaryExpr(): AST.Expr {
    const token = this.peek();
    
    if (token.kind === TokenKind.Not) {
      const start = this.advance().span.start;
      const expr = this.parseUnaryExpr();
      return {
        type: 'unary',
        op: 'not',
        expr,
        span: { start, end: expr.span.end },
      };
    }
    
    if (token.kind === TokenKind.Minus) {
      const start = this.advance().span.start;
      const expr = this.parseUnaryExpr();
      return {
        type: 'unary',
        op: 'neg',
        expr,
        span: { start, end: expr.span.end },
      };
    }
    
    return this.parsePostfixExpr();
  }

  private parsePostfixExpr(): AST.Expr {
    let expr = this.parsePrimaryExpr();
    
    while (true) {
      if (this.check(TokenKind.Dot)) {
        this.advance();
        const fieldToken = this.parseFieldNameToken();
        
        // Check if it's a method call
        if (this.check(TokenKind.LParen)) {
          this.advance();
          const args: AST.Expr[] = [];
          while (!this.check(TokenKind.RParen) && !this.isAtEnd()) {
            args.push(this.parseExpression());
            if (this.check(TokenKind.Comma)) {
              this.advance();
            }
          }
          const end = this.consume(TokenKind.RParen, ')').span.end;
          
          expr = {
            type: 'method_call',
            base: expr,
            method: fieldToken.text,
            args,
            span: { start: expr.span.start, end },
          };
        } else {
          expr = {
            type: 'field_access',
            base: expr,
            field: fieldToken.text,
            span: { start: expr.span.start, end: fieldToken.span.end },
          };
        }
      } else if (this.check(TokenKind.LBracket)) {
        this.advance();
        const index = this.parseExpression();
        const end = this.consume(TokenKind.RBracket, ']').span.end;
        
        expr = {
          type: 'index_access',
          base: expr,
          index,
          span: { start: expr.span.start, end },
        };
      } else if (this.check(TokenKind.Has)) {
        // "entity has component" syntax
        this.advance();
        const componentToken = this.consume(TokenKind.Identifier, 'component name');
        
        expr = {
          type: 'has_component',
          entity: expr,
          component: componentToken.text,
          span: { start: expr.span.start, end: componentToken.span.end },
        };
      } else {
        break;
      }
    }
    
    return expr;
  }

  private parsePrimaryExpr(): AST.Expr {
    const token = this.advance();
    
    switch (token.kind) {
      case TokenKind.IntegerLiteral:
        return {
          type: 'literal',
          value: { type: 'integer', value: parseInt(token.text, 10) },
          span: token.span,
        };
      
      case TokenKind.FloatLiteral:
        return {
          type: 'literal',
          value: { type: 'float', value: parseFloat(token.text) },
          span: token.span,
        };
      
      case TokenKind.DecimalLiteral:
        return {
          type: 'literal',
          value: { type: 'decimal', value: token.text.replace(/d$/, '') },
          span: token.span,
        };
      
      case TokenKind.StringLiteral:
      case TokenKind.StringLiteralSingle:
        return {
          type: 'literal',
          value: { type: 'string', value: token.text.slice(1, -1) },
          span: token.span,
        };
      
      case TokenKind.True:
        return {
          type: 'literal',
          value: { type: 'boolean', value: true },
          span: token.span,
        };
      
      case TokenKind.False:
        return {
          type: 'literal',
          value: { type: 'boolean', value: false },
          span: token.span,
        };
      
      case TokenKind.Null:
        return {
          type: 'literal',
          value: { type: 'null' },
          span: token.span,
        };
      
      case TokenKind.Entities:
        // `entities having ComponentType`
        this.consume(TokenKind.Having, 'having');
        const componentToken = this.consume(TokenKind.Identifier, 'component name');
        return {
          type: 'entities_having',
          component: componentToken.text,
          span: { start: token.span.start, end: componentToken.span.end },
        };
      
      case TokenKind.Clone:
        // `clone entity_expr` or `clone entity_expr { overrides }`
        const source = this.parsePostfixExpr();
        const overrides: AST.ComponentInit[] = [];
        
        if (this.check(TokenKind.LBrace)) {
          this.advance();
          while (!this.check(TokenKind.RBrace) && !this.isAtEnd()) {
            overrides.push(this.parseComponentInit());
          }
          const end = this.consume(TokenKind.RBrace, '}').span.end;
          
          return {
            type: 'clone_entity',
            source,
            overrides,
            span: { start: token.span.start, end },
          };
        }
        
        return {
          type: 'clone_entity',
          source,
          overrides,
          span: { start: token.span.start, end: source.span.end },
        };
      
      case TokenKind.Entity:
      case TokenKind.Event:
        // Allow these keywords as identifiers in expression context
        return {
          type: 'identifier',
          name: token.text,
          span: token.span,
        };
      
      case TokenKind.Identifier:
        // Check if it's a function call
        if (this.check(TokenKind.LParen)) {
          this.advance();
          const args: AST.Expr[] = [];
          while (!this.check(TokenKind.RParen) && !this.isAtEnd()) {
            args.push(this.parseExpression());
            if (this.check(TokenKind.Comma)) {
              this.advance();
            }
          }
          const end = this.consume(TokenKind.RParen, ')').span.end;
          
          return {
            type: 'call',
            name: token.text,
            args,
            span: { start: token.span.start, end },
          };
        }
        
        return {
          type: 'identifier',
          name: token.text,
          span: token.span,
        };
      
      case TokenKind.EntityRef:
        return {
          type: 'entity_ref',
          name: token.text.slice(1), // Remove @
          span: token.span,
        };
      
      case TokenKind.LParen:
        const inner = this.parseExpression();
        const end = this.consume(TokenKind.RParen, ')').span.end;
        return {
          type: 'paren',
          inner,
          span: { start: token.span.start, end },
        };
      
      case TokenKind.LBracket:
        // List literal
        const elements: AST.Expr[] = [];
        while (!this.check(TokenKind.RBracket) && !this.isAtEnd()) {
          elements.push(this.parseExpression());
          if (this.check(TokenKind.Comma)) {
            this.advance();
          }
        }
        const listEnd = this.consume(TokenKind.RBracket, ']').span.end;
        return {
          type: 'list',
          elements,
          span: { start: token.span.start, end: listEnd },
        };
      
      default:
        throw new ParseError(
          token.span.start,
          `Unexpected token '${token.text}' in expression`
        );
    }
  }
}

/**
 * Parse tokens into an AST
 */
export function parse(tokens: Token[]): AST.Module {
  const parser = new Parser(tokens);
  return parser.parse();
}
