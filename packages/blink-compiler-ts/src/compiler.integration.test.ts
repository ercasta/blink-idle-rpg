import { compileString } from './index';
import * as fs from 'fs';
import * as path from 'path';

describe('Integration: compile game BRL files', () => {
  it('compiles classic-rpg.brl with no semantic errors', () => {
    const filePath = path.resolve(__dirname, '../../../game/brl/classic-rpg.brl');
    const src = fs.readFileSync(filePath, 'utf8');

    const result = compileString(src, 'brl', { moduleName: 'integration-classic' });
    if (result.errors && result.errors.length > 0) {
      // Print errors for easier debugging
      console.error('Compilation errors:', result.errors);
    }
    expect(result.errors).toHaveLength(0);
  });
});
