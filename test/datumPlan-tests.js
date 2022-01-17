const datumPlan = require('../natural-lenses/datumPlan.js');
const {assert} = require('chai');
const _ = require('underscore');

describe('lens.DatumPlan', () => {
  const plan = (function() {
    const val = datumPlan.value;

    return datumPlan({
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
  }());
  
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
  
  describe("#at()", () => {
    it("is available where an Array is used in the plan", () => {
      assert.deepEqual(plan.headers.at(0).get(data), data.headers[0]);
    });
    
    it("can dig into the referenced item of an Array in the plan", () => {
      assert.strictEqual(plan.headers.at(0, h => h.name).get(data), data.headers[0].name);
    });
    
    it("can dig into 'dictionary-like' entries of an Object in the plan", () => {
      assert.strictEqual(plan.cookies.at('tracker').get(data), data.cookies.tracker);
    });
  });
  
  describe("#mapInside", () => {
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
});
