export default function bindCallback(cb, context) {
  if (context === void 0) return cb;
  return function(v, k, coll) {
    return cb.call(context, v, k, coll);
  };
}
