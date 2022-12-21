import { useState } from "react"
import { diffLines } from "diff"

function DiffChecker() {
  const [ original, setOriginal ] = useState("")
  const [ changed, setChanged ] = useState("")
  const [ result, setResult ] = useState(null)

  const computeDiff = () => {
    const diff = diffLines(original, changed)
    let originalLines = 0
    let changedLines = 0
    let additions = 0
    let removals = 0
    
    diff.forEach(d => {
      if (d.added) {
        changedLines += d.count
        additions += d.count
      } else if (d.removed) {
        originalLines += d.count
        removals += d.count
      } else {
        changedLines += d.count
        originalLines += d.count
      }
    })
    
    setResult({
      diff: diff,
      original: {
        lines: originalLines,
        changes: removals,
      },
      changed: {
        lines: changedLines,
        changes: additions,
      },
    })
  }

  console.log(result)

  return (
    <div className="">
      {result !== null && (
        <>
        </>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-8">
        <textarea
          id="original"
          name="original"
          rows={8}
          value={original}
          onChange={(e) => setOriginal(e.target.value)}
          className="block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder={'Original'}
        />
        <textarea
          id="changed"
          name="changed"
          rows={8}
          value={changed}
          onChange={(e) => setChanged(e.target.value)}
          className="block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder={'Changed'}
        />
      </dl>
      <button
        type="button"
        onClick={computeDiff}
        className="mt-2 w-full block items-center rounded border border-transparent bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Find Difference
      </button>
    </div>
  )
}

export default DiffChecker