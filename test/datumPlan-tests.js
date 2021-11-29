const datumPlan = require('../natural-lenses/datumPlan.js');
const {assert} = require('chai');

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
      cookies: {[datumPlan.others]: {
        content: val,
        attributes: {
          [datumPlan.others]: val
        },
        flags: [val],
      }},
      body: val,
    });  
  }());
  
  const data = {
    method: 'POST',
    url: '/',
    headers: [
      {name: 'content-type', value: 'text/x-www-form-urlencoded'},
      {name: 'authorization', value: 'Bearer 6a7a952f30aeee2469b85128f118eb455d26f290'},
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
  };
  
  describe("#at()", () => {
    it("is available where an Array is used in the plan", () => {
      assert.deepEqual(plan.headers.at(0).get(data), data.headers[0]);
    });
    
    it("can dig into the referenced item of an Array in the plan", () => {
      function getNameLens(h) {
        return h.name;
      }
      assert.deepEqual(plan.headers.at(0, getNameLens).get(data), data.headers[0].name);
    });
  });
});
