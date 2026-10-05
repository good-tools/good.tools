import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotesStore } from '@/stores/notes.store'
import MarkdownNotes from './MarkdownNotes'

const note = (id: string, body: string, updated: number) => ({ id, body, updated })

beforeEach(() =>
  useNotesStore.setState({
    notes: [note('a', '# Alpha\n\n## Part one', 1), note('b', 'Beta body', 2)],
    activeId: 'a',
    view: 'preview',
  }),
)

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
