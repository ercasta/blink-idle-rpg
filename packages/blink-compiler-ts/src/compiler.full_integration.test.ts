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
  it('compiles BRL + BDL sources together with no errors', () => {
    const brlFiles = readFiles('game/brl', '.brl');
    const bdlFiles = readFiles('game/bdl', '.bdl');

    const sources = [
      ...brlFiles.map(f => ({ path: f.path, content: f.content, language: 'brl' as const })),
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
