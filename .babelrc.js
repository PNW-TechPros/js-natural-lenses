/* istanbul ignore file */
const sharedPresets = [];
const shared = {
  presets: sharedPresets,
};

module.exports = {
  env: {
    esm: shared,
    cjs: {
      ...shared,
      presets: [
        ['@babel/preset-env', {
          
        }],
        ...sharedPresets
      ],
      plugins: [
      ],
    },
  }
};

if (process.env.NODE_ENV === 'test') {
  module.exports.env.cjs.plugins.push(["istanbul"]);
}
