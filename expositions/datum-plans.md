Many applications of JSON take advantage of its strongly hierarchical structure, resulting in JSON documents with layers upon layers of containers.  A {@link Lens} can help consistently read or "write" a single slot in such a data structure, but what really helps a development team is an easily written, easily readable way to lay out the anticipated structure of a JSON document (or other complex data structure) giving access to all the needed lenses.  Better yet, this structure can be sensitive to typos in a way that exceeds both *ad hoc* lenses and vanilla JavaScript.  `natural-lenses` calls this structure of Lenses a *datum plan*.

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

The construction function (`datumPlan`) can also accept a Function that returns the POD spec described above.  If such a function is given, it is passed a [DSL]{@link DatumPlan_Dsl} object, making generation of the plan spec more concise.

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
}), { planGroup: "package.json" });

const thePackage = JSON.parse(require('fs').readFileSync(...));
```

### Simple Example

With the code from above, `$npmPackage.name.get(thePackage)` will retrieve the name of `thePackage` from the JSON we've loaded.

### Spec'ing Special Properties

If there is some reason to create a datum plan where the spec'd property name happens to be a special-case property name for datum plan construction (any string consisting of doubled parentheses with one or more lowercase letters between, like `((others))`), such a property can be included in the datum plan via `datumPlan.raw` or `RAW` in the DSL.  The value of this key is an Object with names that are never treated as special-case but otherwise treated as part of the spec Object containing the `datumPlan.raw`/`RAW` key.

```js
const plan = datumPlan(({ VALUE, RAW }) => ({
  [RAW]: {
    "((zyx))": {
      name: VALUE,
    },
  },
}));
```

This feature should not typically be needed.

### Accessing an Array

When an Array is present in the spec — as with `$npmPackage.contributors` — the lens which would `get` the Array receives additional methods from {@link IndexableMixin}: `length(...)`, `at(...)`, `mapInside(...)`, and `flatMapInside(...)`.  Additionally, if an item spec was given for the Array (that is, a sub-spec as the single element of the Array in the spec), the datum plan for the item is stored on the generated {@link Lens}'s property `$item` -- `$npmPackage.contributors.$item` in the example case.

#### [`length`]{@link IndexableMixin~length}

Get the length of the `contributors` array with `$npmPackage.contributors.length(thePackage)`.

#### [`at`]{@link IndexableMixin~at}

Use this lens extension to retrieve something from within the targeted Array.  The simplest usage in this case would be `$npmPackage.contributors.at(0)` to retrieve the first element of the contributors.  (Here's a fun note: since `contributors` in a `package.json` may contain elements that are either string or Object, it's convenient that this expression builds a {@link Lens} to access whatever value happens to be in the first element of `contributors`, even if it is a string that does not match the plan spec!)

`at` can also construct lenses that dig deeper into the elements of an Array through it's second argument, which can fuse another lens to the one accessing the Array.  The second argument can take two forms: it can be an {@link Optic} or it can be a Function returning an {@link Optic}.  If it is a Function and the spec provided a sub-spec for the Array's elements, the Function will receive the item plan built from the sub-spec as it's only argument.  We can, therefore, build a lens to the name of the first `contributor` element with `$npmPackage.contributors.at(0, ctbtr => ctbtr.name)`.  It would also work to do this with `$npmPackage.contributors.at(0, lens('name'))`.

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

An Object in the datum plan spec can specify a key of `datumPlan.others` (or use `...NAMED_VALUES` or `...NAMED_VALUES(spec)` when passing a spec Function) to indicate dictionary-like or partially dictionary-like behavior.  In this case, the lens targeting the corresponding slot in the subject data receives the additional methods `at(...)`, `mapInside(...)`, and `mapAllInside(...)` from {@link EntriesMixin}.  If a spec was given for the named entries, the datum plan generated from that sub-spec is assigned to the `$entryValue` property of the resulting {@link Lens}.

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

### Name Deconfliction

The data modeled with a datum plan may have property names that conflict with the properties and/or methods critical to the operation of the {@link Lens}.  Any such spec'd properties will have underscores added as a prefix until the resulting property name does not conflict with existing names on the {@link Lens}.  Non-conflicting properties always have top priority.  Any spec'd property name defined in both plain form and in `datumPlan.raw`/`RAW` will use the definition in `datumPlan.raw`.  Let's consider this plan:

```js
const plan = datumPlan(({ VALUE, RAW }) => ({
  name: VALUE,
  keys: [],
  _keys: [],
  [RAW]: {
    name: {first: VALUE, last: VALUE},
  },
}));
```

* `plan.name` will use the definition under `RAW`, with `first` and `last` properties.
* `plan._keys` is a {@link Lens} with keys `['_keys']` (i.e. the definition spec'd for `_keys` is used).  Because it does not conflict with any normal {@link Lens} property, it has priority for the `_keys` property.
* `plan.__keys` is a {@link Lens} with keys `['keys']`.  `keys` is a critical property for all [Lenses]{@link Lens} and `_keys` was already claimed by a non-conflicting property.

### Plans from Plain Ol' Data (POD) Values

In many places, JavaScript data comes down to Arrays, Objects, and scalar values (numbers, Boolean values, null, and strings).  All of these data types are conveniently serializable to JSON.  Such values are frequently used — as with Redux — to store complex state.  A particular instance of a POD value having approximately the datum shape desired for a datum plan is often available, perhaps as an initial value.  However, the initial, POD value may not be as detailed as desired or it may contain information that creates ambiguity when generating a datum plan.  And the actual initial value will not have the special datum plan terminal value marker (currently `"$"`) but will instead use arbitrary scalar values.

For cases like these, this package provides `datumPlan.fromPOD()`, a function that solves all three problems:

* Ambiguous or missing item spec in an Array not of length 1.
* Missing specification for omitted keys.
* Liberally accepting any scalar value as terminating a lensing branch.

```js
// Borrowed from https://redux.js.org/tutorials/fundamentals/part-3-state-actions-reducers#designing-the-state-structure
const todoAppInitialState = {
  todos: [
    { id: 0, text: 'Learn React', completed: true },
    { id: 1, text: 'Learn Redux', completed: false, color: 'purple' },
    { id: 2, text: 'Build something fun!', completed: false, color: 'blue' }
  ],
  filters: {
    status: 'Active',
    colors: ['red', 'blue']
  }
};

