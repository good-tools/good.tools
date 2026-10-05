import { describe, expect, it } from 'vitest'
import { filterModules } from './WiregasmPreferencesModal'
import type { ModuleNode } from './WiregasmPreferenceTree'

const mod = (name: string, submodules: ModuleNode[] = []): ModuleNode => ({
  name,
  title: name.toUpperCase(),
  description: '',
  use_gui: true,
  submodules,
})

const tree = [mod('protocols', [mod('tls'), mod('http', [mod('http2')])]), mod('stats')]

describe('filterModules', () => {
  it('returns the tree unchanged for an empty filter', () => {
    expect(filterModules(tree, '  ')).toBe(tree)
  })

  it('keeps ancestors of matching descendants, pruning siblings', () => {
    expect(filterModules(tree, 'TLS')).toEqual([mod('protocols', [mod('tls')])])
  })

  it('keeps a matching parent even when none of its children match', () => {
    expect(filterModules(tree, 'protocols')).toEqual([tree[0]])
  })

  it('returns nothing when nothing matches', () => {
    expect(filterModules(tree, 'nope')).toEqual([])
  })
})
