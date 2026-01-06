"use strict";
var BlinkCompiler = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    AST: () => ast_exports,
    CodeGenerator: () => CodeGenerator,
    IR: () => ir_exports,
    LexerError: () => LexerError,
    ParseError: () => ParseError,
    Parser: () => Parser,
    TokenKind: () => TokenKind,
    compile: () => compile,
    compileString: () => compileString,
    generate: () => generate,
    mergeIRModules: () => mergeIRModules,
    parse: () => parse,
    parseSource: () => parseSource,
    tokenize: () => tokenize,
    tokenizeSource: () => tokenizeSource
  });

  // src/lexer.ts
  var TokenKind = /* @__PURE__ */ ((TokenKind3) => {
    TokenKind3["Component"] = "Component";
    TokenKind3["Rule"] = "Rule";
    TokenKind3["On"] = "On";
    TokenKind3["Trigger"] = "Trigger";
    TokenKind3["Event"] = "Event";
    TokenKind3["Entity"] = "Entity";
    TokenKind3["If"] = "If";
    TokenKind3["Else"] = "Else";
    TokenKind3["For"] = "For";
    TokenKind3["While"] = "While";
    TokenKind3["Fn"] = "Fn";
    TokenKind3["Return"] = "Return";
    TokenKind3["True"] = "True";
    TokenKind3["False"] = "False";
    TokenKind3["Null"] = "Null";
    TokenKind3["Schedule"] = "Schedule";
    TokenKind3["Cancel"] = "Cancel";
    TokenKind3["Recurring"] = "Recurring";
    TokenKind3["Module"] = "Module";
    TokenKind3["Import"] = "Import";
    TokenKind3["When"] = "When";
    TokenKind3["Create"] = "Create";
    TokenKind3["Delete"] = "Delete";
    TokenKind3["Has"] = "Has";
    TokenKind3["Let"] = "Let";
    TokenKind3["In"] = "In";
    TokenKind3["Choice"] = "Choice";
    TokenKind3["New"] = "New";
    TokenKind3["Clone"] = "Clone";
    TokenKind3["Having"] = "Having";
    TokenKind3["Entities"] = "Entities";
    TokenKind3["TypeString"] = "TypeString";
    TokenKind3["TypeBoolean"] = "TypeBoolean";
    TokenKind3["TypeInteger"] = "TypeInteger";
    TokenKind3["TypeFloat"] = "TypeFloat";
    TokenKind3["TypeDecimal"] = "TypeDecimal";
    TokenKind3["TypeId"] = "TypeId";
    TokenKind3["TypeList"] = "TypeList";
    TokenKind3["TypeNumber"] = "TypeNumber";
    TokenKind3["Identifier"] = "Identifier";
    TokenKind3["EntityRef"] = "EntityRef";
    TokenKind3["StringLiteral"] = "StringLiteral";
    TokenKind3["StringLiteralSingle"] = "StringLiteralSingle";
    TokenKind3["DecimalLiteral"] = "DecimalLiteral";
    TokenKind3["FloatLiteral"] = "FloatLiteral";
    TokenKind3["IntegerLiteral"] = "IntegerLiteral";
    TokenKind3["LBrace"] = "LBrace";
    TokenKind3["RBrace"] = "RBrace";
    TokenKind3["LParen"] = "LParen";
    TokenKind3["RParen"] = "RParen";
    TokenKind3["LBracket"] = "LBracket";
    TokenKind3["RBracket"] = "RBracket";
    TokenKind3["Comma"] = "Comma";
    TokenKind3["Colon"] = "Colon";
    TokenKind3["Semicolon"] = "Semicolon";
    TokenKind3["Dot"] = "Dot";
    TokenKind3["Question"] = "Question";
    TokenKind3["Plus"] = "Plus";
    TokenKind3["Minus"] = "Minus";
    TokenKind3["Star"] = "Star";
    TokenKind3["Slash"] = "Slash";
    TokenKind3["Percent"] = "Percent";
    TokenKind3["Eq"] = "Eq";
    TokenKind3["EqEq"] = "EqEq";
    TokenKind3["NotEq"] = "NotEq";
    TokenKind3["Lt"] = "Lt";
    TokenKind3["LtEq"] = "LtEq";
    TokenKind3["Gt"] = "Gt";
    TokenKind3["GtEq"] = "GtEq";
    TokenKind3["AndAnd"] = "AndAnd";
    TokenKind3["OrOr"] = "OrOr";
    TokenKind3["Not"] = "Not";
    TokenKind3["And"] = "And";
    TokenKind3["PlusEq"] = "PlusEq";
    TokenKind3["MinusEq"] = "MinusEq";
    TokenKind3["StarEq"] = "StarEq";
    TokenKind3["SlashEq"] = "SlashEq";
    TokenKind3["Arrow"] = "Arrow";
    TokenKind3["EOF"] = "EOF";
    return TokenKind3;
  })(TokenKind || {});
  var KEYWORDS = {
    "component": "Component" /* Component */,
    "rule": "Rule" /* Rule */,
    "on": "On" /* On */,
    "trigger": "Trigger" /* Trigger */,
    "event": "Event" /* Event */,
    "entity": "Entity" /* Entity */,
    "if": "If" /* If */,
    "else": "Else" /* Else */,
    "for": "For" /* For */,
    "while": "While" /* While */,
    "fn": "Fn" /* Fn */,
    "return": "Return" /* Return */,
    "true": "True" /* True */,
    "false": "False" /* False */,
    "null": "Null" /* Null */,
    "schedule": "Schedule" /* Schedule */,
    "cancel": "Cancel" /* Cancel */,
    "recurring": "Recurring" /* Recurring */,
    "module": "Module" /* Module */,
    "import": "Import" /* Import */,
    "when": "When" /* When */,
    "create": "Create" /* Create */,
    "delete": "Delete" /* Delete */,
    "has": "Has" /* Has */,
    "let": "Let" /* Let */,
    "in": "In" /* In */,
    "choice": "Choice" /* Choice */,
    "new": "New" /* New */,
    "clone": "Clone" /* Clone */,
    "having": "Having" /* Having */,
    "entities": "Entities" /* Entities */,
    // Types
    "string": "TypeString" /* TypeString */,
    "boolean": "TypeBoolean" /* TypeBoolean */,
    "integer": "TypeInteger" /* TypeInteger */,
    "float": "TypeFloat" /* TypeFloat */,
    "decimal": "TypeDecimal" /* TypeDecimal */,
    "id": "TypeId" /* TypeId */,
    "list": "TypeList" /* TypeList */,
    "number": "TypeNumber" /* TypeNumber */
  };
  var LexerError = class extends Error {
    constructor(position, message) {
      super(message);
      this.position = position;
      this.name = "LexerError";
    }
  };
  var Lexer = class {
    constructor(source) {
      this.pos = 0;
      this.tokens = [];
      this.source = source;
    }
    tokenize() {
      while (!this.isAtEnd()) {
        this.skipWhitespaceAndComments();
        if (this.isAtEnd())
          break;
        const token = this.scanToken();
        if (token) {
          this.tokens.push(token);
        }
      }
      this.tokens.push({
        kind: "EOF" /* EOF */,
        text: "",
        span: { start: this.pos, end: this.pos }
      });
      return this.tokens;
    }
    isAtEnd() {
      return this.pos >= this.source.length;
    }
    peek() {
      return this.source[this.pos] || "";
    }
    peekNext() {
      return this.source[this.pos + 1] || "";
    }
    advance() {
      return this.source[this.pos++] || "";
    }
    skipWhitespaceAndComments() {
      while (!this.isAtEnd()) {
        const c = this.peek();
        if (c === " " || c === "	" || c === "\n" || c === "\r") {
          this.advance();
          continue;
        }
        if (c === "/" && this.peekNext() === "/") {
          while (!this.isAtEnd() && this.peek() !== "\n") {
            this.advance();
          }
          continue;
        }
        if (c === "/" && this.peekNext() === "*") {
          this.advance();
          this.advance();
          while (!this.isAtEnd()) {
            if (this.peek() === "*" && this.peekNext() === "/") {
              this.advance();
              this.advance();
              break;
            }
            this.advance();
          }
          continue;
        }
        break;
      }
    }
    scanToken() {
      const start = this.pos;
      const c = this.advance();
      switch (c) {
        case "{":
          return this.makeToken("LBrace" /* LBrace */, start);
        case "}":
          return this.makeToken("RBrace" /* RBrace */, start);
        case "(":
          return this.makeToken("LParen" /* LParen */, start);
        case ")":
          return this.makeToken("RParen" /* RParen */, start);
        case "[":
          return this.makeToken("LBracket" /* LBracket */, start);
        case "]":
          return this.makeToken("RBracket" /* RBracket */, start);
        case ",":
          return this.makeToken("Comma" /* Comma */, start);
        case ":":
          return this.makeToken("Colon" /* Colon */, start);
        case ";":
          return this.makeToken("Semicolon" /* Semicolon */, start);
        case ".":
          return this.makeToken("Dot" /* Dot */, start);
        case "?":
          return this.makeToken("Question" /* Question */, start);
        case "%":
          return this.makeToken("Percent" /* Percent */, start);
      }
      if (c === "+") {
        if (this.peek() === "=") {
          this.advance();
          return this.makeToken("PlusEq" /* PlusEq */, start);
        }
        return this.makeToken("Plus" /* Plus */, start);
      }
      if (c === "-") {
        if (this.peek() === "=") {
          this.advance();
          return this.makeToken("MinusEq" /* MinusEq */, start);
        }
        if (this.peek() === ">") {
          this.advance();
          return this.makeToken("Arrow" /* Arrow */, start);
        }
        return this.makeToken("Minus" /* Minus */, start);
      }
      if (c === "*") {
        if (this.peek() === "=") {
          this.advance();
          return this.makeToken("StarEq" /* StarEq */, start);
        }
        return this.makeToken("Star" /* Star */, start);
      }
      if (c === "/") {
        if (this.peek() === "=") {
          this.advance();
          return this.makeToken("SlashEq" /* SlashEq */, start);
        }
        return this.makeToken("Slash" /* Slash */, start);
      }
      if (c === "=") {
        if (this.peek() === "=") {
          this.advance();
          return this.makeToken("EqEq" /* EqEq */, start);
        }
        return this.makeToken("Eq" /* Eq */, start);
      }
      if (c === "!") {
        if (this.peek() === "=") {
          this.advance();
          return this.makeToken("NotEq" /* NotEq */, start);
        }
        return this.makeToken("Not" /* Not */, start);
      }
      if (c === "<") {
        if (this.peek() === "=") {
          this.advance();
          return this.makeToken("LtEq" /* LtEq */, start);
        }
        return this.makeToken("Lt" /* Lt */, start);
      }
      if (c === ">") {
        if (this.peek() === "=") {
          this.advance();
          return this.makeToken("GtEq" /* GtEq */, start);
        }
        return this.makeToken("Gt" /* Gt */, start);
      }
      if (c === "&") {
        if (this.peek() === "&") {
          this.advance();
          return this.makeToken("AndAnd" /* AndAnd */, start);
        }
        return this.makeToken("And" /* And */, start);
      }
      if (c === "|") {
        if (this.peek() === "|") {
          this.advance();
          return this.makeToken("OrOr" /* OrOr */, start);
        }
        throw new LexerError(start, `Unexpected character '|' at position ${start}`);
      }
      if (c === '"') {
        return this.scanStringLiteral(start, '"');
      }
      if (c === "'") {
        return this.scanStringLiteral(start, "'");
      }
      if (c === "@") {
        return this.scanEntityRef(start);
      }
      if (this.isDigit(c)) {
        return this.scanNumber(start, c);
      }
      if (this.isAlpha(c)) {
        return this.scanIdentifier(start, c);
      }
      throw new LexerError(start, `Unexpected character '${c}' at position ${start}`);
    }
    makeToken(kind, start) {
      return {
        kind,
        text: this.source.slice(start, this.pos),
        span: { start, end: this.pos }
      };
    }
    scanStringLiteral(start, quote) {
      while (!this.isAtEnd() && this.peek() !== quote) {
        if (this.peek() === "\\") {
          this.advance();
          if (!this.isAtEnd()) {
            this.advance();
          }
        } else {
          this.advance();
        }
      }
      if (this.isAtEnd()) {
        throw new LexerError(start, `Unterminated string literal starting at position ${start}`);
      }
      this.advance();
      return {
        kind: quote === '"' ? "StringLiteral" /* StringLiteral */ : "StringLiteralSingle" /* StringLiteralSingle */,
        text: this.source.slice(start, this.pos),
        span: { start, end: this.pos }
      };
    }
    scanEntityRef(start) {
      while (this.isAlphaNumeric(this.peek())) {
        this.advance();
      }
      return {
        kind: "EntityRef" /* EntityRef */,
        text: this.source.slice(start, this.pos),
        span: { start, end: this.pos }
      };
    }
    scanNumber(start, firstDigit) {
      let text = firstDigit;
      while (this.isDigit(this.peek())) {
        text += this.advance();
      }
      if (this.peek() === "." && this.isDigit(this.peekNext())) {
        text += this.advance();
        while (this.isDigit(this.peek())) {
          text += this.advance();
        }
        if (this.peek() === "d") {
          text += this.advance();
          return {
            kind: "DecimalLiteral" /* DecimalLiteral */,
            text: this.source.slice(start, this.pos),
            span: { start, end: this.pos }
          };
        }
        return {
          kind: "FloatLiteral" /* FloatLiteral */,
          text: this.source.slice(start, this.pos),
          span: { start, end: this.pos }
        };
      }
      return {
        kind: "IntegerLiteral" /* IntegerLiteral */,
        text: this.source.slice(start, this.pos),
        span: { start, end: this.pos }
      };
    }
    scanIdentifier(start, firstChar) {
      let text = firstChar;
      while (this.isAlphaNumeric(this.peek())) {
        text += this.advance();
      }
      const kind = KEYWORDS[text] ?? "Identifier" /* Identifier */;
      return {
        kind,
        text: this.source.slice(start, this.pos),
        span: { start, end: this.pos }
      };
    }
    isDigit(c) {
      return c >= "0" && c <= "9";
    }
    isAlpha(c) {
      return c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c === "_";
    }
    isAlphaNumeric(c) {
      return this.isAlpha(c) || this.isDigit(c);
    }
  };
  function tokenize(source) {
    const lexer = new Lexer(source);
    return lexer.tokenize();
  }

  // src/parser.ts
  var ParseError = class extends Error {
    constructor(position, message) {
      super(message);
      this.position = position;
      this.name = "ParseError";
    }
  };
  var Parser = class {
    constructor(tokens) {
      this.pos = 0;
      this.tokens = tokens;
    }
    parse() {
      const items = [];
      while (!this.isAtEnd()) {
        items.push(this.parseItem());
      }
      return { items };
    }
    isAtEnd() {
      return this.peek().kind === "EOF" /* EOF */;
    }
    peek() {
      return this.tokens[this.pos] || { kind: "EOF" /* EOF */, text: "", span: { start: 0, end: 0 } };
    }
    peekNext() {
      return this.tokens[this.pos + 1] || { kind: "EOF" /* EOF */, text: "", span: { start: 0, end: 0 } };
    }
    advance() {
      if (!this.isAtEnd()) {
        return this.tokens[this.pos++];
      }
      return this.peek();
    }
    check(kind) {
      return this.peek().kind === kind;
    }
    consume(kind, expected) {
      if (this.check(kind)) {
        return this.advance();
      }
      const token = this.peek();
      throw new ParseError(
        token.span.start,
        `Expected ${expected}, got '${token.text}' at position ${token.span.start}`
      );
    }
    parseItem() {
      const token = this.peek();
      switch (token.kind) {
        case "Component" /* Component */:
          return this.parseComponent();
        case "Rule" /* Rule */:
          return this.parseRule();
        case "Fn" /* Fn */:
          return this.parseFunction(false);
        case "Choice" /* Choice */:
          return this.parseChoiceFunction();
        case "Import" /* Import */:
          return this.parseImport();
        case "Module" /* Module */:
          return this.parseModuleDef();
        case "Entity" /* Entity */:
        case "New" /* New */:
          return this.parseEntity();
        case "EntityRef" /* EntityRef */:
          return this.parseEntity();
        case "Identifier" /* Identifier */:
          if (this.peekNext().kind === "Eq" /* Eq */) {
            const peekIdx = this.pos + 2;
            if (this.tokens[peekIdx]?.kind === "New" /* New */) {
              return this.parseEntityAssignment();
            }
          }
          throw new ParseError(
            token.span.start,
            `Unexpected identifier '${token.text}' at top level`
          );
        default:
          throw new ParseError(
            token.span.start,
            `Unexpected token '${token.text}' at position ${token.span.start}`
          );
      }
    }
    // ===== Component Parsing =====
    parseComponent() {
      const start = this.consume("Component" /* Component */, "component").span.start;
      const name = this.consume("Identifier" /* Identifier */, "component name").text;
      this.consume("LBrace" /* LBrace */, "{");
      const fields = [];
      while (!this.check("RBrace" /* RBrace */) && !this.isAtEnd()) {
        fields.push(this.parseFieldDef());
      }
      const end = this.consume("RBrace" /* RBrace */, "}").span.end;
      return {
        type: "component",
        name,
        fields,
        span: { start, end }
      };
    }
    parseFieldDef() {
      const nameToken = this.parseFieldNameToken();
      const start = nameToken.span.start;
      this.consume("Colon" /* Colon */, ":");
      const fieldType = this.parseType();
      const optional = this.check("Question" /* Question */);
      if (optional) {
        this.advance();
      }
      const end = this.tokens[this.pos - 1]?.span.end ?? start;
      return {
        name: nameToken.text,
        fieldType: optional ? { type: "optional", inner: fieldType } : fieldType,
        optional,
        span: { start, end }
      };
    }
    parseFieldNameToken() {
      const token = this.peek();
      if (token.kind === "Identifier" /* Identifier */ || token.kind === "Entity" /* Entity */ || token.kind === "Event" /* Event */ || token.kind === "TypeId" /* TypeId */) {
        return this.advance();
      }
      return this.consume("Identifier" /* Identifier */, "field name");
    }
    parseType() {
      const token = this.advance();
      switch (token.kind) {
        case "TypeString" /* TypeString */:
          return { type: "string" };
        case "TypeBoolean" /* TypeBoolean */:
          return { type: "boolean" };
        case "TypeInteger" /* TypeInteger */:
          return { type: "integer" };
        case "TypeFloat" /* TypeFloat */:
          return { type: "float" };
        case "TypeDecimal" /* TypeDecimal */:
          return { type: "decimal" };
        case "TypeNumber" /* TypeNumber */:
          return { type: "number" };
        case "TypeId" /* TypeId */:
          return { type: "id" };
        case "TypeList" /* TypeList */:
          if (this.check("Lt" /* Lt */)) {
            this.advance();
            const element = this.parseType();
            this.consume("Gt" /* Gt */, ">");
            return { type: "list", element };
          }
          return { type: "list", element: { type: "id" } };
        case "Identifier" /* Identifier */:
          return { type: "component", name: token.text };
        default:
          throw new ParseError(
            token.span.start,
            `Expected type, got '${token.text}'`
          );
      }
    }
    parseCompositeType() {
      const firstType = this.parseType();
      if (this.check("And" /* And */)) {
        const types = [firstType];
        while (this.check("And" /* And */)) {
          this.advance();
          types.push(this.parseType());
        }
        return { type: "composite", types };
      }
      return firstType;
    }
    // ===== Rule Parsing =====
    parseRule() {
      const start = this.consume("Rule" /* Rule */, "rule").span.start;
      let name = null;
      if (this.check("Identifier" /* Identifier */)) {
        name = this.advance().text;
      }
      this.consume("On" /* On */, "on");
      const triggerEvent = this.consume("Identifier" /* Identifier */, "event name").text;
      let condition = null;
      if (this.check("When" /* When */)) {
        this.advance();
        condition = this.parseExpression();
      }
      let priority = null;
      if (this.check("LBracket" /* LBracket */)) {
        this.advance();
        this.consume("Identifier" /* Identifier */, "priority");
        this.consume("Colon" /* Colon */, ":");
        const priorityToken = this.consume("IntegerLiteral" /* IntegerLiteral */, "priority value");
        priority = parseInt(priorityToken.text, 10);
        this.consume("RBracket" /* RBracket */, "]");
      }
      const body = this.parseBlock();
      return {
        type: "rule",
        name,
        triggerEvent,
        condition,
        priority,
        body,
        span: { start, end: body.span.end }
      };
    }
    // ===== Function Parsing =====
    parseFunction(isChoice) {
      const start = this.consume("Fn" /* Fn */, "fn").span.start;
      const name = this.consume("Identifier" /* Identifier */, "function name").text;
      const params = this.parseParams();
      let returnType = null;
      if (this.check("Colon" /* Colon */)) {
        this.advance();
        returnType = this.parseType();
      }
      const body = this.parseBlock();
      return {
        type: "function",
        name,
        params,
        returnType,
        body,
        isChoice,
        span: { start, end: body.span.end }
      };
    }
    parseChoiceFunction() {
      const start = this.consume("Choice" /* Choice */, "choice").span.start;
      this.consume("Fn" /* Fn */, "fn");
      const name = this.consume("Identifier" /* Identifier */, "function name").text;
      const params = this.parseChoiceParams();
      let returnType = null;
      if (this.check("Colon" /* Colon */)) {
        this.advance();
        returnType = this.parseType();
      }
      const body = this.parseBlock();
      return {
        type: "function",
        name,
        params,
        returnType,
        body,
        isChoice: true,
        span: { start, end: body.span.end }
      };
    }
    parseParams() {
      this.consume("LParen" /* LParen */, "(");
      const params = [];
      while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
        const paramStart = this.peek().span.start;
        const paramName = this.consume("Identifier" /* Identifier */, "parameter name").text;
        this.consume("Colon" /* Colon */, ":");
        const paramType = this.parseType();
        const paramEnd = this.tokens[this.pos - 1]?.span.end ?? paramStart;
        params.push({
          name: paramName,
          paramType,
          span: { start: paramStart, end: paramEnd }
        });
        if (this.check("Comma" /* Comma */)) {
          this.advance();
        }
      }
      this.consume("RParen" /* RParen */, ")");
      return params;
    }
    parseChoiceParams() {
      this.consume("LParen" /* LParen */, "(");
      const params = [];
      while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
        const paramStart = this.peek().span.start;
        const paramName = this.consume("Identifier" /* Identifier */, "parameter name").text;
        this.consume("Colon" /* Colon */, ":");
        const paramType = this.parseCompositeType();
        const paramEnd = this.tokens[this.pos - 1]?.span.end ?? paramStart;
        params.push({
          name: paramName,
          paramType,
          span: { start: paramStart, end: paramEnd }
        });
        if (this.check("Comma" /* Comma */)) {
          this.advance();
        }
      }
      this.consume("RParen" /* RParen */, ")");
      return params;
    }
    // ===== Import Parsing =====
    parseImport() {
      const start = this.consume("Import" /* Import */, "import").span.start;
      const path = [];
      path.push(this.consume("Identifier" /* Identifier */, "module path").text);
      while (this.check("Dot" /* Dot */)) {
        this.advance();
        path.push(this.consume("Identifier" /* Identifier */, "module path segment").text);
      }
      let items = null;
      if (this.check("LBrace" /* LBrace */)) {
        this.advance();
        items = [];
        while (!this.check("RBrace" /* RBrace */) && !this.isAtEnd()) {
          items.push(this.consume("Identifier" /* Identifier */, "import item").text);
          if (this.check("Comma" /* Comma */)) {
            this.advance();
          }
        }
        this.consume("RBrace" /* RBrace */, "}");
      }
      const end = this.tokens[this.pos - 1]?.span.end ?? start;
      return {
        type: "import",
        path,
        items,
        span: { start, end }
      };
    }
    // ===== Module Definition =====
    parseModuleDef() {
      const start = this.consume("Module" /* Module */, "module").span.start;
      const name = this.consume("Identifier" /* Identifier */, "module name").text;
      this.consume("LBrace" /* LBrace */, "{");
      const items = [];
      while (!this.check("RBrace" /* RBrace */) && !this.isAtEnd()) {
        items.push(this.parseItem());
      }
      const end = this.consume("RBrace" /* RBrace */, "}").span.end;
      return {
        type: "module",
        name,
        items,
        span: { start, end }
      };
    }
    // ===== Entity Parsing =====
    parseEntity() {
      let start;
      let variable = null;
      if (this.check("EntityRef" /* EntityRef */)) {
        const refToken = this.advance();
        start = refToken.span.start;
        variable = refToken.text.slice(1);
      } else if (this.check("New" /* New */)) {
        start = this.consume("New" /* New */, "new").span.start;
        this.consume("Entity" /* Entity */, "entity");
      } else {
        start = this.consume("Entity" /* Entity */, "entity").span.start;
        if (this.check("EntityRef" /* EntityRef */)) {
          const refToken = this.advance();
          variable = refToken.text.slice(1);
        } else if (this.check("Identifier" /* Identifier */) && this.peekNext().kind === "LBrace" /* LBrace */) {
          variable = this.advance().text;
        }
      }
      this.consume("LBrace" /* LBrace */, "{");
      const components = [];
      const boundFunctions = [];
      while (!this.check("RBrace" /* RBrace */) && !this.isAtEnd()) {
        if (this.check("Dot" /* Dot */)) {
          boundFunctions.push(this.parseBoundFunction());
        } else {
          components.push(this.parseComponentInit());
        }
      }
      const end = this.consume("RBrace" /* RBrace */, "}").span.end;
      return {
        type: "entity",
        variable,
        components,
        boundFunctions,
        span: { start, end }
      };
    }
    parseEntityAssignment() {
      const varToken = this.consume("Identifier" /* Identifier */, "variable name");
      const start = varToken.span.start;
      const variable = varToken.text;
      this.consume("Eq" /* Eq */, "=");
      this.consume("New" /* New */, "new");
      this.consume("Entity" /* Entity */, "entity");
      this.consume("LBrace" /* LBrace */, "{");
      const components = [];
      const boundFunctions = [];
      while (!this.check("RBrace" /* RBrace */) && !this.isAtEnd()) {
        if (this.check("Dot" /* Dot */)) {
          boundFunctions.push(this.parseBoundFunction());
        } else {
          components.push(this.parseComponentInit());
        }
      }
      const end = this.consume("RBrace" /* RBrace */, "}").span.end;
      return {
        type: "entity",
        variable,
        components,
        boundFunctions,
        span: { start, end }
      };
    }
    parseBoundFunction() {
      const start = this.consume("Dot" /* Dot */, ".").span.start;
      const name = this.consume("Identifier" /* Identifier */, "function name").text;
      this.consume("Eq" /* Eq */, "=");
      this.consume("Choice" /* Choice */, "choice");
      const params = this.parseChoiceParams();
      let returnType = null;
      if (this.check("Colon" /* Colon */)) {
        this.advance();
        returnType = this.parseType();
      }
      const body = this.parseBlock();
      return {
        name,
        params,
        returnType,
        body,
        span: { start, end: body.span.end }
      };
    }
    parseComponentInit() {
      const nameToken = this.consume("Identifier" /* Identifier */, "component name");
      const start = nameToken.span.start;
      this.consume("LBrace" /* LBrace */, "{");
      const fields = [];
      while (!this.check("RBrace" /* RBrace */) && !this.isAtEnd()) {
        const fieldNameToken = this.parseFieldNameToken();
        this.consume("Colon" /* Colon */, ":");
        const fieldValue = this.parseExpression();
        fields.push([fieldNameToken.text, fieldValue]);
      }
      const end = this.consume("RBrace" /* RBrace */, "}").span.end;
      return {
        name: nameToken.text,
        fields,
        span: { start, end }
      };
    }
    // ===== Block Parsing =====
    parseBlock() {
      const start = this.consume("LBrace" /* LBrace */, "{").span.start;
      const statements = [];
      while (!this.check("RBrace" /* RBrace */) && !this.isAtEnd()) {
        statements.push(this.parseStatement());
      }
      const end = this.consume("RBrace" /* RBrace */, "}").span.end;
      return {
        statements,
        span: { start, end }
      };
    }
    // ===== Statement Parsing =====
    parseStatement() {
      const token = this.peek();
      switch (token.kind) {
        case "Let" /* Let */:
          return this.parseLetStatement();
        case "If" /* If */:
          return this.parseIfStatement();
        case "For" /* For */:
          return this.parseForStatement();
        case "While" /* While */:
          return this.parseWhileStatement();
        case "Return" /* Return */:
          return this.parseReturnStatement();
        case "Schedule" /* Schedule */:
          return this.parseScheduleStatement();
        case "Cancel" /* Cancel */:
          return this.parseCancelStatement();
        case "Create" /* Create */:
          return this.parseCreateStatement();
        case "Delete" /* Delete */:
          return this.parseDeleteStatement();
        default:
          return this.parseExpressionOrAssignment();
      }
    }
    parseLetStatement() {
      const start = this.consume("Let" /* Let */, "let").span.start;
      const name = this.consume("Identifier" /* Identifier */, "variable name").text;
      let typeAnnotation = null;
      if (this.check("Colon" /* Colon */)) {
        this.advance();
        typeAnnotation = this.parseType();
      }
      this.consume("Eq" /* Eq */, "=");
      const value = this.parseExpression();
      const end = this.tokens[this.pos - 1]?.span.end ?? start;
      return {
        type: "let",
        name,
        typeAnnotation,
        value,
        span: { start, end }
      };
    }
    parseIfStatement() {
      const start = this.consume("If" /* If */, "if").span.start;
      const condition = this.parseExpression();
      const thenBlock = this.parseBlock();
      let elseBlock = null;
      if (this.check("Else" /* Else */)) {
        this.advance();
        if (this.check("If" /* If */)) {
          elseBlock = { type: "else_if", statement: this.parseIfStatement() };
        } else {
          elseBlock = { type: "else", block: this.parseBlock() };
        }
      }
      const end = elseBlock ? elseBlock.type === "else_if" ? elseBlock.statement.span.end : elseBlock.block.span.end : thenBlock.span.end;
      return {
        type: "if",
        condition,
        thenBlock,
        elseBlock,
        span: { start, end }
      };
    }
    parseForStatement() {
      const start = this.consume("For" /* For */, "for").span.start;
      const variable = this.consume("Identifier" /* Identifier */, "loop variable").text;
      this.consume("In" /* In */, "in");
      const iterable = this.parseExpression();
      const body = this.parseBlock();
      return {
        type: "for",
        variable,
        iterable,
        body,
        span: { start, end: body.span.end }
      };
    }
    parseWhileStatement() {
      const start = this.consume("While" /* While */, "while").span.start;
      const condition = this.parseExpression();
      const body = this.parseBlock();
      return {
        type: "while",
        condition,
        body,
        span: { start, end: body.span.end }
      };
    }
    parseReturnStatement() {
      const start = this.consume("Return" /* Return */, "return").span.start;
      let value = null;
      if (!this.check("RBrace" /* RBrace */) && !this.isAtEnd()) {
        const token = this.peek();
        if (!this.isStatementStart(token.kind)) {
          value = this.parseExpression();
        }
      }
      const end = this.tokens[this.pos - 1]?.span.end ?? start;
      return {
        type: "return",
        value,
        span: { start, end }
      };
    }
    isStatementStart(kind) {
      return [
        "Let" /* Let */,
        "If" /* If */,
        "For" /* For */,
        "While" /* While */,
        "Return" /* Return */,
        "Schedule" /* Schedule */,
        "Cancel" /* Cancel */,
        "Create" /* Create */,
        "Delete" /* Delete */
      ].includes(kind);
    }
    parseScheduleStatement() {
      const start = this.consume("Schedule" /* Schedule */, "schedule").span.start;
      const recurring = this.check("Recurring" /* Recurring */);
      if (recurring) {
        this.advance();
      }
      let delay = null;
      let interval = null;
      if (this.check("LBracket" /* LBracket */)) {
        this.advance();
        const paramName = this.consume("Identifier" /* Identifier */, "delay or interval").text;
        this.consume("Colon" /* Colon */, ":");
        const value = this.parseExpression();
        if (paramName === "delay") {
          delay = value;
        } else if (paramName === "interval") {
          interval = value;
        }
        this.consume("RBracket" /* RBracket */, "]");
      }
      const eventName = this.consume("Identifier" /* Identifier */, "event name").text;
      this.consume("LBrace" /* LBrace */, "{");
      const fields = [];
      while (!this.check("RBrace" /* RBrace */) && !this.isAtEnd()) {
        const fieldName = this.consume("Identifier" /* Identifier */, "field name").text;
        this.consume("Colon" /* Colon */, ":");
        const fieldValue = this.parseExpression();
        fields.push([fieldName, fieldValue]);
      }
      const end = this.consume("RBrace" /* RBrace */, "}").span.end;
      return {
        type: "schedule",
        recurring,
        delay,
        interval,
        eventName,
        fields,
        span: { start, end }
      };
    }
    parseCancelStatement() {
      const start = this.consume("Cancel" /* Cancel */, "cancel").span.start;
      const target = this.parseExpression();
      const end = this.tokens[this.pos - 1]?.span.end ?? start;
      return {
        type: "cancel",
        target,
        span: { start, end }
      };
    }
    parseCreateStatement() {
      const start = this.consume("Create" /* Create */, "create").span.start;
      this.consume("Entity" /* Entity */, "entity");
      this.consume("LBrace" /* LBrace */, "{");
      const components = [];
      while (!this.check("RBrace" /* RBrace */) && !this.isAtEnd()) {
        components.push(this.parseComponentInit());
      }
      const end = this.consume("RBrace" /* RBrace */, "}").span.end;
      return {
        type: "create",
        components,
        span: { start, end }
      };
    }
    parseDeleteStatement() {
      const start = this.consume("Delete" /* Delete */, "delete").span.start;
      const entity = this.parseExpression();
      const end = this.tokens[this.pos - 1]?.span.end ?? start;
      return {
        type: "delete",
        entity,
        span: { start, end }
      };
    }
    parseExpressionOrAssignment() {
      const expr = this.parseExpression();
      const token = this.peek();
      let op = null;
      switch (token.kind) {
        case "Eq" /* Eq */:
          op = "assign";
          break;
        case "PlusEq" /* PlusEq */:
          op = "add_assign";
          break;
        case "MinusEq" /* MinusEq */:
          op = "sub_assign";
          break;
        case "StarEq" /* StarEq */:
          op = "mul_assign";
          break;
        case "SlashEq" /* SlashEq */:
          op = "div_assign";
          break;
      }
      if (op) {
        this.advance();
        const value = this.parseExpression();
        return {
          type: "assignment",
          target: expr,
          op,
          value,
          span: { start: expr.span.start, end: value.span.end }
        };
      }
      return {
        type: "expr",
        expr,
        span: expr.span
      };
    }
    // ===== Expression Parsing =====
    parseExpression() {
      return this.parseOrExpr();
    }
    parseOrExpr() {
      let left = this.parseAndExpr();
      while (this.check("OrOr" /* OrOr */)) {
        this.advance();
        const right = this.parseAndExpr();
        left = {
          type: "binary",
          left,
          op: "or",
          right,
          span: { start: left.span.start, end: right.span.end }
        };
      }
      return left;
    }
    parseAndExpr() {
      let left = this.parseEqualityExpr();
      while (this.check("AndAnd" /* AndAnd */)) {
        this.advance();
        const right = this.parseEqualityExpr();
        left = {
          type: "binary",
          left,
          op: "and",
          right,
          span: { start: left.span.start, end: right.span.end }
        };
      }
      return left;
    }
    parseEqualityExpr() {
      let left = this.parseComparisonExpr();
      while (true) {
        const token = this.peek();
        let op = null;
        if (token.kind === "EqEq" /* EqEq */)
          op = "eq";
        else if (token.kind === "NotEq" /* NotEq */)
          op = "neq";
        else
          break;
        this.advance();
        const right = this.parseComparisonExpr();
        left = {
          type: "binary",
          left,
          op,
          right,
          span: { start: left.span.start, end: right.span.end }
        };
      }
      return left;
    }
    parseComparisonExpr() {
      let left = this.parseAdditiveExpr();
      while (true) {
        const token = this.peek();
        let op = null;
        if (token.kind === "Lt" /* Lt */)
          op = "lt";
        else if (token.kind === "LtEq" /* LtEq */)
          op = "lte";
        else if (token.kind === "Gt" /* Gt */)
          op = "gt";
        else if (token.kind === "GtEq" /* GtEq */)
          op = "gte";
        else
          break;
        this.advance();
        const right = this.parseAdditiveExpr();
        left = {
          type: "binary",
          left,
          op,
          right,
          span: { start: left.span.start, end: right.span.end }
        };
      }
      return left;
    }
    parseAdditiveExpr() {
      let left = this.parseMultiplicativeExpr();
      while (true) {
        const token = this.peek();
        let op = null;
        if (token.kind === "Plus" /* Plus */)
          op = "add";
        else if (token.kind === "Minus" /* Minus */)
          op = "sub";
        else
          break;
        this.advance();
        const right = this.parseMultiplicativeExpr();
        left = {
          type: "binary",
          left,
          op,
          right,
          span: { start: left.span.start, end: right.span.end }
        };
      }
      return left;
    }
    parseMultiplicativeExpr() {
      let left = this.parseUnaryExpr();
      while (true) {
        const token = this.peek();
        let op = null;
        if (token.kind === "Star" /* Star */)
          op = "mul";
        else if (token.kind === "Slash" /* Slash */)
          op = "div";
        else if (token.kind === "Percent" /* Percent */)
          op = "mod";
        else
          break;
        this.advance();
        const right = this.parseUnaryExpr();
        left = {
          type: "binary",
          left,
          op,
          right,
          span: { start: left.span.start, end: right.span.end }
        };
      }
      return left;
    }
    parseUnaryExpr() {
      const token = this.peek();
      if (token.kind === "Not" /* Not */) {
        const start = this.advance().span.start;
        const expr = this.parseUnaryExpr();
        return {
          type: "unary",
          op: "not",
          expr,
          span: { start, end: expr.span.end }
        };
      }
      if (token.kind === "Minus" /* Minus */) {
        const start = this.advance().span.start;
        const expr = this.parseUnaryExpr();
        return {
          type: "unary",
          op: "neg",
          expr,
          span: { start, end: expr.span.end }
        };
      }
      return this.parsePostfixExpr();
    }
    parsePostfixExpr() {
      let expr = this.parsePrimaryExpr();
      while (true) {
        if (this.check("Dot" /* Dot */)) {
          this.advance();
          const fieldToken = this.parseFieldNameToken();
          if (this.check("LParen" /* LParen */)) {
            this.advance();
            const args = [];
            while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
              args.push(this.parseExpression());
              if (this.check("Comma" /* Comma */)) {
                this.advance();
              }
            }
            const end = this.consume("RParen" /* RParen */, ")").span.end;
            expr = {
              type: "method_call",
              base: expr,
              method: fieldToken.text,
              args,
              span: { start: expr.span.start, end }
            };
          } else {
            expr = {
              type: "field_access",
              base: expr,
              field: fieldToken.text,
              span: { start: expr.span.start, end: fieldToken.span.end }
            };
          }
        } else if (this.check("LBracket" /* LBracket */)) {
          this.advance();
          const index = this.parseExpression();
          const end = this.consume("RBracket" /* RBracket */, "]").span.end;
          expr = {
            type: "index_access",
            base: expr,
            index,
            span: { start: expr.span.start, end }
          };
        } else if (this.check("Has" /* Has */)) {
          this.advance();
          const componentToken = this.consume("Identifier" /* Identifier */, "component name");
          expr = {
            type: "has_component",
            entity: expr,
            component: componentToken.text,
            span: { start: expr.span.start, end: componentToken.span.end }
          };
        } else {
          break;
        }
      }
      return expr;
    }
    parsePrimaryExpr() {
      const token = this.advance();
      switch (token.kind) {
        case "IntegerLiteral" /* IntegerLiteral */:
          return {
            type: "literal",
            value: { type: "integer", value: parseInt(token.text, 10) },
            span: token.span
          };
        case "FloatLiteral" /* FloatLiteral */:
          return {
            type: "literal",
            value: { type: "float", value: parseFloat(token.text) },
            span: token.span
          };
        case "DecimalLiteral" /* DecimalLiteral */:
          return {
            type: "literal",
            value: { type: "decimal", value: token.text.replace(/d$/, "") },
            span: token.span
          };
        case "StringLiteral" /* StringLiteral */:
        case "StringLiteralSingle" /* StringLiteralSingle */:
          return {
            type: "literal",
            value: { type: "string", value: token.text.slice(1, -1) },
            span: token.span
          };
        case "True" /* True */:
          return {
            type: "literal",
            value: { type: "boolean", value: true },
            span: token.span
          };
        case "False" /* False */:
          return {
            type: "literal",
            value: { type: "boolean", value: false },
            span: token.span
          };
        case "Null" /* Null */:
          return {
            type: "literal",
            value: { type: "null" },
            span: token.span
          };
        case "Entities" /* Entities */:
          this.consume("Having" /* Having */, "having");
          const componentToken = this.consume("Identifier" /* Identifier */, "component name");
          return {
            type: "entities_having",
            component: componentToken.text,
            span: { start: token.span.start, end: componentToken.span.end }
          };
        case "Clone" /* Clone */:
          const source = this.parsePostfixExpr();
          const overrides = [];
          if (this.check("LBrace" /* LBrace */)) {
            this.advance();
            while (!this.check("RBrace" /* RBrace */) && !this.isAtEnd()) {
              overrides.push(this.parseComponentInit());
            }
            const end2 = this.consume("RBrace" /* RBrace */, "}").span.end;
            return {
              type: "clone_entity",
              source,
              overrides,
              span: { start: token.span.start, end: end2 }
            };
          }
          return {
            type: "clone_entity",
            source,
            overrides,
            span: { start: token.span.start, end: source.span.end }
          };
        case "Entity" /* Entity */:
        case "Event" /* Event */:
          return {
            type: "identifier",
            name: token.text,
            span: token.span
          };
        case "Identifier" /* Identifier */:
          if (this.check("LParen" /* LParen */)) {
            this.advance();
            const args = [];
            while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
              args.push(this.parseExpression());
              if (this.check("Comma" /* Comma */)) {
                this.advance();
              }
            }
            const end2 = this.consume("RParen" /* RParen */, ")").span.end;
            return {
              type: "call",
              name: token.text,
              args,
              span: { start: token.span.start, end: end2 }
            };
          }
          return {
            type: "identifier",
            name: token.text,
            span: token.span
          };
        case "EntityRef" /* EntityRef */:
          return {
            type: "entity_ref",
            name: token.text.slice(1),
            // Remove @
            span: token.span
          };
        case "LParen" /* LParen */:
          const inner = this.parseExpression();
          const end = this.consume("RParen" /* RParen */, ")").span.end;
          return {
            type: "paren",
            inner,
            span: { start: token.span.start, end }
          };
        case "LBracket" /* LBracket */:
          const elements = [];
          while (!this.check("RBracket" /* RBracket */) && !this.isAtEnd()) {
            elements.push(this.parseExpression());
            if (this.check("Comma" /* Comma */)) {
              this.advance();
            }
          }
          const listEnd = this.consume("RBracket" /* RBracket */, "]").span.end;
          return {
            type: "list",
            elements,
            span: { start: token.span.start, end: listEnd }
          };
        default:
          throw new ParseError(
            token.span.start,
            `Unexpected token '${token.text}' in expression`
          );
      }
    }
  };
  function parse(tokens) {
    const parser = new Parser(tokens);
    return parser.parse();
  }

  // src/codegen.ts
  var CodeGenerator = class {
    constructor(options = {}) {
      this.componentId = 0;
      this.ruleId = 0;
      this.functionId = 0;
      this.entityId = 0;
      this.sourceFiles = [];
      this.options = options;
    }
    addSourceFile(path, content, language) {
      this.sourceFiles.push({ path, content, language });
    }
    generate(modules) {
      const components = [];
      const rules = [];
      const functions = [];
      const entities = [];
      const choicePoints = [];
      for (const module of modules) {
        for (const item of module.items) {
          switch (item.type) {
            case "component":
              components.push(this.generateComponent(item));
              break;
            case "rule":
              rules.push(this.generateRule(item));
              break;
            case "function":
              const func = this.generateFunction(item);
              functions.push(func);
              if (item.isChoice) {
                choicePoints.push(this.generateChoicePoint(item, func));
              }
              break;
            case "entity":
              const entity = this.generateEntity(item);
              entities.push(entity);
              if (item.boundFunctions.length > 0 && entity.bound_functions) {
                for (const boundFunc of item.boundFunctions) {
                  const boundIRFunc = entity.bound_functions[boundFunc.name];
                  if (boundIRFunc) {
                    choicePoints.push(this.generateBoundChoicePoint(boundFunc, boundIRFunc, item));
                  }
                }
              }
              break;
            case "module":
              const nestedResult = this.generate([{ items: item.items }]);
              components.push(...nestedResult.components);
              rules.push(...nestedResult.rules);
              functions.push(...nestedResult.functions);
              if (nestedResult.initial_state) {
                entities.push(...nestedResult.initial_state.entities);
              }
              if (nestedResult.choice_points) {
                choicePoints.push(...nestedResult.choice_points);
              }
              break;
            case "import":
              break;
          }
        }
      }
      const result = {
        version: "1.0",
        module: this.options.moduleName ?? "unnamed",
        metadata: {
          compiled_at: (/* @__PURE__ */ new Date()).toISOString(),
          compiler_version: "1.0.0-ts"
        },
        components,
        rules,
        functions
      };
      if (entities.length > 0) {
        result.initial_state = { entities };
      }
      if (choicePoints.length > 0) {
        result.choice_points = this.deduplicateChoicePoints(choicePoints);
      }
      if (this.options.includeSourceMap && this.sourceFiles.length > 0) {
        result.source_map = { files: this.sourceFiles };
      }
      return result;
    }
    generateComponent(comp) {
      return {
        id: this.componentId++,
        name: comp.name,
        fields: comp.fields.map((f) => this.generateField(f))
      };
    }
    generateField(field) {
      return {
        name: field.name,
        type: this.convertType(field.fieldType)
      };
    }
    convertType(type) {
      switch (type.type) {
        case "string":
          return { type: "string" };
        case "boolean":
          return { type: "boolean" };
        case "integer":
        case "float":
        case "decimal":
        case "number":
          return { type: "number" };
        case "id":
          return { type: "entity" };
        case "component":
          return { type: "entity" };
        case "list":
          return { type: "list", element: this.convertType(type.element) };
        case "optional":
          return this.convertType(type.inner);
        case "composite":
          return { type: "entity" };
      }
    }
    generateRule(rule) {
      const actions = this.generateBlockActions(rule.body);
      return {
        id: this.ruleId++,
        name: rule.name ?? void 0,
        trigger: {
          type: "event",
          event: rule.triggerEvent
        },
        condition: rule.condition ? this.generateExpression(rule.condition) : void 0,
        actions
      };
    }
    generateBlockActions(block) {
      const actions = [];
      for (const stmt of block.statements) {
        const action = this.generateStatement(stmt);
        if (action) {
          actions.push(action);
        }
      }
      return actions;
    }
    generateStatement(stmt) {
      switch (stmt.type) {
        case "let":
          return {
            type: "let",
            name: stmt.name,
            value: this.generateExpression(stmt.value)
          };
        case "assignment":
          return this.generateAssignment(stmt);
        case "if":
          return this.generateIfAction(stmt);
        case "for":
          return {
            type: "loop",
            variable: stmt.variable,
            iterable: this.generateExpression(stmt.iterable),
            body: this.generateBlockActions(stmt.body)
          };
        case "while":
          return {
            type: "while",
            condition: this.generateExpression(stmt.condition),
            body: this.generateBlockActions(stmt.body)
          };
        case "schedule":
          return this.generateSchedule(stmt);
        case "create":
          return {
            type: "spawn",
            components: stmt.components.map((c) => this.generateComponentInit(c))
          };
        case "delete":
          return {
            type: "despawn",
            entity: this.generateExpression(stmt.entity)
          };
        case "return":
        case "cancel":
        case "expr":
          return null;
      }
    }
    generateAssignment(stmt) {
      if (stmt.target.type === "field_access") {
        const { entity, component, field } = this.extractFieldAccess(stmt.target);
        const op = this.convertAssignOp(stmt.op);
        return {
          type: "modify",
          entity,
          component,
          field,
          op,
          value: this.generateExpression(stmt.value)
        };
      }
      return null;
    }
    extractFieldAccess(expr) {
      const field = expr.field;
      if (expr.base.type === "field_access") {
        const baseAccess = expr.base;
        const component = baseAccess.field;
        const entity = this.generateExpression(baseAccess.base);
        return { entity, component, field };
      }
      return {
        entity: this.generateExpression(expr.base),
        component: "Unknown",
        field
      };
    }
    convertAssignOp(op) {
      switch (op) {
        case "assign":
          return "set";
        case "add_assign":
          return "add";
        case "sub_assign":
          return "subtract";
        case "mul_assign":
          return "multiply";
        case "div_assign":
          return "divide";
      }
    }
    generateIfAction(stmt) {
      const thenActions = this.generateBlockActions(stmt.thenBlock);
      let elseActions;
      if (stmt.elseBlock) {
        if (stmt.elseBlock.type === "else_if") {
          elseActions = [this.generateIfAction(stmt.elseBlock.statement)];
        } else {
          elseActions = this.generateBlockActions(stmt.elseBlock.block);
        }
      }
      return {
        type: "conditional",
        condition: this.generateExpression(stmt.condition),
        then_actions: thenActions,
        else_actions: elseActions
      };
    }
    generateSchedule(stmt) {
      const fields = {};
      for (const [name, value] of stmt.fields) {
        fields[name] = this.generateExpression(value);
      }
      return {
        type: "schedule",
        event: stmt.eventName,
        delay: stmt.delay ? this.generateExpression(stmt.delay) : void 0,
        fields: Object.keys(fields).length > 0 ? fields : void 0
      };
    }
    generateComponentInit(init) {
      const fields = {};
      for (const [name, value] of init.fields) {
        fields[name] = this.generateExpression(value);
      }
      return {
        name: init.name,
        fields
      };
    }
    generateFunction(func) {
      const params = func.params.map((p) => ({
        name: p.name,
        type: this.convertType(p.paramType)
      }));
      const body = this.generateFunctionBody(func.body);
      return {
        id: this.functionId++,
        name: func.name,
        params,
        return_type: func.returnType ? this.convertType(func.returnType) : { type: "number" },
        body
      };
    }
    generateFunctionBody(block) {
      for (const stmt of block.statements) {
        if (stmt.type === "return" && stmt.value) {
          return this.generateExpression(stmt.value);
        }
      }
      return { type: "literal", value: 0 };
    }
    generateEntity(entity) {
      const components = {};
      for (const comp of entity.components) {
        const fields = {};
        for (const [name, value] of comp.fields) {
          fields[name] = this.expressionToValue(value);
        }
        components[comp.name] = fields;
      }
      const result = {
        id: this.entityId++,
        components
      };
      if (entity.variable) {
        result.variable = entity.variable;
      }
      if (entity.boundFunctions.length > 0) {
        result.bound_functions = {};
        for (const func of entity.boundFunctions) {
          result.bound_functions[func.name] = this.generateBoundFunction(func);
        }
      }
      return result;
    }
    generateBoundFunction(func) {
      const params = func.params.map((p) => ({
        name: p.name,
        type: this.convertType(p.paramType)
      }));
      const body = this.generateFunctionBody(func.body);
      return {
        params,
        return_type: func.returnType ? this.convertType(func.returnType) : { type: "number" },
        body
      };
    }
    expressionToValue(expr) {
      if (expr.type === "literal") {
        switch (expr.value.type) {
          case "string":
            return expr.value.value;
          case "integer":
            return expr.value.value;
          case "float":
            return expr.value.value;
          case "decimal":
            return parseFloat(expr.value.value);
          case "boolean":
            return expr.value.value;
          case "null":
            return null;
        }
      }
      if (expr.type === "list") {
        return expr.elements.map((e) => this.expressionToValue(e));
      }
      return null;
    }
    generateExpression(expr) {
      switch (expr.type) {
        case "literal":
          return this.generateLiteral(expr);
        case "identifier":
          return { type: "var", name: expr.name };
        case "entity_ref":
          return { type: "var", name: `@${expr.name}` };
        case "field_access":
          return this.generateFieldAccessExpr(expr);
        case "index_access":
          return {
            type: "call",
            function: "get",
            args: [
              this.generateExpression(expr.base),
              this.generateExpression(expr.index)
            ]
          };
        case "binary":
          return {
            type: "binary",
            op: this.convertBinaryOp(expr.op),
            left: this.generateExpression(expr.left),
            right: this.generateExpression(expr.right)
          };
        case "unary":
          return {
            type: "unary",
            op: expr.op === "neg" ? "negate" : "not",
            expr: this.generateExpression(expr.expr)
          };
        case "call":
          return {
            type: "call",
            function: expr.name,
            args: expr.args.map((a) => this.generateExpression(a))
          };
        case "method_call":
          return {
            type: "call",
            function: expr.method,
            args: [
              this.generateExpression(expr.base),
              ...expr.args.map((a) => this.generateExpression(a))
            ]
          };
        case "has_component":
          return {
            type: "has_component",
            entity: this.generateExpression(expr.entity),
            component: expr.component
          };
        case "list":
          return {
            type: "call",
            function: "list",
            args: expr.elements.map((e) => this.generateExpression(e))
          };
        case "paren":
          return this.generateExpression(expr.inner);
        case "entities_having":
          return {
            type: "call",
            function: "entities_having",
            args: [{ type: "literal", value: expr.component }]
          };
        case "clone_entity":
          return {
            type: "clone",
            source: this.generateExpression(expr.source),
            overrides: expr.overrides.map((o) => this.generateComponentInit(o))
          };
        case "cast":
          return this.generateExpression(expr.expr);
      }
    }
    generateLiteral(expr) {
      switch (expr.value.type) {
        case "string":
          return { type: "literal", value: expr.value.value };
        case "integer":
          return { type: "literal", value: expr.value.value };
        case "float":
          return { type: "literal", value: expr.value.value };
        case "decimal":
          return { type: "literal", value: parseFloat(expr.value.value) };
        case "boolean":
          return { type: "literal", value: expr.value.value };
        case "null":
          return { type: "literal", value: null };
      }
    }
    generateFieldAccessExpr(expr) {
      if (expr.base.type === "field_access") {
        const baseAccess = expr.base;
        if (baseAccess.base.type === "identifier") {
          return {
            type: "field",
            entity: baseAccess.base.name,
            component: baseAccess.field,
            field: expr.field
          };
        }
      }
      return { type: "var", name: expr.field };
    }
    convertBinaryOp(op) {
      switch (op) {
        case "add":
          return "add";
        case "sub":
          return "subtract";
        case "mul":
          return "multiply";
        case "div":
          return "divide";
        case "mod":
          return "modulo";
        case "eq":
          return "eq";
        case "neq":
          return "neq";
        case "lt":
          return "lt";
        case "lte":
          return "lte";
        case "gt":
          return "gt";
        case "gte":
          return "gte";
        case "and":
          return "and";
        case "or":
          return "or";
      }
    }
    generateChoicePoint(func, irFunc) {
      const paramStrs = irFunc.params.map((p) => `${p.name}: ${this.typeToString(p.type)}`);
      return {
        id: func.name,
        name: this.humanizeName(func.name),
        signature: `choice fn ${func.name}(${paramStrs.join(", ")}): ${this.typeToString(irFunc.return_type)}`,
        params: irFunc.params,
        return_type: irFunc.return_type,
        category: this.categorizeFunction(func.name)
      };
    }
    generateBoundChoicePoint(func, irFunc, entity) {
      const paramStrs = irFunc.params.map((p) => `${p.name}: ${this.typeToString(p.type)}`);
      let applicableClasses;
      const charComp = entity.components.find((c) => c.name === "Character");
      if (charComp) {
        const classField = charComp.fields.find(([name]) => name === "class");
        if (classField && classField[1].type === "literal" && classField[1].value.type === "string") {
          applicableClasses = [classField[1].value.value];
        }
      }
      return {
        id: func.name,
        name: this.humanizeName(func.name),
        signature: `choice fn ${func.name}(${paramStrs.join(", ")}): ${this.typeToString(irFunc.return_type)}`,
        params: irFunc.params,
        return_type: irFunc.return_type,
        category: this.categorizeFunction(func.name),
        applicable_classes: applicableClasses
      };
    }
    deduplicateChoicePoints(choicePoints) {
      const seen = /* @__PURE__ */ new Map();
      for (const cp of choicePoints) {
        if (!seen.has(cp.id)) {
          seen.set(cp.id, cp);
        }
      }
      return Array.from(seen.values()).sort((a, b) => a.id.localeCompare(b.id));
    }
    humanizeName(name) {
      return name.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    }
    categorizeFunction(name) {
      if (name.includes("target"))
        return "targeting";
      if (name.includes("skill"))
        return "skills";
      if (name.includes("flee") || name.includes("retreat"))
        return "strategy";
      return void 0;
    }
    typeToString(type) {
      switch (type.type) {
        case "string":
          return "string";
        case "boolean":
          return "boolean";
        case "number":
          return "number";
        case "entity":
          return "id";
        case "list":
          return `list<${this.typeToString(type.element)}>`;
        case "map":
          return `map<${this.typeToString(type.key)}, ${this.typeToString(type.value)}>`;
      }
    }
  };
  function generate(modules, options = {}) {
    const generator = new CodeGenerator(options);
    return generator.generate(modules);
  }

  // src/ast.ts
  var ast_exports = {};

  // src/ir.ts
  var ir_exports = {};

  // src/index.ts
  function positionToLineColumn(source, position) {
    let line = 1;
    let column = 1;
    for (let i = 0; i < position && i < source.length; i++) {
      if (source[i] === "\n") {
        line++;
        column = 1;
      } else {
        column++;
      }
    }
    return { line, column };
  }
  function compile(sources, options = {}) {
    const errors = [];
    const modules = [];
    const generator = new CodeGenerator({
      moduleName: options.moduleName,
      includeSourceMap: options.includeSourceMap
    });
    for (const source of sources) {
      generator.addSourceFile(source.path, source.content, source.language);
    }
    for (const source of sources) {
      try {
        const tokens = tokenize(source.content);
        const ast = parse(tokens);
        modules.push(ast);
      } catch (e) {
        if (e instanceof LexerError) {
          const { line, column } = positionToLineColumn(source.content, e.position);
          errors.push({
            type: "lexer",
            message: e.message,
            file: source.path,
            position: e.position,
            line,
            column
          });
        } else if (e instanceof ParseError) {
          const { line, column } = positionToLineColumn(source.content, e.position);
          errors.push({
            type: "parser",
            message: e.message,
            file: source.path,
            position: e.position,
            line,
            column
          });
        } else {
          errors.push({
            type: "semantic",
            message: String(e),
            file: source.path
          });
        }
      }
    }
    if (errors.length > 0) {
      return {
        ir: {
          version: "1.0",
          module: options.moduleName ?? "unnamed",
          components: [],
          rules: [],
          functions: []
        },
        errors
      };
    }
    const ir = generator.generate(modules);
    return { ir, errors };
  }
  function compileString(source, language = "brl", options = {}) {
    return compile([{
      path: `input.${language}`,
      content: source,
      language
    }], options);
  }
  function parseSource(source) {
    const tokens = tokenize(source);
    return parse(tokens);
  }
  function tokenizeSource(source) {
    return tokenize(source);
  }
  function mergeIRModules(modules, moduleName) {
    const components = [];
    const rules = [];
    const functions = [];
    const entities = [];
    const choicePoints = [];
    const sourceFiles = [];
    let componentId = 0;
    let ruleId = 0;
    let functionId = 0;
    let entityId = 0;
    for (const module of modules) {
      for (const comp of module.components) {
        components.push({ ...comp, id: componentId++ });
      }
      for (const rule of module.rules) {
        rules.push({ ...rule, id: ruleId++ });
      }
      for (const func of module.functions) {
        functions.push({ ...func, id: functionId++ });
      }
      if (module.initial_state) {
        for (const entity of module.initial_state.entities) {
          entities.push({
            ...entity,
            id: entityId++
          });
        }
      }
      if (module.choice_points) {
        choicePoints.push(...module.choice_points);
      }
      if (module.source_map) {
        sourceFiles.push(...module.source_map.files);
      }
    }
    const seenChoicePoints = /* @__PURE__ */ new Set();
    const uniqueChoicePoints = choicePoints.filter((cp) => {
      if (seenChoicePoints.has(cp.id))
        return false;
      seenChoicePoints.add(cp.id);
      return true;
    });
    const result = {
      version: "1.0",
      module: moduleName ?? "merged",
      metadata: {
        compiled_at: (/* @__PURE__ */ new Date()).toISOString(),
        compiler_version: "1.0.0-ts"
      },
      components,
      rules,
      functions
    };
    if (entities.length > 0) {
      result.initial_state = { entities };
    }
    if (uniqueChoicePoints.length > 0) {
      result.choice_points = uniqueChoicePoints;
    }
    if (sourceFiles.length > 0) {
      result.source_map = { files: sourceFiles };
    }
    return result;
  }
  if (typeof window !== "undefined") {
    window.BlinkCompiler = {
      compile,
      compileString,
      parseSource,
      tokenizeSource,
      mergeIRModules,
      tokenize,
      parse,
      generate
    };
  }
  return __toCommonJS(src_exports);
})();