const plan = datumPlan.fromPOD(todoAppInitialState, {
  tweaks: (({ access, VALUE }) => [
    access.ITEMS('todos').plan({
      id: VALUE,
      text: VALUE,
      completed: VALUE,
      color: VALUE,
    }),
    access.ITEMS('filters', 'colors'),
  ]),
});
```

The two `access.ITEMS` tweaks are necessary because, in both cases, the Arrays have more than one element, creating the potential for ambiguous structure among the Array items.

This is equivalent to building the following datum plan:

```js
const equivPlan = datumPlan(({ VALUE } => ({
  todos: [{
    id: VALUE,
    text: VALUE,
    completed: VALUE,
    color: VALUE,
  }],
  filters: {
    status: VALUE,
    colors: [VALUE],
  },
})));
```

But building the datum plan the "equivalent way" requires duplicating a lot of data, and changes to `todoAppInitialState` might not always be mirrored to `equivPlan`.  Conversely, using `datumPlan.fromPOD()` only requires additionally specifying tweaks to resolve ambiguities, and any changes to `todoAppInitialState` introducing new ambiguities will throw errors.

### Troubleshooting

*This feature only works in interpreters providing the ES6 `Proxy` class.*

Datum plans, like other complex JavaScript values, suffer from JavaScript's lenient approach to access of undefined properties.  The `undefined` value can creep in at some point and not be detected until much later when it is difficult to determine which access failed unexpectedly.  To combat this, a `planGroup` option naming the plan group may be specified when the datum plan is constructed and this same group name specified as one of the comma-separated group names in the `DATUM_PLAN_GUARDS` environment variable.  Alternatively, the plan group name can be programmatically added to the guarded groups *prior* to constructing the datum plan:

```js
datumPlan.guardedGroups.add('SimpleRecord');
const plan = datumPlan(({ VALUE }) => ({
  name: VALUE,
}), { planGroup: 'SimpleRecord' });

plan.address; // This will not raise any errors
plan.address.get; // This will raise UndefinedPropertyError: No such property 'address' on trivial Lens among properties "keys", "name"
```

One of the nicest aspects about the error reporting is that the code location where the undefined property is accessed is captured and is the location reported when any property of the "tripwire" value is accessed.  In the example above it does not matter, but if it were instead:

```js
function getBadLens() {
  return plan.address;
}

getBadLens().get({});
```

the error would reference the line `return plan.address;`, not `getBadLens().get({});`.  The latter line doesn't really help understand where the error occurred, but the former points out directly where the non-existent property of the plan was accessed.  Here is some sample output from an interactive `node` session:

```plain
UndefinedPropertyError: No such property 'address' on trivial Lens among properties "keys", "name"
    at .../natural-lenses/cjs/datum_plan.js:1:38361
    at Object.GuardedLensHandlers.get (.../natural-lenses/cjs/datum_plan.js:1:38478)
    at getBadLens (REPL32:2:13) {
  lensKeys: [],
  missingProperty: 'address'
}
```

The availability of this troubleshooting feature comes with some recommended practices when using datum plan lenses:

- Prefer `'prop' in obj` to `obj.prop === undefined` or `typeof obj.prop === 'undefined'`; the latter two expressions change from `true` to `false` when guard proxies are activated.
- If getting `undefined` for a missing property on a datum plan lens is desirable, use `lens('prop').get(obj)`: lens _does_ an `in` test and returns `undefined` if it fails, producing the intuitive result.
- `Lens#get_maybe` works on guarded datum plan lenses, if a {@link Maybe} context for the Lens's property is desired.
