//! Language Compilation Test Suite
//!
//! This module contains comprehensive tests for the Blink language compiler.
//! It should be run after each change to the compiler to ensure correctness.
//!
//! To run: `cargo test --test language_tests`

use blink_compiler::{compile, CompilerOptions};

/// Test basic component definition
#[test]
fn test_component_definition() {
    let source = r#"
        component Health {
            current: integer
            max: integer
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Component definition should compile");
    
    let ir = result.unwrap();
    assert_eq!(ir.components.len(), 1);
    assert_eq!(ir.components[0].name, "Health");
    assert_eq!(ir.components[0].fields.len(), 2);
}

/// Test rule with trigger
#[test]
fn test_rule_definition() {
    let source = r#"
        component Health {
            current: integer
            max: integer
        }
        
        rule damage_rule on DamageEvent {
            entity.Health.current -= 10
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Rule definition should compile");
    
    let ir = result.unwrap();
    assert_eq!(ir.rules.len(), 1);
}

/// Test function definition
#[test]
fn test_function_definition() {
    let source = r#"
        fn calculate_damage(base: float, multiplier: float): float {
            return base * multiplier
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Function definition should compile");
    
    let ir = result.unwrap();
    assert_eq!(ir.functions.len(), 1);
    assert_eq!(ir.functions[0].name, "calculate_damage");
}

/// Test tracker definition
#[test]
fn test_tracker_definition() {
    let source = r#"
        component Health {
            current: integer
            max: integer
        }
        
        tracker Health on DamageEvent
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Tracker definition should compile");
    
    let ir = result.unwrap();
    assert_eq!(ir.trackers.len(), 1);
    assert_eq!(ir.trackers[0].component, "Health");
    assert_eq!(ir.trackers[0].event, "DamageEvent");
}

/// Test new entity syntax: `name = new entity { ... }`
#[test]
fn test_new_entity_syntax() {
    let source = r#"
        component Health {
            current: integer
            max: integer
        }
        
        warrior = new entity {
            Health {
                current: 100
                max: 100
            }
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "New entity syntax should compile");
    
    let ir = result.unwrap();
    assert!(ir.initial_state.is_some());
    let state = ir.initial_state.unwrap();
    assert_eq!(state.entities.len(), 1);
    assert_eq!(state.entities[0].variable, Some("warrior".to_string()));
}

/// Test legacy entity syntax: `entity @name { ... }` (deprecated but supported)
#[test]
fn test_legacy_entity_syntax() {
    let source = r#"
        component Health {
            current: integer
            max: integer
        }
        
        entity @warrior {
            Health {
                current: 100
                max: 100
            }
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Legacy entity syntax should compile");
    
    let ir = result.unwrap();
    assert!(ir.initial_state.is_some());
}

/// Test `entities having` expression
#[test]
fn test_entities_having_expression() {
    let source = r#"
        component Character {
            name: string
        }
        
        rule test_rule on TestEvent {
            let warriors = entities having Character
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Entities having expression should compile");
}

/// Test bound choice functions in entities
#[test]
fn test_bound_choice_function() {
    let source = r#"
        component Health {
            current: integer
            max: integer
        }
        
        warrior = new entity {
            Health {
                current: 100
                max: 100
            }
            
            .selectTarget = choice(enemies: list): id {
                return enemies[0]
            }
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Bound choice function should compile");
    
    let ir = result.unwrap();
    assert!(ir.initial_state.is_some());
    let state = ir.initial_state.unwrap();
    assert!(state.entities[0].bound_functions.is_some());
}

/// Test composite types in choice function parameters
#[test]
fn test_composite_type_parameter() {
    let source = r#"
        component Character {
            name: string
        }
        
        component Skills {
            skill1: string
        }
        
        warrior = new entity {
            Character {
                name: "Test"
            }
            Skills {
                skill1: "attack"
            }
            
            .selectSkill = choice(char: Character & Skills): string {
                return "attack"
            }
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Composite type parameter should compile");
}

/// Test if statements in rules
#[test]
fn test_if_statement() {
    let source = r#"
        component Health {
            current: integer
            max: integer
        }
        
        rule heal_rule on HealEvent {
            if entity.Health.current < entity.Health.max {
                entity.Health.current += 10
            }
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "If statement should compile");
}

/// Test for loops in rules
#[test]
fn test_for_loop() {
    let source = r#"
        component Health {
            current: integer
            max: integer
        }
        
        rule heal_all on HealAllEvent {
            let allies = [1, 2, 3]
            for ally in allies {
                entity.Health.current += 10
            }
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "For loop should compile: {:?}", result.err());
}

/// Test let statement
#[test]
fn test_let_statement() {
    let source = r#"
        component Health {
            current: integer
            max: integer
        }
        
        rule calc_rule on CalcEvent {
            let damage = 10
            entity.Health.current -= damage
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Let statement should compile");
}

/// Test schedule statement
#[test]
fn test_schedule_statement() {
    let source = r#"
        rule delayed_event on TriggerEvent {
            schedule [delay: 1.0] DelayedEvent {
                source: entity.id
            }
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Schedule statement should compile");
}

/// Test binary expressions
#[test]
fn test_binary_expressions() {
    let source = r#"
        component Health {
            current: integer
            max: integer
        }
        
        rule expr_rule on ExprEvent {
            let a = 10 + 5
            let b = 10 - 5
            let c = 10 * 5
            let d = 10 / 5
            let e = 10 % 5
            let f = a > b && c < d || e == 0
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Binary expressions should compile");
}

/// Test unary expressions
#[test]
fn test_unary_expressions() {
    let source = r#"
        rule unary_rule on UnaryEvent {
            let a = -10
            let b = !true
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Unary expressions should compile");
}

/// Test field access expressions
#[test]
fn test_field_access() {
    let source = r#"
        component Health {
            current: integer
            max: integer
        }
        
        rule access_rule on AccessEvent {
            let health = entity.Health.current
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Field access should compile");
}

/// Test index access expressions
#[test]
fn test_index_access() {
    let source = r#"
        rule index_rule on IndexEvent {
            let enemies = [1, 2, 3]
            let first = enemies[0]
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Index access should compile: {:?}", result.err());
}

/// Test function calls
#[test]
fn test_function_call() {
    let source = r#"
        fn double(x: integer): integer {
            return x * 2
        }
        
        rule call_rule on CallEvent {
            let result = double(5)
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Function call should compile");
}

/// Test list literals
#[test]
fn test_list_literal() {
    let source = r#"
        rule list_rule on ListEvent {
            let nums = [1, 2, 3, 4, 5]
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "List literal should compile");
}

/// Test string literals
#[test]
fn test_string_literals() {
    let source = r#"
        component Character {
            name: string
        }
        
        warrior = new entity {
            Character {
                name: "Test Hero"
            }
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "String literals should compile");
}

/// Test optional field type
#[test]
fn test_optional_field() {
    let source = r#"
        component Target {
            entity: id?
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Optional field type should compile");
}

/// Test list field type
#[test]
fn test_list_field() {
    let source = r#"
        component Inventory {
            items: list<string>
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "List field type should compile");
}

/// Test multiple components in entity
#[test]
fn test_multiple_components() {
    let source = r#"
        component Health {
            current: integer
            max: integer
        }
        
        component Combat {
            damage: integer
            defense: integer
        }
        
        warrior = new entity {
            Health {
                current: 100
                max: 100
            }
            Combat {
                damage: 10
                defense: 5
            }
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Multiple components in entity should compile");
    
    let ir = result.unwrap();
    assert!(ir.initial_state.is_some());
    let state = ir.initial_state.unwrap();
    assert_eq!(state.entities[0].components.len(), 2);
}

/// Test rule with condition
#[test]
fn test_rule_with_condition() {
    let source = r#"
        component Health {
            current: integer
            max: integer
        }
        
        rule conditional_rule on DamageEvent when entity.Health.current > 0 {
            entity.Health.current -= 10
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Rule with condition should compile");
}

/// Test create entity statement
#[test]
fn test_create_statement() {
    let source = r#"
        component Health {
            current: integer
            max: integer
        }
        
        rule spawn_rule on SpawnEvent {
            create entity {
                Health {
                    current: 100
                    max: 100
                }
            }
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Create statement should compile");
}

/// Test delete entity statement
#[test]
fn test_delete_statement() {
    let source = r#"
        component Health {
            current: integer
            max: integer
        }
        
        rule death_rule on DeathEvent {
            delete entity
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Delete statement should compile");
}

/// Test else-if chain
#[test]
fn test_else_if_chain() {
    let source = r#"
        component Health {
            current: integer
            max: integer
        }
        
        rule heal_rule on HealEvent {
            if entity.Health.current < 30 {
                entity.Health.current += 50
            } else if entity.Health.current < 60 {
                entity.Health.current += 25
            } else {
                entity.Health.current += 10
            }
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Else-if chain should compile");
}

/// Test compound assignment operators
#[test]
fn test_compound_assignment() {
    let source = r#"
        component Health {
            current: integer
            max: integer
        }
        
        rule ops_rule on OpsEvent {
            entity.Health.current += 10
            entity.Health.current -= 5
            entity.Health.current *= 2
        }
    "#;
    
    let result = compile(source, &CompilerOptions::default());
    assert!(result.is_ok(), "Compound assignment should compile");
}
