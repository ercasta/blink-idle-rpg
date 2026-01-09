const { compile } = require('./packages/blink-compiler-ts/dist/index.js');

const brl = `
component Team { isPlayer: boolean }

rule test on TestEvent {
    let seeker = event.seeker
    seeker.Team.isPlayer = true
}
`;

const sources = [
    { path: 'test.brl', content: brl, language: 'brl' },
];

const result = compile(sources);
if (result.errors && result.errors.length > 0) {
    console.error('Errors:', result.errors);
    process.exit(1);
}

const rule = result.ir.rules.find(r => r.name === 'test');
console.log('Rule:');
console.log(JSON.stringify(rule, null, 2));
