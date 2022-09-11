import { root } from './_setup.js';

var isFunction = (val) => Object.prototype.toString.call(val) === '[object Function]';

const nodelist = root.document && root.document.childNodes;
if (typeof /./ != 'function' && typeof Int8Array != 'object' && typeof nodelist != 'function') {
  isFunction = function(obj) {
    return typeof obj == 'function' || false;
  };
}

export default isFunction;
