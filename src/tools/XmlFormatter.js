import { useContext, useState } from "react";
import Editor from "@monaco-editor/react";
import { Allotment } from "allotment";
import { Button } from "../components/Button";
import { DarkModeContext } from "../components/ModeToggle";
import { Tag } from "../components/Tag";
import "allotment/dist/style.css";
import { pd } from "pretty-data";
import { XMLParser } from "fast-xml-parser";
import { ObjectInspector } from "react-inspector";

const DEFAULT_XML_OBJ = `<?xml version="1.0" encoding="UTF-8"?>
<greeting>Hello, world!</greeting>`;

function XmlFormatter() {
  const [value, setValue] = useState(DEFAULT_XML_OBJ);
  const [parsed, setParsed] = useState("")
  const [valid, setValid] = useState(true);
  const { darkMode } = useContext(DarkModeContext);
  const [defaultLanguage, setDefaultLanguage] = useState("xml");
  const [tree, setTree] = useState(false);

  const format = () => {
    if (valid) {
      setTree(false);
      try {
        let formatted = pd.xml(value);
        setDefaultLanguage("xml");
        setParsed(formatted)
        setValid(true);
      } catch {
        setValid(false);
      }
    }
  };

  const checkValidityAndSetValue = (val) => {
    setValue(val);
    if (val === "") {
      setValid(true);
      return;
    }
    const parser = new XMLParser();
    try {
      parser.parse(val, true);
      setValid(true);
    } catch (err) {
      setValid(false);
    }
  };

  const tiny = () => {
    if (valid) {
      setTree(false);
      let mini = pd.xmlmin(value);
      setDefaultLanguage("xml");
      setParsed(mini)
    }
  };

  const tojson = () => {
    if (valid) {
      const parser = new XMLParser();
      let jsonObj = parser.parse(value);
      if (jsonObj != null) {
        setDefaultLanguage("json");
        setTree(false);
        setParsed(jsonObj)
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
    setValue("")
    setParsed("")
    setValid(true)
    setTree(false)
  };

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
              language="xml"
              onChange={(val) => checkValidityAndSetValue(val)}
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
          <div className="pl-2">
            <div className="w-full mb-2 text-sm ml-1">
              Output
            </div>
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
                    ? parsed
                    : JSON.stringify(parsed, null, 2)
                }
                theme={darkMode ? "vs-dark" : "light"}
                language={defaultLanguage}
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

export default XmlFormatter;
