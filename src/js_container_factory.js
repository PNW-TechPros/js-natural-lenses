const instanceContainerTypes = new WeakMap();
/**
 * @class
 * @summary A class to construct alternative sequential/mapping typings based on key type
 * 
 * @description
 * Use containers with the interfaces of the Array and ES6 Map classes as the
 * constructed containers based on the type of the key to be used for indexing
 * the container: a number indicates an Array and anything else uses a Map.
 *
 * Pass an instance of this class as the containerFactory option when
 * constructing a LensFactory. The container types to be used can be customized
 * when constructing this factory.
 */
class JsContainerFactory {
  /**
   * Construct a factory object
   * @param {Object} containerTypes
   * @param {Function} [containerTypes.Map = Map]  Map-equivalent container to construct
   * @param {Function} [containerTypes.Array = Array]  Array-equivalent container to construct
   */
  constructor(containerTypes = {Map, Array}) {
    instanceContainerTypes.set(this, {...containerTypes});
  }
  
  /**
   * The container type provided by this instance
   * @type {Object}
   *
   * @property {Function} Map  The "map" type
   * @property {Function} Array The "array" type
   */
  get containerTypes() {
    return {
      Map, Array,
      ...(instanceContainerTypes.get(this) ||
        /* istanbul ignore next: this shouldn't be possible */ {})
    };
  }
  
  /**
   * Construct the missing container
   * @param {Array} keys  The keys up to and including the one into the missing container
   * @returns {*} The missing container
   */
  construct(keys) {
    const types = instanceContainerTypes.get(this);
    const k = keys[keys.length - 1];
    return (typeof k === 'number')
      ? new (types.Array || Array)()
      : new (types.Map || Map)();
  }
}

export const DEFAULT_FACTORY = new JsContainerFactory();

export default JsContainerFactory;
