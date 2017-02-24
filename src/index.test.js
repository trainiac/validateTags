const validateTags = require('./index')

describe('validateTags', () => {
  it('should return no errors and all tags for proper html', () => {
    const html = '<div></div>'
    const validation = validateTags(html)
    expect(validation.errors).toHaveLength(0)
    expect(validation.tags).toHaveLength(2)
  })

  it('should return no errors for self-closing tags', () => {
    const html = '<div><img/></div>'
    const validation = validateTags(html)
    expect(validation.errors).toHaveLength(0)
    expect(validation.tags).toHaveLength(3)
  })
})
