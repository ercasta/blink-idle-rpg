/**
 * Code Generator Tests for Blink Compiler
 * Tests IR code generation from AST
 */

import { tokenize } from './lexer';
import { parse } from './parser';
import { generate, CodeGenerator } from './codegen';
import * as IR from './ir';

describe('CodeGenerator', () => {
  const compileToIR = (source: string, moduleName = 'test'): IR.IRModule => {
    const tokens = tokenize(source);
    const ast = parse(tokens);
    return generate([ast], { moduleName });
  };

  describe('Component generation', () => {
    it('should generate IR for simple component', () => {
      const ir = compileToIR(`
        component Health {
          current: integer
          max: integer
        }
      `);
      expect(ir.components).toHaveLength(1);
      expect(ir.components[0].name).toBe('Health');
      expect(ir.components[0].fields).toHaveLength(2);
      expect(ir.components[0].fields[0].name).toBe('current');
      expect(ir.components[0].fields[0].type.type).toBe('integer');
    });

    it('should generate IR for component with list type', () => {
      const ir = compileToIR(`
        component Inventory {
          items: list<id>
        }
      `);
      const field = ir.components[0].fields[0];
      expect(field.type.type).toBe('list');
      const listType = field.type as { type: string; element: IR.IRType };
      expect(listType.element.type).toBe('entity');
    });

    it('should generate IR for component with optional field', () => {
      const ir = compileToIR(`
        component Target {
          entity: id?
        }
      `);
      // Optional types are converted to the base type
      expect(ir.components[0].fields[0].type.type).toBe('entity');
    });
  });

  describe('Rule generation', () => {
    it('should generate IR for simple rule', () => {
      const ir = compileToIR(`
        rule attack on DoAttack {
          entity.Health.current -= 10
        }
      `);
      expect(ir.rules).toHaveLength(1);
      expect(ir.rules[0].name).toBe('attack');
      expect(ir.rules[0].trigger.type).toBe('event');
      expect(ir.rules[0].trigger.event).toBe('DoAttack');
    });

    it('should generate IR for rule with condition', () => {
      const ir = compileToIR(`
        rule attack on DoAttack atk when atk.source.Health.current > 0 {
          let source = atk.source
          source.Health.current -= 10
        }
      `);
      expect(ir.rules[0].condition).toBeDefined();
      expect(ir.rules[0].condition?.type).toBe('binary');
    });

    it('should generate IR for modify action', () => {
      const ir = compileToIR(`
        rule attack on DoAttack {
          entity.Health.current -= 10
        }
      `);
      const action = ir.rules[0].actions[0] as IR.IRModifyAction;
      expect(action.type).toBe('modify');
      expect(action.component).toBe('Health');
      expect(action.field).toBe('current');
      expect(action.op).toBe('subtract');
    });

    it('should generate IR for let action', () => {
      const ir = compileToIR(`
        rule test on Test {
          let x = 10
        }
      `);
      const action = ir.rules[0].actions[0] as IR.IRLetAction;
      expect(action.type).toBe('let');
      expect(action.name).toBe('x');
    });

    it('should generate IR for conditional action', () => {
      const ir = compileToIR(`
        rule test on Test {
          if x > 0 {
            y = 1
          } else {
            y = 0
          }
        }
      `);
      const action = ir.rules[0].actions[0] as IR.IRConditionalAction;
      expect(action.type).toBe('conditional');
      expect(action.then_actions).toBeDefined();
      expect(action.else_actions).toBeDefined();
    });

    it('should generate IR for loop action', () => {
      const ir = compileToIR(`
        rule test on Test {
          for item in items {
            item.value = 0
          }
        }
      `);
      const action = ir.rules[0].actions[0] as IR.IRLoopAction;
      expect(action.type).toBe('loop');
      expect(action.variable).toBe('item');
    });

    it('should generate IR for schedule action', () => {
      const ir = compileToIR(`
        rule test on Test {
          schedule [delay: 2.0] DoAttack { source: entity }
        }
      `);
      const action = ir.rules[0].actions[0] as IR.IRScheduleAction;
      expect(action.type).toBe('schedule');
      expect(action.event).toBe('DoAttack');
      expect(action.delay).toBeDefined();
    });
  });

  describe('Function generation', () => {
    it('should generate IR for simple function', () => {
      const ir = compileToIR(`
        fn calculate(a: number, b: number): number {
          return a + b
        }
      `);
      expect(ir.functions).toHaveLength(1);
      expect(ir.functions[0].name).toBe('calculate');
      expect(ir.functions[0].params).toHaveLength(2);
    });

    it('should generate IR for choice function', () => {
      const ir = compileToIR(`
        choice fn selectTarget(enemies: list): id {
          return enemies[0]
        }
      `);
      expect(ir.functions).toHaveLength(1);
      expect(ir.choice_points).toHaveLength(1);
      expect(ir.choice_points![0].id).toBe('selectTarget');
    });
  });

  describe('Entity generation', () => {
    it('should generate IR for simple entity', () => {
      const ir = compileToIR(`
        entity {
          Health { current: 100 max: 100 }
        }
      `);
      expect(ir.initial_state?.entities).toHaveLength(1);
      expect(ir.initial_state?.entities[0].components.Health).toBeDefined();
      expect(ir.initial_state?.entities[0].components.Health.current).toBe(100);
    });

    it('should generate IR for named entity', () => {
      const ir = compileToIR(`
        warrior = new entity {
          Health { current: 100 }
        }
      `);
      expect(ir.initial_state?.entities[0].variable).toBe('warrior');
    });

    it('should generate IR for entity with bound functions', () => {
      const ir = compileToIR(`
        entity {
          Health { current: 100 }
          .selectTarget = choice(enemies: list): id {
            return enemies[0]
          }
        }
      `);
      expect(ir.initial_state?.entities[0].bound_functions).toBeDefined();
      expect(ir.initial_state?.entities[0].bound_functions!.selectTarget).toBeDefined();
    });
  });

  describe('Expression generation', () => {
    it('should generate IR for literal expressions', () => {
      const ir = compileToIR(`
        rule test on Test {
          let a = 42
          let b = 3.14
          let c = "hello"
          let d = true
          let e = null
        }
      `);
      expect(ir.rules[0].actions).toHaveLength(5);
    });

    it('should generate IR for binary expressions', () => {
      const ir = compileToIR(`
        rule test on Test {
          let x = a + b * c
        }
      `);
      const action = ir.rules[0].actions[0] as IR.IRLetAction;
      expect(action.value.type).toBe('binary');
    });

    it('should generate IR for field access', () => {
      const ir = compileToIR(`
        rule test on Test {
          let hp = entity.Health.current
        }
      `);
      const action = ir.rules[0].actions[0] as IR.IRLetAction;
      expect(action.value.type).toBe('field');
    });

    it('should generate IR for function calls', () => {
      const ir = compileToIR(`
        rule test on Test {
          let result = calculate(a, b)
        }
      `);
      const action = ir.rules[0].actions[0] as IR.IRLetAction;
      const call = action.value as IR.IRCallExpr;
      expect(call.type).toBe('call');
      expect(call.function).toBe('calculate');
    });

    it('should generate IR for list literal', () => {
      const ir = compileToIR(`
        rule test on Test {
          let nums = [1, 2, 3]
        }
      `);
      const action = ir.rules[0].actions[0] as IR.IRLetAction;
      const call = action.value as IR.IRCallExpr;
      expect(call.type).toBe('call');
      expect(call.function).toBe('list');
      expect(call.args).toHaveLength(3);
    });

    it('should generate IR for entities having', () => {
      const ir = compileToIR(`
        rule test on Test {
          let enemies = entities having Enemy
        }
      `);
      const action = ir.rules[0].actions[0] as IR.IRLetAction;
      const call = action.value as IR.IRCallExpr;
      expect(call.type).toBe('call');
      expect(call.function).toBe('entities_having');
    });

    it('should generate IR for has component', () => {
      const ir = compileToIR(`
        rule test on Test {
          if entity has Health {
            x = 1
          }
        }
      `);
      const conditional = ir.rules[0].actions[0] as IR.IRConditionalAction;
      const condition = conditional.condition as IR.IRHasComponentExpr;
      expect(condition.type).toBe('has_component');
      expect(condition.component).toBe('Health');
    });

    it('should generate IR for clone expression', () => {
      const ir = compileToIR(`
        rule test on Test {
          let newEnemy = clone template {
            Health { current: 200 }
          }
        }
      `);
      const action = ir.rules[0].actions[0] as IR.IRLetAction;
      const clone = action.value as IR.IRCloneExpr;
      expect(clone.type).toBe('clone');
      expect(clone.overrides).toHaveLength(1);
    });
  });

  describe('Complete module generation', () => {
    it('should generate IR for complete game module', () => {
      const ir = compileToIR(`
        component Health {
          current: integer
          max: integer
        }

        component Combat {
          damage: integer
        }

        rule attack on DoAttack atk {
          let source = atk.source
          if source.Health.current > 0 {
            let damage = source.Combat.damage
            let target = source.Target.entity
            target.Health.current -= damage
            schedule [delay: 1.0] DoAttack { source: source }
          }
        }

        fn calculate_damage(base: number, bonus: number): number {
          return base + bonus
        }

        entity @warrior {
          Health { current: 100 max: 100 }
          Combat { damage: 20 }
        }
      `);
      
      expect(ir.version).toBe('1.0');
      expect(ir.components).toHaveLength(2);
      expect(ir.rules).toHaveLength(1);
      expect(ir.functions).toHaveLength(1);
      expect(ir.initial_state?.entities).toHaveLength(1);
    });

    it('should include metadata', () => {
      const ir = compileToIR(`
        component Test { value: integer }
      `, 'my_module');
      
      expect(ir.module).toBe('my_module');
      expect(ir.metadata?.compiled_at).toBeDefined();
      expect(ir.metadata?.compiler_version).toBe('1.0.0-ts');
    });
  });

  describe('Assignment operators', () => {
    it('should convert assign to set', () => {
      const ir = compileToIR(`
        rule test on Test {
          entity.Health.current = 100
        }
      `);
      const action = ir.rules[0].actions[0] as IR.IRModifyAction;
      expect(action.op).toBe('set');
    });

    it('should convert add_assign to add', () => {
      const ir = compileToIR(`
        rule test on Test {
          entity.Health.current += 10
        }
      `);
      const action = ir.rules[0].actions[0] as IR.IRModifyAction;
      expect(action.op).toBe('add');
    });

    it('should convert sub_assign to subtract', () => {
      const ir = compileToIR(`
        rule test on Test {
          entity.Health.current -= 10
        }
      `);
      const action = ir.rules[0].actions[0] as IR.IRModifyAction;
      expect(action.op).toBe('subtract');
    });

    it('should convert mul_assign to multiply', () => {
      const ir = compileToIR(`
        rule test on Test {
          entity.Health.current *= 2
        }
      `);
      const action = ir.rules[0].actions[0] as IR.IRModifyAction;
      expect(action.op).toBe('multiply');
    });

    it('should convert div_assign to divide', () => {
      const ir = compileToIR(`
        rule test on Test {
          entity.Health.current /= 2
        }
      `);
      const action = ir.rules[0].actions[0] as IR.IRModifyAction;
      expect(action.op).toBe('divide');
    });
  });
});
