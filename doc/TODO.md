# TODO

- Review workflow files
- Interface GameSnapsot should be substituted by a specific component, and the engine should expose methods to set / get components, usable by typescript
- The existing Javascript engine must be deleted. We'll restore it after we have stabilized the wasm engine that must be used for both development and production
- web-interface-design.md still mentions loading IR. There should be no IR loading at runtime.
- Implement storage via IndexedDB instead of localstorage




