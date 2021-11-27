# JavaScript-Native Lenses

* Safely retrieve values from deep in JSON data or complex JavaScript data structures
* Produce an altered clone of JSON or other data, reusing every unchanged branch of the subject tree
* Build views into complex data

While retrieving or setting a property of an `Object` in JavaScript is trivially easy to code, when the data structure is more complex than a single `Object` or single `Array`, the code gets trickier: each level of retrieval has to check that the container it is accessing actually exists in the subject data and, when setting, has to ensure that a container exists at each level on the way down to the slot to be set.  Further complications arise when treating the data as immutable: each container to be "changed" must be cloned and the appropriate change made in the fresh clone returned.

Lenses address these problems by codifying the concept of "slots" within a data structure as objects separate from the data structure, but knowing how to operate upon it.  They have a strong theoretical background and there are many ways to modify, combine, and use them.

## Inspiration

Edward Kmett implemented the concept of "lenses" in Haskell as a method of navigating and manipulating nested data types.  The lenses exist separate from the data they access, unlike methods on JavaScript objects associated with class identity, which makes them ideal for accessing JSON data: JSON just contains the data and does not encode behaviors (a.k.a. methods), and there are no guarantees about what indexes or properties are present as one descends into any particular JSON data.

One of the key aspects of Kmett lenses is their formulation as a single Haskell function (the van Laarhoven formulation), which allows composition of lenses with the Haskell `.` (function composition) operator — though the order of application is reversed from what a Haskell programmer unfamiliar with lenses would expect, and looks like property access notation in JavaScript.  Unfortunately, unlike Haskell, JavaScript does not have a convenient way to compose functions.

Lenses that access and modify JSON have additional problems around partiality and polymorphic updates.  This tends to bring the Maybe monad into play via prisms.  So now we have lack of syntactically easy function composition and the presence of the Maybe monad that are interfering with a straightforward port of Kmett lenses to JavaScript for the purpose of digging into JSON data.  While these obstacles can be overcome, and have been by other packages, the consequent syntax is awkward and very foreign to JavaScript.

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

Where a lens can retrieve the value from a single slot within the data, often multiple, dispersed values will need to be extracted; multifocal lensing addresses this problem.

A multifocal lens can be built from either an Array of optics or an Object whose own properties contain optics.  The result of *getting* through a multifocal lens is the same type as passed for constructing the multifocal.

While it is possible to `xformInClone` on a multifocal lens, the operation behaves differently than for basic lenses: the transformations are passed as an iterable of index/transform or key/transform pairs (i.e. 2-element Arrays) instead of passing a single transformation function.  For each transformation element in order as presented by the iterable, the lens associated with the index or key is looked up from the multifocal lens and the transform function is passed to `xformInClone` of that lens; if the index or key is not found in the multifocal's member optic container, no change to the result occurs for that transformation element.

While this difference of call interface might seem to indicate a different name would be better, by using the same `xformInClone` name, the transforms can be chained if a selected member optic of the multifocal is itself a multifocal.

## The Maybe Monad

The code using lenses may want to vary actions depending on whether a given slot is present in the input JSON, using the value of the slot if it is present.  This condition of "presence plus the value present" or "no value present" is an instance of the Maybe monad.

This package always represents a value of the Maybe monad as an Object.  The *Just* construction is an Object with a `just` property (test with `'just' in maybeVal`) associated with the contained value, where *Nothing* is just an empty Object.  Methods operating with such values are suffixed with `_maybe`.

There is one wrinkle here that shows up with Array multifocal lenses: Array multifocals *definitely* return an Array when *getting*, so in a Maybe monad, they always return `{just: [...]}`; missing elements are represented as *empty* cells of the Array (i.e. `n in maybe_result.just` returns `false` for index `n` of the element that would be *Nothing*).  Care must be used when iterating such an Array, as ES6 `for...of` and some libraries treat all indexes from 0 to `maybe_result.just.length - 1` as present.  `lens.eachFound` is available for iteration of this kind of sparse Array, where the iterator yields a two-element Array of each found value and the index for the lens which found it in the sparse array.

```js
const lens = require('natural-lenses');
const data = {name: "Fred Flintstone", phone: "+15077392058"};

const arrayNfocal = lens.nfocal([lens('name'), lens('phone')]);
for (let [value, index] of lens.eachFound(arrayNfocal.get_maybe(data))) {
  console.log({[index]: value});
  // Will log:
  //   {'0': 'Fred Flintstone'}
  //   {'1': '+15077392058'}
}

const objectNfocal = lens.nfocal({nombre: lens('name'), "teléfono": lens('phone')});
for (let [value, key] of lens.eachFound(objectNfocal.get_maybe(data))) {
  console.log({[key]: value});
  // Will log (though order may differ):
  //   {'nombre': 'Fred Flintstone'}
  //   {'teléfono': '+15077392058'}
}
```

`lens.eachFound` also has the effect — on Maybe values not arising from multifocals — of converting to a JavaScript iterable: yielding no items for *Nothing* or the single value of the *Just*, which simplifies coding "do something if the value is present" logic:

```js
const data = {name: "Fred Flintstone", phone: "+15077392058"};
for (let value of lens.eachFound(lens('phone').get_maybe(data))) {
  // Do something with "value"
}
```

However, this same functionality is more conveniently wrapped up in the `ifFound` method of the Lens:

```js
const data = {name: "Fred Flintstone", phone: "+15077392058"};
for (let value of lens('phone').ifFound(data)) {
  // Do something with "value"
}
```

