import { useEffect, useMemo, useState } from "react";
import FileButton from "../components/FileButton";
import TextInput from "../components/TextInput";
import { Buffer } from "buffer";
import DissectionTree from "../components/DissectionTree";
import DissectionDump from "../components/DissectionDump";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import PacketVirtualTable from "../components/PacketVirtualTable";
import { Button } from "../components/Button";
import PacketSummaryModal from "../components/PacketSummaryModal";
import { Tab } from "@headlessui/react";
import TabButton from "../components/TabButton";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import clsx from "clsx";
import { Tag } from "../components/Tag";
import WiregasmPreferencesModal from "../components/WiregasmPreferencesModal";

export const NO_SELECTION = { id: "", idx: 0, start: 0, length: 0 };

const EXAMPLE_CAPTURES = [
  new URL("../examples/captures/http.cap", import.meta.url),
  new URL("../examples/captures/bfd-raw-auth-simple.pcap", import.meta.url),
  new URL("../examples/captures/dns.cap", import.meta.url),
];

const checkFilter = (worker, filter) =>
  new Promise((res, rej) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = ({ data }) => {
      channel.port1.close();
      if (data.error) {
        rej(data.error);
      } else {
        res(data.result);
      }
    };

    worker.postMessage({ type: "check-filter", filter: filter }, [
      channel.port2,
    ]);
  });

const getFrames = (worker, filter, skip, limit) =>
  new Promise((res, rej) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = ({ data }) => {
      channel.port1.close();
      if (data.error) {
        rej(data.error);
      } else {
        res(data.result);
      }
    };

    worker.postMessage(
      { type: "select-frames", filter: filter, skip: skip, limit: limit },
      [channel.port2]
    );
  });

const loadModuleTreeFromWorker = (worker) =>
  new Promise((res, rej) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = ({ data }) => {
      channel.port1.close();
      if (data.error) {
        rej(data.error);
      } else {
        res(data.result);
      }
    };

    worker.postMessage({ type: "module-tree" }, [channel.port2]);
  });

const loadPreferencesFromWorker = (worker, name) =>
  new Promise((res, rej) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = ({ data }) => {
      channel.port1.close();
      if (data.error) {
        rej(data.error);
      } else {
        res(data.result);
      }
    };

    worker.postMessage({ type: "module-prefs", name: name }, [channel.port2]);
  });

const uploadFileToWorker = (worker, file) =>
  new Promise((res, rej) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = ({ data }) => {
      channel.port1.close();
      if (data.error) {
        rej(data.error);
      } else {
        res(data.result);
      }
    };

    worker.postMessage({ type: "upload-file", file: file }, [channel.port2]);
  });

const updatePreferenceToWorker = (worker, module, key, value) =>
  new Promise((res, rej) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = ({ data }) => {
      channel.port1.close();
      if (data.error) {
        rej(data.error);
      } else {
        res(data.result);
      }
    };

    worker.postMessage(
      { type: "update-pref", module: module, key: key, value: value },
      [channel.port2]
    );
  });

const applyPreferencesToWorker = (worker) =>
  new Promise((res, rej) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = ({ data }) => {
      channel.port1.close();
      if (data.error) {
        rej(data.error);
      } else {
        res(data.result);
      }
    };

    worker.postMessage({ type: "apply-prefs" }, [channel.port2]);
  });

