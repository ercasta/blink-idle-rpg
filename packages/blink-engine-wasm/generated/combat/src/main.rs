// Generated test harness for combat
#![allow(dead_code, unused_imports, unused_variables)]

use blink_game_combat::*;

fn main() {
    let mut engine = blink_runtime::Engine::new();

    // Initialize the game
    init_game(&mut engine);

    // Schedule the GameStart event
    let game_start_type = engine.interner.intern("GameStart");
    let start_event = blink_runtime::Event::new(game_start_type);
    engine.timeline.schedule_immediate(start_event);

    // Run simulation steps
    let mut steps_run = 0u32;
    let max_steps = 1000u32;

    while engine.has_events() && steps_run < max_steps {
        if step(&mut engine) {
            steps_run += 1;
        } else {
            break;
        }
    }

    // Print results as JSON
    println!("{{");
    println!("  \"test\": \"combat\",");
    println!("  \"steps_run\": {},", steps_run);
    println!("  \"final_time\": {},", engine.get_time());
    println!("  \"has_events\": {},", engine.has_events());
    println!("  \"status\": \"ok\"");
    println!("}}");
}
