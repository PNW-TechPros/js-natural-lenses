import { isArray, range, reduce } from 'underscore';

// BinderMixin
export default {
  '$': function(method) {
    // Support tagged template syntax
    if (isArray(method)) {
      method = reduce(
        range(1, arguments.length),
        (cur, i) => cur + arguments[i].toString() + method[i],
        method[0]
      );
    }
    return this[method].bind(this);
  }
};
