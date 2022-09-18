export default function isObject(val) {
  const type = typeof val;
  return type === 'function' || type === 'object' && !!val;
}
