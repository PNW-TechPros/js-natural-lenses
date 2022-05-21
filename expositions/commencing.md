Idiomatically, this package is usually imported under the name `lens`; these tutorials will use that convention.

The primary purpose of lenses is to drill down into data structures.

```js
const lens = require('natural-lenses');

const data = {answer: [1,2,3]};
console.log(lens('answer', 1).get(data)); // prints  2 (data.answer[1])
const newData = lens('answer', 2).setInClone(data, 4);
console.log(newData); // prints {answer: [1,2,4]}
```

### Key Points

* Pass as many keys as desired — one per layer of container through which to dig — to `lens` to construct a lens to that slot.
* Strings and numbers are different when used as keys, but only when _setting_, and only if the container indexed itself is not present within _its_ container: a key that is a number will cause an Array to be created, where any other key will cause an Object to be created.
* For *getting*, these optics work pretty well for any JavaScript data that does not require invoking methods along the way.  When *setting* or *transforming*, default lenses only support *Plain Ol' Data* (POD); to *set* or *transform* with other data types, use a [`lens.Factory`]{@link Factory} with an appropriate container factory to construct the lenses, or use a [`lens.Step`]{@link Step}.
* Operations are intended to be immutable, but the library only encourages it and does not demand it.  Values returned by {@link Optic#get} are from the input data and are as mutable as the input data.  Method names commemorate the imposition of immutability by including `InClone`.
* Primary operations with lenses are {@link Optic#get}, {@link Optic#setInClone}, and {@link Optic#xformInClone}.  Some of these have variants that end in `_maybe` — see *{@tutorial maybe-monad}*.

### Importing or Requiring the Library

`natural-lenses` behaves slightly differently when it is the target of a CommonJS `require` call than when it is referenced via `import` declaration or call.  When the library is loaded via `require`, the value returned will be the main entry point (for modules providing one) and all named exports will be properties of that returned value.  But when the library is required, the main entry point is the default export and the named exports are ESM-style named exports.

```js
# CommonJS-style load
const cjsLens = require('natural-lenses'), { isLens, maybeDo, Step } = cjsLens;

# ESM-style load
import esmLens, { isLens, maybeDo, Step } from 'natural-lenses';
```

The rationale behind this difference is that CommonJS is often deployed server-side and the `require` call is not too latent, especially after the first usage.  Several functionalities are lazy-loaded through getter properties, reducing the in-memory footprint for applications avoiding those parts of the library.  The ESM is published in the package to allow effective tree-shaking, which has similar benefits for client-side applications; also, because loading an ESM module is an asynchronous operation, the ESM code does not use dynamic loading.

## Lens Composition

Lenses can be composed through [`lens.fuse`]{@link module:natural-lenses#fuse}, which takes one or more lenses (or other optics) to fuse and creates either a new, fused lens that behaves as the composition of all the passed lenses (though this can only be done if _only_ lenses are passed) or an OpticArray which implements most Lens functionality.

Lenses constructed through a {@link Factory} can only be incorporated in an {@link OpticArray}, and not directly fused into a single {@link Lens}.
