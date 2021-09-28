# JavaScript-Native Lenses

Edward Kmett implemented the concept of "lenses" in Haskell as a method of navigating and manipulating nested data types.  The lenses exist separate from the data they access, unlike class identity on JavaScript objects, which makes them ideal for accessing JSON data: JSON just contains the data and does not encode behaviors (a.k.a. methods), and there are no guarantees about what indexes or properties are present as one descends into any particular JSON data.

One of the key aspects of Kmett lenses is their formulation as a single Haskell function, which allows composition of lenses with the Haskell `.` (function composition) operator — though the order of the arguments is reversed from what a Haskell programmer unfamiliar with lenses would expect, and looks like property access notation in JavaScript.  Unfortunately, unlike Haskell, JavaScript does not have a convenient way to compose functions.

Lenses that access and modify JSON have additional problems around partiality and polymorphic updates.  This tends to bring the Maybe monad into play via prisms.  So now we have lack of syntactically easy function composition and the presence of the Maybe monad that are interfering with a straightforward port of Kmett lenses to JavaScript for the purpose of digging into JSON data.  While these obstacles can be overcome, and have been by other packages, the consequence is syntax very unusual to JavaScript.

This package attempts to put a more JavaScript-friendly face on lenses, building around the syntax and native data types supported by the language.

## Basic Lensing

Idiomatically, this package is usually imported under the name `lens`, and this document will use that convention.

The primary purpose of lenses is to drill down into data structures.

```js
const lens = require('natural-lenses');

const data = {answer: [1,2,3]};
console.log(lens('answer', 1).get(data)); // prints  2 (data.answer[1])
const newData = lens('answer', 2).setInClone(data, 4);
console.log(newData); // prints [1,2,4]
```

### Key Points

* Pass as many keys as desired — one per layer of container through which to dig — to `lens` to construct a lens to that slot.
* Strings and numbers are different when used as keys, but only when _setting_, and only if the container itself is not present within _its_ container: a key that is a number will cause an Array to be created, where any other key will cause an Object to be created.
* For *getting*, these optics work pretty well for any JavaScript data that does not require invoking methods along the way.  When *setting* or *transforming*, default lenses only support JSON data; to *set* or *transform* with other data types, use `lens.Factory` with an appropriate container factory to construct the lenses.
* Operations are intended to be immutable, but the library only encourages it and does not demand it.  Values returned by `get` are from the input data and are as mutable as the input data.  Method names commemorate the imposition of immutability by including `InClone`.
* Primary operations with lenses are `get`, `setInClone`, and `xformInClone`.  Some of these have variants that end in `_maybe` — see the description of the Maybe monad below.

## Lens Composition

Lenses can be composed through `lens.fuse`, which takes one or more lenses (or other optics) to fuse and creates either a new, fused lens that behaves as the composition of all the passed lenses (though this can only be done if _only_ lenses are passed) or an OpticArray that functions somewhat like a lens, at least for *getting*.

Lenses constructed through a `lens.Factory` can only be incorporated in an OpticArray, and not directly fused into a single lens.

## Multifocal (N-focal) Lensing

Where a lens can retrieve the value from a single slot within the data, often multiple, dispersed values will need to be extracted; multifocal lensing is the provided solution.

A multifocal lens can be built from either an Array of optics or an Object whose own properties contain optics.  The result of *getting* through a multifocal lens is the same type as passed for constructing the multifocal.

While it is possible to `xformInClone` on a multifocal lens, the operation behaves differently than for basic lenses: the transformations are passed as an iterable of index/transform or key/transform pairs (i.e. 2-element Arrays) instead of passing a single transformation function.  For each transformation element in order as presented by the iterable, the lens associated with the index or key is looked up from the multifocal lens and the transform function is passed to `xformInClone` of that lens; if the index or key is not found in the multifocal's member optic container, no change to the result occurs for that transformation element.

While this difference of call interface might seem to indicate a different name would be better, by using the same `xformInClone` name, the transforms can be chained if a selected member optic of the multifocal is itself a multifocal.

