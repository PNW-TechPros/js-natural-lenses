Code using lenses may want to vary actions depending on whether a given slot is present in the input JSON, using the value of the slot if it is present.  This condition of "presence plus the value present" or "no value present" is an instance of the *Maybe monad*.

While JavaScript provides the `undefined` value as a way to indicate lack-of-value in much the way the Maybe monad's Nothing does, the former lacks the ability to nest the indication.  Often, the results of "the location in which I was instructed to look for a value didn't exist" and "the value `undefined` was stored in the location I found" are both indistinguishably `undefined`.  {@link Maybe} solves this problem by being nestable.

This package always represents a value of the Maybe monad as an Object.  The *Just* construction is an Object with a `just` property (test with `'just' in maybeVal`) associated with the contained value, where *Nothing* is just an empty Object.  Methods in this package which represent slot values within subject data embedded in a {@link Maybe} have names suffixed with `_maybe`.

There is one wrinkle here that shows up with Array multifocal lenses: Array multifocals *definitely* return an Array when *getting*, so in a {@link Maybe} monad, they always return `{just: [...]}`; missing elements are represented as *empty* cells of the Array (i.e. `n in maybe_result.just` returns `false` for index `n` of the element that would be *Nothing*).  Care must be used when iterating such an Array, as ES6 `for...of` and some libraries treat all indexes from 0 to `maybe_result.just.length - 1` as present.  [`lens.eachFound`]{@link module:natural-lenses#eachFound} is available for iteration of this kind of sparse Array, where the iterator yields a two-element Array of each found value and the index for the lens which found it in the sparse array.

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

[`lens.eachFound`]{@link module:natural-lenses#eachFound} also has the effect — on {@link Maybe} values not arising from multifocals — of converting to a JavaScript iterable: yielding no items for *Nothing* or the single value of the *Just*, which simplifies coding "do something if the value is present" logic:

```js
const data = {name: "Fred Flintstone", phone: "+15077392058"};
for (let value of lens.eachFound(lens('phone').get_maybe(data))) {
  // Do something with "value"
}
```

However, this same functionality is more conveniently wrapped up in {@link Optic#getting}, with the added ability to take action or compute a value when the slot is absent:

```js
const data = {name: "Fred Flintstone", phone: "+15077392058"};
lens('phone').getting(data, {
  then: value => {
    // Do something with "value"
  },
  else: () => {
    // Do something if not present
  }
});
```

Another way to write the previous example is with the exported [`lens.maybeDo`]{@link module:natural-lenses#maybeDo} function:

```js
const data = {name: "Fred Flintstone", phone: "+15077392058"};
const result = lens.maybeDo(
  lens('phone').get_maybe(data),
  localeFormattedPhoneNumber,
  () => "<none given>" // Optional to pass, default produces undefined
);
```
