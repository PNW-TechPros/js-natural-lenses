import isArrayLike from './_isArrayLike.js';

export default function reduce(container, iteratee, memo) {
  const initial = arguments.length >= 3;
  return impl(container, iteratee, memo, initial);
}

function impl(container, iteratee, memo, initial) {
  const keys = !isArrayLike(container) && (container == null ? [] : Object.keys(container)),
    length = (keys || container).length;
  let index = 0;
  if (!initial) {
    memo = container[keys ? keys[0] : 0];
    ++index;
  }
  for (; index < length; ++index) {
    const curKey = keys ? keys[index] : index;
    memo = iteratee(memo, container[curKey], curKey, container);
  }
  return memo;
}