A third alternative allows computation based on whether the value is *Just* or *Nothing*:

```js
const data = {name: "Fred Flintstone", phone: "+15077392058"};
const result = lens.maybeDo(
  lens('phone').get_maybe(data),
  localeFormattedPhoneNumber,
  () => "<none given>" // Optional to pass, default produces undefined
);
```

## The `lens.Factory`

Sometimes it is convenient for lenses to construct missing non-JSON containers when they build a clone, in which case the container construction has to be specified.  To do this consistently at all levels accessed through a group of related lenses, use a `lens.Factory`.  There are two primary cases for constructing such a factory.

The first is the simpler possibility, where the lens factory can be constructed with an off-the-shelf container factory.  Two such container factories are included: one for ES6 containers (`Array` and `Map`) and one for integrating the "immutable" package containers.  These can be used like:

```js
const lens = require('natural-lenses'), immutable = require('immutable');

const es6lenses = new lens.Factory({
  containerFactory: new lens.JsContainerFactory(),
});
const es6_result = es6lenses.lens('userInfo', 'address', 'city').setInClone(new Map(), 'Digidapo');

const imlenses = new lens.Factory({
  containerFactory: new lens.ImmutableContainerFactory(immutable),
});
const im_result = imlenses.lens('userInfo', 'address', 'city').setInClone(new immutable.Map(), 'Digidapo');
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
  containerFactory: {
    construct(keys) {
      if (_.isEqual(keys, ['accessToken'])) {
        return new SecureAccessToken();
      }
      const k = keys[keys.length - 1];
      return (typeof k === 'number') ? [] : {};
    },
  },
});
const request = requestLenses.lens('accessToken', 'password').set({}, '12345');
```

While the first case handles integration of the container types with the lens system, for the second it is imperative to implement handler methods for the `Symbol`s `lens.at_maybe` and `lens.clone` on the container types used.

## Support for the [Immutable](https://www.npmjs.com/package/immutable) Package

Lenses and efficiently immutable data structures work together synergistically, yet not every application of lenses needs or wants the `immutable` package installed.  To avoid introducing a dependency between this library and the "immutable" package, `natural-lenses` limits its importing from "immutable" to one dangling submodule.  `natural-lenses/immutable` exports two objects, of which the `lensFactory` is the more convenient: it is a `Factory` (from `natural-lenses`) customized with a container factory for `immutable`'s `List` and `Map`.  That container factory is the other export, under the name `containerFactory`, which can be used in constructing a `lens.Factory`.

The `natural-lenses/immutable` submodule also has a side-effect of polyfilling support for lenses into `immutable` types.  Though `immutable`'s `List`, `Map`, and `OrderedMap` classes share many interface semantics with ES6 container types, they are not identical, and two specific behaviors have to be defined for the container types to work with lenses (both named by `Symbol`s): `lens.at_maybe` and `lens.clone`.  The first implements the behavior for returning a Maybe monad value for the given key/index, and the second implements cloning with potential modifications of `set` or `spliceOut`.  Because the methods are named with `Symbol`s defined by this package, this polyfill should not interfere with application code or any other libraries in use.

Importing `natural-lenses/immutable` also has the side-effect of polyfilling `Lens` with a `getSeq` method that constructs a `Seq` (from the `immutable` package) from the non-`String` iterable in the `Lens`'s target slot (or from an empty array if the slot's contents are a `String` or not iterable).

Even if no modified clones are to be created, the `lens.at_maybe` must be defined for immutable container types to participate in lens *getting*, so it may be beneficial to run `lens.polyfillImmutable` on all `immutable` types that might be present in data to be queried with lenses.

Because this library _does not_ declare a dependency on `immutable`, it is the responsibility of the including project to declare it's own dependency on both that package and this one if both are to be used.

## Customized Access with `lens.Step`

The second alternative for constructing non-JSON containers is to specify a `lens.Step` object as a step (i.e. key) when constructing a Lens.  Construction of a `lens.Step` requires three Functions:

1. A function to retrieve the Maybe value on the "down" side of the step: it should return `{}` if the value is not present or `{just: value}` if the value is present (as described in the *Maybe Monad* section above).
2. A function to create and return a clone of the container (first argument) with a specified change (second argument), either:
    * `{just: newValue}` indicating a `newValue` to give this slot in the clone, or
    * `{}` indicating that the slot should not be present in the clone.
3. A function to construct the container in an empty state (no arguments given)

While passing `null` for one or more of these won't cause an error immediately, it will cause errors if the Lens is used for for certain operations:

| Argument to `lens.Step` Constructor | Missing Function | Operations that Fail |
| --------: | :-------- | : ------------------------------------------ |
| first | `get_maybe` | Retrieving or transforming any value, which also prevents any additional steps in the Lens |
| second | `updatedClone` | Setting any item (even in a container that doesn't exist) |
| third | `construct` | Setting an item in a container that doesn't exist in the input; `xformInClone` with `addMissing` and `xformInClone_maybe` if the container is missing from the subject |

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

### The `getIterable` and `xformArrayInClone` Methods

`natural-lenses` does not provide any direct support for traversal, but instead simplifies accessing a slot expected to contain an *Array*.  `getIterable` (available on on lenses but not on other optics) converts a non-iterable value (including an missing value) to an empty Array.  To use methods like `Array.prototype.map` or `Array.prototype.flatMap`, the iterable result of `getIterable` can be passed to `Array.from`.

`xformArrayInClone` works similarly for transforming a value expected to be Array-like, 
