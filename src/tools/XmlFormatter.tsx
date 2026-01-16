import { useState } from "react";
import Editor from "@monaco-editor/react";
import { Allotment } from "allotment";
import { Button } from "@/components/ui/button";
import { useDarkModeContext } from "@/components/ModeToggle";
import { Tag } from "@/components/Tag";
import "allotment/dist/style.css";
import xmlFormat from "xml-formatter";
import { XMLParser } from "fast-xml-parser";
import { ObjectInspector } from "react-inspector";

const DEFAULT_XML_OBJ = `<?xml version="1.0" encoding="UTF-8"?>
<greeting>Hello, world!</greeting>`;

function XmlFormatter() {
  const [value, setValue] = useState(DEFAULT_XML_OBJ);
  const [parsed, setParsed] = useState<string | Record<string, unknown>>("");
  const [valid, setValid] = useState(true);
  const { darkMode } = useDarkModeContext();
  const [defaultLanguage, setDefaultLanguage] = useState<"xml" | "json">("xml");
  const [tree, setTree] = useState(false);

  const format = () => {
    if (valid) {
      setTree(false);
      try {
        const formatted = xmlFormat(value);
        setDefaultLanguage("xml");
        setParsed(formatted);
        setValid(true);
      } catch {
        setValid(false);
      }
    }
  };

  const checkValidityAndSetValue = (val: string | undefined) => {
    if (!val) {
      setValue("");
      return;
    }

    setValue(val);
    if (val === "") {
      setValid(true);
      return;
    }
    const parser = new XMLParser();
    try {
      parser.parse(val, true);
      setValid(true);
    } catch {
      setValid(false);
    }
  };

  const tiny = () => {
    if (valid) {
      setTree(false);
      const mini = xmlFormat.minify(value, { collapseContent: true });
      setDefaultLanguage("xml");
      setParsed(mini);
    }
  };

  const tojson = () => {
    if (valid) {
      const parser = new XMLParser();
      const jsonObj = parser.parse(value) as Record<string, unknown> | null;
      if (jsonObj != null) {
        setDefaultLanguage("json");
        setTree(false);
        setParsed(jsonObj);
      }
    }
  };

  const totree = () => {
    if (valid) {
      tojson();
      setTree(true);
    }
  };

  const clear = () => {
    setValue("");
    setParsed("");
    setValid(true);
    setTree(false);
  };

  return (
    <div className="h-[60vh] w-full">
      <Allotment>
        <Allotment.Pane>
          <div>
            <div className="mb-3">
              <Button onClick={() => format()}>Format</Button>
              <Button
                className="ml-2"
                variant="secondary"
                onClick={() => tiny()}
              >
                Minify
              </Button>
              <Button
                className="ml-2"
                variant="secondary"
                onClick={() => tojson()}
              >
                XML to JSON
              </Button>
              <Button
                className="ml-2"
                variant="secondary"
                onClick={() => totree()}
              >
                Object Tree
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
              language="xml"
              onChange={(val) => checkValidityAndSetValue(val)}
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
          <div className="pl-2">
            <div className="w-full mb-2 text-sm ml-1">Output</div>
            {tree ? (
              <ObjectInspector
                data={parsed}
                theme={darkMode ? "chromeDark" : "chromeLight"}
              />
            ) : (
              <Editor
                height={"64vh"}
                value={
                  defaultLanguage === "xml"
                    ? (parsed as string)
                    : JSON.stringify(parsed, null, 2)
                }
                theme={darkMode ? "vs-dark" : "light"}
                language={defaultLanguage}
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

export default XmlFormatter;
