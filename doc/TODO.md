# TODO

- Review workflow files
- Interface GameSnapsot should be substituted by a specific component, and the engine should expose methods to set / get components, usable by typescript
- The existing Javascript engine must be deleted. We'll restore it after we have stabilized the wasm engine that must be used for both development and production
- web-interface-design.md still mentions loading IR. There should be no IR loading at runtime.
- Implement storage via IndexedDB instead of localstorage
- remove floating point from BRL. Keep decimal values but precision must be specified. Internally (compiler, engine) they are manipulated as integers to avoid rouding / floating point representation inconsistencies
- make references typed: id types must specify the component they are referring to, not the entity. At engine level, give unique ids to components to allow this behaviour. Also if c is a component, the syntax c.entity will return the entity id. Modify the BRL compiler to check for correct type usage.
- remove the "priority" concept from BRL. If the engine currently supports it, remove it. Rules will fire in the order they are declared; to make ordering explicit, it is advisable to use different events




