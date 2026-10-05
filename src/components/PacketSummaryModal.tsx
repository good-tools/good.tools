import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { filesize } from 'filesize'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/utils'

interface PacketSummary {
  filename: string
  file_type: string
  file_length: number
  file_encap_type: string
  packet_count: number
  start_time: number
  stop_time: number
  elapsed_time: number
}

interface PacketSummaryModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  summary: PacketSummary | null
  /** Display name; the summary's own filename is the path inside the wasm FS */
  name: string
}

function PacketSummaryModal({ open, setOpen, summary, name }: PacketSummaryModalProps) {
  if (summary === null) return null

  const fields: Array<[string, React.ReactNode]> = [
    ['Type', summary.file_type],
    ['Size', filesize(summary.file_length, { base: 2 })],
    ['Encapsulation', summary.file_encap_type],
    ['Packets', summary.packet_count.toLocaleString()],
    ['Start time', formatDateTime(summary.start_time * 1000)],
    ['Stop time', formatDateTime(summary.stop_time * 1000)],
    ['Duration', `${summary.elapsed_time} s`],
  ]

  return (
    <Dialog open={open} onClose={setOpen} className='relative z-50'>
      <DialogBackdrop
        transition
        className='fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-150 data-closed:opacity-0'
      />
      <div className='fixed inset-0 flex items-center justify-center p-4'>
        <DialogPanel
          transition
          className='w-full max-w-lg rounded-xl border bg-popover p-5 text-popover-foreground shadow-2xl transition duration-150 data-closed:scale-[0.98] data-closed:opacity-0'
        >
          <DialogTitle className='mb-4 truncate font-mono text-sm font-semibold'>{name}</DialogTitle>
          <dl className='grid grid-cols-2 gap-x-4 gap-y-3 text-sm'>
            {fields.map(([label, value]) => (
              <div key={label}>
                <dt className='text-xs text-muted-foreground'>{label}</dt>
                <dd className='mt-0.5'>{value}</dd>
              </div>
            ))}
          </dl>
          <div className='mt-5 flex justify-end'>
            <Button size='sm' variant='outline' onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

export default PacketSummaryModal
export type { PacketSummary }
