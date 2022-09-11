import { MAX_ARRAY_INDEX } from './_setup.js';

export default function isArrayLike(val) {
  const sizeProperty = getLength(val);
  return typeof sizeProperty == 'number' && sizeProperty >= 0 && sizeProperty <= MAX_ARRAY_INDEX;
}

function getLength(obj) {
  return obj == null ? void 0 : obj.length;
}
