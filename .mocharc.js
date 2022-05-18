'use strict'

const NODE_VERSION = (function() {
  'use strict';
  
  try {
    return Number(/^v(\d+)\./.exec(process.version)[1]);
  } catch (e) {
    return NaN;
  }
}());

function datumPlanMethodVersionTestsBeforeNode14() {
  if (NODE_VERSION <= 12 || isNaN(NODE_VERSION)) {
    return ['test/datumPlan-methodsVersion-tests.mjs'];
  } else {
    return [];
  }
}

module.exports = {
  exclude: [
    ...datumPlanMethodVersionTestsBeforeNode14(),
  ],
};
