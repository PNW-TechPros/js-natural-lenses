import { at_maybe, cloneImpl } from '../src-cjs/constants.js';

function ImmutableMixin({spliceOutWithDelete}) {
  return {
    [at_maybe]: function (key) {
      return this.has(key) ? {just: this.get(key)} : {};
    },
    [cloneImpl]: function ({pop, set, spliceOut}) {
      /* istanbul ignore next: unsupported */
      if (pop) {
        return this.pop();
      }
      if (set) {
        return this.set(...set);
      }
      if (spliceOut) {
        return spliceOutWithDelete ? this.delete(spliceOut) : this.set(spliceOut, undefined);
      }
      /* istanbul ignore next: no change requested */
      return this;
    },
  };
}

/**
 * @function module:natural-lenses#polyfillImmutable
 * @summary Add lensing support methods to an Immutable type
 * @see {@link Container}
 * @param {Function} containerType  Target container type for support
 *
 * @description
 * Adds mixin methods for supporting lenses to the given Immutable container
 * type, to implement {@link Container}.
 */
function polyfillImmutable(containerType) {
  const isList = containerType.isList;
  const proto = containerType.prototype,
    mixins = ImmutableMixin({spliceOutWithDelete: !isList});
  Object.getOwnPropertySymbols(mixins).forEach(
    (name) => {
      if (!proto.hasOwnProperty(name)) {
        Object.defineProperty(proto, name, {
          enumerable: false,
          configurable: true,
          writable: true,
          value: mixins[name],
        });
      }
    }
  );
}

export { polyfillImmutable };
