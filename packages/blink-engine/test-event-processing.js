const BlinkEngine = require('./dist/index.js');

console.log('Creating game...');
const game = BlinkEngine.BlinkGame.createSync({
  debug: true,
  timeScale: 1.0,
  discreteTimeStep: 0.01,
  maxEventsPerFrame: 1000
});

console.log('Loading minimal IR...');
game.loadRulesFromObject({
  module: 'test',
  components: [],
  rules: [{
    name: 'test_rule',
    trigger: { event: 'TestEvent' },
    conditions: [],
    actions: [{
      type: 'log',
      message: 'TestEvent fired!'
    }]
  }],
  functions: [],
  initial_state: { entities: [] }
});

console.log('Scheduling event at time 0...');
game.scheduleEvent('TestEvent', 0, {});

console.log('Timeline has events:', game.hasEvents());
console.log('Current time:', game.getTime());

console.log('\nStarting game...');
game.start();

// Wait a bit for the game loop to run
setTimeout(() => {
  console.log('\nAfter start:');
  console.log('Timeline has events:', game.hasEvents());
  console.log('Current time:', game.getTime());
  console.log('Is running:', game.getIsRunning());
  
  game.stop();
  process.exit(0);
}, 1000);
