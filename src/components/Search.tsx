import { Fragment, useEffect, useRef, useState, useCallback, forwardRef } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { createAutocomplete } from '@algolia/autocomplete-core'
import type { AutocompleteApi, AutocompleteState, AutocompleteCollection } from '@algolia/autocomplete-core'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search as SearchIcon, Loader2 } from 'lucide-react'
import { filteredTools } from '@/config/tools.config'
import type { Tool } from '@/types'
import clsx from 'clsx'

interface SearchItem extends Tool {
  objectID: string
  [key: string]: unknown
}

function useAutocomplete() {
  const navigate = useNavigate()
  const [autocompleteState, setAutocompleteState] = useState<AutocompleteState<SearchItem>>({
    collections: [],
    isOpen: false,
    query: '',
    activeItemId: null,
    status: 'idle',
    completion: null,
    context: {},
  })

  const autocomplete = useRef(
    createAutocomplete<SearchItem>({
      onStateChange({ state }) {
        setAutocompleteState(state)
      },
      getSources() {
        return [
          {
            sourceId: 'tools',
            getItems({ query }: { query: string }) {
              if (!query) {
                return filteredTools.map((tool, idx) => ({
                  ...tool,
                  objectID: `tool-${idx}`,
                }))
              }

              const lowerQuery = query.toLowerCase()
              return filteredTools
                .filter(
                  (tool) =>
                    tool.title.toLowerCase().includes(lowerQuery) ||
                    tool.description.toLowerCase().includes(lowerQuery) ||
                    tool.searchTags.some((tag) => tag.toLowerCase().includes(lowerQuery)),
                )
                .map((tool, idx) => ({
                  ...tool,
                  objectID: `tool-${idx}-${tool.title}`,
                }))
            },
            onSelect({ item }: { item: SearchItem }) {
              navigate(item.href)
            },
          },
        ]
      },
    }),
  ).current

  return { autocomplete, autocompleteState }
}