## The Maybe Monad

The code using lenses may want to vary actions depending on whether a given slot is present in the input JSON, using the value of the slot if it is present.  This condition of "presence plus the value present" or "no value present" is an instance of the Maybe monad.

This package always represents a value of the Maybe monad as an Object.  The *Just* construction is an Object with a `just` property (test with `'just' in maybeVal`) associated with the contained value, where *Nothing* is just an empty Object.  Methods returning such values are suffixed with `_maybe` (or `_maybe_fip` as described below).

There is one wrinkle here that shows up with Array multifocal lenses: Array multifocals *definitely* return an Array when *getting*, so in a Maybe monad, they always return `{just: [...]}`; missing elements are represented as *empty* cells of the Array (i.e. `n in theArray` returns `false` for index `n` of the element that would be *Nothing*).  Care must be used when iterating such an Array, as ES6 `for...of` and some libraries treat all indexes from 0 to `theArray.length - 1` as present.  `lens.eachFound` is available for iteration of this kind of sparse Array, where the iterator yields an Array of the found value and the index for the lens which found it for each found value in the sparse array.  `lens.eachFound` also has the effect — on non-sparse array Maybe values — of converting to a JavaScript iterable: yielding no items for *Nothing* or the single value of the *Just*.

## The `lens.Factory`

If non-JSON container types are to be constructed when a lens builds a clone, the relevant lenses must be constructed through a `lens.Factory`.  There are two primary cases for constructing such a factory.

The first is the simpler possibility, where the lens factory can be constructed with an off-the-shelf container factory.  Two such container factories are included: one for ES6 containers (`Array` and `Map`) and one for integrating the "immutable" package containers.  These can be used like:

```js
const lens = require('natural-lenses'), immutable = require('immutable');

const es6lenses = new lens.Factory(new lens.JsContainerFactory());
const es6_result = es6lenses.lens('userInfo', 'address', 'city').set(new Map(), 'Digidapo');
```

The second possibility uses the entire path of keys down to the missing container to determine what kind of object gets constructed.  This requires a custom container factory object:

```js
const lens = require('natural-lenses'), _ = require('underscore');

class SecureAccessToken {
  set password(value) {
    // Store salted & hashed value or value encrypted with public key
  }
}

const requestLenses = new lens.Factory({
  construct(keys) {
    if (_.isEqual(keys, ['accessToken'])) {
      return new SecureAccessToken();
    }
    const k = keys[keys.length - 1];
    return (typeof k === 'number') ? [] : {};
  },
});
const request = requestLenses.lens('accessToken', 'password').set({}, '12345');
```

## Utilities

### The `$` Method

To support higher-order functional programming, this package provides the `$` method on optic objects like lenses.  This method accepts a method name (on the optic object) and returns the function of that method bound to the optic object with `Function.bind`, thus removing the "double reference" when binding a JavaScript method to its host object.

```js
const lens = require('natural-lenses');

const secondAnswer = lens('answer', 1).$('get');
```

The `$` method also supports tagged template syntax, so the following is also legal (in ES6) and uses fewer characters:

```js
const lens = require('natural-lenses');

const secondAnswer = lens('answer', 1).$`get`;
```

### The `bound` Method

When the target of a lens is intended to be a method of the object to which it is attached, the `bound` method is helpful to avoid repeated lookup through the whole data structure.  It looks up the target value of the lens and then — if that value is a Function — calls `Function.bind` on that value passing the object from which it was retrieved.  If the slot doesn't refer to a function, the result is the value in the slot.  If the slot does not exist, a no-op function is returned.

`bound` also provides two options for alternate behavior as the second argument: `{or: defaultValue}` and `{orThrow: exceptionValue}`.  In the case of the `or` option and if the slot is not found in the subject, the default value associated with `or` is returned *without any modification* — specifically, `Function.bind` is *not* called.  If the `orThrow` option is given and the slot not exist, the given exception value will be thrown.  `orThrow` takes precedence over `or` if both are specified.
