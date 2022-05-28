/**
 * @namespace "process.env"
 * @description
 * This page describes the environment variables available via `process.env`
 * which affect the behavior of this library or its scripts.
 *
 * These environment variables are expected to be accessible via `process.env`.
 * In environments (e.g. browsers) where this is not a typical global value, the
 * value is always treated as an empty Object.  Toolchains (e.g. `webpack`) may
 * provide ways to define `process.env` to trigger the behaviors described in
 * this page when run in environments other than Node.js.
 */

/**
 * @name DATUM_PLAN_GUARDS
 * @memberOf "process.env"
 * @description
 * Comma-separated list of datum plan group names (see *opts.planGroup* of
 * {@link module:natural-lenses/datum-plan}) which should instantiate Proxy
 * guards against misspelled member names.
 */

/**
 * @name TEST_FLAGS
 * @memberOf "process.env"
 * @summary *(package development)* Control tests run by `npm test`
 * @description
 * Comma-separated list of test flags to determine which groups of tests are
 * run.
 *
 * # Defined Flags
 *
 * ### `ALL`
 *
 * Act as if all possible test flags were given except flags that skip tests.
 * Flags indicate skipping by having the word "skip" in camel case (that is,
 * starting with "skip" or having "Skip" internally, followed by a character
 * that is not a lowercase latin letter).
 *
 * ### `datumPlanApiVersions`
 * 
 * Download previous minor versions within the current major version and test if
 * the `methodsVersion` option of {@link module:natural-lenses/datum-plan}
 * uses correct information for determining "newer" {@link Lens} instance method
 * names.
 */
