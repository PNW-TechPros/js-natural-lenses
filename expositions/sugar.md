The basic {@link Lens} construction syntax — requiring each successive indexing key to be written as a JavaScript literal — can be overly verbose and varies strongly from the appearance of standard JavaScript syntax for accessing a slot within a data structure.  {@link module:natural-lenses/sugar} is designed to make lens construction more "fluent" in JavaScript with a tagged string template definition.

```js
const lens = require('natural-lenses'), A = require('natural-lenses/sugar');

# Programmatic lens construction
const l1 = lens('address', 'locality');

# Fluent lens construction using sugar
const l2 = A`$.address.locality`;
const l3 = A`$.nameParts[0].name`;
```

# Template String Syntax

The template string MUST start with `$` — this represents the subject data to which the created lens applies.  Following this, a series of "property access"-like steps may be specified, either `.propName` (where `propName` adheres to JavaScript identifier syntax) or square brackets around a acceptable value.  Acceptable values are single-quoted string literals, double-quoted string literals, unsigned integers, negative integers (using a `+` in front of an integer is *not* supported), and value intercalations.  String literals support JavaScript string escape syntax.

Whitespace in the template string is ignored.

# Intercalated Values

Some lens constructions may occur in loops, passing a different key or set of keys on each iteration.  Additionally, some containers — ES6 Maps, for example — can use any type of value as a key, not just strings and integers.  To support these use cases, {@link module:natural-lenses/sugar} supports intercalating values into the constructed lens with the ES6 string template `${...}` syntax.  The values enclosed in the intercalation *are not converted to strings*; the value is passed directly to the {@link Lens} constructor.

```js
for (const n of [0, 1, 2]) {
  const l3 = A`$.address.street[${n}]`;
  ...
}
```

Consequently, just as with [basic construction of a Lens]{@link module:natural-lenses}, the syntax sugar supports customizating any step in the constructed {@link Lens} by passing a {@link Step} as an intercalated value.

# Explicit Call

The *sugar* functionality has another application: converting strings accepted in configuration files, persisted data, or client requests into lenses for application to data.  There are at least three advantages to using lenses for this purpose:

* The syntax allowed in the string template is very limited: only JavaScript identifier names, string keys, and unsigned or negative integer keys.
* The resulting value only holds a decoded version of the string, allowing validation of the keys before application.
* The manipulations possible through a lens always create a copy, leaving the original data untouched; this mitigates prototype pollution attacks.

Explicit calls to the sugar function are simply an unwinding of the template call, using a single template part:

```js
var makeUserTargetLens = itemPath => A([itemPath]);
```

It is also possible to manually pass multiple template parts with intercalated values; please reference how ES6 interpreters call string template tagging functions.

# Factory Sugar

Tagged template construction for lenses is available even where consistently applied [non-POD]{@tutorial lens-factories} containers are desired.  Though the {@link Factory} available directly from {@link module:natural-lenses} does not inherently support tagged template construction, it *is* available through {@link module:natural-lenses/sugar-factory}.

```js
const lens = require('natural-lenses'),
  LensFactory = require('natural-lenses/sugar-factory');

const A = new LensFactory({
  containerFactory: new lens.JsContainerFactory(),
}).$`A`;
const es6_result = A`$.userInfo.address.city`.setInClone(new Map(), 'Digidapo');
```

# Parser Cache

No matter how well a JavaScript interpreter can JIT-compile and optimize it, parsing a string is complicated process riddled with CPU-unfriendly conditional statements.  If a string template for a lens were used in a frequently-called function or — worse — a tight loop, this could have serious efficiency impacts.  To mitigate this problem, {@link module:natural-lenses/sugar} caches template parses with an LRU cache.  While this cache is initialized with a preset number of cache slots, {@link module:natural-lenses/sugar} offers visibility and control to expand that allocation via its [`cache`]{@link module:natural-lenses/sugar#cache} property.

The key for the cache is built from the string parts of the template — the intercalated values are not part of the cache at all.  The constructed lenses themselves are *not* cached.

Adjusting the cache size is accomplished with the [cache.addCapacity]{@link Sugar_CacheControl#addCapacity} and the Function it returns.  The call to `addCapacity` adds the specified number of slots to the current cache capacity, and calls to its result adjust that initial allocation.  Calling the `addCapacity` result with `0` or without an argument cancels the allocation.  This functionality is probably best used if profiling indicates large amounts of time spent in the parser.
