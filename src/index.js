const fp = require('lodash/fp')
// Regular Expressions for parsing tags and attributes
const startTag = /^<([-A-Za-z0-9_]+)((?:\s+[\w-@:.]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/
const endTag = /^<\/([-A-Za-z0-9_]+)[^>]*>/

// Special Elements (can contain anything)
const special = ['script', 'style']
const endComment = '-->'
const startComment = '<!--'
const beginEndTag = '</'

function validateCloseOrder (tags, errors) {
  let tagIndex = -1
  while (++tagIndex < tags.length) {
    const tag = tags[tagIndex]
    if (tag.type === 'close') {
      let isError = false
      if (tagIndex === 0) {
        isError = true
      } else {
        const lastTag = tags[tagIndex - 1]
        if (lastTag.type === 'open' && lastTag.name !== tag.name) {
          isError = true
        }
      }

      if (isError) {
        errors.push(formatError('UnexpectedClosingTag', tag))
      }
    }
  }
}

function validateOpenClose (tags, errors) {
  const grouped = fp.groupBy('name', tags)

  fp.forEach(tagGroup => {
    const openTags = []
    tagGroup.forEach(tag => {
      if (tag.type === 'close') {
        if (openTags.length > 0) {
          openTags.pop()
        } else {
          errors.push(formatError('UnexpectedClosingTag', tag))
        }
      } else if (tag.type === 'open') {
        openTags.push(tag)
      }
    })
    openTags.forEach(tag => {
      errors.push(formatError('UnclosedTag', tag))
    })
  }, grouped)
}

function formatError (rule, tag) {
  let text
  if (rule === 'UnclosedTag') {
    text = `Unclosed ${tag.name} tag`
  } else if (rule === 'UnclosedComment') {
    text = 'Unclosed comment'
  } else {
    text = `Unexpected ${tag.name} closing tag`
  }

  return {
    rule,
    text,
    line: tag.line + 1,
    column: tag.col + 1
  }
}

function findLineCol (lines, currentLine, currentCol, term) {
  let lineIndex = currentLine - 1
  while (++lineIndex < lines.length) {
    const line = lines[lineIndex]
    if (!line.length) {
      continue
    }

    let colIndex
    if (lineIndex === currentLine) {
      colIndex = currentCol
    } else {
      colIndex = 0
    }

    if (colIndex >= line.length) {
      continue
    }

    let termIndex
    if (!term && line.substring(colIndex).length) {
      termIndex = colIndex
    } else if (term) {
      termIndex = line.substring(colIndex).indexOf(term)
      if (termIndex !== -1) {
        termIndex += colIndex
      }
    }
    if (termIndex !== -1) {
      return {
        line: lineIndex,
        col: termIndex
      }
    }
  }

  return {
    line: lineIndex,
    col: 0
  }
}

function validateStartComment (lines, line, col) {
  const result = findLineCol(lines, line, col, endComment)
  if (result.line < lines.length) {
    return {
      line: result.line,
      col: result.col + endComment.length
    }
  }

  return {
    error: formatError('UnclosedComment', {
      type: 'open',
      name: 'comment',
      line,
      col
    }),
    line: lines.length,
    col: 0
  }
}

function validateEndTag (lines, line, col) {
  const currentLineText = lines[line].substring(col)
  const match = currentLineText.match(endTag)
  let tag = null
  if (match) {
    tag = {
      type: 'close',
      name: match[1],
      line,
      col
    }
    col += match[0].length
  } else {
    col += beginEndTag.length
  }

  const result = findLineCol(lines, line, col)

  return {
    tag,
    line: result.line,
    col: result.col
  }
}

function validateStartTag (lines, line, col) {
  const html = lines.slice(line).join('\n')
  const htmlAtCol = html.substring(col)
  const match = htmlAtCol.match(startTag)

  if (match) {
    const matchLines = match[0].split('\n')
    // self closing
    if (match[3] === '/') {
      let newCol
      if (matchLines.length === 1) {
        newCol = col + match[0].length
      } else {
        newCol = fp.last(matchLines).length
      }
      return {
        tag: {
          type: 'self-closing',
          name: match[1],
          line,
          col
        },
        line: matchLines.length - 1 + line,
        col: newCol
      }
    }

    if (special.indexOf(match[1]) !== -1) {
      const afterStartTag = htmlAtCol.substring(match[0].length)

      const specialContentToEnd = new RegExp(`([^]*)(</${match[1]}[^>]*>)`)
      const specialContentToEndMatch = afterStartTag.match(specialContentToEnd)
      if (!specialContentToEndMatch) {
        return {
          error: formatError('UnclosedTag', {
            type: 'open',
            name: match[1]
          }),
          line: lines.length,
          col: 0
        }
      }

      const specialContent = match[0] + specialContentToEndMatch[0]
      const specialContentLines = specialContent.split('\n')

      let newCol
      if (specialContentLines.length === 1) {
        newCol = col + specialContent.length
      } else {
        newCol = fp.last(specialContentLines).length
      }
      return {
        line: specialContentLines.length - 1 + line,
        col: newCol
      }
    }

    let newCol
    if (matchLines.length === 1) {
      newCol = col + match[0].length
    } else {
      newCol = fp.last(matchLines).length
    }

    return {
      tag: {
        type: match[1] === 'meta' ? 'self-closing' : 'open',
        name: match[1],
        line,
        col
      },
      line: matchLines.length - 1 + line,
      col: newCol
    }
  }

  const result = findLineCol(lines, line, col + 1)
  return {
    line: result.line,
    col: result.col
  }
}

function validateNextTag (lines, line, col) {
  const result = findLineCol(lines, line, col, '<')

  if (result.line < lines.length) {
    const currentLine = result.line
    const currentCol = result.col

    const currentLineText = lines[currentLine].substring(currentCol)

    if (currentLineText.indexOf(startComment) === 0) {
      return validateStartComment(lines, currentLine, currentCol + startComment.length)
    }

    if (currentLineText.indexOf(beginEndTag) === 0) {
      return validateEndTag(lines, currentLine, currentCol)
    }

    return validateStartTag(lines, currentLine, currentCol)
  }

  return {
    line: lines.length,
    col: 0
  }
}

function validateTagsInput (input) {
  const lines = input.split('\n')
  const tags = []
  const errors = []
  let line = 0
  let col = 0
  let lastLine = line
  let lastCol = col

  while (findLineCol(lines, line, col).line < lines.length) {
    const validation = validateNextTag(lines, line, col)

    if (validation.error) {
      errors.push(validation.error)
    }

    if (validation.tag) {
      tags.push(validation.tag)
    }

    line = validation.line
    col = validation.col

    if (line === lastLine && lastCol === col) {
      throw Error('parsing error')
    }

    lastCol = col
    lastLine = line
  }

  validateCloseOrder(tags, errors)
  validateOpenClose(tags, errors)

  return {
    tags,
    errors: fp.orderBy(['tag.line', 'tag.col'], ['asc'], errors)
  }
}

module.exports = function validateTags (input) {
  const result = validateTagsInput(input)
  return new Promise(resolve => resolve(result))
}
