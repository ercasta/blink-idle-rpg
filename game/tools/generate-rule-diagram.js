const fs = require('fs');
const path = require('path');

function readIR(irPath) {
  const text = fs.readFileSync(irPath, 'utf8');
  return JSON.parse(text);
}

function collectRuleCandidates(ir) {
  const candidates = [];
  function walk(obj, parentKey) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { for (const item of obj) walk(item, parentKey); return; }
    const keys = Object.keys(obj);
    if (typeof obj.name === 'string' && (keys.includes('trigger') || keys.includes('when') || keys.includes('actions') || keys.includes('steps') || parentKey === 'rules')) {
      candidates.push(obj);
    }
    for (const k of keys) walk(obj[k], k);
  }
  walk(ir, undefined);
  return candidates;
}

function gatherNames(rules) {
  const names = new Set();
  for (const r of rules) if (typeof r.name === 'string') names.add(r.name);
  return Array.from(names);
}

function findReferences(obj, names) {
  const found = new Set();
  function w(o) {
    if (!o) return;
    if (typeof o === 'string') { for (const n of names) if (o.includes(n) && o !== n) found.add(n); return; }
    if (Array.isArray(o)) return o.forEach(w);
    if (typeof o === 'object') return Object.values(o).forEach(w);
  }
  w(obj);
  return Array.from(found);
}

function shortLabel(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj.slice(0,40).replace(/\n/g,' ');
  try {
    const raw = JSON.stringify(obj);
    // remove characters that break mermaid labels (braces, quotes, colons, pipes)
    const safe = raw.replace(/[\{\}\[\]":,|]/g, '');
    return safe.slice(0,60).replace(/\n/g,' ');
  } catch { return '' }
}

function buildMermaid(rules, allNames) {
  const lines = [];
  lines.push('flowchart LR');
  const nameToId = new Map();
  let idx = 0;
  for (const r of rules) {
    const nm = r.name || `rule_${idx}`;
    const id = 'R' + (++idx);
    nameToId.set(nm, id);
    const label = nm.replace(/"/g,'\\"');
    lines.push(`  ${id}["${label}"]`);
  }

  // helper: map event -> rules that trigger on it
  const eventMap = new Map();
  for (const r of rules) {
    if (r.trigger && r.trigger.type === 'event' && typeof r.trigger.event === 'string') {
      const ev = r.trigger.event;
      if (!eventMap.has(ev)) eventMap.set(ev, []);
      eventMap.get(ev).push(r.name);
    }
  }

  // collect schedules from actions
  function collectSchedules(actions) {
    const schedules = [];
    function walk(obj) {
      if (!obj) return;
      if (Array.isArray(obj)) return obj.forEach(walk);
      if (typeof obj !== 'object') return;
      if (obj.type === 'schedule' && obj.event) schedules.push({ event: obj.event, delay: obj.delay });
      for (const v of Object.values(obj)) walk(v);
    }
    walk(actions);
    return schedules;
  }

  // add edges: rule -> event node -> triggered rules
  for (const r of rules) {
    const src = nameToId.get(r.name);
    const schedules = collectSchedules(r.actions || []);
    for (const s of schedules) {
      const evName = (typeof s.event === 'string') ? s.event : (s.event && s.event.value) || 'UNKNOWN_EVENT';
      const evId = `E_${evName.replace(/[^a-zA-Z0-9_]/g,'_')}`;
      if (!lines.some(l => l.includes(evId))) lines.push(`  ${evId}(((event: ${evName})))`);
      const label = s.delay ? shortLabel(s.delay) : '';
      if (label) lines.push(`  ${src} -->|delay:${label}| ${evId}`);
      else lines.push(`  ${src} --> ${evId}`);
      const targets = eventMap.get(evName) || [];
      for (const t of targets) {
        const dst = nameToId.get(t);
        if (dst) lines.push(`  ${evId} --> ${dst}`);
      }
    }
  }

  // fallback textual references between rules
  for (const r of rules) {
    const src = nameToId.get(r.name);
    const refs = findReferences(r, allNames);
    for (const ref of refs) {
      const dst = nameToId.get(ref);
      if (!dst) continue;
      if (!lines.some(l => l.includes(`${src}`) && l.includes(`${dst}`))) {
        const edgeLabel = shortLabel(r.actions || r.steps || r.trigger || r.when || '');
        if (edgeLabel) lines.push(`  ${src} -->|${edgeLabel}| ${dst}`);
        else lines.push(`  ${src} --> ${dst}`);
      }
    }
  }

  // START nodes for GameStart triggers or named starts
  for (const r of rules) {
    const nm = r.name || '';
    const src = nameToId.get(nm);
    if ((r.trigger && r.trigger.type === 'event' && r.trigger.event === 'GameStart') || nm.toLowerCase().includes('start') || (r.start === true)) {
      lines.push(`  START((Start)) --> ${src}`);
    }
  }

  // end nodes
  for (const [nm,id] of nameToId) {
    const hasOut = lines.some(l => l.startsWith(`  ${id}`) && l.includes('-->')) || lines.some(l => l.includes(`--> ${id}`) && l.includes('event:'));
    if (!hasOut) lines.push(`  ${id} --> END((End))`);
  }

  return lines.join('\n');
}

function main() {
  const irPath = process.argv[2] || path.join('game','ir','classic-rpg.ir.json');
  if (!fs.existsSync(irPath)) { console.error('IR file not found:', irPath); process.exit(2); }
  const ir = readIR(irPath);
  const rules = collectRuleCandidates(ir);
  if (!rules.length) console.error('No rule-like candidates found in IR.');
  const names = gatherNames(rules);
  const mermaid = buildMermaid(rules, names);
  const outPath = path.join('game','rule-chain.mmd');
  fs.writeFileSync(outPath, mermaid, 'utf8');
  console.log('Mermaid diagram written to', outPath);
  console.log(mermaid);
}

if (require.main === module) main();
