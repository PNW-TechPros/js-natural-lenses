### The `$` Method

To support higher-order functional programming, this package provides the [`$`]{@link BinderMixin#$} method on optic objects like lenses.  This method accepts a method name (on the optic object) and returns the function of that method bound to the optic object with `Function.bind`, thus removing the "double reference" when binding a JavaScript method to its host object.

```js
const lens = require('natural-lenses');

const secondAnswer = lens('answer', 1).$('get');
```

The `$` method also supports tagged template syntax, so the following is also legal (in ES6) and uses fewer characters:

```js
const lens = require('natural-lenses');

const secondAnswer = lens('answer', 1).$`get`;
```

### The `bound` and `binding` Methods

When the target of a lens is intended to be a method of the object to which it is attached, the {@link Lens#bound} method is helpful to avoid repeated lookup through the whole data structure.  It looks up the target value of the lens and then — if that value is a Function — calls `Function.bind` on that value passing the object from which it was retrieved.  If the slot doesn't refer to a function, the result is the value in the slot.  If the slot does not exist, a no-op function is returned.

{@link Lens#bound} also provides two options for alternate behavior as the second argument: `{or: defaultValue}` and `{orThrow: exceptionValue}`.  In the case of the `or` option and if the slot is not found in the subject, the default value associated with `or` is returned *without any modification* — specifically, `Function.bind` is *not* called.  If the `orThrow` option is given and the slot not exist, the given exception value will be thrown.  `orThrow` takes precedence over `or` if both are specified.

By default {@link Lens#bound} fully binds the target Function it's {@link Lens} identifies to the Object hosting that Function at the time {@link Lens#bound} is called.  Including the `bindNow: false` in the second argument causes the binding to become lazy, and the path from designated by the {@link Lens} not to be evaluated until the returned Function is called.

While {@link Lens#bound} is only available on [Lenses]{@link Lens}, the {@link Optic} base class provides a similar {@link Optic#binding} method.  There are, however, two key differences:
* {@link Optic#binding} defaults to lazy evaluation of the {@link Lens}, where {@link Lens#bound} default to eager evaluation.
* {@link Optic#binding} accepts the name of the method as the first parameter and the target object for binding in the `on` property of the second parameter, where {@link Lens#bound} takes the method name to bind from the last key of the {@link Lens} and binds it to the Object from which it was retrieved.

### The `getIterable` and `xformIterableInClone` Methods

{@link module:natural-lenses} does not provide any direct support for traversal, but instead simplifies accessing a slot expected to contain an *Array* (or other type implementing `Symbol.iterator`).  {@link Optic#getIterable} converts a non-iterable value (including an missing value) to an empty Array.  To use methods like `Array.prototype.map` or `Array.prototype.flatMap`, the iterable result of `getIterable` can be passed to `Array.from`.  The behavior of the `getIterable` call can be altered for the case of a non-iterable value in the slot by passing an option object as the second argument with a `orThrow` property, giving the value to throw if a non-iterable value is found (though not if the slot is missing).

{@link Optic#xformIterableInClone} works similarly for transforming a value expected to be Array-like, calling the passed transform Function on the iterable in the slot or, for non-iterable values (including a missing value), on an empty Array.  As with {@link Optic#getIterable}, the behavior for the case of a present-but-non-iterable value in the slot can be changed by passing options with `orThrow`, which gives the value to be thrown in this case.

These methods *do not* consider strings to be iterable.
