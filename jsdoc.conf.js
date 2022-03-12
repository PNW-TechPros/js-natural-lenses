exports.plugins = [
  'plugins/markdown',
];

exports.source = {
  include: ['src', 'src-cjs', 'index.js'],
};

exports.opts = {
  template: 'node_modules/docdash',
};
