/**
 * Parser Tests for Blink Compiler
 * Tests parsing of all language constructs in BRL/BCL/BDL
 */

import { tokenize } from './lexer';
import { parse, ParseError } from './parser';
import * as AST from './ast';

describe('Parser', () => {
  const parseSource = (source: string): AST.Module => {
    const tokens = tokenize(source);
    return parse(tokens);
  };

  describe('Component definitions', () => {
    it('should parse simple component', () => {
      const ast = parseSource(`
        component Health {
          current: integer
          max: integer
        }
      `);
      expect(ast.items).toHaveLength(1);
      const component = ast.items[0] as AST.ComponentDef;
      expect(component.type).toBe('component');
      expect(component.name).toBe('Health');
      expect(component.fields).toHaveLength(2);
      expect(component.fields[0].name).toBe('current');
      expect(component.fields[1].name).toBe('max');
    });

    it('should parse component with optional fields', () => {
      const ast = parseSource(`
        component Target {
          entity: id?
        }
      `);
      const component = ast.items[0] as AST.ComponentDef;
      expect(component.fields[0].optional).toBe(true);
    });

    it('should parse component with list type', () => {
      const ast = parseSource(`
        component Inventory {
          items: list<id>
        }
      `);
      const component = ast.items[0] as AST.ComponentDef;
      expect(component.fields[0].fieldType.type).toBe('list');
    });

    it('should parse component with all primitive types', () => {
      const ast = parseSource(`
        component AllTypes {
          str: string
          bool: boolean
          int: integer
          flt: float
          dec: decimal
          num: number
          eid: id
        }
      `);
      const component = ast.items[0] as AST.ComponentDef;
      expect(component.fields).toHaveLength(7);
    });
  });

  describe('Rule definitions', () => {
    it('should parse simple rule', () => {
      const ast = parseSource(`
        rule attack on DoAttack(atk: id) {
          let target: id = atk.target
          target.Health.current -= 10
        }
      `);
      expect(ast.items).toHaveLength(1);
      const rule = ast.items[0] as AST.RuleDef;
      expect(rule.type).toBe('rule');
      expect(rule.name).toBe('attack');
      expect(rule.triggerEvent).toBe('DoAttack');
      expect(rule.eventParam.name).toBe('atk');
      expect(rule.eventParam.paramType.type).toBe('id');
    });

    it('should parse rule without name', () => {
      const ast = parseSource(`
        rule on DoAttack(atk: id) {
          let target: id = atk.target
          target.Health.current -= 10
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      expect(rule.name).toBeNull();
      expect(rule.eventParam.name).toBe('atk');
    });

    it('should parse rule with when condition', () => {
      const ast = parseSource(`
        rule attack on DoAttack(atk: id) when atk.source.Health.current > 0 {
          let target: id = atk.target
          target.Health.current -= 10
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      expect(rule.condition).not.toBeNull();
      expect(rule.eventParam.name).toBe('atk');
    });

    it('should parse rule with priority', () => {
      const ast = parseSource(`
        rule attack on DoAttack(atk: id) [priority: 100] {
          let target: id = atk.target
          target.Health.current -= 10
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      expect(rule.priority).toBe(100);
      expect(rule.eventParam.name).toBe('atk');
    });
  });

  describe('Function definitions', () => {
    it('should parse simple function', () => {
      const ast = parseSource(`
        fn calculate(a: number, b: number): number {
          return a + b
        }
      `);
      const func = ast.items[0] as AST.FunctionDef;
      expect(func.type).toBe('function');
      expect(func.name).toBe('calculate');
      expect(func.params).toHaveLength(2);
      expect(func.returnType?.type).toBe('number');
      expect(func.isChoice).toBe(false);
    });

    it('should parse function without return type', () => {
      const ast = parseSource(`
        fn doSomething(x: number) {
          let y = x + 1
        }
      `);
      const func = ast.items[0] as AST.FunctionDef;
      expect(func.returnType).toBeNull();
    });

    it('should parse choice function', () => {
      const ast = parseSource(`
        choice fn selectTarget(enemies: list): id {
          return enemies[0]
        }
      `);
      const func = ast.items[0] as AST.FunctionDef;
      expect(func.isChoice).toBe(true);
    });

    it('should parse choice function with composite type', () => {
      const ast = parseSource(`
        choice fn makeChoice(e: Health & Combat): string {
          return "attack"
        }
      `);
      const func = ast.items[0] as AST.FunctionDef;
      expect(func.params[0].paramType.type).toBe('composite');
    });
  });

  describe('Entity definitions', () => {
    it('should parse entity with components', () => {
      const ast = parseSource(`
        entity {
          Health { current: 100 max: 100 }
          Combat { damage: 20 }
        }
      `);
      const entity = ast.items[0] as AST.EntityDef;
      expect(entity.type).toBe('entity');
      expect(entity.components).toHaveLength(2);
    });

    it('should parse named entity with variable', () => {
      const ast = parseSource(`
        entity @warrior {
          Health { current: 100 }
        }
      `);
      const entity = ast.items[0] as AST.EntityDef;
      expect(entity.variable).toBe('warrior');
    });

    it('should parse new entity syntax', () => {
      const ast = parseSource(`
        warrior = new entity {
          Health { current: 100 }
        }
      `);
      const entity = ast.items[0] as AST.EntityDef;
      expect(entity.variable).toBe('warrior');
    });

    it('should parse entity with bound functions', () => {
      const ast = parseSource(`
        entity {
          Health { current: 100 }
          .selectTarget = choice(enemies: list): id {
            return enemies[0]
          }
        }
      `);
      const entity = ast.items[0] as AST.EntityDef;
      expect(entity.boundFunctions).toHaveLength(1);
      expect(entity.boundFunctions[0].name).toBe('selectTarget');
    });
  });

  describe('Statements', () => {
    it('should parse let statement', () => {
      const ast = parseSource(`
        rule test on Test t {
          let x = 10
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const letStmt = rule.body.statements[0] as AST.LetStatement;
      expect(letStmt.type).toBe('let');
      expect(letStmt.name).toBe('x');
    });

    it('should parse let statement with type annotation', () => {
      const ast = parseSource(`
        rule test on Test t {
          let x: number = 10
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const letStmt = rule.body.statements[0] as AST.LetStatement;
      expect(letStmt.typeAnnotation?.type).toBe('number');
    });

    it('should parse if statement', () => {
      const ast = parseSource(`
        rule test on Test t {
          if x > 0 {
            y = 1
          }
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const ifStmt = rule.body.statements[0] as AST.IfStatement;
      expect(ifStmt.type).toBe('if');
      expect(ifStmt.elseBlock).toBeNull();
    });

    it('should parse if-else statement', () => {
      const ast = parseSource(`
        rule test on Test t {
          if x > 0 {
            y = 1
          } else {
            y = 0
          }
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const ifStmt = rule.body.statements[0] as AST.IfStatement;
      expect(ifStmt.elseBlock?.type).toBe('else');
    });

    it('should parse if-else if chain', () => {
      const ast = parseSource(`
        rule test on Test t {
          if x > 10 {
            y = 2
          } else if x > 0 {
            y = 1
          } else {
            y = 0
          }
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const ifStmt = rule.body.statements[0] as AST.IfStatement;
      expect(ifStmt.elseBlock?.type).toBe('else_if');
    });

    it('should parse for loop', () => {
      const ast = parseSource(`
        rule test on Test t {
          for item in items {
            process(item)
          }
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const forStmt = rule.body.statements[0] as AST.ForStatement;
      expect(forStmt.type).toBe('for');
      expect(forStmt.variable).toBe('item');
    });

    it('should parse while loop', () => {
      const ast = parseSource(`
        rule test on Test t {
          while x > 0 {
            x -= 1
          }
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const whileStmt = rule.body.statements[0] as AST.WhileStatement;
      expect(whileStmt.type).toBe('while');
    });

    it('should parse return statement', () => {
      const ast = parseSource(`
        fn test(): number {
          return 42
        }
      `);
      const func = ast.items[0] as AST.FunctionDef;
      const returnStmt = func.body.statements[0] as AST.ReturnStatement;
      expect(returnStmt.type).toBe('return');
    });

    it('should parse schedule statement', () => {
      const ast = parseSource(`
        rule test on Test t {
          schedule DoAttack { source: entity }
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const scheduleStmt = rule.body.statements[0] as AST.ScheduleStatement;
      expect(scheduleStmt.type).toBe('schedule');
      expect(scheduleStmt.eventName).toBe('DoAttack');
    });

    it('should parse schedule with delay', () => {
      const ast = parseSource(`
        rule test on Test t {
          schedule [delay: 2.0] DoAttack { source: entity }
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const scheduleStmt = rule.body.statements[0] as AST.ScheduleStatement;
      expect(scheduleStmt.delay).not.toBeNull();
    });

    it('should parse recurring schedule', () => {
      const ast = parseSource(`
        rule test on Test t {
          schedule recurring [interval: 1.0] Tick { }
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const scheduleStmt = rule.body.statements[0] as AST.ScheduleStatement;
      expect(scheduleStmt.recurring).toBe(true);
    });

    it('should parse create statement', () => {
      const ast = parseSource(`
        rule test on Test t {
          create entity {
            Health { current: 100 }
          }
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const createStmt = rule.body.statements[0] as AST.CreateStatement;
      expect(createStmt.type).toBe('create');
    });

    it('should parse delete statement', () => {
      const ast = parseSource(`
        rule test on Test t {
          delete enemy
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const deleteStmt = rule.body.statements[0] as AST.DeleteStatement;
      expect(deleteStmt.type).toBe('delete');
    });

    it('should parse assignment statements', () => {
      const ast = parseSource(`
        rule test on Test t {
          x = 10
          x += 5
          x -= 3
          x *= 2
          x /= 4
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      expect(rule.body.statements).toHaveLength(5);
    });
  });

  describe('Expressions', () => {
    it('should parse binary expressions', () => {
      const ast = parseSource(`
        rule test on Test t {
          let x = a + b * c
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const letStmt = rule.body.statements[0] as AST.LetStatement;
      expect(letStmt.value.type).toBe('binary');
    });

    it('should parse comparison expressions', () => {
      const ast = parseSource(`
        rule test on Test t {
          if a > b && c <= d {
            x = 1
          }
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const ifStmt = rule.body.statements[0] as AST.IfStatement;
      expect(ifStmt.condition.type).toBe('binary');
    });

    it('should parse unary expressions', () => {
      const ast = parseSource(`
        rule test on Test t {
          let x = !flag
          let y = -value
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const letStmt = rule.body.statements[0] as AST.LetStatement;
      const unary = letStmt.value as AST.UnaryExpr;
      expect(unary.type).toBe('unary');
      expect(unary.op).toBe('not');
    });

    it('should parse field access', () => {
      const ast = parseSource(`
        rule test on Test t {
          let hp = entity.Health.current
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const letStmt = rule.body.statements[0] as AST.LetStatement;
      expect(letStmt.value.type).toBe('field_access');
    });

    it('should parse index access', () => {
      const ast = parseSource(`
        rule test on Test t {
          let first = items[0]
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const letStmt = rule.body.statements[0] as AST.LetStatement;
      expect(letStmt.value.type).toBe('index_access');
    });

    it('should parse function calls', () => {
      const ast = parseSource(`
        rule test on Test t {
          let result = calculate(a, b)
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const letStmt = rule.body.statements[0] as AST.LetStatement;
      const call = letStmt.value as AST.CallExpr;
      expect(call.type).toBe('call');
      expect(call.name).toBe('calculate');
      expect(call.args).toHaveLength(2);
    });

    it('should parse method calls', () => {
      const ast = parseSource(`
        rule test on Test t {
          let result = mylist.length()
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const letStmt = rule.body.statements[0] as AST.LetStatement;
      expect(letStmt.value.type).toBe('method_call');
    });

    it('should parse list literals', () => {
      const ast = parseSource(`
        rule test on Test t {
          let nums = [1, 2, 3]
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const letStmt = rule.body.statements[0] as AST.LetStatement;
      const list = letStmt.value as AST.ListExpr;
      expect(list.type).toBe('list');
      expect(list.elements).toHaveLength(3);
    });

    it('should parse parenthesized expressions', () => {
      const ast = parseSource(`
        rule test on Test t {
          let x = (a + b) * c
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const letStmt = rule.body.statements[0] as AST.LetStatement;
      expect(letStmt.value.type).toBe('binary');
    });

    it('should parse entities having expression', () => {
      const ast = parseSource(`
        rule test on Test t {
          let enemies = entities having Enemy
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const letStmt = rule.body.statements[0] as AST.LetStatement;
      expect(letStmt.value.type).toBe('entities_having');
    });

    it('should parse has component expression', () => {
      const ast = parseSource(`
        rule test on Test t {
          if entity has Health {
            x = 1
          }
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const ifStmt = rule.body.statements[0] as AST.IfStatement;
      expect(ifStmt.condition.type).toBe('has_component');
    });

    it('should parse clone expression', () => {
      const ast = parseSource(`
        rule test on Test t {
          let newEnemy = clone template
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const letStmt = rule.body.statements[0] as AST.LetStatement;
      expect(letStmt.value.type).toBe('clone_entity');
    });

    it('should parse clone with overrides', () => {
      const ast = parseSource(`
        rule test on Test t {
          let newEnemy = clone template {
            Health { current: 200 }
          }
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const letStmt = rule.body.statements[0] as AST.LetStatement;
      const clone = letStmt.value as AST.CloneEntityExpr;
      expect(clone.type).toBe('clone_entity');
      expect(clone.overrides).toHaveLength(1);
    });

    it('should parse entity reference', () => {
      const ast = parseSource(`
        rule test on Test t {
          let e = @warrior
        }
      `);
      const rule = ast.items[0] as AST.RuleDef;
      const letStmt = rule.body.statements[0] as AST.LetStatement;
      expect(letStmt.value.type).toBe('entity_ref');
    });
  });

  describe('Imports and Modules', () => {
    it('should parse import statement', () => {
      const ast = parseSource(`
        import game.rules
      `);
      const imp = ast.items[0] as AST.ImportDef;
      expect(imp.type).toBe('import');
      expect(imp.path).toEqual(['game', 'rules']);
    });

    it('should parse import with specific items', () => {
      const ast = parseSource(`
        import game.rules { Health, Combat }
      `);
      const imp = ast.items[0] as AST.ImportDef;
      expect(imp.items).toEqual(['Health', 'Combat']);
    });

    it('should parse module definition', () => {
      const ast = parseSource(`
        module combat {
          component Damage { value: integer }
        }
      `);
      const mod = ast.items[0] as AST.ModuleDef;
      expect(mod.type).toBe('module');
      expect(mod.name).toBe('combat');
      expect(mod.items).toHaveLength(1);
    });
  });

  describe('Error handling', () => {
    it('should throw on unexpected token', () => {
      expect(() => parseSource('{ }')).toThrow(ParseError);
    });

    it('should throw on missing brace', () => {
      expect(() => parseSource('component Health { current: integer')).toThrow(ParseError);
    });
  });

  describe('Complex parsing', () => {
    it('should parse a complete game rule file', () => {
      const source = `
        component Health {
          current: integer
          max: integer
        }

        component Combat {
          damage: integer
          attackSpeed: float
        }

        rule attack on DoAttack atk {
          let source = atk.source
          if source.Health.current > 0 {
            let damage = source.Combat.damage
            let target = source.Target.entity
            target.Health.current -= damage
            schedule [delay: 1.0] DoAttack {
              source: source
            }
          }
        }

        fn calculate_damage(base: number, bonus: number): number {
          return base + bonus
        }
      `;
      const ast = parseSource(source);
      expect(ast.items).toHaveLength(4);
    });

    it('should parse nested control flow', () => {
      const source = `
        rule complex on Test t {
          let enemies = entities having Enemy
          for enemy in enemies {
            if enemy.Health.current > 0 {
              if enemy.Combat.damage > 10 {
                let target = enemy
              } else {
                let target = null
              }
            }
          }
        }
      `;
      const ast = parseSource(source);
      expect(ast.items).toHaveLength(1);
    });
  });
});
