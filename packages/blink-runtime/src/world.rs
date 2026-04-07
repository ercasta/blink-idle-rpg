/// ECS World: typed component storage with entity management.
///
/// Unlike the JS engine's Map-of-Maps approach, the WASM engine uses a trait-based
/// component storage system. Generated game code registers concrete component types
/// at compile time, giving direct struct field access instead of string lookups.
///
/// The World provides a type-erased storage interface via `ComponentStorageMap` that
/// generated code implements for each game's specific set of components.

use std::collections::HashMap;
use crate::value::EntityId;

/// Trait for component storage - implemented by generated code for each component type.
/// This provides the type-erased interface that the World uses.
pub trait ComponentStorage: std::any::Any {
    fn remove(&mut self, entity: EntityId);
    fn has(&self, entity: EntityId) -> bool;
    fn entity_ids(&self) -> Vec<EntityId>;
    fn clone_component(&mut self, source: EntityId, dest: EntityId);
    fn as_any(&self) -> &dyn std::any::Any;
    fn as_any_mut(&mut self) -> &mut dyn std::any::Any;
}

/// Typed component storage for a specific component type.
pub struct TypedStorage<C: Clone + 'static> {
    pub data: HashMap<EntityId, C>,
}

impl<C: Clone + 'static> TypedStorage<C> {
    pub fn new() -> Self {
        TypedStorage {
            data: HashMap::new(),
        }
    }

    pub fn insert(&mut self, entity: EntityId, component: C) {
        self.data.insert(entity, component);
    }

    pub fn get(&self, entity: EntityId) -> Option<&C> {
        self.data.get(&entity)
    }

    pub fn get_mut(&mut self, entity: EntityId) -> Option<&mut C> {
        self.data.get_mut(&entity)
    }
}

impl<C: Clone + 'static> Default for TypedStorage<C> {
    fn default() -> Self {
        Self::new()
    }
}

impl<C: Clone + 'static> ComponentStorage for TypedStorage<C> {
    fn remove(&mut self, entity: EntityId) {
        self.data.remove(&entity);
    }

    fn has(&self, entity: EntityId) -> bool {
        self.data.contains_key(&entity)
    }

    fn entity_ids(&self) -> Vec<EntityId> {
        self.data.keys().copied().collect()
    }

    fn clone_component(&mut self, source: EntityId, dest: EntityId) {
        if let Some(comp) = self.data.get(&source).cloned() {
            self.data.insert(dest, comp);
        }
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    fn as_any_mut(&mut self) -> &mut dyn std::any::Any {
        self
    }
}

/// The ECS World manages entities and their component storage.
/// Component storages are registered by generated code at initialization.
pub struct World {
    next_entity_id: EntityId,
    alive: std::collections::HashSet<EntityId>,
    storages: HashMap<std::any::TypeId, Box<dyn ComponentStorage>>,
    /// Maps entity IDs to their variable names (from BRL entity definitions).
    entity_variables: HashMap<EntityId, String>,
}

impl World {
    pub fn new() -> Self {
        World {
            next_entity_id: 1, // 0 is reserved for NO_ENTITY
            alive: std::collections::HashSet::new(),
            storages: HashMap::new(),
            entity_variables: HashMap::new(),
        }
    }

