const datumPlan = require('#this/datum-plan');
const lens = require('#this');
const {assert} = require('chai');
const _ = require('underscore');

async function loadEsmSubjects() {
  const { default: datumPlan } = await import('#this/datum-plan');
  const { default: lens, UndefinedPropertyError } = await import('#this');
  return { datumPlan, lens, UndefinedPropertyError };
}

function testSequence(loaderName, subjects) {
  const origIt = it;
  describe(loaderName, () => {
    subjects = Promise.resolve(subjects);
    let datumPlan, lens, UndefinedPropertyError;
    
    async function loadSubjects() {
      ({ datumPlan, lens, UndefinedPropertyError } = await subjects);
    }
    
    let it = (name, body) => {
      return origIt(name, async () => {
        await loadSubjects();
        return Promise.resolve(body());
      });
    };

    describe('lens.DatumPlan', () => {
      let plan;
      before(async () => {
        await loadSubjects();
        const val = datumPlan.value;
        
        plan = datumPlan({
          method: val,
          url: val,
          headers: [{
            name: val,
            value: val,
          }],
          verifiedCertDNs: [val],
          securityPrincipals: [val],
          cookies: {[datumPlan.others]: {
            content: val,
            attributes: {
              [datumPlan.others]: val
            },
            flags: [val],
          }},
          preferredLanguages: [{
            lang: val,
            factor: val,
          }],
          body: val,
        });
      });
      
      const data = {
        method: 'POST',
        url: '/',
        headers: [
          {name: 'content-type', value: 'text/x-www-form-urlencoded'},
          {name: 'authorization', value: 'Bearer 6a7a952f30aeee2469b85128f118eb455d26f290'},
          {name: 'accepted-language', value: 'en-us, en;q=0.8, es;q=0.5, *;q=0.1'}
        ],
        cookies: {
          "tracker": {
            content: 'a9c9846e-aa6b-5d84-9a15-081d6eca4616',
            attributes: {
              domain: "example.com",
              path: "/",
              expires: "Sat, 01 Jan 2022 00:00:00 GMT",
              samesite: "None",
            },
            flags: ['secure']
          },
        },
        preferredLanguages: [
          {lang: 'en', factor: 1},
          {lang: 'es', factor: 0.5},
        ],
      };
      
      const supportedLanguages = new Set([
        'en-us',
        'en-gb',
        'en-au',
        'fr-fr',
      ]);
      
      function assertAllPropsStrictEqual(actual, expected) {
        for (let propName of [...Object.keys(expected), ...Object.keys(actual)]) {
          assert.strictEqual(actual[propName], expected[propName]);
        }
      }
      
      describe("construction", () => {
        it('throws an Error if the plan contains an Array with multiple item plans', () => {
          assert.throws(
            () => datumPlan([{foo: datumPlan.value}, {bar: datumPlan.value}]),
            /multiple\s*plans/i
          );
        });
        
        it('accepts an empty Array as a plan',() => {
          datumPlan([]);
        });
        
        it('throws when encountering an unexpected item in a plan', () => {
          assert.throws(
            () => datumPlan({foo: 'garbage'}),
            /invalid/i
          );
        });
        
        it('can be constructed with a Function returning the spec', () => {
          datumPlan(({ VALUE, NAMED_VALUES }) => ({
            method: VALUE,
            url: VALUE,
            headers: [{
              name: VALUE,
              value: VALUE,
            }],
            verifiedCertDNs: [VALUE],
            securityPrincipals: [VALUE],
            cookies: {...NAMED_VALUES({
              content: VALUE,
              attributes: {
                ...NAMED_VALUES,
              },
              flags: [VALUE],
            })},
            preferredLanguages: [{
              lang: VALUE,
              factor: VALUE,
            }],
            body: VALUE,
          }));
        });
      });
      
      describe("#at()", () => {
        describe("(applied to Array collections)", () => {
          it("is available where an Array is used in the plan", () => {
            assert.deepEqual(plan.headers.at(0).get(data), data.headers[0]);
          });
          
          it("can dig into the referenced item of an Array in the plan", () => {
            assert.strictEqual(plan.headers.at(0, h => h.name).get(data), data.headers[0].name);
          });
          
          it("can dig into 'dictionary-like' entries of an Object in the plan", () => {
            assert.strictEqual(plan.cookies.at('tracker').get(data), data.cookies.tracker);
          });
          
          it("can fuse a lens after item selection", () => {
            assert.strictEqual(plan.headers.at(0, lens('name')).get(data), data.headers[0].name);
          });
        });
        
        describe("(applied to Object collections)", () => {
          it("is available where an Object specifying 'datumPlan.others' key is used in the plan", () => {
            assert.deepEqual(plan.cookies.at('tracker').get(data), data.cookies.tracker);
          });
          
          it("can dig into the referenced item of an Object in the plan", () => {
            assert.strictEqual(
              plan.cookies.at('tracker', c => c.attributes).get(data),
              data.cookies.tracker.attributes
            );
          });
          
          it("can fuse a lens after item selection", () => {
            assert.strictEqual(
              plan.cookies.at('tracker', lens('attributes')).get(data),
              data.cookies.tracker.attributes
            );
          });
        });
      });
      
      describe("#mapInside", () => {
        describe("(applied to Array collections)", () => {
          it("returns the subject when no change is made", () => {
            assert.strictEqual(plan.headers.mapInside(data, c => c), data);
          });
          
          it("alters the targeted part of the subject when a change is made", () => {
            const targetHeader = 'authorization';
            const testTag = {verified: true};
            const {headers: origHeaders, ...origOther} = data;
            const {headers: modHeaders, ...modOther} = plan.headers.mapInside(
              data,
              header => header.name === targetHeader ? {...header, ...testTag} : header
            );
            
            // Doesn't impact anything else
            assertAllPropsStrictEqual(modOther, origOther);
            
            // Does change the headers
            assert.notDeepEqual(modHeaders, origHeaders);
            
            // Doesn't change the number of headers
            assert.strictEqual(modHeaders.length, origHeaders.length);
            
            // Only changes the targeted header, and does not change the order
            for (let [modHeader, origHeader] of _.zip(modHeaders, origHeaders)) {
              assert.strictEqual(modHeader.name, origHeader.name);
              if (origHeader.name === targetHeader) {
                assert.notDeepEqual(modHeader, origHeader);
                assert.include(modHeader, origHeader);
                assert.include(modHeader, testTag);
                assert.notInclude(origHeader, testTag);
              } else {
                assert.strictEqual(modHeader, origHeader);
              }
            }
          });
          
          it("passes the item plan as the third argument to *itemXform*", () => {
            const targetHeader = 'authorization';
            const testTag = {verified: true};
            const {headers: origHeaders, ...origOther} = data;
            const {headers: modHeaders, ...modOther} = plan.headers.mapInside(
              data,
              (header, i, headerPlan) => 
                headerPlan.name.get(header) === targetHeader ? {...header, ...testTag} : header
            );
            
            // Doesn't impact anything else
            assertAllPropsStrictEqual(modOther, origOther);
            
            // Does change the headers
            assert.notDeepEqual(modHeaders, origHeaders);
            
            // Doesn't change the number of headers
            assert.strictEqual(modHeaders.length, origHeaders.length);
            
            // Only changes the targeted header, and does not change the order
            for (let [modHeader, origHeader] of _.zip(modHeaders, origHeaders)) {
              assert.strictEqual(modHeader.name, origHeader.name);
              if (origHeader.name === targetHeader) {
                assert.notDeepEqual(modHeader, origHeader);
                assert.include(modHeader, origHeader);
                assert.include(modHeader, testTag);
                assert.notInclude(origHeader, testTag);
              } else {
                assert.strictEqual(modHeader, origHeader);
              }
            }
          });
          
          it("can target nested slots within the items of the subject collection", () => {
            function alteredName(name) {
              return 'forwarded-' + name;
            }
            const {headers: origHeaders, ...origOther} = data;
            const {headers: modHeaders, ...modOther} = plan.headers.mapInside(
              data,
              header => header.name,
              alteredName
            );
            
            // Doesn't impact other properties of the subject datum
            assertAllPropsStrictEqual(modOther, origOther);
            
            // Changes the headers
            assert.notDeepEqual(modHeaders, origHeaders);
            
            // Doesn't change the number of headers
            assert.strictEqual(modHeaders.length, origHeaders.length);
            
            // Every header only has a changed name, and it changed in the indicated way
            for (let [modHeader, origHeader] of _.zip(modHeaders, origHeaders)) {
              const {name: modHeaderName, ...modHeaderOther} = modHeader;
              const {name: origHeaderName, ...origHeaderOther} = origHeader;
              
              assertAllPropsStrictEqual(modHeaderOther, origHeaderOther);
              
              assert.strictEqual(modHeaderName, alteredName(origHeaderName));
            }
          });
          
          it("can target nested slots within the items of the subject collection via a provided lens", () => {
            function alteredName(name) {
              return 'forwarded-' + name;
            }
            const {headers: origHeaders, ...origOther} = data;
            const {headers: modHeaders, ...modOther} = plan.headers.mapInside(
              data,
              lens('name'),
              alteredName
            );
            
            // Doesn't impact other properties of the subject datum
            assertAllPropsStrictEqual(modOther, origOther);
            
            // Changes the headers
            assert.notDeepEqual(modHeaders, origHeaders);
            
            // Doesn't change the number of headers
            assert.strictEqual(modHeaders.length, origHeaders.length);
            
            // Every header only has a changed name, and it changed in the indicated way
            for (let [modHeader, origHeader] of _.zip(modHeaders, origHeaders)) {
              const {name: modHeaderName, ...modHeaderOther} = modHeader;
              const {name: origHeaderName, ...origHeaderOther} = origHeader;
              
              assertAllPropsStrictEqual(modHeaderOther, origHeaderOther);
              
              assert.strictEqual(modHeaderName, alteredName(origHeaderName));
            }
          });
          
          it("returns the subject when no change is made while targeting a nested slot", () => {
            
            const result = plan.headers.mapInside(
              data,
              header => header.name,
              x => x
            );
            
            assert.strictEqual(result, data);
          });
          
          it("treats a missing slot as an empty Array", () => {
            const {verifiedCertDNs, ...modOther} = plan.verifiedCertDNs.mapInside(
              data,
              dn => 'secret'
            );
            
            assertAllPropsStrictEqual(modOther, data);
            
            assert.deepEqual(verifiedCertDNs, []);
          });
          
          it("treats a non-iterable slot value as an empty Array", () => {
            const {verifiedCertDNs, ...modOther} = plan.verifiedCertDNs.mapInside(
              {...data, verifiedCertDNs: 'zippo'},
              dn => 'secret'
            );
            
            assertAllPropsStrictEqual(modOther, data);
            
            assert.deepEqual(verifiedCertDNs, []);
          });
          
          it("requires at least one manipulator", () => {
            assert.throws(
              () => plan.headers.mapInside(data),
              /mapInside.+requires/i
            );
          });
          
          it("accepts no more than two manipulators", () => {
            assert.throws(
              () => plan.headers.mapInside(data, 1, 2, 3),
              /mapInside.+requires/i
            );
          });
        });
        
        describe("(applied to Object collections)", () => {
          it("requires at least one manipulator", () => {
            assert.throws(
              () => plan.cookies.mapInside(data),
              /mapInside.+requires/i
            );
          });
          
          it("accepts no more than two manipulators", () => {
            assert.throws(
              () => plan.cookies.mapInside(data, 1, 2, 3),
              /mapInside.+requires/i
            );
          });
          
          it("returns the subject when no change is made", () => {
            assert.strictEqual(plan.cookies.mapInside(data, c => c), data);
          });
          
          it("returns the subject when no change is made while targeting a nested slot", () => {
            const result = plan.cookies.mapInside(
              data,
              cookiePlan => cookiePlan.content,
              x => x
            );
            
            assert.strictEqual(result, data);
          });
          
          it("can target nested slots within the items of the subject collection via a provided lens", () => {
            function alteredContent(content) {
              return content + ' as modified';
            }
            const {cookies: origCookies, ...origOther} = data;
            const {cookies: modCookies, ...modOther} = plan.cookies.mapInside(
              data,
              lens('content'),
              alteredContent
            );
            
            // Doesn't impact other properties of the subject datum
            assertAllPropsStrictEqual(modOther, origOther);
            
            // Changes the cookie
            assert.notDeepEqual(modCookies, origCookies);
            
            // Doesn't change the number of cookies
            assert.strictEqual(Object.keys(modCookies).length, Object.keys(origCookies).length);
            
            // Every cookie only has a changed content, and it changed in the indicated way
            for (let cookieName of Object.keys(origCookies)) {
              const {content: modCookieContent, ...modCookieOther} = modCookies[cookieName];
              const {content: origCookieContent, ...origCookieOther} = origCookies[cookieName];
              
              assertAllPropsStrictEqual(modCookieOther, origCookieOther);
              
              assert.strictEqual(modCookieContent, alteredContent(origCookieContent));
            }
          });
          
          it("iterates only non-explicit keys of the target object", () => {
            const characterPlan = datumPlan({
              name: datumPlan.value,
              [datumPlan.others]: {
                type: datumPlan.value,
              }
            });
            const data = {
              name: 'Lancelot',
              weapon: {
                type: 'sword',
              },
              armor: {
                type: 'plate',
              },
            };
            
            const result = characterPlan.mapInside(data, accessory => ({...accessory, damaged: true}));
            assert.strictEqual(result.name, data.name);
            for (var prop of ['weapon', 'armor']) {
              assert.notStrictEqual(result[prop], data[prop]);
            }
          });
        });
      });
      
      describe("#mapAllInside", () => {
        it("requires at least one manipulator", () => {
          assert.throws(
            () => plan.cookies.mapAllInside(data),
            /mapAllInside.+requires/i
          );
        });
        
        it("accepts no more than two manipulators", () => {
          assert.throws(
            () => plan.cookies.mapAllInside(data, 1, 2, 3),
            /mapAllInside.+requires/i
          );
        });
        
        it("returns the subject when no change is made", () => {
          assert.strictEqual(plan.cookies.mapAllInside(data, c => c), data);
        });
        
        it("iterates even explicit keys of the target object", () => {
          const headersPlan = datumPlan(({ VALUE, NAMED_VALUES }) => ({
            host: VALUE,
            contentType: VALUE,
            cookie: VALUE,
            ...NAMED_VALUES,
          }));
          const data = {
            host: 'www.example.com',
            xForwardedFor: '27.71.44.150',
          };
          const PARSER_VALIDATORS = {
            xForwardedFor(untrustedIpList) {
              const items = untrustedIpList.split(/,\s*/);
              return items.map((item, i) => {
                const ip4Match = /^\d{1,3}(\.\d{1,3}){3}$/.exec(item);
                if (ip4Match) {
                  const byteVals = ip4Match[0].split('.').map(ns => parseInt(ns));
                  if (byteVals.findIndex(n => n < 0 || n > 255) < 0) {
                    return ip4Match[0];
                  }
                }
                return {invalidAddress: item};
              });
            }
          };
          
          const result = headersPlan.mapAllInside(data, (headerValue, headerName) => {
            const validatedValue = lens(headerName).bound(PARSER_VALIDATORS)(headerValue);
            return _.isUndefined(validatedValue) ? {unvalidated: headerValue} : validatedValue;
          });
          
          for (const prop of Object.keys(data)) {
            assert.notStrictEqual(result[prop], data[prop]);
          }
          assert.deepEqual(result.host, {unvalidated: data.host});
          assert.deepEqual(result.xForwardedFor, [data.xForwardedFor]);
        });
      });
      
      describe("#length", () => {
        it('can get the length of a Array-like in the plan from the subject', () => {
          assert.strictEqual(plan.headers.length(data), data.headers.length);
        });
        
        it('returns undefined for length of non-Array-like Object', () => {
          assert.isUndefined(plan.headers.length({headers: {}}));
        });
        
        it('returns undefined for length of a missing slot', () => {
          assert.isUndefined(plan.headers.length({}));
        });
        
        it('returns undefined for length of null', () => {
          assert.isUndefined(plan.headers.length({headers: null}));
        });
        
        it('returns undefined for length of a number', () => {
          assert.isUndefined(plan.headers.length({headers: 7}));
        });
        
        it('returns undefined for length of a string', () => {
          assert.isUndefined(plan.headers.length({headers: 'present'}));
        });
      });
      
      describe("#flatMapInside", () => {
        it("returns the subject when no change is made", () => {
          assert.strictEqual(plan.headers.flatMapInside(data, c => [c]), data);
        });
        
        it("can alter items in the result", () => {
          const targetHeader = 'authorization';
          const testTag = {verified: true};
          const {headers: origHeaders, ...origOther} = data;
          const {headers: modHeaders, ...modOther} = plan.headers.flatMapInside(
            data,
            header => [header.name === targetHeader ? {...header, ...testTag} : header]
          );
          
          // Doesn't impact anything else
          assertAllPropsStrictEqual(modOther, origOther);
          
          // Does change the headers
          assert.notDeepEqual(modHeaders, origHeaders);
          
          // Doesn't change the number of headers
          assert.strictEqual(modHeaders.length, origHeaders.length);
          
          // Only changes the targeted header, and does not change the order
          for (let [modHeader, origHeader] of _.zip(modHeaders, origHeaders)) {
            assert.strictEqual(modHeader.name, origHeader.name);
            if (origHeader.name === targetHeader) {
              assert.notDeepEqual(modHeader, origHeader);
              assert.include(modHeader, origHeader);
              assert.include(modHeader, testTag);
              assert.notInclude(origHeader, testTag);
            } else {
              assert.strictEqual(modHeader, origHeader);
            }
          }
        });
        
        it("can remove items", () => {
          const targetHeader = 'authorization';
          const {headers: origHeaders, ...origOther} = data;
          const {headers: modHeaders, ...modOther} = plan.headers.flatMapInside(
            data,
            header => header.name === targetHeader ? [] : [header]
          );
          
          // Doesn't impact anything else
          assertAllPropsStrictEqual(modOther, origOther);
          
          // Does change the headers
          assert.notDeepEqual(modHeaders, origHeaders);
          
          // Removes the one expected header
          assert.strictEqual(modHeaders.length, origHeaders.length - 1);
          for (let origHeader of origHeaders) {
            if (origHeader.name === targetHeader) {
              assert.notInclude(modHeaders, origHeader);
            } else {
              assert.include(modHeaders, origHeader);
            }
          }
        })
        
        it("can add items", () => {
          const targetHeader = 'authorization';
          const extraHeader = {name: 'x-internal-value', value: 'af8225e10682a8403532307b91fdf0e1dd07e6d5'};
          const {headers: origHeaders, ...origOther} = data;
          const {headers: modHeaders, ...modOther} = plan.headers.flatMapInside(
            data,
            header => header.name === targetHeader ? [header, extraHeader] : [header]
          );
          
          // Doesn't impact anything else
          assertAllPropsStrictEqual(modOther, origOther);
          
          // Does change the headers
          assert.notDeepEqual(modHeaders, origHeaders);
          
          // Adds the one expected header
          assert.strictEqual(modHeaders.length, origHeaders.length + 1);
          for (let origHeader of origHeaders) {
            assert.include(modHeaders, origHeader);
          }
          const extraHeaderIndex = modHeaders.indexOf(extraHeader);
          assert.isAtLeast(extraHeaderIndex, 1);
          
          // Adds the extra header where expected (after the target header)
          assert.strictEqual(modHeaders[extraHeaderIndex - 1].name, targetHeader);
        });
        
        it("handles a missing slot in the subject as if an empty Array", () => {
          const {verifiedCertDNs, ...modOther} = plan.verifiedCertDNs.flatMapInside(
            data,
            dn => {throw new Error("should not be called");}
          );
          
          assertAllPropsStrictEqual(modOther, data);
          
          assert.deepEqual(verifiedCertDNs, []);
        });
        
        it("handles a non-iterable slot value in the subject as if an empty Array", () => {
          const {verifiedCertDNs, ...modOther} = plan.verifiedCertDNs.flatMapInside(
            Object.assign({}, data, {verifiedCertDNs: 'zippo'}),
            dn => {throw new Error("should not be called");}
          );
          
          assertAllPropsStrictEqual(modOther, data);
          
          assert.deepEqual(verifiedCertDNs, []);
        });
        
        it("allows specifying how to reduce the items resulting from flat-mapping to a collection", () => {
          const result = plan.preferredLanguages.flatMapInside(
            data,
            (entry, i, langPlan) => {
              const langCode = langPlan.lang.get(entry);
              if (supportedLanguages.has(langCode)) {
                return [entry];
              }
              const langMatchPrefix = langCode + '-', mapItemResult = [];
              for (let supLang of supportedLanguages) {
                if (supLang.slice(0, langMatchPrefix.length) === langMatchPrefix) {
                  mapItemResult.push(langPlan.lang.setInClone(entry, supLang));
                }
              }
              return mapItemResult;
            },
            {reduce: entries => {
              let bestFactor = 0, reduceResult = new Set(['fr-fr']);
              for (let entry of entries) {
                const entryPlan = plan.preferredLanguages.$item;
                const entryFactor = entryPlan.factor.get(entry);
                if (entryFactor > bestFactor) {
                  [bestFactor, reduceResult] = [entryFactor, new Set([entryPlan.lang.get(entry)])];
                } else if (entryFactor === bestFactor) {
                  reduceResult.add(entryPlan.lang.get(entry));
                }
              }
              return reduceResult;
            }}
          );
          assert.instanceOf(plan.preferredLanguages.get(result), Set);
        });
        
        it("can reduce a missing slot (and know it is missing)", () => {
          const workData = plan.preferredLanguages.xformInClone_maybe(data, () => ({}));
          const prefLangVal = new Set(['en-us']);
          const result = plan.preferredLanguages.flatMapInside(
            workData,
            () => {assert.fail("should not be called")},
            {reduce: entries => {
              assert.isOk(entries.injected, "testing items marked as injected");
              return prefLangVal;
            }}
          );
          assert.strictEqual(result.preferredLanguages, prefLangVal);
        });
        
        it("can use a non-iterable value from the slot while reducing", () => {
          const workData = plan.preferredLanguages.setInClone(data, 'en-us');
          const result = plan.preferredLanguages.flatMapInside(
            workData,
            () => {assert.fail("should not be called")},
            {reduce: entries => {
              if (_.isString(entries.noniterableValue)) {
                return [{lang: entries.noniterableValue, factor: 1}];
              } else {
                return entries;
              }
            }}
          );
          assert.deepInclude(result.preferredLanguages, {lang: 'en-us', factor: 1});
        });
      });
      
      describe("when Proxy-guarded", () => {
        const planGroup = '28c85e0f9fdedba40e60e5a909132ef9cc80f882';
        
        function proxyGuardsEnabled(body) {
          const oldVals = Array.from(datumPlan.guardedGroups);
          datumPlan.guardedGroups.clear();
          datumPlan.guardedGroups.add(planGroup);
          try {
            return body();
          } finally {
            datumPlan.guardedGroups.clear();
            oldVals.forEach((item) => {
              datumPlan.guardedGroups.add(item);
            });
          }
        }
        
        it("activates without error", () => {
          proxyGuardsEnabled(() => {
            const plan = datumPlan({name: datumPlan.value}, { planGroup });
          });
        });
        
        it("lenses like normal for defined properties", () => {
          proxyGuardsEnabled(() => {
            const plan = datumPlan({name: datumPlan.value}, { planGroup });
            const name = "Fred Flintstone";
            assert.strictEqual(plan.name.get({name}), name);
          });
        });
        
        it("allows testing for presence with 'in' without error", () => {
          proxyGuardsEnabled(() => {
            const plan = datumPlan({name: datumPlan.value}, { planGroup });
            assert.isNotOk('address' in plan);
          });
        });
        
        it("throws the expected error type when non-properties are accessed", () => {
          proxyGuardsEnabled(() => {
            const plan = datumPlan({name: datumPlan.value}, { planGroup });
            assert.throws(
              () => plan.address.get,
              UndefinedPropertyError
            );
          });
        });
        
        it("throws an error indicating where the bad property access occurred", () => {
          proxyGuardsEnabled(() => {
            const plan = datumPlan({name: datumPlan.value}, { planGroup });
            function f16d64e0352ebbc376fa3c5fc216f544ab5ab446() {
              return plan.address;
            }
            assert.doesNotThrow(f16d64e0352ebbc376fa3c5fc216f544ab5ab446);
            const badAccess = f16d64e0352ebbc376fa3c5fc216f544ab5ab446();
            try {
              badAccess.get;
            } catch (ex) {
              assert.instanceOf(ex, UndefinedPropertyError);
              assert.include(ex.stack, 'f16d64e0352ebbc376fa3c5fc216f544ab5ab446', "Stack includes source of error");
            }
          });
        });
        
        it("reports the keys leading to the incorrect property access", () => {
          proxyGuardsEnabled(() => {
            const plan = datumPlan({
              name: {
                first: datumPlan.value,
                last: datumPlan.value,
              },
            }, { planGroup });
            
            let caughtException = false;
            try {
              plan.name.middle.get;
            } catch (ex) {
              caughtException = true;
              assert.instanceOf(ex, UndefinedPropertyError);
              assert.include(ex.message, 'name');
            }
            assert(caughtException, "Exception expected");
          });
        });
        
        it("shows defined properties through a Lens", () => {
          proxyGuardsEnabled(() => {
            const plan = datumPlan({name: datumPlan.value}, { planGroup });
            assert.strictEqual(lens('name').get(plan), plan.name);
          });
        });
        
        it("shows undefined properties as 'undefined' through a Lens", () => {
          proxyGuardsEnabled(() => {
            const plan = datumPlan({name: datumPlan.value}, { planGroup });
            assert.isUndefined(lens('address').get(plan));
          });
        });
        
        it("shows undefined properties as Nothing via Lens#get_maybe", () => {
          proxyGuardsEnabled(() => {
            const plan = datumPlan({name: datumPlan.value}, { planGroup });
            assert.notProperty(lens('address').get_maybe(plan), 'just');
          });
        });
      });
    });
  });
}

testSequence('CommonJS', { datumPlan, lens, UndefinedPropertyError: lens.UndefinedPropertyError });
testSequence('ESM', loadEsmSubjects());

function withEnv(envvar, value, body) {
  const oldVal = process.env[envvar];
  process.env[envvar] = value;
  try {
    return body();
  } finally {
    process.env[envvar] = oldVal;
  }
}
