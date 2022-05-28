import { buildVersionApiMap } from './lens-api-helper.js';
import * as tflags from './test-flags.js';
import { assert } from 'chai';
import _ from 'underscore';
import datumPlan from '#this/datum-plan';

const API_MAP = await buildVersionApiMap();

describe("datumPlan methodsVersion-option verity", () => {
  const versions = [...API_MAP.keys()],
    currentVersionMethods = API_MAP.get(versions.slice(-1)[0]);
  
  versions.slice(0, -1).forEach(version => {
    it(`correctly locks version ${version}`, function() {
      if (!tflags.include(tflags.DATUM_PLAN_LENS_API_VERSIONS)) {
        this._runnable.title += ` (skipped because TEST_FLAGS does not include '${tflags.DATUM_PLAN_LENS_API_VERSIONS}')`;
        this.skip();
      }
      
      const versionMethods = API_MAP.get(version);
      const weakNames = datumPlan.WEAK_LENS_METHODS[version];
      assert.sameMembers(
        [...currentVersionMethods].filter(prop => !versionMethods.has(prop)),
        [...weakNames]
      );
    });
  });
});
