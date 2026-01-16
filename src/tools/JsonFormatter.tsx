import Editor from "@monaco-editor/react";
import { Allotment } from "allotment";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useDarkModeContext } from "@/components/ModeToggle";
import { Tag } from "@/components/Tag";

import "allotment/dist/style.css";
import TextInput from "@/components/TextInput";
import jp from "jsonpath";
import { ObjectInspector } from "react-inspector";
import { cn } from "@/lib/utils";
import CheckBox from "@/components/CheckBox";
import { useJSONFormatterStore } from "@/stores";

function JsonFormatter() {
  const { darkMode } = useDarkModeContext();

  const {
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
  } = useJSONFormatterStore();

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
    } catch {
      // Invalid JSONPath query
    }
  }, [query, parsed, setFiltered]);

  const checkValidityAndSetValue = (val: string | undefined) => {
    if (!val) {
      setValue("");
      return;
    }

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
    setValue("{}");
  };

  return (
    <div className="h-[60vh] w-full">
      <Allotment>
        <Allotment.Pane>
          <div>
            <div className="mb-3">
              <Button onClick={() => format()}>Format</Button>
              <Button
                className="ml-3"
                variant="secondary"
                onClick={() => tiny()}
              >
                Minify
              </Button>
              <Button variant="ghost" className={"ml-3"} onClick={clear}>
                Clear
              </Button>
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
                wordWrap: "on" as const,
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
            className={cn(
              "pl-2 justify-items-center",
              tree ? "h-full overflow-y-auto" : "",
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
                  wordWrap: "on" as const,
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
