/**
 * End-to-End Compiler Tests
 * Tests the complete compilation pipeline from source to IR
 */

import { compile, compileString, CompileResult } from './index';

describe('End-to-End Compiler', () => {
  describe('compileString', () => {
    it('should compile a simple component', () => {
      const result = compileString(`
        component Health {
          current: integer
          max: integer
        }
      `, 'brl');
      
      expect(result.errors).toHaveLength(0);
      expect(result.ir.components).toHaveLength(1);
      expect(result.ir.components[0].name).toBe('Health');
    });

    it('should compile component and rule together', () => {
      const result = compileString(`
        component Health {
          current: integer
          max: integer
        }
        rule attack on DoAttack {
          entity.Health.current -= 10
        }
      `, 'brl');
      
      expect(result.errors).toHaveLength(0);
      expect(result.ir.components).toHaveLength(1);
      expect(result.ir.rules).toHaveLength(1);
    });

    it('should compile an entity definition', () => {
      const result = compileString(`
        component Health {
          current: integer
          max: integer
        }
        entity {
          Health { current: 100 max: 100 }
        }
      `, 'bdl');
      
      expect(result.errors).toHaveLength(0);
      expect(result.ir.initial_state?.entities).toHaveLength(1);
    });
  });

  describe('compile with multiple files', () => {
    it('should compile multiple source files', () => {
      const result = compile([
        {
          path: 'components.brl',
          content: `
            component Health { current: integer max: integer }
            component Combat { damage: integer }
          `,
          language: 'brl',
        },
        {
          path: 'rules.brl',
          content: `
            rule attack on DoAttack {
              entity.Health.current -= entity.Combat.damage
            }
          `,
          language: 'brl',
        },
        {
          path: 'entities.bdl',
          content: `
            entity {
              Health { current: 100 max: 100 }
              Combat { damage: 20 }
            }
          `,
          language: 'bdl',
        },
      ]);
      
      expect(result.errors).toHaveLength(0);
      expect(result.ir.components).toHaveLength(2);
      expect(result.ir.rules).toHaveLength(1);
      expect(result.ir.initial_state?.entities).toHaveLength(1);
    });
  });

  describe('Error handling', () => {
    it('should report lexer errors', () => {
      const result = compileString(`
        component Health {
          current: integer
          "unterminated string
        }
      `, 'brl');
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('lexer');
    });

    it('should report parser errors', () => {
      const result = compileString(`
        component Health {
          current integer
        }
      `, 'brl');
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('parser');
    });

    it('should include line and column in errors', () => {
      const result = compileString(`
        component Health {
          current: integer
          "unterminated
        }
      `, 'brl');
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].line).toBeDefined();
      expect(result.errors[0].column).toBeDefined();
    });
  });

  describe('Complex scenarios', () => {
    it('should compile a complete RPG rule set', () => {
      const result = compileString(`
        component Character {
          name: string
          level: integer
          experience: integer
        }

        component Health {
          current: integer
          max: integer
        }

        component Combat {
          damage: integer
          defense: integer
          attackSpeed: float
        }

        component Target {
          entity: id?
        }

        component Enemy {
          tier: integer
          isBoss: boolean
        }

        rule attack on DoAttack when entity.Health.current > 0 {
          if entity.Target.entity != null {
            let target = entity.Target.entity
            let damage = entity.Combat.damage
            target.Health.current -= damage
            
            if target.Health.current <= 0 {
              schedule Death { target: target }
            }
            
            let speed = entity.Combat.attackSpeed
            if speed > 0 {
              let delay = 1 / speed
              schedule [delay: delay] DoAttack { source: entity }
            }
          }
        }

        rule enemy_death on Death when entity has Enemy {
          if entity.Health.current <= 0 {
            schedule EnemyDefeated { enemy: entity }
          }
        }

        rule spawn_enemies on GameStart {
          let indices = [0, 1, 2, 3, 4]
          for i in indices {
            schedule [delay: 0.5 * i] SpawnEnemy { tier: 1 }
          }
        }

        fn calculate_damage(base: number, bonus: number): number {
          return base + bonus
        }
      `, 'brl');
      
      expect(result.errors).toHaveLength(0);
      expect(result.ir.components.length).toBeGreaterThan(0);
      expect(result.ir.rules.length).toBeGreaterThan(0);
      expect(result.ir.functions).toHaveLength(1);
    });

    it('should compile entity definitions with bound functions', () => {
      const result = compileString(`
        component Character {
          name: string
          class: string
          level: integer
        }
        component Health {
          current: integer
          max: integer
        }
        component Combat {
          damage: integer
          defense: integer
          attackSpeed: float
        }
        entity {
          Character { name: "Warrior" class: "Warrior" level: 1 }
          Health { current: 100 max: 100 }
          Combat { damage: 20 defense: 10 attackSpeed: 1.0 }
          
          .selectTarget = choice(enemies: list): id {
            let target = enemies[0]
            for enemy in enemies {
              if enemy.Health.current < target.Health.current {
                target = enemy
              }
            }
            return target
          }
        }
      `, 'bdl');
      
      expect(result.errors).toHaveLength(0);
      expect(result.ir.initial_state?.entities).toHaveLength(1);
      expect(result.ir.initial_state?.entities[0].bound_functions).toBeDefined();
    });

    it('should compile choice functions', () => {
      const result = compileString(`
        component Health {
          current: integer
          max: integer
        }
        component Combat {
          damage: integer
        }
        choice fn selectTarget(enemies: list): id {
          return enemies[0]
        }
        
        choice fn selectSkill(character: Health & Combat): string {
          if character.Health.current < 30 {
            return "heal"
          }
          return "attack"
        }
      `, 'bcl');
      
      expect(result.errors).toHaveLength(0);
      expect(result.ir.functions).toHaveLength(2);
      expect(result.ir.choice_points?.length).toBe(2);
    });

    it('should compile entities having expression', () => {
      const result = compileString(`
        component Enemy {
          tier: integer
        }
        component Health {
          current: integer
        }
        rule find_targets on FindTargets {
          let enemies = entities having Enemy
          for enemy in enemies {
            if enemy.Health.current > 0 {
              schedule TargetFound { target: enemy }
            }
          }
        }
      `, 'brl');
      
      expect(result.errors).toHaveLength(0);
      expect(result.ir.rules).toHaveLength(1);
    });

    it('should compile clone expressions', () => {
      const result = compileString(`
        component EnemyTemplate {
          isTemplate: boolean
        }
        component Health {
          current: integer
        }
        rule spawn_enemy on SpawnEnemy {
          let templates = entities having EnemyTemplate
          let template = templates[0]
          let newEnemy = clone template {
            EnemyTemplate { isTemplate: false }
            Health { current: 100 }
          }
          schedule DoAttack { source: newEnemy }
        }
      `, 'brl');
      
      expect(result.errors).toHaveLength(0);
      expect(result.ir.rules).toHaveLength(1);
    });
  });

  describe('Source map', () => {
    it('should include source map when requested', () => {
      const result = compile([
        {
          path: 'test.brl',
          content: 'component Health { current: integer }',
          language: 'brl',
        },
      ], { includeSourceMap: true });
      
      expect(result.errors).toHaveLength(0);
      expect(result.ir.source_map).toBeDefined();
      expect(result.ir.source_map?.files).toHaveLength(1);
    });
  });
});
