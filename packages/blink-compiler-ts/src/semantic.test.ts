import { parseSource } from './index';
import { analyze } from './semantic';

describe('Semantic analyzer - module-scoped functions', () => {
  it('should recognize functions declared inside a module', () => {
    const src = `
      module M {
        fn inner(x: number): number {
          return x
        }

        rule use on Test t {
          let v = inner(1)
        }
      }
    `;

    const ast = parseSource(src);
    const errors = analyze([ast]);
    expect(errors).toHaveLength(0);
  });
});
