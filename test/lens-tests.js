const lens = require('../lens');
const {assert} = require('chai');

describe('Lens', () => {
  describe('#present()', () => {
    it('should identify an element in an Array', () => {
      const data = [2, 3, 5];
      assert(lens(1).present(data), "expected slot to be present");
    });

    it('should identify an element missing from an Array', () => {
      const data = [2, 3, 5];
      assert(!lens(3).present(data), "expected slot to not be present");
    });

    it('should identify as missing an element of a missing intermediate container', () => {
      assert(!lens('answer', 1).present({}), "expected slot to not be present");
    });

    it('should identify a property in an Object', () => {
      const data = {answer: 42};
      assert(lens('answer').present(data), "expected slot to be present");
    });

    it('should identify a property missing from an Object', () => {
      const data = {answer: 42};
      assert(!lens('question').present(data), "expected slot to not be present");
    });

    it('should safely dig past an undefined value', () => {
      assert(!lens('answer', 2).present({answer: undefined}));
    });

    it('should safely dig past a null value', () => {
      assert(!lens('answer', 2).present({answer: null}));
    });
  });

  describe('#get()', () => {
    it('should fetch element of Array from index', () => {
      const data = [2,3,5];
      assert.equal(lens(1).get(data), data[1]);
    });

    it('should fetch property of Object from name', () => {
      const data = {answer: 42};
      assert.equal(lens('answer').get(data), data.answer);
    });

    it('should fetch deeper property', () => {
      const data = {answer: [2,3,5]};
      assert.equal(lens('answer', 1).get(data), data.answer[1]);
    });

    it('should return undefined for missing property', () => {
      const data = {};
      assert.strictEqual(lens('answer').get(data), undefined);
    });

    it('should safely dig past undefined value', () => {
      const data = {};
      assert.isUndefined(lens('address', 'street').get({address: undefined}));
    });

    it('should safely dig past null value', () => {
      const data = {};
      assert.isUndefined(lens('address', 'street').get({address: null}));
    });
  });

  describe('#get_maybe()', () => {
    it('should return {"just": value} for element in Array', () => {
      const data = [2,3,5];
      assert.deepEqual(lens(1).get_maybe(data), {just: data[1]});
    });
    
    it('should return {} (no "just" property) for empty element of Array', () => {
      const data = new Array(5);
      assert.notProperty(lens(3).get_maybe(data), 'just');
    });

    it('should return {"just": value} for property of Object', () => {
      const data = {answer: 42};
      assert.deepEqual(lens('answer').get_maybe(data), {just: data.answer});
    });

    it('should return {"just": undefined} for element of Array with undefined value', () => {
      const data = [2,3,undefined,5];
      assert.deepEqual(lens(2).get_maybe(data), {just: undefined});
    });

    it('should return {} (no "just" property) for element outside of Array', () => {
      const data = [2,3,5];
      assert.notProperty(lens(3).get_maybe(data), 'just');
    });

    it('should return {} (no "just" property) for property not on an Object', () => {
      const data = {answer: 42};
      assert.notProperty(lens('question').get_maybe(data), 'just');
    });
  });

  describe('#setInClone()', () => {
    it('should assign into an existing element of an Array', () => {
      const data = [2, 3, 4];
      const result = lens(2).setInClone(data, 5);
      assert.notStrictEqual(result, data);
      assert.equal(result[2], 5);
    });

    it('should assign into a missing element of an Array', () => {
      const data = [2, 3, 4];
      const result = lens(4).setInClone(data, 5);
      assert.notStrictEqual(result, data);
      assert.equal(result[4], 5);
    });

    it('should assign into an existing property of an Object', () => {
      const data = {answer: 42};
      const newVal = 'blowing in the wind';
      const result = lens('answer').setInClone(data, newVal);
      assert.notStrictEqual(result, data);
      assert.equal(result.answer, newVal);
    });

    it('should assign into a new property of an Object', () => {
      const data = {};
      const newVal = 42;
      const result = lens('answer').setInClone(data, newVal);
      assert.notStrictEqual(result, data);
      assert.equal(result.answer, newVal);
    });

    it('should assign deeper into a container', () => {
      const data = {question: 'What are the first three primes?', answer: [2,3,4]};
      const result = lens('answer', 2).setInClone(data, 5);
      assert.notStrictEqual(result, data);
      assert.strictEqual(result.question, data.question);
      assert.notStrictEqual(result.answer, data.answer);
      assert.deepEqual(data, {question: 'What are the first three primes?', answer: [2,3,4]});
      assert.deepEqual(result, {question: data.question, answer: [2,3,5]});
    });

    it('should assign a property of a missing intermediate container', () => {
      const data = {name: 'Fred Flintstone'};
      const result = lens('address', 'street').setInClone(data, '345 Cave Stone Rd');
      assert.notStrictEqual(result, data);
      assert.strictEqual(result.name, data.name);
      assert.deepEqual(data, {name: 'Fred Flintstone'});
      assert.deepEqual(result, {name: 'Fred Flintstone', address: {street: '345 Cave Stone Rd'}});
    });

    it('should return the original if the strict-equal-same value is assigned to the slot', () => {
      const data = {question: 'What are the first three primes?', answer: [2,3,5]};
      const result = lens('answer', 2).setInClone(data, 5);
      assert.strictEqual(result, data);
      assert.deepEqual(data, {question: 'What are the first three primes?', answer: [2,3,5]});
    });

    class Uncloneable {}
    it('should raise an error for uncloneable data', () => {
      const data = new Uncloneable();
      assert.throws(() => lens('answer').setInClone(data, 42), /not\s+cloneable/);
    });

    class Cloneable {
      [lens.clone]() {
        return Object.assign(new Cloneable(), this);
      }
    }
    it('should support an explicitly cloneable class', () => {
      const data = Object.assign(new Cloneable(), {answer: 42});
      const newVal = 'What is 6 times 7?';
      const result = lens('question').setInClone(data, newVal);
      assert.equal(result.question, newVal);
      assert.strictEqual(result.answer, data.answer);
      assert.strictEqual(result.constructor, Cloneable);
    });
  });

  describe('#xformInClone()', () => {
    it('should transform an existing slot', () => {
      const data = {question: 'What are the first three primes?', answer: [2,3,4]};
      const result = lens('answer', 2).xformInClone(data, n => n + 1);
      assert.notStrictEqual(result, data);
      assert.strictEqual(result.question, data.question);
      assert.notStrictEqual(result.answer, data.answer);
      assert.deepEqual(data, {question: 'What are the first three primes?', answer: [2,3,4]});
      assert.deepEqual(result, {question: 'What are the first three primes?', answer: [2,3,5]});
    });

    it('should not transform a missing slot', () => {
      const data = {answer: 42};
      const result = lens('question').xformInClone(data, s => s.length);
      assert.strictEqual(result, data);
    });

    it('should transform a missing slot if expressly requested', () => {
      const data = {answer: 42};
      const result = lens('question').xformInClone(data, s => s + '!', {addMissing: true});
      assert.notStrictEqual(result, data);
      assert.deepEqual(data, {answer: 42});
      assert.deepEqual(result, Object.assign({question: undefined + '!'}, data));
    });

    it('should return the original if the strict-equal-same value is the result of the transform callback', () => {
      const data = {question: 'What are the first three primes?', answer: [2,3,5]};
      const result = lens('answer', 2).xformInClone(data, n => 5);
      assert.strictEqual(result, data);
      assert.deepEqual(data, {question: 'What are the first three primes?', answer: [2,3,5]});
    });
  });

  describe('#xformInClone_maybe()', () => {
    it('should transform a {"just": value} of an existing value', () => {
      const data = {question: 'What are the first three primes?', answer: [2,3,4]};
      const result = lens('answer', 2).xformInClone_maybe(data, mv => ({just: mv.just + 1}));
      assert.notStrictEqual(result, data);
      assert.strictEqual(result.question, data.question);
      assert.notStrictEqual(result.answer, data.answer);
      assert.deepEqual(data, {question: 'What are the first three primes?', answer: [2,3,4]});
      assert.deepEqual(result, {question: 'What are the first three primes?', answer: [2,3,5]});
    });

    it('should transform a {} (no "just" property) of a missing value', () => {
      const data = {question: 'What are the first four primes?', answer: [2,3,5]};
      const result = lens('answer', 3).xformInClone_maybe(data, mv => {
        assert.notProperty(mv, 'just');
        return {just: 7};
      });
      assert.notStrictEqual(result, data);
      assert.strictEqual(result.question, data.question);
      assert.notStrictEqual(result.answer, data.answer);
      assert.deepEqual(data, {question: 'What are the first four primes?', answer: [2,3,5]});
      assert.deepEqual(result, {question: 'What are the first four primes?', answer: [2,3,5,7]});
    });

    it('should delete an element from an array when no "just" is returned', () => {
      const data = {question: 'What are the first three primes?', answer: [2,3,5]};
      const result = lens('answer').xformInClone_maybe(data, mv => ({}));
      assert.notStrictEqual(result, data);
      assert.strictEqual(result.question, data.question);
      assert.notStrictEqual(result.answer, data.answer);
      assert.deepEqual(data, {question: 'What are the first three primes?', answer: [2,3,5]});
      assert.deepEqual(result, {question: 'What are the first three primes?'});
    });

    it('should return the input value when no "just" is returned for a missing value', () => {
      const data = {question: 'What are the first three primes?'};
      const result = lens('answer').xformInClone_maybe(data, mv => ({}));
      assert.strictEqual(result, data);
      assert.deepEqual(data, {question: 'What are the first three primes?'});
    });

    it('should return the original if the strict-equal-same value is the result of the transform callback', () => {
      const data = {question: 'What are the first three primes?', answer: [2,3,5]};
      const result = lens('answer', 2).xformInClone_maybe(data, mv => ({just: 5}));
      assert.strictEqual(result, data);
      assert.deepEqual(data, {question: 'What are the first three primes?', answer: [2,3,5]});
    });
  });

  describe('.fuse()', () => {
    it('joins the behavior of Lenses sequentially', () => {
      const secondAnswer = lens.fuse(lens('answer'), lens(2));
      assert.deepEqual(secondAnswer.keys, lens('answer', 2).keys);
      const data = {question: 'What are the first three primes?', answer: [2,3,4]};
      const result = secondAnswer.xformInClone(data, n => n + 1);
      assert.notStrictEqual(result, data);
      assert.strictEqual(result.question, data.question);
      assert.notStrictEqual(result.answer, data.answer);
      assert.deepEqual(data, {question: 'What are the first three primes?', answer: [2,3,4]});
      assert.deepEqual(result, {question: 'What are the first three primes?', answer: [2,3,5]});
    });

    it('joins the behavior of an N-focal to a Lens', () => {
      const arrayizedPerson = lens.fuse(
        lens.nfocal([lens('name'), lens('email')]),
        lens('person')
      );
      const data = {
        person: {name: 'Warren Barber', email: 'valahpu@inuzu.ac', birthdate: '1984-01-01'},
        vehicle: {make: 'Ford', model: 'Fiesta', year: 2011}
      };
      const result = arrayizedPerson.get(data);
      assert.deepEqual(result, [data.person.name, data.person.email]);
    });

    it('joins the behavior of a Lens to an N-focal', () => {
      const vehicleHome = lens.fuse(
        lens('streetAddress', 0),
        lens.nfocal({
          streetAddress: lens('location', 'streetAddress'),
          vehicleMake: lens('vehicle', 'make')}
        )
      );
      const data = {
        person: {name: 'Warren Barber', email: 'valahpu@inuzu.ac', birthdate: '1984-01-01'},
        location: {
          streetAddress: ['1054 Sodhuf Way', 'Apt 17'],
          city: 'Mouhko',
          state: 'NE'
        },
        vehicle: {make: 'Ford', model: 'Fiesta', year: 2011}
      };
      const result = vehicleHome.get(data);
      assert.deepEqual(result, data.location.streetAddress[0]);
    });
  });
});

