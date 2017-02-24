const babelJest = require('babel-jest')

// webpack can use the .babelrc file because it understands import module syntax
// but jest does not and needs the import modules preset.
module.exports = babelJest.createTransformer({
  presets: [
    'es2015'
  ]
})