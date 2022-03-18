Many applications of JSON take advantage of its strongly hierarchical structure, resulting in JSON documents with layers upon layers of containers.  While lenses can assist in digging into the POD result of parsing the JSON, convenient notation for generating all the lenses necessary for accessing the POD received, all in one centralized location, would be even more helpful.  Better yet if the generated lenses are bound together into a JavaScript structure that is more sensitive to typos than *ad hoc* lens instances.  The solution is the *datum plan*.

A datum plan is to a single piece of data (i.e. a datum) what a building plan is to a building: it specifies *what* is expected to be found *where*.  In the world of `natural-lenses`, a datum plan is constructed from lenses, some of which may be extended with additional members to assist with dictionary-like or array access patterns.  Construction of a datum plan is actually very simple: pass a JSONizable value — the datum plan spec — to the Function imported from `natural-lenses/datum-plan`, and get a datum plan in return.

An important note: a plan only indicates what is *expected* to be present and how it relates to the overall structure.  Just as a building's architectural plan may not call out tables put out in the foyer for receptions, there may be data present in the subject document of which the plan will be blissfully unaware.  And — as the plan is constructed of lenses — even if some structural aspect of the subject document does not conform to the plan, the lens will simply return `undefined` (or `{}` in a {@link Maybe} monad).

### The Datum Plan Spec

```js
const datumPlan = require('natural-lenses/datum-plan');
```

The JSONizable value passed to the datum plan construction function has a few quirks compared to standard JSON-compatible data:

* Arrays should have 0 or 1 elements.  The presence of an Array indicates within the target document structure an Array of zero or more elements having the same structure.  For a "tuple" (where Array elements are given semantics by their position), use an Object with numeric string properties (e.g. `"0"`).
* Objects intended to be used (at least partially) as a dictionary-like collection have a special property name to specify, which is given by `datumPlan.others`.
* When the plan gets to a "leaf node" (the position within the target documents of an item whose structure is not of interest to the datum plan), use `datumPlan.value` to indicate the tip of the access pathway.

The construction function (`datumPlan`) can also accept a Function that returns the POD spec described above.  If such a function is given, it is passed a [DSL]{@link DatumPlan_DSL} object, making generation of the plan spec more concise.

Let's use as an example a partial plan for an NPM `package.json` file:

```js
const $npmPackage = datumPlan(({ VALUE, NAMED_VALUES }) => ({
  name: VALUE,
  version: VALUE,
  author: VALUE,
  contributors: [{
    name: VALUE,
    url: VALUE,
    email: VALUE,
  }],
  dependencies: NAMED_VALUES,
  main: VALUE,
  module: VALUE,
  exports: {
    import: VALUE,
    require: VALUE,
    ...NAMED_VALUES({
      import: VALUE,
      require: VALUE,
    }),
  },
}));

const thePackage = JSON.parse(require('fs').readFileSync(...));
```

### Simple Example

With the code from above, `$npmPackage.name.get(thePackage)` will retrieve the name of `thePackage` from the JSON we've loaded.

### Accessing an Array

When an Array is present in the spec — as with `contributors` — the lens which would `get` the Array receives additional methods from {@link IndexableMixin}: `length(...)`, `at(...)`, `mapInside(...)`, and `flatMapInside(...)`.

#### [`length`]{@link IndexableMixin~length}

Get the length of the `contributors` array with `$npmPackage.contributors.length(thePackage)`.

#### [`at`]{@link IndexableMixin~at}

Use this lens extension to retrieve something from within the targeted Array.  The simplest usage in this case would be `$npmPackage.contributors.at(0)` to retrieve the first element of the contributors.  (Here's a fun note: since `contributors` in a `package.json` may contain elements that are either string or Object, it's convenient that this expression would return whatever value happens to be in the first element of `contributors`, even if it is a string that does not match the plan spec!)

`at` can also dig deeper into the elements of an Array through it's second argument, which can fuse another lens to the one accessing the Array.  The second argument can take two forms: it can be a lens or it can be a Function returning a lens.  If it is a Function and the spec provided a sub-spec for the Array's elements, the Function will receive as it's only argument.  We can, therefore, get the name of the first `contributor` element with `$npmPackage.contributors.at(0, ctbtr => ctbtr.name)`.  It would also work to do this with `$npmPackage.contributors.at(0, lens('name'))`.

If `at` is given a negative index, the returned lens references an element counted from the end of the subject Array it is given, with `-1` indexing the last element of the Array.

