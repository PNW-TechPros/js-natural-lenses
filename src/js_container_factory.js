const instanceContainerTypes = new WeakMap();
/**
 * @summary A class to construct alternative sequential/mapping typings based on key type
 * @description
 * Use containers with the interfaces of the Array and ES6 Map classes as the
 * constructed containers based on the type of the key to be used for indexing
 * the container: a number indicates an Array and anything else uses a Map.
 *
 * Pass an instance of this class as the containerFactory option when
 * constructing a LensFactory. The container types to be used can be customized
 * when constructing this factory.
 */
export default class JsContainerFactory {
  constructor(containerTypes = {Map, Array}) {
    instanceContainerTypes.set(this, {...containerTypes});
  }
  
  get containerTypes() {
    return {
      Map, Array,
      ...(instanceContainerTypes.get(this) || {})
    };
  }
  
  construct(keys) {
    const types = instanceContainerTypes.get(this);
    const k = keys[keys.length - 1];
    return (typeof k === 'number')
      ? new (types.Array || Array)()
      : new (types.Map || Map)();
  }
}

export const DEFAULT_FACTORY = new JsContainerFactory();
