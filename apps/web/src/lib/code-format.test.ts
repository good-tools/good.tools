import { describe, expect, it } from 'vitest'
import { beautify, CodeError, canMinify, EXAMPLES, LANGUAGES, type Language, minify } from './code-format'

const error = (p: Promise<unknown>) =>
  p.then(
    () => expect.unreachable(),
    (e: unknown) => {
      expect(e).toBeInstanceOf(CodeError)
      return e as CodeError
    },
  )

describe('beautify', () => {
  it('formats JavaScript with the chosen indent', async () => {
    expect(await beautify('function f(a){return a+1}', 'javascript', '2')).toBe('function f(a) {\n  return a + 1;\n}\n')
    expect(await beautify('function f(a){return a+1}', 'javascript', '4')).toContain('\n    return')
    expect(await beautify('function f(a){return a+1}', 'javascript', 'tab')).toContain('\n\treturn')
  })

  it('formats TypeScript, CSS, SCSS and HTML', async () => {
    expect(await beautify('const x:number=1', 'typescript', '2')).toBe('const x: number = 1;\n')
    expect(await beautify('a{color:red}', 'css', '2')).toBe('a {\n  color: red;\n}\n')
    expect(await beautify('.a{&:hover{color:red}}', 'scss', '2')).toBe('.a {\n  &:hover {\n    color: red;\n  }\n}\n')
    expect(await beautify('<div><p>hi</p></div>', 'html', '2')).toBe('<div><p>hi</p></div>\n')
  })

  it('formats SQL in the chosen dialect', async () => {
    expect(await beautify('select a,b from t where x=1', 'sql', '2')).toBe(
      'SELECT\n  a,\n  b\nFROM\n  t\nWHERE\n  x = 1\n',
    )
    expect(await beautify('select `a` from t', 'sql', '2', 'mysql')).toContain('`a`')
  })

  it('reports parse errors with a position', async () => {
    const js = await error(beautify('const a = {\n  b: 1,,\n}', 'javascript', '2'))
    expect(js.line).toBe(2)
    expect(js.column).toBeGreaterThan(0)
    expect(js.message).not.toContain('\n')
    const css = await error(beautify('a { color: red', 'css', '2'))
    expect(css.line).toBe(1)
    const sql = await error(beautify('select (a from t', 'sql', '2'))
    expect(sql.line).toBe(1)
  })

  it('beautifies every example', async () => {
    for (const lang of Object.keys(LANGUAGES) as Language[]) await beautify(EXAMPLES[lang], lang, '2')
  })
})

describe('minify', () => {
  it('minifies JavaScript, CSS and HTML', async () => {
    expect(
      await minify('function add(first, second) {\n  return first + second\n}\nexport default add', 'javascript'),
    ).toBe('function add(d,t){return d+t}export default add;')
    expect(await minify('a {\n  color: #ff0000;\n  margin: 0px;\n}', 'css')).toBe('a{color:red;margin:0}')
    expect(
      await minify(
        '<p class="a" style="color: #ff0000; margin: 0px">\n  Hello   <b>world</b>\n</p>\n<!-- c -->\n<style>a { color: #ff0000 }</style>',
        'html',
      ),
    ).toBe('<p class="a" style="color:red;margin:0">Hello <b>world</b></p><style>a{color:red}</style>')
  })

  it('reports JavaScript parse errors with a 1-based position', async () => {
    const e = await error(minify('let a = 1\nlet = = 2', 'javascript'))
    expect(e.line).toBe(2)
    expect(e.column).toBeGreaterThan(0)
  })

  it('rejects languages without a minifier', async () => {
    expect(canMinify('sql')).toBe(false)
    await expect(minify('select 1', 'sql')).rejects.toThrow(/not supported/)
  })
})
