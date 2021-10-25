const {List, Map, OrderedMap} = require('immutable');
const lens = require('../lens.js');

lens.polyfillImmutable(List);
lens.polyfillImmutable(Map);
lens.polyfillImmutable(OrderedMap);

const containerFactory = {
  construct(keys) {
    const k = keys[keys.length - 1];
    return (typeof k === 'number') ? new List() : new Map();
  }
}

const lensFactory = new lens.Factory({containerFactory});

Object.assign(module.exports, {
  containerFactory,
  lensFactory,
});
