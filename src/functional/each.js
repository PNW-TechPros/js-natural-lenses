import bindCb from './_cb.js';
import isArrayLike from './_isArrayLike.js';

export default function each(container, iteratee, context) {
  iteratee = bindCb(iteratee, context);
  if (isArrayLike(container)) {
    const length = container.length;
    for (let i = 0; i < length; i++) {
      iteratee(container[i], i, container);
    }
  } else {
    const keys = container == null ? [] : Object.keys(container), length = keys.length;
    for (let i = 0; i < length; i++) {
      iteratee(container[keys[i]], keys[i], container);
    }
  }
  return container;
}
