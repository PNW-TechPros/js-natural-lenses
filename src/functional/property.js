export default function property(key) {
  return (obj) => {
    if (obj == null) return void 0;
    return obj[key];
  }
}
