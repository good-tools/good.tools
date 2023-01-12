import Editor from "@monaco-editor/react"
import { Allotment } from "allotment"
import { useContext, useEffect, useState } from "react"
import { Button } from "../components/Button"
import { DarkModeContext } from "../components/ModeToggle"
import { Tag } from "../components/Tag"

import "allotment/dist/style.css";
import TextInput from "../components/TextInput"
import jp from "jsonpath"

const DEFAULT_JSON_OBJ = {
  "message": "Hello, World!"
}

function JsonFormatter() {
  const { darkMode } = useContext(DarkModeContext)
  const [ value, setValue ] = useState(JSON.stringify(DEFAULT_JSON_OBJ, null, 2))
  const [ parsed, setParsed ] = useState(DEFAULT_JSON_OBJ)
  const [ filtered, setFiltered ] = useState(DEFAULT_JSON_OBJ)
  const [ valid, setValid ] = useState(true)
  const [ query, setQuery ] = useState("")

  useEffect(() => {
    if (query.length <= 0) {
      setFiltered(parsed)
      return
    }

    try {
      setFiltered(jp.query(parsed, query))
    } catch {
      
    }

  }, [ query, parsed ] )

  const checkValidityAndSetValue = (val) => {
    setValue(val)

    if (val === "") {
      setParsed(null)
      return
    }

    setParsed(null)

    try {
      const p = JSON.parse(val)
      setParsed(p)

      setValid(true)
    } catch {
      setValid(false)
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
    <div className="h-[60vh] w-full">
      <Allotment>
        <Allotment.Pane>
          <div>
            <div className="mb-3">
              <Button
                variant="filled"
                onClick={() => format()}
              >
                Format
              </Button>
              <Button
                className="ml-2"
                variant="secondary"
                onClick={() => tiny()}
              >
                Remove Whitespace
              </Button>
              { !valid && (
                <div className="inline ml-3">
                  <Tag color="rose">
                    INVALID
                  </Tag>
                </div>
              )}
            </div>
            <Editor
                height={"64vh"}
                value={value}
                theme={darkMode ? "vs-dark" : "light"}
                defaultLanguage="json"
                onChange={(v) => checkValidityAndSetValue(v)}
                options={{
                  wordWrap: true,
                  contextmenu: false,
                  minimap: {
                    enabled: false
                  }
                }}
              />
          </div>
        </Allotment.Pane>
        <Allotment.Pane>
          <div className="pl-2">
            <div className="w-full mb-2">
              <TextInput
                type="text"
                name="query"
                id="query"
                className="w-full p-1"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="JSONPath query (example: $.message)"
              />
            </div>
            {/* <ObjectTree object={filtered} /> */}
            <Editor
                height={"64vh"}
                value={JSON.stringify(filtered, null, 2)}
                theme={darkMode ? "vs-dark" : "light"}
                defaultLanguage="json"
                options={{
                  readOnly: true,
                  wordWrap: true,
                  contextmenu: false,
                  minimap: {
                    enabled: false
                  }
                }}
              />
          </div>

        </Allotment.Pane>
      </Allotment>
      
    </div>
  )
}

export default JsonFormatter