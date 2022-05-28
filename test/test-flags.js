
const FLAGS_GIVEN = new Set(
  (process.env.TEST_FLAGS || '')
  .split(/\s*,\s*/g)
  .filter(f => !f.match(/^\s*$/))
);

exports.include = (
  FLAGS_GIVEN.has('ALL')
  ? (flag) => !flag.match(/(^s|S)kip[^a-z]/)
  : FLAGS_GIVEN.has.bind(FLAGS_GIVEN)
);

exports.DATUM_PLAN_LENS_API_VERSIONS = 'datumPlanApiVersions';
