import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { useEffect, useMemo, useState } from 'react'
import WiregasmPreferenceTree, { type ModuleNode } from '@/components/WiregasmPreferenceTree'
import WiregasmModulePreferences, { type Preference } from '@/components/WiregasmModulePreferences'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Keeps modules whose name/title matches, plus ancestors of matches. A matching parent keeps all its children. */
export function filterModules(tree: ModuleNode[], filter: string): ModuleNode[] {
  const q = filter.trim().toLowerCase()
  if (!q) return tree
  return tree.flatMap((node) => {
    if (node.name.toLowerCase().includes(q) || node.title.toLowerCase().includes(q)) return [node]
    const submodules = filterModules(node.submodules, q)
    return submodules.length > 0 ? [{ ...node, submodules }] : []
  })
}

interface WiregasmPreferencesModalProps {
  initialized: boolean
  open: boolean
  setOpen: (open: boolean) => void
  loadModuleTree: () => Promise<ModuleNode[]>
  loadPreferences: (moduleName: string) => Promise<Preference[]>
  uploadFile: (file: File) => Promise<string>
  updatePreference: (moduleName: string, key: string, value: string) => Promise<void>
  applyPreferences: () => Promise<void>
}

function WiregasmPreferencesModal({
  initialized,
  open,
  setOpen,
  loadModuleTree,
  loadPreferences,
  uploadFile,
  updatePreference,
  applyPreferences,
}: WiregasmPreferencesModalProps) {
  const [moduleTree, setModuleTree] = useState<ModuleNode[]>([])
  const [selectedModule, setSelectedModule] = useState<ModuleNode | null>(null)
  const [modulePreferences, setModulePreferences] = useState<Preference[] | null>(null)
  const [updatedNonce, setUpdatedNonce] = useState(0)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)

  const filteredTree = useMemo(() => filterModules(moduleTree, filter), [moduleTree, filter])

  useEffect(() => {
    if (!initialized) return
    loadModuleTree().then(setModuleTree, (e: unknown) => setError(errorMessage(e)))
  }, [loadModuleTree, initialized])

  useEffect(() => {
    setModulePreferences(null)
    if (!selectedModule) return
    let cancelled = false
    loadPreferences(selectedModule.name).then(
      (data) => !cancelled && setModulePreferences(data),
      (e: unknown) => !cancelled && setError(errorMessage(e)),
    )
    return () => {
      cancelled = true
    }
  }, [loadPreferences, selectedModule, updatedNonce])

  const updatePreferenceValue = (key: string, value: string) => {
    if (!selectedModule) return Promise.reject(new Error('No module selected'))
    return updatePreference(selectedModule.name, key, value)
  }

  const apply = () => {
    setError(null)
    setApplying(true)
    applyPreferences()
      .then(() => {
        setUpdatedNonce((n) => n + 1)
        setOpen(false)
      })
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => setApplying(false))
  }

  return (
    <Dialog open={open} onClose={setOpen} className='relative z-50'>
      <DialogBackdrop
        transition
        className='fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-150 data-closed:opacity-0'
      />
      <div className='fixed inset-0 flex items-center justify-center p-4'>
        <DialogPanel
          transition
          className='flex h-[min(36rem,90dvh)] w-full max-w-5xl flex-col rounded-xl border bg-popover text-popover-foreground shadow-2xl transition duration-150 data-closed:scale-[0.98] data-closed:opacity-0'
        >
          <DialogTitle className='border-b px-4 py-3 text-sm font-semibold'>Wireshark preferences</DialogTitle>
          <div className='flex min-h-0 flex-1'>
            <div className='flex w-72 shrink-0 flex-col border-r'>
              <div className='p-3'>
                <Input
                  type='search'
                  aria-label='Filter modules'
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder='e.g. tls'
                  className='h-8'
                />
              </div>
              <div className='min-h-0 flex-1 overflow-auto px-3 pb-3'>
                <WiregasmPreferenceTree
                  nodes={filteredTree}
                  select={setSelectedModule}
                  selected={selectedModule}
                  expandAll={filter.trim() !== ''}
                />
              </div>
            </div>
            <div className='min-w-0 flex-1 overflow-auto p-4'>
              {selectedModule ? (
                <>
                  <h3 className='mb-3 text-sm font-semibold'>{selectedModule.description}</h3>
                  <WiregasmModulePreferences
                    key={`${selectedModule.name}-${updatedNonce}`}
                    preferences={modulePreferences}
                    uploadFile={uploadFile}
                    updatePreferenceValue={updatePreferenceValue}
                  />
                </>
              ) : (
                <p className='text-sm text-muted-foreground'>Select a module to view and edit its preferences.</p>
              )}
            </div>
          </div>
          <div className='flex items-center gap-2 border-t px-4 py-3'>
            <Alert className='mr-auto py-1'>{error}</Alert>
            <Button size='sm' variant='outline' className='ml-auto' onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button size='sm' onClick={apply} disabled={applying}>
              Apply
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

export default WiregasmPreferencesModal
