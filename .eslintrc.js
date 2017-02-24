const config = require('eslint-config-trainiac/index')
const merge = require('lodash/fp').merge

const mergedConfig = merge(config('warn'), {
  env: {
    jest: true
  }
})

module.exports = mergedConfig
