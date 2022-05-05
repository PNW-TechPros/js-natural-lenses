const A = require('#this/sugar');
const {default: Lens} = require('#this/cjs/lens');
const {assert} = require('chai');

async function loadEsmSubjects() {
  const subjectPromises = Object.entries({
    A: import('#this/sugar').then(m => m.default),
    Lens: import('../esm/lens.js').then(m => m.default),
  });
  
  const pr = await Promise.all(subjectPromises.map(
    // async ([name, valuePromise]) => [name, await valuePromise]
    ([name, valuePromise]) => valuePromise.then(value => [name, value])
  ));
  return Object.fromEntries(pr);
}

function testSequence(loaderName, subjects) {
  const origIt = it;
  describe(loaderName, () => {
    subjects = Promise.resolve(subjects);
    let A, Lens;
    
    async function loadSubjects() {
      ({ A, Lens } = await subjects);
    }
    
    let it = (name, body) => {
      return origIt(name, async () => {
        await loadSubjects();
        return body();
      });
    };
    
    describe('`A` string template tag', () => {
      it('can create a Lens', () => {
        const subject = A`$.foo`;
        assert.instanceOf(subject, Lens);
      });
      
      it('supports member syntax', () => {
        const subject = A`$.name`;
        assert.deepEqual(subject.keys, ['name']);
      });
      
      describe("subscript notation", () => {
        it('accepts an unsigned integer', () => {
          const subject = A`$[0]`;
          assert.deepEqual(subject.keys, [0]);
          assert.notDeepEqual(subject.keys, ['0']);
        });
        
        it('accepts a negative integer', () => {
          const subject = A`$[-1]`;
          assert.deepEqual(subject.keys, [-1]);
        });
        
        it('accepts a single-quoted string', () => {
          const subject = A`$['name']`;
          assert.deepEqual(subject.keys, ['name']);
        });
        
        it('allows escaping a backslash with a double-backslash in a single-quoted string', () => {
          const subject = A `$['employee\\id']`;
          assert.deepEqual(subject.keys, ['employee\\id']);
        });
        
        it('accepts single-character escape sequences in a single-quoted string', () => {
          const subject = A `$['first\tname']`;
          assert.deepEqual(subject.keys, ['first\tname']);
        });
        
        it('accepts \\xHH escape sequences in a single-quoted string', () => {
          const subject = A `$['first\x20name']`;
          assert.deepEqual(subject.keys, ['first name']);
        });
        
        it('accepts \\uHHHH escape sequences in a single-quoted string', () => {
          const subject = A `$['sch\u00f6n']`;
          assert.deepEqual(subject.keys, ['schön']);
        });
        
        it('accepts \\u{HHHHH} escape sequences in a single-quoted string', () => {
          const subject = A `$['a\u{1F635}z']`;
          assert.deepEqual(subject.keys, ['a😵z']);
        });
        
        it('accepts \\` escape sequences in a single-quoted string', () => {
          const subject = A `$['a\`z']`;
          assert.deepEqual(subject.keys, ['a`z']);
        });
        
        it('accepts a double-quoted string', () => {
          const subject = A `$["name"]`;
          assert.deepEqual(subject.keys, ['name']);
        });
        
        it('allows escaping a backslash with a double-backslash in a double-quoted string', () => {
          const subject = A `$["employee\\id"]`;
          assert.deepEqual(subject.keys, ['employee\\id']);
        });
        
        it('accepts single-character escape sequences in a double-quoted string', () => {
          const subject = A `$["first\tname"]`;
          assert.deepEqual(subject.keys, ['first\tname']);
        });
        
        it('accepts \\xHH escape sequences in a double-quoted string', () => {
          const subject = A `$["first\x20name"]`;
          assert.deepEqual(subject.keys, ['first name']);
        });
        
        it('accepts \\uHHHH escape sequences in a double-quoted string', () => {
          const subject = A `$["sch\u00f6n"]`;
          assert.deepEqual(subject.keys, ['schön']);
        });
        
        it('accepts \\u{HHHHH} escape sequences in a double-quoted string', () => {
          const subject = A `$["a\u{1F635}z"]`;
          assert.deepEqual(subject.keys, ['a😵z']);
        });
        
        it('accepts \\` escape sequences in a double-quoted string', () => {
          const subject = A `$["a\`z"]`;
          assert.deepEqual(subject.keys, ['a`z']);
        });
        
        it('accepts any intercalated value', () => {
          const marker = Symbol('marker'), subject = A `$[${marker}]`;
          assert.deepEqual(subject.keys, [marker]);
        });
      });
      
      it('throws an exception if the path ends prematurely', () => {
        assert.throws( () => A `$.foo['bar\']` );
      });
      
      it('throws an exception for unsupported operators', () => {
        assert.throws( () => A `$.foo[1 + 2]` );
      });
      
      it('throws an exception if the path ends with an open square bracket', () => {
        assert.throws( () => A `$.foo[` );
      });
      
      describe('explicit invocation as a function', () => {
        it('returns the trivial lens when passed an empty list of string parts', () => {
          const subject = A({raw: []});
          assert.deepEqual(subject.keys, []);
        });
        
        it('throws an exception if there are not enough string parts', () => {
          assert.throws( () => A({raw: ['$[']}, 42) );
        });
        
        it('throws an exception if there are too many values', () => {
          assert.throws( () => A({raw: ['$.foo']}, 42) );
        });
        
        it('throws an exception if there are too many strings', () => {
          assert.throws( () => A({raw: ['$.foo', 'bar']}) );
        });
      });
    });
  });
}

testSequence('CommonJS', { A, Lens });

testSequence('ESM', loadEsmSubjects());
