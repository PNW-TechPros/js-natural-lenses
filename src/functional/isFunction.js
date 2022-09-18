import { root } from './_setup.js';


var isFunction = /* istanbul ignore next */ (val) => Object.prototype.toString.call(val) === '[object Function]';

const nodelist = root.document && /* istanbul ignore next */ root.document.childNodes;
if (typeof /./ != 'function' && typeof Int8Array != 'object' && typeof nodelist != 'function') {
  isFunction = function(obj) {
    return typeof obj == 'function' || false;
  };
}

export default isFunction;