    /// Register a component storage for a type. Called by generated code at init.
    pub fn register_component<C: Clone + 'static>(&mut self) {
        let type_id = std::any::TypeId::of::<C>();
        if !self.storages.contains_key(&type_id) {
            self.storages
                .insert(type_id, Box::new(TypedStorage::<C>::new()));
        }
    }

    /// Spawn a new entity, returning its ID.
    pub fn spawn(&mut self) -> EntityId {
        let id = self.next_entity_id;
        self.next_entity_id += 1;
        self.alive.insert(id);
        id
    }

    /// Spawn a named entity (with a BRL variable name).
    pub fn spawn_named(&mut self, name: &str) -> EntityId {
        let id = self.spawn();
        self.entity_variables.insert(id, name.to_string());
        id
    }

    /// Spawn an entity with a specific ID (used by the WASM/JS bridge to create
    /// entities that match the IDs assigned by the JavaScript SimEngine).
    /// If the ID is already alive, this is a no-op and returns the ID.
    /// Advances `next_entity_id` past this ID to avoid future collisions.
    pub fn spawn_with_id(&mut self, id: EntityId) -> EntityId {
        if !self.alive.contains(&id) {
            self.alive.insert(id);
            if id >= self.next_entity_id {
                self.next_entity_id = id + 1;
            }
        }
        id
    }

    /// Despawn an entity, removing all its components.
    pub fn despawn(&mut self, id: EntityId) {
        self.alive.remove(&id);
        for storage in self.storages.values_mut() {
            storage.remove(id);
        }
        self.entity_variables.remove(&id);
    }

    /// Check if an entity is alive.
    pub fn is_alive(&self, id: EntityId) -> bool {
        self.alive.contains(&id)
    }

    /// Insert a component on an entity.
    pub fn insert<C: Clone + 'static>(&mut self, id: EntityId, component: C) {
        let type_id = std::any::TypeId::of::<C>();
        if let Some(storage) = self.storages.get_mut(&type_id) {
            storage
                .as_any_mut()
                .downcast_mut::<TypedStorage<C>>()
                .unwrap()
                .insert(id, component);
        }
    }

    /// Get a reference to a component on an entity.
    /// Returns a default value if the entity doesn't have the component or is not alive.
    /// This is safe for BRL-generated code where event references may point to
    /// despawned entities (e.g. a DoAttack event for a killed enemy).
    pub fn get<C: Clone + Default + 'static>(&self, id: EntityId) -> &C {
        static DEFAULT_STORAGE: std::sync::OnceLock<std::sync::Mutex<Vec<Box<dyn std::any::Any + Send + Sync>>>> = std::sync::OnceLock::new();
        let type_id = std::any::TypeId::of::<C>();
        if let Some(result) = self.storages
            .get(&type_id)
            .and_then(|s| s.as_any().downcast_ref::<TypedStorage<C>>())
            .and_then(|s| s.get(id))
        {
            return result;
        }
        // Entity doesn't have the component - return a thread-local default
        // This avoids panicking when BRL rules reference despawned entities
        thread_local! {
            static DEFAULTS: std::cell::RefCell<std::collections::HashMap<std::any::TypeId, *const u8>> = std::cell::RefCell::new(std::collections::HashMap::new());
        }
        // Leak a default value to get a stable &C reference
        // This is fine since it's per-type and happens at most once per type
        DEFAULTS.with(|defaults| {
            let mut map = defaults.borrow_mut();
            let ptr = map.entry(type_id).or_insert_with(|| {
                let boxed = Box::new(C::default());
                Box::into_raw(boxed) as *const u8
            });
            unsafe { &*(*ptr as *const C) }
        })
    }

    /// Get a mutable reference to a component on an entity.
    /// Panics if the entity doesn't have the component.
    pub fn get_mut<C: Clone + 'static>(&mut self, id: EntityId) -> &mut C {
        let type_id = std::any::TypeId::of::<C>();
        self.storages
            .get_mut(&type_id)
            .and_then(|s| s.as_any_mut().downcast_mut::<TypedStorage<C>>())
            .and_then(|s| s.get_mut(id))
            .unwrap_or_else(|| panic!("Entity {} does not have component for mutation", id))
    }

    /// Try to get a reference to a component (returns None if not present).
    pub fn try_get<C: Clone + 'static>(&self, id: EntityId) -> Option<&C> {
        let type_id = std::any::TypeId::of::<C>();
        self.storages
            .get(&type_id)
            .and_then(|s| s.as_any().downcast_ref::<TypedStorage<C>>())
            .and_then(|s| s.get(id))
    }

    /// Try to get a mutable reference to a component.
    pub fn try_get_mut<C: Clone + 'static>(&mut self, id: EntityId) -> Option<&mut C> {
        let type_id = std::any::TypeId::of::<C>();
        self.storages
            .get_mut(&type_id)
            .and_then(|s| s.as_any_mut().downcast_mut::<TypedStorage<C>>())
            .and_then(|s| s.get_mut(id))
    }

    /// Check if an entity has a specific component.
    pub fn has<C: Clone + 'static>(&self, id: EntityId) -> bool {
        let type_id = std::any::TypeId::of::<C>();
        self.storages
            .get(&type_id)
            .map(|s| s.has(id))
            .unwrap_or(false)
    }

    /// Query all entity IDs that have a specific component.
    pub fn query_component<C: Clone + 'static>(&self) -> Vec<EntityId> {
        let type_id = std::any::TypeId::of::<C>();
        self.storages
            .get(&type_id)
            .map(|s| s.entity_ids())
            .unwrap_or_default()
    }

    /// Get all alive entity IDs.
    pub fn get_all_entities(&self) -> Vec<EntityId> {
        self.alive.iter().copied().collect()
    }

    /// Get the variable name for an entity (if it was named).
    pub fn get_variable_name(&self, id: EntityId) -> Option<&str> {
        self.entity_variables.get(&id).map(|s| s.as_str())
    }

    /// Clone all components from source entity to dest entity for a specific component type.
    pub fn clone_component_by_type_id(
        &mut self,
        type_id: std::any::TypeId,
        source: EntityId,
        dest: EntityId,
    ) {
        if let Some(storage) = self.storages.get_mut(&type_id) {
            storage.clone_component(source, dest);
        }
    }

    /// Reset the world to empty state.
    pub fn reset(&mut self) {
        self.alive.clear();
        self.entity_variables.clear();
        self.next_entity_id = 1;
        self.storages.clear();
    }
}

