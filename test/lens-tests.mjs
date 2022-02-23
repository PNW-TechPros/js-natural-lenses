// import lens, * as lensUtils from '../index.mjs';
import lens, * as lensUtils from '#this';
import { lensFactory as immutableLensFactory } from '../esm/immutable.js';
import { assert } from 'chai';
import immutable from 'immutable';

function xxdescribe() {}

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
    
    it('should chain "get" via tail', () => {
      const lenses = [lens('answer')];
      const data = {answer: [2, 3, 5]};
      assert.strictEqual(lens(0).get(lenses, data), data.answer);
    });
    
    it('should fail chained "get" because of non-lens to undefined result', () => {
      const lenses = [lens('answer')];
      const data = {answer: [2, 3, 5]};
      assert.isUndefined(lens(1).get(lenses, data));
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
    
    it('should access a property of an Array if given a non-number step', () => {
      const data = [2,3,5];
      assert.deepEqual(lens('length').get_maybe(data), {just: 3});
    });
    
    it('should recognize a non-property of an Array if given a non-number step', () => {
      const data = [2,3,5];
      assert.notProperty(lens('question').get_maybe(data), 'just');
    });
    
    it('accesses from the end of an Array if given negative numeric index', () => {
      const data = [2,3,5];
      assert.deepEqual(lens(-1).get_maybe(data), {just: 5});
    });
    
    it('correctly evaluates for items in a Map', () => {
      const o = {}, data = new Map([
        ['theObject', o],
      ]);
      assert.strictEqual(lens('theObject').get_maybe(data).just, o);
    });
    
    it('correctly evaluates for items not in a Map', () => {
      const o = {}, data = new Map([
        ['theObject', o],
      ]);
      assert.notProperty(lens('somethingElse').get_maybe(data), 'just');
    })
    
    it('should chain "get_maybe" via tail', () => {
      const lenses = [lens('answer')];
      const data = {answer: [2, 3, 5]};
      const result = lens(0).get_maybe(lenses, data);
      assert.property(result, 'just');
      assert.strictEqual(result.just, data.answer);
    });
    
    it('should fail chained "get" because of non-lens to undefined result', () => {
      const lenses = [lens('answer'), null];
      const data = {answer: [2, 3, 5]};
      assert.notProperty(lens(1).get_maybe(lenses, data), 'just');
    });
  });
  
  describe('#getIterable', () => {
    it('should fetch Array from slot', () => {
      const data = {primes: [2,3,5]};
      assert.strictEqual(lens('primes').getIterable(data), data.primes);
    });
    
    it('should fetch an empty Array from a nonexistent slot', () => {
      assert.deepEqual(lens('primes').getIterable({}), []);
    });
    
    it('should default to returning an empty Array for noniterable in slot', () => {
      assert.deepEqual(lens('primes').getIterable({primes: 6}), []);
    });
    
    it('should throw the given Error for noniterable in slot', () => {
      const niError = new Error('non-iterable value');
      assert.throws(() => {
        lens('primes').getIterable({primes: 6}, {orThrow: niError});
      }, niError);
    });
    
    it('should return empty Array for nonexistent slot even if orThrow specified', () => {
      const niError = new Error('non-iterable value');
      assert.deepEqual(lens('primes').getIterable({}, {orThrow: niError}), []);
    });
    
    it('should treat a string as noniterable', () => {
      assert.deepEqual(lens('primes').getIterable({primes: 'Aqasix'}), []);
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

    class Uncloneable {
      constructor() {
        if (arguments.length < 1) {
          throw new Error("Cannot construct without at least one argument!");
        }
      }
    }
    it('should raise an error for uncloneable data', () => {
      const data = new Uncloneable(0);
      assert.throws(() => lens('answer').setInClone(data, 42), /requires\s+arguments/);
    });

    class Cloneable {}
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
    
    it('should transform a slot within a missing container if expressly requested', () => {
      const data = {question: "What are the first three primes?"};
      const { answer, ...otherResult } = lens('answer', 1).xformInClone(data, s => 3, {addMissing: true});
      assert.deepEqual(otherResult, data);
      assert.notProperty(answer, 0);
      assert.strictEqual(answer[1], 3);
      assert.strictEqual(answer.length, 2);
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
    
    it('should transform a {} of a missing slot within a missing container', () => {
      const data = {question: 'What are the first four primes?'};
      const result = lens('answer', 1).xformInClone_maybe(data, mv => {
        assert.notProperty(mv, 'just');
        return {just: 3};
      });
      assert.notStrictEqual(result, data);
      assert.strictEqual(result.question, data.question);
      assert.notStrictEqual(result.answer, data.answer);
      assert.notProperty(result.answer, 0);
      assert.strictEqual(result.answer[1], 3);
      assert.strictEqual(result.answer.length, 2);
      // assert.deepEqual(data, {question: 'What are the first four primes?', answer: [2,3,5]});
      // assert.deepEqual(result, {question: 'What are the first four primes?', answer: [2,3,5,7]});
    });

    it('should delete an element from an array when no "just" is returned', () => {
      const data = {question: 'What are the first three primes?', answer: [2,3,5,7]};
      const result = lens('answer', 3).xformInClone_maybe(data, mv => ({}));
      assert.notStrictEqual(result, data);
      assert.strictEqual(result.question, data.question);
      assert.notStrictEqual(result.answer, data.answer);
      assert.deepEqual(data, {question: 'What are the first three primes?', answer: [2,3,5,7]});
      assert.deepEqual(result, {question: 'What are the first three primes?', answer: [2,3,5]});
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
    
    it('should delete a property from the clone of an Object when no "just" is returned', () => {
      const data = {question: 'What are the first three primes?', answer: [2,3,5]};
      const result = lens('answer').xformInClone_maybe(data, mv => ({}));
      assert.notStrictEqual(result, data);
      assert.strictEqual(result.question, data.question);
      assert.notStrictEqual(result.answer, data.answer);
      assert.deepEqual(data, {question: 'What are the first three primes?', answer: [2,3,5]});
      assert.deepEqual(result, {question: 'What are the first three primes?'});
    });
    
    it('should return the original if transforming Nothing to Nothing', () => {
      const data = {question: 'What are the first three primes?', answer: [2,3,5]};
      const result = lens('answer', 3).xformInClone_maybe(data, mv => ({}));
      assert.strictEqual(result, data);
      assert.deepEqual(data, {question: 'What are the first three primes?', answer: [2,3,5]});
    });
    
    it('should not alter an Object when transforming a non-own property', () => {
      const data = {question: 'What are the first three primes?', answer: [2,3,5]};
      const result = lens('toString').xformInClone_maybe(data, mv => ({}));
      assert.strictEqual(result, data);
      assert.deepEqual(data, {question: 'What are the first three primes?', answer: [2,3,5]});
    });
    
    it('should leave an empty slot in an Array if transforming to Nothing', () => {
      const data = [2,3,5];
      const result = lens(-2).xformInClone_maybe(data, mv => ({}));
      assert.notProperty(result, 1);
    });
    
    it('should not alter an Array if the deleted slot is out of bounds', () => {
      const data = lens(-2).xformInClone_maybe([2,3,5], mv => ({}));;
      const result = lens(-2).xformInClone_maybe(data, mv => ({}));
      assert.strictEqual(result, data);
    });
    
    it('should not alter a Map if an entry is returned unchanged', () => {
      const data = new Map([
        ['answer', 42],
      ]);
      const result = lens('answer').xformInClone_maybe(data, x => x);
      assert.strictEqual(result, data);
    });
    
    it('can set an item in a clone of a Map', () => {
      const data = new Map([
        ['answer', 42],
      ]);
      const result = lens('answer').xformInClone_maybe(data, () => ({just: 48}));
      assert.notStrictEqual(result, data);
      assert.strictEqual(result.get('answer'), 48);
      assert.deepEqual(result.keys(), data.keys());
    });
    
    it('can delete an item from the clone of a Map', () => {
      const data = new Map([
        ['answer', 42],
      ]);
      const result = lens('answer').xformInClone_maybe(data, () => ({}));
      assert.notStrictEqual(result, data);
      assert.deepEqual(Array.from(result.keys()), []);
    });
    
    it('returns the original subject when deleting a empty element from an Array', () => {
      const data = new Array(3);
      data[1] = 2;
      data[2] = 3;
      assert.notProperty(data, 0);
      const result = lens(0).xformInClone_maybe(data, () => ({}));
      assert.strictEqual(result, data);
    });
    
    it('returns the original subject when deleting an out-of-bounds element from an Array', () => {
      const data = new Array(3);
      data[1] = 2;
      data[2] = 3;
      assert.notProperty(data, 0);
      const result = lens(-10).xformInClone_maybe(data, () => ({}));
      assert.strictEqual(result, data);
    });
  });
  
  describe('#xformIterableInClone()', () => {
    it('should return subject if slot value returned', () => {
      const data = {primes: [2,3,5]};
      assert.strictEqual(lens('primes').xformIterableInClone(data, x => x), data);
    });
    
    it('should input an empty Array to fn if slot is missing', () => {
      lens('primes').xformIterableInClone({}, x => {
        assert.deepEqual(x, []);
        return x;
      })
    });
    
    it('should log if output of fn is not an Array', () => {
      lens('primes').xformIterableInClone({}, x => {
        return 6;
      })
    });
    
    it('should return a modified clone if fn does not return its input', () => {
      const data = {primes: [2,3,5]};
      const result = lens('primes').xformIterableInClone(data, xs => Array.from(xs));
      assert.deepEqual(data, result);
      assert.notStrictEqual(data, result);
    });
    
    it('should return a clone with modified iterable if fn modifies', () => {
      const data = {primes: [2,3,5]};
      const result = lens('primes').xformIterableInClone(data, xs => xs.concat([7]));
      assert.notDeepEqual(data, result);
      assert.deepEqual(result.primes, data.primes.concat([7]));
    });
    
    it('should throw the given Error if the slot contains a noniterable value', () => {
      const data = {primes: 6};
      const niError = new Error('non-iterable value');
      assert.throws(() => lens('primes').xformIterableInClone(data, x => x, {orThrow: niError}), niError);
    });
  });
  
  describe('#$', () => {
    it('should work when called with a string', () => {
      const data = [2,3,5], getter = lens(1).$('get');
      assert.strictEqual(getter(data), data[1]);
    });
    
    it('should work as a tagged template', () => {
      const data = [2,3,5], getter = lens(1).$`get`;
      assert.strictEqual(getter(data), data[1]);
    });
    
    it('should work with tagged template substitution', () => {
      const data = [2,3,5], getter = lens(1).$`g${'e'}t`;
      assert.strictEqual(getter(data), data[1]);
    });
  });
  
  describe('#bound', () => {
    it('should work when the target is present', () => {
      const data = {question: 'What is the air speed of an unladen swallow?'};
      const sliceQuestion = lens('question', 'slice').bound(data);
      assert.strictEqual(sliceQuestion(0, 4), data.question.slice(0, 4));
    });
    
    it('should return a no-op function when the target is not present', () => {
      const data = {question: 'What is the air speed of an unladen swallow?'};
      const spliceQuestion = lens('question', 'splice').bound(data);
      assert.isUndefined(spliceQuestion(0, 4, 'WAT'));
      assert.strictEqual(data.question, 'What is the air speed of an unladen swallow?');
    });
    
    it('should return the given default function when the target is not present', () => {
      const data = {question: 'What is the air speed of an unladen swallow?'};
      const spliceQuestion = lens('question', 'splice').bound(data, {or: () => 'Who'});
      assert.strictEqual(spliceQuestion(0, 4, 'WAT'), 'Who');
    });
    
    it('should throw the given value when the target is not present', () => {
      const data = {question: 'What is the air speed of an unladen swallow?'};
      const mnpError = new Error("Method not present");
      assert.throws(() => lens('question', 'splice').bound(data, {orThrow: mnpError}), mnpError);
    });
  });
  
  describe('#ifFound', () => {
    it('should iterate over exactly the target if present', () => {
      const data = {answer: [2,3,5]};
      assert.deepEqual(Array.from(lens('answer', 1).ifFound(data)), [3]);
    });
    
    it('should iterate over nothing if the target is not present', () => {
      const data = {answer: [2,3,5]};
      assert.deepEqual(Array.from(lens('answer', 15).ifFound(data)), []);
    });
  });

  describe('.fuse()', () => {
    it('joins the behavior of Lenses sequentially', () => {
      const secondAnswer = lensUtils.fuse(lens('answer'), lens(2));
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
      const arrayizedPerson = lensUtils.fuse(
        lensUtils.nfocal([lens('name'), lens('email')]),
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
      const vehicleHome = lensUtils.fuse(
        lens('streetAddress', 0),
        lensUtils.nfocal({
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
  
  describe('#fuse()', () => {
    it("throws if non-Lenses are provided (use .fuse() instead)", () => {
      const Lens = lens(0).constructor;
      assert.throws(
        () => Lens.fuse(lens(0), lensUtils.nfocal([lens(1)])),
        /exactly\s+Lens/
      );
    });
  });
});

describe('CustomStep', () => {
  const elementZeroStep = new lensUtils.Step(
    (c) => ({just: c[0]}),
    (c, v_m) => ('just' in v_m ? [v_m.just] : new Array(1)).concat(c.slice(1)),
    () => []
  );
  
  it("can be used in a 'get' to fetch in an arbitrary way", () => {
    const data = [{v: 2}, {v: 3}, {v: 5}];
    assert.strictEqual(lens(elementZeroStep).get(data), data[0]);
  });
  
  it("can be used in a 'setInClone' to update in an arbitrary way", () => {
    const data = [{v: 1}, {v: 3}, {v: 5}], elt0repl = {v: 2};
    const result = lens(elementZeroStep).setInClone(data, elt0repl);
    assert.deepEqual(data[0], {v: 1});
    assert.notStrictEqual(result, data);
    assert.strictEqual(result[0], elt0repl);
    for (var i of [1, 2]) {
      assert.strictEqual(result[i], data[i]);
    }
  });
  
  it("can be used to construct a missing container", () => {
    const elt0val = {v:2};
    const result = lens('answers', elementZeroStep).setInClone({}, elt0val);
    assert.typeOf(result.answers, 'array', 'Array was constructed');
    assert.strictEqual(result.answers[0], elt0val);
  });
  
  it("can be used to eliminate a slot in an arbitrary way", () => {
    const data = {answers: [{v: 2}, {v: 3}, {v: 5}]};
    const result = lens('answers', elementZeroStep).xformInClone_maybe(
      data,
      () => ({})
    );
    assert.strictEqual(data.answers.length, 3);
    assert.notStrictEqual(result, data);
    assert.notProperty(result.answers, 0);
    assert.strictEqual(result.answers.length, 3);
  });
});

describe('ArrayNFocal', () => {
  describe('#get()', () => {
    it('pulls multiple values from structured data', () => {
      const L = lensUtils.nfocal([lens('name'), lens('address', 'street', 0)]);
      const data = {
        name: 'Fred Flintstone',
        address: {street: ['345 Cave Stone Rd']}
      };
      assert.deepEqual(L.get(data), [data.name, data.address.street[0]]);
    });
  });

  describe('#get_maybe()', () => {
    it('pulls multiple values from structured data', () => {
      const L = lensUtils.nfocal([lens('name'), lens('address', 'street', 0)]);
      const data = {
        name: 'Fred Flintstone',
        address: {street: ['345 Cave Stone Rd']}
      };
      const result = L.get_maybe(data);
      assert.deepEqual(result, {just: [data.name, data.address.street[0]], multiFocal: true});
    });

    it('leaves indexes not found out of the "found" property of the result', () => {
      const L = lensUtils.nfocal([lens('name'), lens('address', 'street', 0)]);
      const data = {
        name: 'Fred Flintstone',
      };
      const result = L.get_maybe(data);
      assert.deepEqual(result, {just: [data.name, undefined], multiFocal: true});
      assert.doesNotHaveAllKeys(result.just, [1]);
    });

    it('includes falsey properties present in the input', () => {
      const L = lensUtils.nfocal([lens('name'), lens('address', 'street', 0)]);
      const data = {
        name: 'Fred Flintstone',
        address: {street: [undefined]}
      };
      const result = L.get_maybe(data);
      assert.deepEqual(result, {just: [data.name, undefined], multiFocal: true});
      assert.containsAllKeys(result.just, [1]);
    });
  });
  
  describe("#present()", () => {
    it("returns an Array of the indexes of each constituent lens present in the subject", () => {
      const L = lensUtils.nfocal([lens('name'), lens('address', 'street', 0)]);
      assert.deepEqual(L.present({name: "Fred Flintstone"}), [0]);
      assert.deepEqual(L.present({
        name: "Fred Flintstone",
        address: {street: ['345 Cave Stone Rd']},
      }), [0, 1]);
    });
  });
  
  describe("#xformInClone()", () => {
    const L = lensUtils.nfocal([lens('name'), lens('address', 'street', 0)]);
    
    it("applies the given transforms", () => {
      const data = {
        name: "Fred Flintstone",
        address: {street: ['345 Cave Stone Rd']},
      };
      const result = L.xformInClone(
        data,
        [
          [0, n => n.toLowerCase()],
        ]
      );
      assert.deepEqual(result, {...data, name: "fred flintstone"});
    });
  });
  
  describe("#xformInClone_maybe()", () => {
    const L = lensUtils.nfocal([lens('name'), lens('address', 'street', 0)]);
    
    it("can supply a value for a missing slot", () => {
      const insertedName = "Barney Rubble";
      const result = L.xformInClone_maybe(
        {},
        [
          [0, n_m => 'just' in n_m ? n_m : {just: insertedName}],
        ]
      );
      assert.strictEqual(result.name, insertedName);
    });
  });
  
  describe("(as an Array-like collection of lenses)", () => {
    const L = lensUtils.nfocal([lens('name'), lens('address', 'street', 0)]);
    
    it("allows 'getting' of a constituent lens", () => {
      const lens0 = lens(0).get(L);
      assert.strictEqual(lens0, L.lenses[0]);
    });
    
    it("can construct an altered clone", () => {
      const institutionLens = lens('institution');
      const L2 = lens(0).setInClone(L, institutionLens);
      assert.strictEqual(L2.lenses[0], institutionLens);
      assert.strictEqual(L2.lenses[1], L.lenses[1]);
    });
  });
});

describe('ObjectNFocal', () => {
  describe('#get_maybe', () => {
    it('pulls multiple values from structured data into an object', () => {
      const L = lensUtils.nfocal({name: lens('name'), mailTo: lens('school', 'address')});
      const data = {
        name: 'Ferris Bueller',
        school: {
          address: '123 Example Way'
        }
      };
      assert.deepEqual(L.get_maybe(data), {just: {name: 'Ferris Bueller', mailTo: '123 Example Way'}, multiFocal: true});
    });

    it('omits properties not present in the input', () => {
      const L = lensUtils.nfocal({name: lens('name'), mailTo: lens('school', 'address')});
      const data = {
        name: 'Ferris Bueller'
      };
      const result = L.get_maybe(data);
      assert.deepEqual(result, {just: {name: 'Ferris Bueller'}, multiFocal: true});
    });

    it('includes falsey properties present in the input', () => {
      const L = lensUtils.nfocal({name: lens('name'), mailTo: lens('school', 'address')});
      const data = {
        name: 'Ferris Bueller',
        school: {
          address: undefined
        }
      };
      const result = L.get_maybe(data);
      assert.deepEqual(result, {just: {name: 'Ferris Bueller', mailTo: undefined}, multiFocal: true});
    });
  });
  
  describe("(as an Object-like collection of lenses)", () => {
    const L = lensUtils.nfocal({name: lens('name'), mailTo: lens('school', 'address')});
    
    it("allows 'getting' of a constituent lens", () => {
      const lensName = lens('name').get(L);
      assert.strictEqual(lensName, L.lenses.name);
    });
  });
});

describe('OpticArray', () => {
  const mfl = lensUtils.nfocal([lens('name'), lens('address', 'street', 0)]);
  
  describe('#get()', () => {
    it('retrieves the target value when target is present', () => {
      const fusedLens = lensUtils.fuse(lens(0), mfl);
      const name = "Fred Flintstone";
      assert.strictEqual(fusedLens.get({name}), name);
    });
    
    it('returns undefined when intermediate lens is missing', () => {
      const fusedLens = lensUtils.fuse(lens(7), mfl);
      const name = "Fred Flintstone";
      assert.isUndefined(fusedLens.get({name}));
    });
    
    it('returns undefined when target slot is missing', () => {
      const fusedLens = lensUtils.fuse(lens(0), mfl);
      assert.isUndefined(fusedLens.get({}));
    });
  });
  
  describe('#get_maybe()', () => {
    it('returns a Just construct with the target value when target is present', () => {
      const fusedLens = lensUtils.fuse(lens(0), mfl);
      const name = "Fred Flintstone";
      const result = fusedLens.get_maybe({ name });
      assert.deepEqual(result, {just: name});
    });
    
    it('returns a Nothing when intermediate lens is missing', () => {
      const fusedLens = lensUtils.fuse(lens(7), mfl);
      const name = "Fred Flintstone";
      const result = fusedLens.get_maybe({ name });
      assert.notProperty(result, 'just');
    });
    
    it('returns a Nothing when the target slot is missing', () => {
      const fusedLens = lensUtils.fuse(lens(0), mfl);
      const result = fusedLens.get_maybe({});
      assert.notProperty(result, 'just');
    });
  });
});

describe('eachFound', () => {
  it('yields an Object wrapped in an Array in a (basic) maybe of that Object', () => {
    const data = {
      name: 'Ferris Bueller',
      school: {
        address: undefined
      }
    };
    const unwound = Array.from(lensUtils.eachFound({just: data}));
    assert.strictEqual(unwound.length, 1);
    assert.deepEqual(unwound[0][0], data);
  });
  
  it('yields an Array wrapped in an Array in a (basic) maybe of that Array', () => {
    const data = [1,2,3];
    const unwound = Array.from(lensUtils.eachFound({just: data}));
    assert.strictEqual(unwound.length, 1);
    assert.deepEqual(unwound[0][0], data);
  });
  
  it('yields an empty Array for a Nothing', () => {
    const unwound = Array.from(lensUtils.eachFound({}));
    assert.strictEqual(unwound.length, 0);
  });
  
  it('yields each found value and its index from an ArrayNFocal#get_maybe', () => {
    const nfocal = lensUtils.nfocal(['name', 'email', 'phone'].map(k => lens(k)));
    const data = {name: "Fred Flintstone", phone: "+15077392058"};
    const result_maybe = nfocal.get_maybe(data);
    const unwound = Array.from(lensUtils.eachFound(result_maybe));
    assert.strictEqual(unwound.length, 2);
    assert.deepEqual(unwound[0], [data.name, 0]);
    assert.deepEqual(unwound[1], [data.phone, 2]);
  });
  
  it('yields each found value and its key from an ObjectNFocal#get_maybe', () => {
    const nfocal = lensUtils.nfocal(Object.fromEntries(
      ['name', 'email', 'phone'].map(k => [k + 'View', lens(k)])
    ));
    const data = {name: "Fred Flintstone", phone: "+15077392058"};
    const result_maybe = nfocal.get_maybe(data);
    const unwound = Array.from(lensUtils.eachFound(result_maybe));
    assert.strictEqual(unwound.length, 2);
    assert.deepInclude(unwound, [data.name, 'nameView']);
    assert.deepInclude(unwound, [data.phone, 'phoneView']);
  });
});

describe('Immutable integration', () => {
  const lf = immutableLensFactory;
  
  it('instantiates immutable Maps', () => {
    const cityName = 'Digidapo';
    const im_result = lf.lens('userInfo', 'address', 'city').setInClone(new immutable.Map(), cityName);
    assert.instanceOf(im_result, immutable.Map);
    assert.instanceOf(im_result.get('userInfo'), immutable.Map);
    assert.instanceOf(im_result.get('userInfo').get('address'), immutable.Map);
    assert.strictEqual(
      im_result.get('userInfo').get('address').get('city'),
      cityName
    );
    assert.strictEqual(
      im_result.get('userInfo').get('address').get('city'),
      lens('userInfo', 'address', 'city').get(im_result)
    );
  });
  
  it('instantiates immutable Lists', () => {
    const street0 = '360 Tied Key';
    const im_result = lf.lens('address', 'street', 0).setInClone(new immutable.Map(), street0);
    assert.instanceOf(im_result, immutable.Map);
    assert.instanceOf(im_result.get('address'), immutable.Map);
    assert.instanceOf(im_result.get('address').get('street'), immutable.List);
    assert.strictEqual(
      im_result.get('address').get('street').get(0),
      street0
    );
    assert.strictEqual(
      im_result.get('address').get('street').get(0),
      lens('address', 'street', 0).get(im_result)
    );
  });
  
  it('deletes from List by setting to "undefined"', () => {
    const data = new immutable.List(['x', 'y', 'z']);
    const im_result = lf.lens(1).xformInClone_maybe( data, () => ({}) );
    assert.strictEqual(im_result.size, 3);
    assert.isUndefined(im_result.get(1));
  });
  
  it('deletes from Map by delete()', () => {
    const data = new immutable.Map({
      question: "What are the first three primes?",
      answer: [2,3,5]
    });
    const im_result = lf.lens('answer').xformInClone_maybe( data, () => ({}) );
    assert.strictEqual(im_result.size, 1);
    assert.isFalse(im_result.has('answer'));
  });
  
  describe('Lens#getSeq', () => {
    it('returns a Seq for an Array in subject', () => {
      const data = {
        countries: ['United States of America', 'Canada', "Mexico"],
      };
      const seq = lens('countries').getSeq(data);
      assert.instanceOf(seq, immutable.Seq);
    });
    
    it('returns an empty Seq for a missing element in subject', () => {
      const data = {};
      const seq = lens('countries').getSeq(data);
      assert.instanceOf(seq, immutable.Seq);
      assert.strictEqual(seq.count(), 0);
    });
    
    it('returns an empty Seq for a noniterable element in subject', () => {
      const data = {
        countries: 3,
      };
      const seq = lens('countries').getSeq(data);
      assert.instanceOf(seq, immutable.Seq);
      assert.strictEqual(seq.count(), 0);
    });
    
    it('returns an empty Seq for a string element in subject', () => {
      const data = {
        countries: 'all',
      };
      const seq = lens('countries').getSeq(data);
      assert.instanceOf(seq, immutable.Seq);
      assert.strictEqual(seq.count(), 0);
    });
    
    it('throws the given "orThrow" for a noniterable element in subject', () => {
      const data = {
        countries: 3,
      };
      const niError = new Error("Not an iterable");
      assert.throws(() => {lens('countries').getSeq(data, {orThrow: niError});}, niError);
    });
  });
});
