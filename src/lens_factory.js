import CCCLens from './ccc_lens.js';
import { DEFAULT_FACTORY as jsContainers } from './js_container_factory.js';

/**
 * @interface ContainerFactory
 * @see Factory
 */

/**
 * @function ContainerFactory#construct
 * @summary Construct a missing container
 * @param {Array} keys  The keys up to and including the one indexing into the missing container
 * @returns {*} The missing container
 */

class LensFactory {
  /**
   * @constructs Factory
   * @summary A factory for Lens-derived objects with customized container construction
   * @param {Object} spec
   * @param {ContainerFactory} spec.containerFactory  Factory for containers, used by [Lenses]{@link Lens} created by this Factory, invoked when modify-cloning missing containers in subject data
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
   * @param {...*} key  A key of the customized lens type
   * @returns {Lens}  A lens with customized container creation behavior
   */
  lens(...keys) {
    const result = new CCCLens(...keys);
    result._containerFactory = this.containerFactory;
    return result;
  }
}

export default LensFactory;
