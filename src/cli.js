#!/usr/bin/env node

const path = require('path')
const fs = require('fs')
const globby = require('globby')
const validateTags = require('./index')
const formatterFunction = require('./formatter')
const minimist = require('minimist')

const formatters = {
  json: JSON.stringify,
  string: formatterFunction
}

const flatten = array => {
  if (!array || !array.length) {
    return []
  }

  let index = -1
  const length = array.length
  const result = []

  while (++index < length) {
    const value = array[index]
    if (Array.isArray(value)) {
      let index2 = -1
      const valueLength = value.length
      const offset = result.length
      while (++index2 < valueLength) {
        result[offset + index2] = value[index2]
      }
    } else {
      result[result.length] = value
    }
  }
  return result
}

function readFile (filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, content) => {
      if (err) {
        reject(err)
      }
      resolve(content)
    })
  })
}

const prepareReturnValue = formatter => results => {
  const flattened = flatten(results)
  return new Promise(resolve => {
    const errored = flattened.some(result => result.errors.length)

    const returnValue = {
      errored,
      output: formatter(flattened)
    }

    resolve(returnValue)
  })
}

function getAbsolutePath (filePath) {
  return (!path.isAbsolute(filePath)) ? path.join(process.cwd(), filePath) : filePath
}

function validateTagsForFile (file) {
  return globby(file).then(filePaths => {
    const getValidateTagsResults = filePaths.map(filePath => {
      const absoluteFilepath = getAbsolutePath(filePath)
      return readFile(absoluteFilepath).then(validateTags).then(result => {
        return {
          source: filePath,
          errors: result.errors
        }
      })
    })

    return Promise.all(getValidateTagsResults)
  })
}

function validateTagsForFiles (options) {
  let files = options._
  if (typeof files === 'string') {
    files = [files]
  }
  const validated = files.map(validateTagsForFile)
  return Promise.all(validated).then(prepareReturnValue(formatters[options.f]))
}

Promise.resolve().then(() => {
  const args = minimist(process.argv.slice(2)) // eslint-disable-line no-magic-numbers
  args.f = args.f || 'string'  // eslint-disable-line id-length
  return validateTagsForFiles(args)
}).then((linted) => {
  if (!linted.output) {
    return
  }
  process.stdout.write(linted.output)
  if (linted.errored) {
    process.exitCode = 2
  }
}).catch(err => {
  console.log(err.stack)
  const exitCode = typeof err.code === 'number' ? err.code : 1
  process.exit(exitCode)
})