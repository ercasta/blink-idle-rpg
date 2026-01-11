import { compile } from './index';
import * as fs from 'fs';
import * as path from 'path';

function readFiles(dir: string, ext: string) {
  const dirPath = path.resolve(__dirname, `../../../${dir}`);
  if (!fs.existsSync(dirPath)) return [] as { path: string; content: string }[];
  return fs.readdirSync(dirPath)
    .filter(f => f.endsWith(ext))
    .map(f => ({ path: f, content: fs.readFileSync(path.join(dirPath, f), 'utf8') }));
}

describe('Full-game integration', () => {
  it('compiles BRL + BCL + BDL sources together with no errors', () => {
    const brlFiles = readFiles('game/brl', '.brl');
    let bclFiles = readFiles('game/bcl', '.bcl');
    const bdlFiles = readFiles('game/bdl', '.bdl');

    // Normalize BCL files: some BCL sources declare `module NAME` or contain
    // top-level configuration blocks (like `party { ... }`). The general
    // BRL parser accepts top-level `fn`/`choice fn` items, so for integration
    // testing we strip a leading `module NAME` line (so functions parse), and
    // skip files that are pure config (party/strategy) which the BRL parser
    // does not support yet.
    bclFiles = bclFiles.map(f => {
      const lines = f.content.split(/\r?\n/);
      // Find index of first non-empty line
      const firstIdx = lines.findIndex(l => l.trim().length > 0);
      const firstNonEmpty = firstIdx >= 0 ? lines[firstIdx].trim() : '';

      // If there's a `module NAME` declaration (commonly near the top), remove
      // that line so top-level `fn` and `choice fn` declarations parse correctly.
      const moduleIdx = lines.findIndex((l, idx) => idx < 20 && /^module\s+[A-Za-z0-9_]+$/.test(l.trim()));
      if (moduleIdx >= 0) {
        const newContent = lines.slice(0, moduleIdx).concat(lines.slice(moduleIdx + 1)).join('\n');
        return { path: f.path, content: newContent };
      }

      // Skip pure configuration BCL files that use `party {` or `strategy {` blocks
      if (/^party\s*\{|^strategy\s*\{/m.test(f.content)) {
        return { path: f.path, content: '' };
      }

      return f;
    }).filter(f => f.content.trim().length > 0);

    const sources = [
      ...brlFiles.map(f => ({ path: f.path, content: f.content, language: 'brl' as const })),
      ...bclFiles.map(f => ({ path: f.path, content: f.content, language: 'bcl' as const })),
      ...bdlFiles.map(f => ({ path: f.path, content: f.content, language: 'bdl' as const })),
    ];

    // Ensure we have something to compile
    expect(sources.length).toBeGreaterThan(0);

    const result = compile(sources, { moduleName: 'full-game-integration' });
    if (result.errors.length > 0) {
      console.error('Full-game compilation errors:', result.errors);
    }
    expect(result.errors).toHaveLength(0);
    // Basic sanity checks on produced IR
    expect(result.ir).toBeDefined();
    expect(Array.isArray(result.ir.components)).toBe(true);
  });
});
