import LensFactory from './lens_factory.js';
import sugar from './sugar.js';

/**
 * @module natural-lenses/sugar-factory
 *
 * @description
 * Import or require this module to extend the {@link Factory} class with a
 * [string template tag method]{@link Factory#A} for constructing [Lenses]{@link Lens}
 * through the Factory.
 *
 * This module is (if `require`d) or exports as default (if `import`ed) the
 * {@link Factory} class.
 */

/**
 * @function Factory#A
 * @param {...*} args String template tag arguments
 * @returns {Lens} A lens with customized container construction behavior
 * @see module:natural-lenses/sugar
 * @see Factory#lens
 *
 * @description
 * This method is only available if {@link module:natural-lenses/sugar-factory}
 * has been imported/required.
 *
 * The {@link BinderMixin#$} method may be helpful:
 * ```
 * const A = new Factory({...}).$`A`;
 * ```
 *
 * ## Why `A`?
 *
 * `A` is intended to represent "access", and the letter "LATIN CAPITAL LETTER A"
 * (U+0041) is often rendered to look a bit like light rays focusing through a lens.
 */
LensFactory.prototype.A = function(...args) {
  return this.lens(...sugar(...args).keys);
};
