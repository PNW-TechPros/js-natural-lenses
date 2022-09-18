export default function range(start, stop, step) {
  if (stop == null) {
    stop = start || 0;
    start = 0;
  }
  if (!step) {
    step = stop < start ? -1 : 1;
  }
  
  const length = Math.max(Math.ceil((stop - start) / step), 0);
  const result = Array(length);
  
  for (let i = 0; i < length; i++, start += step) {
    result[i] = start;
  }
  
  return result;
}
