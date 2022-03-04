import BinderMixin from './binder_mixin.js';
import CCCLens from './ccc_lens.js';

class LensFactory {
  /**
   * @constructs Factory
   * @summary A factory for Lens-derived objects with customized container construction
   * @param {Object} spec
   * @param {JsContainerFactory} spec.containerFactory  Factory for containers created with [Lenses]{@link Lens} created by this Factory
   * 
   * @description
   * When POD container types (Object and Array) are not the desired types to 
   * construct in a clone -- as with use of immutable containers -- this class
   * can be used to build lenses that *do* build the desired types of objects.
   * 
   * This class is often used in conjunction with a JsContainerFactory object
   * implementing the container factory.
   */
  constructor({containerFactory = jsContainers} = {}) {
    this.containerFactory = containerFactory;
  }
  
  /**
   * Construct a lens through the factory
   * @param {...*} keys  The keys of the customized lens type
   * @returns {Lens}  A lens with customized container creation behavior
   */
  lens(...keys) {
    const result = new CCCLens(...keys);
    result._containerFactory = this.containerFactory;
    return result;
  }
}

export default LensFactory;
