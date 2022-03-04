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
        ["@babel/plugin-transform-runtime", {
          
        }],
        ["istanbul"],
      ],
    },
  }
}