function PacketDissector() {
  const worker = useMemo(
    () => new Worker(new URL("../workers/wiregasm.worker.js", import.meta.url)),
    []
  );

  const queryClient = new QueryClient();
  const [totalFrames, setTotalFrames] = useState(0);
  const [matchedFrames, setMatchedFrames] = useState(0);
  const [status, setStatus] = useState("Loading...");
  const [columns, setColumns] = useState([]);
  const [filter, setFilter] = useState("");
  const [filterError, setFilterError] = useState(null);
  const [currentFilter, setCurrentFilter] = useState("");
  const [selectedFrame, setSelectedFrame] = useState(1);
  const [selectedPacket, setSelectedPacket] = useState(null);
  const [preparedPositions, setPreparedPositions] = useState(new Map());
  const [selectedTreeEntry, setSelectedTreeEntry] = useState(NO_SELECTION);
  const [finishedProcessing, setFinishedProcessing] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [selectedDataSourceIndex, setSelectedDataSourceIndex] = useState(0);
  const [fileName, setFileName] = useState("");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [dissectionNonce, setDissectionNonce] = useState(0);

  const clear = useMemo(
    () => () => {
      setSelectedFrame(1);
      setSelectedPacket(null);
      setPreparedPositions({});
      setSelectedTreeEntry(NO_SELECTION);
      setSelectedDataSourceIndex(0);
    },
    []
  );

  useEffect(() => {
    setSelectedDataSourceIndex(selectedTreeEntry.idx);
  }, [selectedTreeEntry]);

  const processData = useMemo(
    () => (name, data) => {
      clear();
      setSummary(null);
      setFinishedProcessing(false);
      worker.postMessage({ type: "process-data", name: name, data: data });
    },
    [clear, worker]
  );

  const loadExample = useMemo(
    () => async () => {
      const example =
        EXAMPLE_CAPTURES[Math.floor(Math.random() * EXAMPLE_CAPTURES.length)];
      const name = example.toString().split("/").pop();

      const res = await fetch(example);
      const body = await res.arrayBuffer();

      processData(name, body);
    },
    [processData]
  );

  const preparePositions = useMemo(
    () => (id, node) => {
      let map = new Map();

      if (node.tree && node.tree.length > 0) {
        for (let i = 0; i < node.tree.length; i++) {
          map = new Map([
            ...map,
            ...preparePositions(`${id}-${i}`, node.tree[i]),
          ]);
        }
      } else if (node.length > 0) {
        map.set(id, {
          id: id,
          idx: node.data_source_idx,
          start: node.start,
          length: node.length,
        });
      }

      return map;
    },
    []
  );

  const findSelection = useMemo(
    () => (src_idx, pos) => {
      // find the smallest one
      let current = null;

      for (let [k, pp] of preparedPositions) {
        if (pp.idx !== src_idx) continue;

        if (pos >= pp.start && pos <= pp.start + pp.length) {
          if (
            current != null &&
            preparedPositions.get(current).length > pp.length
          ) {
            current = k;
          } else {
            current = k;
          }
        }
      }

      if (current != null) {
        setSelectedTreeEntry(preparedPositions.get(current));
      }
    },
    [preparedPositions]
  );

  useEffect(() => {
    if (!initialized) {
      return;
    }

    checkFilter(worker, filter)
      .then(() => {
        setFilterError(null);
      })
      .catch((e) => {
        setFilterError(e);
      });
  }, [filter, worker, initialized]);

  useEffect(() => {
    clear();
    if (window.Worker) {
      worker.onmessage = (e) => {
        if (e.data.type === "init") {
          worker.postMessage({ type: "columns" });
          setInitialized(true);
        } else if (e.data.type === "columns") {
          setColumns(e.data.data);
        } else if (e.data.type === "status") {
          setStatus(e.data.status);
        } else if (e.data.type === "error") {
          setStatus(`Error: ${e.data.error}`);
        } else if (e.data.type === "selected") {
          setSelectedPacket(e.data.data);
          setPreparedPositions(preparePositions("root", e.data.data));
          setSelectedTreeEntry(NO_SELECTION);
          setSelectedDataSourceIndex(0);
        } else if (e.data.type === "processed") {
          // setStatus(`Error: non-zero return code (${e.data.code})`);
          const response = e.data.data;
          // console.log(response);

          setFinishedProcessing(true);
          setFileName(e.data.name);

          if (response.code === 0) {
            // in case of a reload, update the dissection nonce
            setDissectionNonce(Math.random());

            setTotalFrames(response.summary.packet_count);
            setSummary(response.summary);
          }
        }
      };
    }

    return () => {
      worker.terminate();
    };
  }, [worker, preparePositions, clear]);

  useEffect(() => {
    if (
      finishedProcessing &&
      selectedFrame >= 1 &&
      selectedFrame <= totalFrames
    ) {
      worker.postMessage({ type: "select", number: selectedFrame });
    }
  }, [selectedFrame, totalFrames, worker, finishedProcessing, dissectionNonce]);

  const process = useMemo(
    () => (f) => {
      clear();
      setFinishedProcessing(false);
      worker.postMessage({ type: "process", file: f });
    },
    [worker, clear]
  );

  const fetchPackets = useMemo(
    () => async (filter, skip, limit) => {
      // console.log("fetchPackets", filter, skip, limit);
      if (initialized && finishedProcessing) {
        const res = await getFrames(worker, filter, skip, limit);
        setMatchedFrames(res.matched);
        return res.frames;
      }

      return [];
    },
    [worker, initialized, finishedProcessing]
  );

  const loadFile = useMemo(
    () => (e) => {
      const f = e.target.files[0];
      setSummary(null);
      setSelectedFrame(1);
      setSelectedPacket(null);
      process(f);
    },
    [process]
  );

  const loadModuleTree = useMemo(
    () => async () => {
      return await loadModuleTreeFromWorker(worker);
    },
    [worker]
  );

  const loadPreferences = useMemo(
    () => async (name) => {
      return await loadPreferencesFromWorker(worker, name);
    },
    [worker]
  );

  const uploadFile = useMemo(
    () => async (file) => {
      return await uploadFileToWorker(worker, file);
    },
    [worker]
  );

  const updatePreference = useMemo(
    () => async (module, key, value) => {
      return await updatePreferenceToWorker(worker, module, key, value);
    },
    [worker]
  );

  const applyPreferences = useMemo(
    () => async () => {
      const res = await applyPreferencesToWorker(worker);
      worker.postMessage({ type: "reload-quick", name: fileName });
      return res;
    },
    [worker, fileName]
  );

  return (
    <div>
      <PacketSummaryModal
        open={summaryOpen}
        setOpen={setSummaryOpen}
        summary={summary}
      />
      <WiregasmPreferencesModal
        initialized={initialized}
        open={preferencesOpen}
        setOpen={setPreferencesOpen}
        loadModuleTree={loadModuleTree}
        loadPreferences={loadPreferences}
        uploadFile={uploadFile}
        updatePreference={updatePreference}
        applyPreferences={applyPreferences}
      />
      <div className="flex items-center w-full">
        <FileButton variant="text" onFileSelected={loadFile}>
          Load File
        </FileButton>
        <Button className={"ml-5"} variant="text" onClick={loadExample}>
          Load Random Example
        </Button>
        <Button
          className={"ml-5"}
          variant="text"
          onClick={() => setPreferencesOpen(true)}
        >
          Preferences
        </Button>
        <div className="ml-5 text-sm text-gray-500">
          <strong>Status: </strong>
          {status}
        </div>
        {currentFilter.length > 0 && (
          <Tag className={"ml-5"} color="emerald">
            {currentFilter}
          </Tag>
        )}
        {summary != null && (
          <Button
            className={"ml-5"}
            variant="text"
            onClick={() => setSummaryOpen(true)}
          >
            Summary
          </Button>
        )}
        <div className="ml-auto text-sm">
          {matchedFrames} / {totalFrames} packets
        </div>
      </div>
      <TextInput
        type="text"
        name="filter"
        id="filter"
        className={clsx(
          "py-1 mt-2 w-full",
          filterError != null
            ? "border-red-300 shadow-sm focus:border-red-500 focus:ring-red-500"
            : ""
        )}
        placeholder="display filter, example: tcp"
        value={filter}
        onEnter={() => setCurrentFilter(filter)}
        onChange={(e) => setFilter(e.target.value)}
        autoComplete={"off"}
      />
      {filterError != null && (
        <div className="text-xs text-red-500">{filterError}</div>
      )}
      <div className="h-[70vh] mt-3">
        <Allotment vertical>
          <Allotment.Pane minSize={200} preferredSize={200}>
            <QueryClientProvider client={queryClient}>
              <PacketVirtualTable
                columns={columns}
                fileName={fileName}
                filter={currentFilter}
                fetchPackets={fetchPackets}
                total={matchedFrames}
                selectedFrame={selectedFrame}
                setSelectedFrame={setSelectedFrame}
                dissectionNonce={dissectionNonce}
              />
            </QueryClientProvider>
          </Allotment.Pane>
          <Allotment.Pane>
            {selectedPacket != null && (
              <div className="h-full">
                <Allotment>
                  <Allotment.Pane>
                    <div className="font-mono text-xs whitespace-nowrap pt-3 pb-3 overflow-y-auto h-full select-none">
                      <DissectionTree
                        id="root"
                        select={(entry) => setSelectedTreeEntry(entry)}
                        selected={selectedTreeEntry.id}
                        tree={selectedPacket.tree}
                        root
                      />
                    </div>
                  </Allotment.Pane>
                  <Allotment.Pane>
                    <div className="ml-5 pt-3 pb-3 overflow-y-auto h-full">
                      <Tab.Group
                        selectedIndex={selectedDataSourceIndex}
                        onChange={setSelectedDataSourceIndex}
                      >
                        <Tab.List className="flex space-x-4">
                          {selectedPacket.data_sources.map((ds, idx) => (
                            <TabButton
                              className="px-1 py-0 text-xs"
                              key={`tb-${idx}`}
                            >
                              {ds.name}
                            </TabButton>
                          ))}
                        </Tab.List>
                        <Tab.Panels className="mt-2">
                          {selectedPacket.data_sources.map((ds, idx) => {
                            const pos =
                              idx === selectedTreeEntry.idx
                                ? [
                                    selectedTreeEntry.start,
                                    selectedTreeEntry.length,
                                  ]
                                : [0, 0];
                            return (
                              <Tab.Panel key={`tp-${idx}`}>
                                <DissectionDump
                                  buffer={Buffer.from(ds.data, "base64")}
                                  select={(pos) => findSelection(idx, pos)}
                                  selected={pos}
                                />
                              </Tab.Panel>
                            );
                          })}
                        </Tab.Panels>
                      </Tab.Group>
                    </div>
                  </Allotment.Pane>
                </Allotment>
              </div>
            )}
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
}

export default PacketDissector;
