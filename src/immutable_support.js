import { forEach } from 'underscore';
import { at_maybe, cloneImpl } from './constants';

function ImmutableMixin({spliceOutWithDelete = false}) {
  return {
    [at_maybe]: function (key) {
      return this.has(key) ? {just: this.get(key)} : {};
    },
    [cloneImpl]: function ({pop, set, spliceOut}) {
      if (pop) {
        return this.pop();
      }
      if (set) {
        return this.set(...set);
      }
      if (spliceOut) {
        return spliceOutWithDelete ? this.delete(spliceOut) : this.set(spliceOut, undefined);
      }
      return this;
    },
  };
}
export function polyfillImmutable(containerType) {
  const isList = containerType.isList;
  const proto = containerType.prototype,
    mixins = ImmutableMixin({spliceOutWithDelete: !isList});
  forEach(
    Object.getOwnPropertySymbols(mixins),
    (name) => {
      if (!proto.hasOwnProperty(name)) proto[name] = mixins[name];
    }
  )
}
