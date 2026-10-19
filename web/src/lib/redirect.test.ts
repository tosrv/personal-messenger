import { safeRedirect } from './redirect'

describe('safeRedirect', () => {
  it.each([
    ['/u/tomy', '/u/tomy'],
    ['/c/1?x=2', '/c/1?x=2'],
    [null, '/'],
    ['', '/'],
    ['https://evil.com', '/'],
    ['//evil.com', '/'],
    ['/\\evil.com', '/'],
    ['javascript:alert(1)', '/'],
  ])('safeRedirect(%j) → %j', (input, want) => {
    expect(safeRedirect(input)).toBe(want)
  })
})
