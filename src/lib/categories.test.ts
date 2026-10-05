import { tools } from '@/config/tools.config'
import { searchTools, groupByCategory } from '@/lib/categories'

test('tool paths are unique and well-formed', () => {
  const paths = tools.map((t) => t.path)
  expect(new Set(paths).size).toBe(paths.length)
  for (const p of paths) expect(p).toMatch(/^\/[a-z0-9-]+$/)
})

test('every tool lands in exactly one sidebar group', () => {
  const grouped = groupByCategory(tools).flatMap(([, list]) => list)
  expect(grouped).toHaveLength(tools.length)
})

test('search matches all words across fields', () => {
  expect(searchTools(tools, 'base64').map((t) => t.path)).toContain('/base64')
  expect(searchTools(tools, 'json format')[0]?.path).toBe('/json')
  expect(searchTools(tools, 'xml')[0]?.path).toBe('/xml')
  expect(searchTools(tools, 'sha256').map((t) => t.path)).toEqual(['/hash'])
  expect(searchTools(tools, '   ')).toHaveLength(tools.length)
  expect(searchTools(tools, 'zzzz-nothing')).toHaveLength(0)
})
