Sometimes it is convenient for lenses to construct missing non-JSON containers when they build a clone, in which case the container construction has to be specified.  To do this consistently at all levels accessed through a group of related lenses, use a {@link Factory}.  There are two primary cases for constructing such a factory.

The first is the simpler possibility, where the lens factory can be constructed with an off-the-shelf container factory.  Two such container factories are included: one for ES6 containers (`Array` and `Map`) and one for integrating the [immutable]{@link external:immutable} package containers.  Some examples of this usage:

```js
const lens = require('natural-lenses'), immutable = require('immutable'),
  { containerFactory: immutableContainers } = require('natural-lenses/immutable');

const es6lenses = new lens.Factory({
  containerFactory: new lens.JsContainerFactory(),
});
const es6_result = es6lenses.lens('userInfo', 'address', 'city').setInClone(new Map(), 'Digidapo');

const imlenses = new lens.Factory({
  containerFactory: immutableContainers,
});
const im_result = imlenses.lens('userInfo', 'address', 'city').setInClone(new immutable.Map(), 'Digidapo');
```

The second possibility uses the entire path of keys down to the missing container to determine the container class to construct.  This requires a custom container factory object:

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

While the first case handles integration of the container types with the lens system, for the second it is imperative to implement handler methods for the `Symbol`s [`lens.at_maybe`]{@link module:natural-lenses#at_maybe} and [`lens.clone`]{@link module:natural-lenses#clone} on the container types used.
