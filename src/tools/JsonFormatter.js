import Editor from "@monaco-editor/react";
import { Allotment } from "allotment";
import { useContext, useEffect } from "react";
import { Button } from "../components/Button";
import { DarkModeContext } from "../components/ModeToggle";
import { Tag } from "../components/Tag";

import "allotment/dist/style.css";
import TextInput from "../components/TextInput";
import jp from "jsonpath";
import { ObjectInspector } from "react-inspector";
import clsx from "clsx";
import CheckBox from "../components/CheckBox";
import create from "zustand";

const DEFAULT_JSON_OBJ = {
  message: "Hello, World!",
};

const useJSONFormatterStore = create((set) => ({
  value: JSON.stringify(DEFAULT_JSON_OBJ, null, 2),
  parsed: DEFAULT_JSON_OBJ,
  filtered: DEFAULT_JSON_OBJ,
  valid: true,
  query: "",
  tree: true,

  setValue: (v) => set(() => ({ value: v })),
  setParsed: (v) => set(() => ({ parsed: v })),
  setFiltered: (v) => set(() => ({ filtered: v })),
  setValid: (v) => set(() => ({ valid: v })),
  setQuery: (v) => set(() => ({ query: v })),
  setTree: (v) => set(() => ({ tree: v })),
}));

function JsonFormatter() {
  const { darkMode } = useContext(DarkModeContext);

  const [
    value,
    setValue,
    parsed,
    setParsed,
    filtered,
    setFiltered,
    valid,
    setValid,
    query,
    setQuery,
    tree,
    setTree,
  ] = useJSONFormatterStore((state) => [
    state.value,
    state.setValue,
    state.parsed,
    state.setParsed,
    state.filtered,
    state.setFiltered,
    state.valid,
    state.setValid,
    state.query,
    state.setQuery,
    state.tree,
    state.setTree,
  ]);

  const handleTreeChange = () => {
    setTree(!tree);
  };

  useEffect(() => {
    if (query.length <= 0) {
      setFiltered(parsed);
      return;
    }

    try {
      setFiltered(jp.query(parsed, query));
    } catch {}
  }, [query, parsed, setFiltered]);

  const checkValidityAndSetValue = (val) => {
    setValue(val);

    if (val === "") {
      setParsed(null);
      return;
    }

    setParsed(null);

    try {
      const p = JSON.parse(val);
      setParsed(p);

      setValid(true);
    } catch {
      setValid(false);
    }
  };

  const format = () => {
    if (parsed != null) {
      setValue(JSON.stringify(parsed, null, 2));
    }
  };

  const tiny = () => {
    if (parsed != null) {
      setValue(JSON.stringify(parsed));
    }
  };

  const clear = () => {
    setValue("{}")
  }

  return (
    <div className="h-[60vh] w-full">
      <Allotment>
        <Allotment.Pane>
          <div>
            <div className="mb-3">
              <Button variant="filled" onClick={() => format()}>
                Format
              </Button>
              <Button
                className="ml-3"
                variant="secondary"
                onClick={() => tiny()}
              >
                Minify
              </Button>
              <Button variant="text" className={"ml-3"} onClick={clear}>Clear</Button>
              {!valid && (
                <div className="inline ml-3">
                  <Tag color="rose">INVALID</Tag>
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
                  enabled: false,
                },
              }}
            />
          </div>
        </Allotment.Pane>
        <Allotment.Pane>
          <div
            className={clsx(
              "pl-2 justify-items-center",
              tree ? "h-full overflow-y-auto" : ""
            )}
          >
            <div className="mb-2 grid grid-cols-3 gap-2">
              <TextInput
                type="text"
                name="query"
                id="query"
                className="p-1 col-span-2"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="JSONPath query (example: $.message)"
              />
              <CheckBox
                checked={tree}
                onChange={handleTreeChange}
                title="Tree View"
              />
            </div>
            {tree ? (
              <ObjectInspector
                data={filtered}
                theme={darkMode ? "chromeDark" : "chromeLight"}
              />
            ) : (
              <Editor
                value={JSON.stringify(filtered, null, 2)}
                theme={darkMode ? "vs-dark" : "light"}
                height={"64vh"}
                defaultLanguage="json"
                options={{
                  readOnly: true,
                  wordWrap: true,
                  contextmenu: false,
                  minimap: {
                    enabled: false,
                  },
                }}
              />
            )}
          </div>
        </Allotment.Pane>
      </Allotment>
    </div>
  );
}

export default JsonFormatter;
