
const functionalModules = 'each every map range reduce'.split(/\s+/);
const {assert} = require('chai');

async function loadEsmSubjects() {
  const result = {};
  Promise.all(functionalModules.map(async (fnName) => {
    result[fnName] = (await import(`#src/functional/${fnName}`)).default;
  }));
  return result;
}

function testSequence(loaderName, subjects) {
  const origIt = it;
  describe(`${loaderName} functional`, () => {
    subjects = Promise.resolve(subjects);
    let each, every, range, reduce;
    
    async function loadSubjects() {
      ({ each, every, map, range, reduce } = await subjects);
    }
    
    let it = (name, body) => {
      return origIt(name, async () => {
        await loadSubjects();
        return body();
      });
    };
    
    function failIfIterated() {
      assert.fail("Should not iterate");
    }
    
    describe('each', () => {
      it('can bind a context', () => {
        const context = {context: 'test'};
        each([1], function(val, key) {
          assert.strictEqual(this, context);
        }, context);
      });
      
      it('trivially iterates undefined given as a container', () => {
        each(undefined, failIfIterated);
      });
      
      it('trivially iterates null given as a container', () => {
        each(null, failIfIterated);
      });
    });
    
    describe('every', () => {
      it('trivially iterates undefined given as a container', () => {
        assert.strictEqual(every(undefined, failIfIterated), true);
      });
      
      it('trivially iterates null given as a container', () => {
        assert.strictEqual(every(null, failIfIterated), true);
      });
    });
    
    describe('map', () => {
      it('can iterate an Object', () => {
        map({answer: 42}, () => {});
      });
      
      it('trivially iterates undefined given as a container', () => {
        map(undefined, failIfIterated);
      });
      
      it('trivially iterates null given as a container', () => {
        map(null, failIfIterated);
      });
    });
    
    describe('range', () => {
      it('can be constructed using only the end', () => {
        assert.deepEqual(range(3), [0,1,2]);
      });
      
      it('constructs an empty range if no arguments given', () => {
        assert.deepEqual(range(), []);
      });
      
      it('can count downwards', () => {
        assert.deepEqual(range(3, 0), [3,2,1]);
      });
    });
    
    describe('reduce', () => {
      it('trivially iterates undefined given as a container', () => {
        assert.strictEqual(reduce(undefined, failIfIterated, 0), 0);
      });
      
      it('trivially iterates null given as a container', () => {
        assert.strictEqual(reduce(null, failIfIterated, 0), 0);
      });
      
      it('uses element 0 of an Array as the initial if no memo given', () => {
        assert.strictEqual(reduce([1,2], (a, b) => a + b), 3);
      });
      
      it('uses an arbitrary key of an Object as the initial if no memo given', () => {
        assert.strictEqual(reduce({a: 1, b: 2}, (a, b) => a + b), 3);
      });
    });
  });
}

testSequence('CommonJS', Object.fromEntries(functionalModules.map(
  fnName => [fnName, require(`#src/functional/${fnName}`).default]
)));
testSequence('ESM', loadEsmSubjects());
