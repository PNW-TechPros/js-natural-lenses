export default function isString(val) {
  return Object.prototype.toString.call(val) === '[object String]';
}