#### [`mapInside`]{@link IndexableMixin~mapInside}

When you need to clone the subject with a transform applied to an Array from the datum plan spec, look to the `mapInside` method.  Like `at` it has three forms: a simple one that maps the elements themselves, one that takes a lens to transform a slot within each element, and one that take a Function to return a slot to transform within each element.

The simplest call could be used to transform the `contributors` to a list of only strings:

```js
const stringContribPackage = $npmPackage.contributors.mapInside(thePackage,
  (ctbtr, i, $ctbtr) => {
    let val;
    if (val = $ctbtr.name.get(ctbtr)) return val;
    if (val = $ctbtr.email.get(ctbtr)) return val;
    if (val = $ctbtr.url.get(ctbtr)) return val;
    return ctbtr.toString();
  }
);
```

When `mapInside` is called this way, the transform function receives each element of the targeted Array, the element's index within the Array, and the datum plan for the element as indicated in the plan spec we provided.

If we wanted to transform each contributor name to upper case — which is a bit silly, but a good example — we could use the second or third form and reduce the complexity of our transform function:

```js
const capNameContribPackage = $npmPackage.contributors.mapInside(thePackage,
  ctbtr => ctbtr.name,
  name => name && name.toUpperCase ? name.toUpperCase() : name
);
```

The same operation could be written more verbosely and repetetively as:

```js
const capNameContribPackage2 = $npmPackage.contributors.mapInside(thePackage,
  (ctbtr, i, $ctbtr) => $ctbtr.name.xformInClone(
    ctbtr,
    name => name && name.toUpperCase ? name.toUpperCase() : name
  )
);
```

#### [`flatMapInside`]{@link IndexableMixin~flatMapInside}

As `Array.prototype.flatMap` is to `Array.prototype.map`, so is `flatMapInside` to `mapInside`, though `flatMapInside` is a bit more restricted in that it always applies its transform over the elements themselves and never a slot within each element.  The transform must return an iterable value.  A third argument may be passed to customize how the values captured from all transforms are reduced to an iterable; this could be used, for example, to output a Set instead of an Array.

One example of using this method would be to eliminate all contributors with no `name` specified (including entries that are just strings):

```js
const noAContribPackage = $npmPackage.contributors.flatMapInside(thePackage,
  (ctbtr, i, $ctbtr) => $ctbtr.name.present(ctbtr) ? [ctbtr] : []
);
```

### Accessing a Dictionary-like Object

An Object in the datum plan spec can specify a key of `datumPlan.others` (or use `...NAMED_VALUES` or `...NAMED_VALUES(plan)` when passing a spec Function) to indicate dictionary-like or partially dictionary-like behavior.  In this case, the lens targeting the corresponding slot in the subject data receives the additional methods `at(...)`, `mapInside(...)`, and `mapAllInside(...)` from {@link EntriesMixin}.

#### [`at`]{@link EntriesMixin~at}

Equivalent to the `at` method for accessing an Array, this method builds a lens to the property of the targeted object.  The same argument patterns are supported as for the lens coming from an Array spec, only substituting a string property name for the integer index.

```js
const requireSlots = [
  $npmPackage.exports.at('.', e => e.require),
  $npmPackage.exports.at('require'),
  $npmPackage.main,
];
function getRequireTarget(thePackage) {
  for (const slot of requireSlots) {
    const val_maybe = slot.get_maybe(thePackage);
    if ('just' in val_maybe) return val_maybe.just;
  }
}
```

```js
const importSlots = [
  $npmPackage.exports.at('.', e => e.import),
  $npmPackage.exports.at('import'),
  $npmPackage.module,
  $npmPackage.main,
];
function getImportTarget(thePackage) {
  for (const slot of importSlots) {
    const val_maybe = slot.get_maybe(thePackage);
    if ('just' in val_maybe) return val_maybe.just;
  }
}
```

#### [`mapInside`]{@link EntriesMixin~mapInside}

This method is mostly equivalent to the `mapInside` method added to lenses spec'ed from Arrays, except:
* The callbacks receive a string property name/key instead of an integer index.
* Any explicitly spec'ed property names will *not* be iterated (as they may have a different intended plan).

`mapInside` will only iterate over own-properties of the target object.

#### [`mapAllInside`]{@link EntriesMixin~mapAllInside}

This method is just like `mapInside`, except it iterates *all* own-properties without regard for whether they were spec'ed explicitly.
