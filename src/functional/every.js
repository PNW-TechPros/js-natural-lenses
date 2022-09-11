import bindCb from './_cb.js';
import isArrayLike from './_isArrayLike.js';

export default function every(container, predicate, context) {
  predicate = bindCb(predicate, context);
  const keys = container == null ? [] : Object.keys(container),
    length = (keys || container).length;
  for (let i = 0; i < length; ++i) {
    const curKey = keys ? keys[i] : i;
    if (!predicate(container[curKey], curKey, container)) return false;
  }
  return true;
}
