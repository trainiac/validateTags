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

function readFile (filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, content) => {
      if (err) {
        return reject(err)
      }
      resolve(content)
    })
  })
}

const prepareReturnValue = formatter => validateTagsResults => {
  return new Promise(resolve => {
    const errored = validateTagsResults.some(result => result.errors.length)

    const returnValue = {
      errored,
      output: formatter(validateTagsResults)
    }

    resolve(returnValue)
  })
}

function validateTagsForFiles (fileList, options) {
  return globby(fileList).then(filePaths => {
    const getValidateTagsResults = filePaths.map(filePath => {
      const absoluteFilepath = (!path.isAbsolute(filePath))
        ? path.join(process.cwd(), filePath)
        : filePath

      return readFile(absoluteFilepath).then(validateTags).then(result => {
        return {
          source: filePath,
          errors: result.errors
        }
      })
    })

    return Promise.all(getValidateTagsResults)
  }).then(prepareReturnValue(formatters[options.f]))
}

Promise.resolve().then(() => {
  const args = minimist(process.argv.slice(2))
  args.f = args.f || 'string'
  return validateTagsForFiles(process.argv[2], args)
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