function SearchResult({
  result,
  autocomplete,
  collection,
  resultIndex,
}: {
  result: SearchItem
  autocomplete: AutocompleteApi<SearchItem>
  collection: AutocompleteCollection<SearchItem>
  resultIndex: number
}) {
  const navigate = useNavigate()

  return (
    <li
      className={clsx(
        'group block cursor-pointer px-4 py-3 aria-selected:bg-primary/10',
        resultIndex > 0 && 'border-t border-border',
      )}
      {...(autocomplete.getItemProps({
        item: result,
        source: collection.source,
      }) as unknown as React.LiHTMLAttributes<HTMLLIElement>)}
      onClick={() => {
        navigate(result.href)
      }}
    >
      <div className='flex items-start gap-3'>
        <div className='flex-1 min-w-0'>
          <div className='font-semibold text-foreground group-aria-selected:text-primary'>{result.title}</div>
          <div className='text-sm text-muted-foreground line-clamp-2'>{result.description}</div>
          {result.searchTags && result.searchTags.length > 0 && (
            <div className='mt-1 flex flex-wrap gap-1'>
              {result.searchTags.slice(0, 3).map((tag) => (
                <span key={tag} className='text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground'>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

function SearchResults({
  autocomplete,
  query,
  collection,
}: {
  autocomplete: AutocompleteApi<SearchItem>
  query: string
  collection: AutocompleteCollection<SearchItem>
}) {
  if (collection.items.length === 0) {
    return (
      <div className='p-6 text-center sm:p-14'>
        <SearchIcon className='mx-auto h-6 w-6 text-muted-foreground' />
        <p className='mt-4 text-sm text-muted-foreground'>
          Nothing found for <strong className='break-words font-semibold text-foreground'>&lsquo;{query}&rsquo;</strong>
          . Please try again.
        </p>
      </div>
    )
  }

  return (
    <ul {...(autocomplete.getListProps() as unknown as React.HTMLAttributes<HTMLUListElement>)}>
      {collection.items.map((result: SearchItem, resultIndex: number) => (
        <SearchResult
          key={result.objectID}
          result={result}
          resultIndex={resultIndex}
          autocomplete={autocomplete}
          collection={collection}
        />
      ))}
    </ul>
  )
}

const SearchInput = forwardRef<
  HTMLInputElement,
  { autocomplete: AutocompleteApi<SearchItem>; autocompleteState: AutocompleteState<SearchItem>; onClose: () => void }
>(function SearchInput({ autocomplete, autocompleteState, onClose }, inputRef) {
  const inputProps = autocomplete.getInputProps({
    inputElement: (inputRef as React.RefObject<HTMLInputElement>).current,
  }) as unknown as React.InputHTMLAttributes<HTMLInputElement>

  return (
    <div className='group relative flex h-12'>
      <SearchIcon className='pointer-events-none absolute left-3 top-0 h-full w-5 text-muted-foreground' />
      <input
        ref={inputRef}
        className={clsx(
          'flex-auto appearance-none border-none bg-transparent pl-10 text-foreground outline-none placeholder:text-muted-foreground focus:w-full focus:flex-none focus:outline-none sm:text-sm',
          autocompleteState.status === 'stalled' ? 'pr-11' : 'pr-4',
        )}
        placeholder='Search tools...'
        {...inputProps}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !autocompleteState.isOpen && autocompleteState.query === '') {
            ;(document.activeElement as HTMLElement)?.blur()
            onClose()
          } else if (event.key === 'Tab' && autocompleteState.isOpen) {
            // Prevent default tab behavior and simulate arrow key navigation
            event.preventDefault()
            const newEvent = new KeyboardEvent('keydown', {
              key: event.shiftKey ? 'ArrowUp' : 'ArrowDown',
              bubbles: true,
            }) as unknown as React.KeyboardEvent<HTMLInputElement>
            if (inputProps.onKeyDown) {
              inputProps.onKeyDown(newEvent)
            }
          } else {
            if (inputProps.onKeyDown) {
              inputProps.onKeyDown(event)
            }
          }
        }}
      />
      {autocompleteState.status === 'stalled' && (
        <div className='absolute inset-y-0 right-3 flex items-center'>
          <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
        </div>
      )}
    </div>
  )
})

function SearchDialog({
  open,
  setOpen,
  className,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  className?: string
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { autocomplete, autocompleteState } = useAutocomplete()
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [location, setOpen])

  useEffect(() => {
    if (!open) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, setOpen])

  return (
    <Transition.Root show={open} as={Fragment} afterLeave={() => autocomplete.setQuery('')}>
      <Dialog onClose={setOpen} className={clsx('fixed inset-0 z-50', className)}>
        <Transition.Child
          as={Fragment}
          enter='ease-out duration-300'
          enterFrom='opacity-0'
          enterTo='opacity-100'
          leave='ease-in duration-200'
          leaveFrom='opacity-100'
          leaveTo='opacity-0'
        >
          <div className='fixed inset-0 bg-background/80 backdrop-blur-sm' />
        </Transition.Child>

        <div className='fixed inset-0 overflow-y-auto px-4 py-4 sm:py-20 sm:px-6 md:py-32 lg:px-8 lg:py-[15vh]'>
          <Transition.Child
            as={Fragment}
            enter='ease-out duration-300'
            enterFrom='opacity-0 scale-95'
            enterTo='opacity-100 scale-100'
            leave='ease-in duration-200'
            leaveFrom='opacity-100 scale-100'
            leaveTo='opacity-0 scale-95'
          >
            <Dialog.Panel className='mx-auto overflow-hidden rounded-lg bg-card shadow-xl ring-1 ring-border sm:max-w-xl'>
              <div {...(autocomplete.getRootProps({}) as unknown as React.HTMLAttributes<HTMLDivElement>)}>
                <form
                  ref={formRef}
                  {...(autocomplete.getFormProps({
                    inputElement: inputRef.current,
                  }) as unknown as React.FormHTMLAttributes<HTMLFormElement>)}
                >
                  <SearchInput
                    ref={inputRef}
                    autocomplete={autocomplete}
                    autocompleteState={autocompleteState}
                    onClose={() => setOpen(false)}
                  />
                  <div
                    ref={panelRef}
                    className='border-t border-border bg-background empty:hidden max-h-[60vh] overflow-y-auto'
                    {...(autocomplete.getPanelProps({}) as unknown as React.HTMLAttributes<HTMLDivElement>)}
                  >
                    {autocompleteState.isOpen && autocompleteState.collections[0] && (
                      <>
                        <SearchResults
                          autocomplete={autocomplete}
                          query={autocompleteState.query}
                          collection={autocompleteState.collections[0]}
                        />
                      </>
                    )}
                  </div>
                </form>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  )
}

function useSearchProps() {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  const dialogSetOpen = useCallback(
    (open: boolean) => {
      const button = buttonRef.current
      if (!open || (button && button.getBoundingClientRect().width !== 0)) {
        setOpen(open)
      }
    },
    [buttonRef],
  )

  return {
    buttonProps: {
      ref: buttonRef,
      onClick() {
        setOpen(true)
      },
    },
    dialogProps: {
      open,
      setOpen: dialogSetOpen,
    },
  }
}

export function Search() {
  const [modifierKey, setModifierKey] = useState<string>('')
  const { buttonProps, dialogProps } = useSearchProps()

  useEffect(() => {
    setModifierKey(/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform) ? '⌘' : 'Ctrl ')
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        dialogProps.setOpen(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dialogProps])

  return (
    <div className='hidden lg:block lg:max-w-md lg:flex-auto'>
      <button
        type='button'
        className='hidden h-9 w-full items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition hover:bg-accent hover:text-accent-foreground lg:flex focus:outline-none focus:ring-2 focus:ring-primary/50'
        {...buttonProps}
      >
        <SearchIcon className='h-4 w-4' />
        Find a tool...
        <kbd className='ml-auto inline-flex gap-1 text-xs text-muted-foreground'>
          <kbd className='font-sans'>{modifierKey}</kbd>
          <kbd className='font-sans'>K</kbd>
        </kbd>
      </button>
      <SearchDialog className='hidden lg:block' {...dialogProps} />
    </div>
  )
}

export function MobileSearch() {
  const { buttonProps, dialogProps } = useSearchProps()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        dialogProps.setOpen(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dialogProps])

  return (
    <div className='contents lg:hidden'>
      <button
        type='button'
        className='flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-accent hover:text-accent-foreground lg:hidden focus:outline-none focus:ring-2 focus:ring-primary/50'
        aria-label='Find a tool...'
        {...buttonProps}
      >
        <SearchIcon className='h-5 w-5' />
      </button>
      <SearchDialog className='lg:hidden' {...dialogProps} />
    </div>
  )
}
