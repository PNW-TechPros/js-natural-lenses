export default function mapObject(obj, iteratee) {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = iteratee(v, k, obj);
  }
  return result;
}
