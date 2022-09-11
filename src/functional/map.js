import bindCb from './_cb.js';
import isArrayLike from './_isArrayLike.js';

export default function map(obj, iteratee, context) {
  iteratee = bindCb(iteratee, context);
  const _keys = !isArrayLike(obj) && keys(obj),
      length = (_keys || obj).length,
      results = Array(length);
  for (let index = 0; index < length; index++) {
    const currentKey = _keys ? _keys[index] : index;
    results[index] = iteratee(obj[currentKey], currentKey, obj);
  }
  return results;
}
