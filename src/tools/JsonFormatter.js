import Editor from "@monaco-editor/react"
import { useContext, useState } from "react"
import { Button } from "../components/Button"
import { DarkModeContext } from "../components/ModeToggle"

const DEFAULT_JSON_OBJ = {
  "message": "Hello, World!"
}

function JsonFormatter() {
  const { darkMode } = useContext(DarkModeContext)
  const [ value, setValue ] = useState(JSON.stringify(DEFAULT_JSON_OBJ, null, 2))
  const [ parsed, setParsed ] = useState(DEFAULT_JSON_OBJ)

  const checkValidityAndSetValue = (val) => {
    setValue(val)

    if (val === "") {
      setParsed(null)
      return
    }

    setParsed(null)

    try {
      setParsed(JSON.parse(val))
    } catch {
    }
  }
  
  const format = () => {
    if (parsed != null) {
      setValue(JSON.stringify(parsed, null, 2))
    }
  }
  
  const tiny = () => {
    if (parsed != null) {
      setValue(JSON.stringify(parsed))
    }
  }

  return (
    <div>
      <Button
        className="mb-3"
        variant="filled"
        onClick={() => format()}
      >
        Format
      </Button>
      <Button
        className="mb-3 ml-2"
        variant="secondary"
        onClick={() => tiny()}
      >
        Remove Whitespace
      </Button>
      <Editor
          height="65vh"
          value={value}
          theme={darkMode ? "vs-dark" : "light"}
          defaultLanguage="json"
          onChange={(v) => checkValidityAndSetValue(v)}
          options={{
            scrollBeyondLastColumn: false,
            wordWrap: true,
            contextmenu: false,
          }}
        />
    </div>
  )
}

export default JsonFormatter