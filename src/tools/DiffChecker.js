import { useState } from "react"
import { DiffEditor, default as Editor } from "@monaco-editor/react";
import clsx from "clsx";
import { Tab } from "@headlessui/react";

function DiffChecker() {
  const [ original, setOriginal ] = useState("")
  const [ changed, setChanged ] = useState("")

  function handleEditorDidMount(editor, _) {
    editor.updateOptions({ readOnly: true })
  }

  return (
    <Tab.Group>
      <Tab.List className="flex space-x-4">
        <Tab className={({ selected }) => clsx(
            selected ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700',
            'px-3 py-2 font-medium text-sm rounded-md'
        )}>Original</Tab>
        <Tab className={({ selected }) => clsx(
            selected ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700',
            'px-3 py-2 font-medium text-sm rounded-md'
        )}>Modified</Tab>
        <Tab className={({ selected }) => clsx(
            selected ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700',
            'px-3 py-2 font-medium text-sm rounded-md'
        )}>Diff</Tab>
      </Tab.List>
      <Tab.Panels className="mt-2">
        <Tab.Panel>
          <Editor 
            height="50vh"
            value={original}
            onChange={(v) => setOriginal(v)}
          />
        </Tab.Panel>
        <Tab.Panel>
          <Editor 
            height="50vh"
            value={changed}
            onChange={(v) => setChanged(v)}
          />
        </Tab.Panel>
        <Tab.Panel>
          <DiffEditor
            height="50vh"
            original={original}
            modified={changed}
            onMount={handleEditorDidMount}
          />
        </Tab.Panel>
      </Tab.Panels>
    </Tab.Group>
  )
}

export default DiffChecker