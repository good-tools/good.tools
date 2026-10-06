import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mergeNotebooks, useNotesStatus, useNotesStore } from '@/stores/notes.store'
import MarkdownNotes from './MarkdownNotes'

const printDocument = vi.hoisted(() => vi.fn())
vi.mock('@/lib/print-document', () => ({ printDocument }))

const note = (id: string, body: string, updated: number) => ({ id, body, updated })

beforeEach(() => {
  useNotesStatus.setState({ loaded: true, error: undefined })
  useNotesStore.setState({
    notes: [note('a', '# Alpha\n\n## Part one', 1), note('b', 'Beta body', 2)],
    activeId: 'a',
    deleted: [],
    view: 'preview',
    showNotes: true,
    showToc: true,
  })
})

describe('MarkdownNotes', () => {
  it('lists notes newest first and previews the active one with a toc', async () => {
    render(<MarkdownNotes />)
    const list = screen.getByRole('list', { name: 'Notes' })
    expect(
      within(list)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Beta body', 'Alpha'])
    expect(screen.getByTestId('preview').querySelector('h2#part-one')).toBeInTheDocument()
    expect(within(screen.getByRole('navigation')).getByText('Part one')).toBeInTheDocument()

    await userEvent.click(within(list).getByText('Beta body'))
    expect(screen.getByTestId('preview')).toHaveTextContent('Beta body')
  })

  it('creates notes and keeps one after deleting the last', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<MarkdownNotes />)
    await userEvent.click(screen.getByRole('button', { name: /new/i }))
    expect(useNotesStore.getState().notes).toHaveLength(3)
    for (let i = 0; i < 3; i++) await userEvent.click(screen.getByRole('button', { name: /delete/i }))
    const { notes, activeId } = useNotesStore.getState()
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({ id: activeId, body: '' })
  })
})

it('hides the notes list and contents for a focused editor', async () => {
  render(<MarkdownNotes />)
  await userEvent.click(screen.getByRole('button', { name: 'Notes list' }))
  await userEvent.click(screen.getByRole('button', { name: 'Contents' }))
  expect(screen.queryByRole('list', { name: 'Notes' })).not.toBeInTheDocument()
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Notes list' })).toHaveAttribute('aria-pressed', 'false')
})

it('waits for saved notes before rendering, so nothing overwrites them', () => {
  useNotesStatus.setState({ loaded: false })
  const { container } = render(<MarkdownNotes />)
  expect(container).toBeEmptyDOMElement()
})

it('merges two tabs: newer edit of each note wins, deletions stick', () => {
  const tabA = { notes: [note('x', 'x edited in A', 5), note('y', 'y old', 1), note('z', 'z', 1)], deleted: [] }
  const tabB = { notes: [note('x', 'x old', 1), note('y', 'y edited in B', 6)], deleted: ['z'] }
  expect(mergeNotebooks(tabA, tabB)).toEqual({
    notes: [note('x', 'x edited in A', 5), note('y', 'y edited in B', 6)],
    deleted: ['z'],
  })
})

it('exports the active note to the print dialog, titled after the note', async () => {
  render(<MarkdownNotes />)
  await userEvent.click(screen.getByRole('button', { name: /export pdf/i }))
  await vi.waitFor(() => expect(printDocument).toHaveBeenCalled())
  expect(printDocument).toHaveBeenCalledWith('Alpha', expect.stringContaining('<h2 data-line="3" id="part-one">'))
})
