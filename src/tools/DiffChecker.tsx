import { useState } from "react";
import { DiffEditor, default as Editor } from "@monaco-editor/react";
import { Tab } from "@headlessui/react";
import TabButton from "@/components/TabButton";
import { useDarkModeContext } from "@/components/ModeToggle";

function DiffChecker() {
  const { darkMode } = useDarkModeContext();
  const [original, setOriginal] = useState("");
  const [changed, setChanged] = useState("");

  function handleEditorDidMount(editor: {
    updateOptions: (options: { readOnly: boolean }) => void;
  }) {
    editor.updateOptions({ readOnly: true });
  }

  return (
    <Tab.Group>
      <Tab.List className="flex space-x-4">
        <TabButton>Original</TabButton>
        <TabButton>Modified</TabButton>
        <TabButton>Diff</TabButton>
      </Tab.List>
      <Tab.Panels className="mt-2">
        <Tab.Panel>
          <Editor
            height="65vh"
            value={original}
            theme={darkMode ? "vs-dark" : "light"}
            onChange={(v) => setOriginal(v || "")}
          />
        </Tab.Panel>
        <Tab.Panel>
          <Editor
            height="65vh"
            theme={darkMode ? "vs-dark" : "light"}
            value={changed}
            onChange={(v) => setChanged(v || "")}
          />
        </Tab.Panel>
        <Tab.Panel>
          <DiffEditor
            height="65vh"
            theme={darkMode ? "vs-dark" : "light"}
            original={original}
            modified={changed}
            onMount={handleEditorDidMount}
          />
        </Tab.Panel>
      </Tab.Panels>
    </Tab.Group>
  );
}

export default DiffChecker;
