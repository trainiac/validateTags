const table = require('table')
const _ = require('lodash')
const chalk = require('chalk')
const path = require('path')
const stringWidth = require('string-width')
const symbols = require('log-symbols')

const MARGIN_WIDTHS = 9

function logFrom (fromValue) {
  if (fromValue.charAt(0) === '<') return fromValue
  return path.relative(process.cwd(), fromValue).split(path.sep).join('/')
}

function getMessageWidth (columnWidths) {
  if (!process.stdout.isTTY) {
    return columnWidths[3]
  }

  const availableWidth = process.stdout.columns < 80 ? 80 : process.stdout.columns
  const fullWidth = _.sum(_.values(columnWidths))

  // If there is no reason to wrap the text, we won't align the last column to the right
  if (availableWidth > fullWidth + MARGIN_WIDTHS) {
    return columnWidths[3]
  }

  return availableWidth - (fullWidth - columnWidths[3] + MARGIN_WIDTHS)
}

function formatter (messages, source) {
  if (!messages.length) return ''

  const orderedMessages = _.sortBy(messages, m => m.line ? 2 : 1, // positionless first
  m => m.line, m => m.column)

  // Create a list of column widths, needed to calculate
  // the size of the message column and if needed wrap it.
  const columnWidths = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 }

  const calculateWidths = function (columns) {
    _.forOwn(columns, (value, key) => {
      const normalisedValue = value ? value.toString() : value
      columnWidths[key] = Math.max(columnWidths[key], stringWidth(normalisedValue))
    })

    return columns
  }

  let output = '\n'

  if (source) {
    output += `${chalk.underline(logFrom(source))}\n`
  }

  const cleanedMessages = orderedMessages.map(message => {
    const severity = 'error'
    const row = [message.line, message.column, chalk.red(symbols[severity]), message.text]
    calculateWidths(row)

    return row
  })

  output += table.table(cleanedMessages, {
    border: table.getBorderCharacters('void'),
    columns: {
      0: { alignment: 'right', width: columnWidths[0], paddingRight: 0 },
      1: { alignment: 'left', width: columnWidths[1] },
      2: { alignment: 'center', width: columnWidths[2] },
      3: { alignment: 'left', width: getMessageWidth(columnWidths), wrapWord: true },
      4: { alignment: 'left', width: columnWidths[4], paddingRight: 0 }
    },
    drawHorizontalLine: () => false
  }).split('\n').map(el => el.replace(/(\d+)\s+(\d+)/, (m, p1, p2) => chalk.dim(`${p1}:${p2}`))).join('\n')

  return output
}

module.exports = function (results) {
  let output = results.reduce((next, result) => {
    next += formatter(result.errors, result.source)
    return next
  }, '')

  // Ensure consistent padding
  output = output.trim()

  if (output !== '') {
    output = `\n${output}\n\n`
  }

  return output
}