describe('ArrayNFocal', () => {
  describe('#get()', () => {
    it('pulls multiple values from structured data', () => {
      const L = lens.nfocal([lens('name'), lens('address', 'street', 0)]);
      const data = {
        name: 'Fred Flintstone',
        address: {street: ['345 Cave Stone Rd']}
      };
      assert.deepEqual(L.get(data), [data.name, data.address.street[0]]);
    });
  });

  describe('#get_maybe()', () => {
    it('pulls multiple values from structured data', () => {
      const L = lens.nfocal([lens('name'), lens('address', 'street', 0)]);
      const data = {
        name: 'Fred Flintstone',
        address: {street: ['345 Cave Stone Rd']}
      };
      const result = L.get_maybe(data);
      assert.deepEqual(result, {just: [data.name, data.address.street[0]]});
    });

    it('leaves indexes not found out of the "found" property of the result', () => {
      const L = lens.nfocal([lens('name'), lens('address', 'street', 0)]);
      const data = {
        name: 'Fred Flintstone',
      };
      const result = L.get_maybe(data);
      assert.deepEqual(result, {just: [data.name, undefined]});
      assert.doesNotHaveAllKeys(result.just, [1]);
    });

    it('includes falsey properties present in the input', () => {
      const L = lens.nfocal([lens('name'), lens('address', 'street', 0)]);
      const data = {
        name: 'Fred Flintstone',
        address: {street: [undefined]}
      };
      const result = L.get_maybe(data);
      assert.deepEqual(result, {just: [data.name, undefined]});
      assert.containsAllKeys(result.just, [1]);
    });
  });
});

describe('ObjectNFocal', () => {
  describe('#get_maybe', () => {
    it('pulls multiple values from structured data into an object', () => {
      const L = lens.nfocal({name: lens('name'), mailTo: lens('school', 'address')});
      const data = {
        name: 'Ferris Bueller',
        school: {
          address: '123 Example Way'
        }
      };
      assert.deepEqual(L.get_maybe(data), {just: {name: 'Ferris Bueller', mailTo: '123 Example Way'}});
    });

    it('omits properties not present in the input', () => {
      const L = lens.nfocal({name: lens('name'), mailTo: lens('school', 'address')});
      const data = {
        name: 'Ferris Bueller'
      };
      const result = L.get_maybe(data);
      assert.deepEqual(result, {just: {name: 'Ferris Bueller'}});
    });

    it('includes falsey properties present in the input', () => {
      const L = lens.nfocal({name: lens('name'), mailTo: lens('school', 'address')});
      const data = {
        name: 'Ferris Bueller',
        school: {
          address: undefined
        }
      };
      const result = L.get_maybe(data);
      assert.deepEqual(result, {just: {name: 'Ferris Bueller', mailTo: undefined}});
    });
  });
});