impl Default for World {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Clone, Debug, PartialEq, Default)]
    struct Health {
        current: i64,
        max: i64,
    }

    #[derive(Clone, Debug, PartialEq, Default)]
    struct Combat {
        damage: f64,
    }

    #[test]
    fn test_spawn_and_insert() {
        let mut world = World::new();
        world.register_component::<Health>();

        let entity = world.spawn();
        world.insert(entity, Health { current: 100, max: 100 });

        assert!(world.is_alive(entity));
        assert_eq!(world.get::<Health>(entity).current, 100);
    }

    #[test]
    fn test_get_mut() {
        let mut world = World::new();
        world.register_component::<Health>();

        let entity = world.spawn();
        world.insert(entity, Health { current: 100, max: 100 });

        world.get_mut::<Health>(entity).current -= 20;
        assert_eq!(world.get::<Health>(entity).current, 80);
    }

    #[test]
    fn test_has_component() {
        let mut world = World::new();
        world.register_component::<Health>();
        world.register_component::<Combat>();

        let entity = world.spawn();
        world.insert(entity, Health { current: 100, max: 100 });

        assert!(world.has::<Health>(entity));
        assert!(!world.has::<Combat>(entity));
    }

    #[test]
    fn test_query_component() {
        let mut world = World::new();
        world.register_component::<Health>();
        world.register_component::<Combat>();

        let e1 = world.spawn();
        let e2 = world.spawn();
        let e3 = world.spawn();

        world.insert(e1, Health { current: 100, max: 100 });
        world.insert(e2, Health { current: 50, max: 50 });
        world.insert(e3, Combat { damage: 10.0 });

        let health_entities = world.query_component::<Health>();
        assert_eq!(health_entities.len(), 2);
        assert!(health_entities.contains(&e1));
        assert!(health_entities.contains(&e2));
    }

    #[test]
    fn test_despawn() {
        let mut world = World::new();
        world.register_component::<Health>();

        let entity = world.spawn();
        world.insert(entity, Health { current: 100, max: 100 });

        world.despawn(entity);
        assert!(!world.is_alive(entity));
        assert!(!world.has::<Health>(entity));
    }

    #[test]
    fn test_named_entity() {
        let mut world = World::new();
        let entity = world.spawn_named("hero");
        assert_eq!(world.get_variable_name(entity), Some("hero"));
    }

    #[test]
    fn test_try_get() {
        let mut world = World::new();
        world.register_component::<Health>();

        let entity = world.spawn();
        assert!(world.try_get::<Health>(entity).is_none());

        world.insert(entity, Health { current: 100, max: 100 });
        assert_eq!(world.try_get::<Health>(entity).unwrap().current, 100);
    }
}
