import BinderMixin from './binder_mixin';
import CCCLens from './ccc_lens';

/**
 * @summary A factory for Lens-derived objects with customized container construction
 * @description
 * When POD container types (Object and Array) are not the desired types to 
 * construct in a clone -- as with use of immutable containers -- this class
 * can be used to build lenses that *do* build the desired types of objects.
 * 
 * This class is often used in conjunction with a JsContainerFactory object
 * implementing the container factory.
 */
export default class LensFactory {
  constructor({containerFactory = jsContainers} = {}) {
    this.containerFactory = containerFactory;
  }
  
  lens(...keys) {
    const result = new CCCLens(...keys);
    result._containerFactory = this.containerFactory;
    return result;
  }
}
