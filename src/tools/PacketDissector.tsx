import { useEffect, useMemo, useState } from "react";
import FileButton from "@/components/FileButton";
import TextInput from "@/components/TextInput";
import { Buffer } from "buffer";
import DissectionTree, {
  type DissectionNode,
  type DissectionSelection,
} from "@/components/DissectionTree";
import DissectionDump from "@/components/DissectionDump";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import PacketVirtualTable, {
  type PacketRow,
} from "@/components/PacketVirtualTable";
import { Button } from "@/components/Button";
import PacketSummaryModal, {
  type PacketSummary,
} from "@/components/PacketSummaryModal";
import { Tab } from "@headlessui/react";
import TabButton from "@/components/TabButton";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import clsx from "clsx";
import { Tag } from "@/components/Tag";
import WiregasmPreferencesModal from "@/components/WiregasmPreferencesModal";
import type { ModuleNode } from "@/components/WiregasmPreferenceTree";
import type { Preference } from "@/components/WiregasmModulePreferences";

export const NO_SELECTION: DissectionSelection = {
  id: "",
  idx: 0,
  start: 0,
  length: 0,
};

const EXAMPLE_CAPTURES = [
  new URL("../examples/captures/http.cap", import.meta.url),
  new URL("../examples/captures/bfd-raw-auth-simple.pcap", import.meta.url),
  new URL("../examples/captures/dns.cap", import.meta.url),
];

interface WorkerResponse<T> {
  error?: string;
  result?: T;
}

interface SelectedPacket {
  tree: DissectionNode[];
  data_sources: Array<{
    name: string;
    data: string;
  }>;
}

interface ProcessedResponse {
  code: number;
  summary: PacketSummary;
}

interface GetFramesResult {
  frames: PacketRow[];
  matched: number;
}

const checkFilter = (worker: Worker, filter: string): Promise<boolean> =>
  new Promise((res, rej) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = ({
      data,
    }: MessageEvent<WorkerResponse<boolean>>) => {
      channel.port1.close();
      if (data.error) {
        rej(data.error);
      } else {
        res(data.result ?? false);
      }
    };

    worker.postMessage({ type: "check-filter", filter: filter }, [
      channel.port2,
    ]);
  });

const getFrames = (
  worker: Worker,
  filter: string,
  skip: number,
  limit: number
): Promise<GetFramesResult> =>
  new Promise((res, rej) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = ({
      data,
    }: MessageEvent<WorkerResponse<GetFramesResult>>) => {
      channel.port1.close();
      if (data.error) {
        rej(data.error);
      } else {
        res(data.result ?? { frames: [], matched: 0 });
      }
    };

    worker.postMessage(
      { type: "select-frames", filter: filter, skip: skip, limit: limit },
      [channel.port2]
    );
  });

const getVersion = (worker: Worker): Promise<string> =>
  new Promise((res, rej) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = ({
      data,
    }: MessageEvent<WorkerResponse<string>>) => {
      channel.port1.close();
      if (data.error) {
        rej(data.error);
      } else {
        res(data.result ?? "");
      }
    };

    worker.postMessage({ type: "get-version" }, [channel.port2]);
  });

const loadModuleTreeFromWorker = (worker: Worker): Promise<ModuleNode[]> =>
  new Promise((res, rej) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = ({
      data,
    }: MessageEvent<WorkerResponse<ModuleNode[]>>) => {
      channel.port1.close();
      if (data.error) {
        rej(data.error);
      } else {
        res(data.result ?? []);
      }
    };

    worker.postMessage({ type: "module-tree" }, [channel.port2]);
  });

const loadPreferencesFromWorker = (
  worker: Worker,
  name: string
): Promise<Preference[]> =>
  new Promise((res, rej) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = ({
      data,
    }: MessageEvent<WorkerResponse<Preference[]>>) => {
      channel.port1.close();
      if (data.error) {
        rej(data.error);
      } else {
        res(data.result ?? []);
      }
    };

    worker.postMessage({ type: "module-prefs", name: name }, [channel.port2]);
  });

const uploadFileToWorker = (worker: Worker, file: File): Promise<string> =>
  new Promise((res, rej) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = ({
      data,
    }: MessageEvent<WorkerResponse<string>>) => {
      channel.port1.close();
      if (data.error) {
        rej(data.error);
      } else {
        res(data.result ?? "");
      }
    };

    worker.postMessage({ type: "upload-file", file: file }, [channel.port2]);
  });

const updatePreferenceToWorker = (
  worker: Worker,
  module: string,
  key: string,
  value: string
): Promise<void> =>
  new Promise((res, rej) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = ({
      data,
    }: MessageEvent<WorkerResponse<void>>) => {
      channel.port1.close();
      if (data.error) {
        rej(data.error);
      } else {
        res();
      }
    };

    worker.postMessage(
      { type: "update-pref", module: module, key: key, value: value },
      [channel.port2]
    );
  });

const applyPreferencesToWorker = (worker: Worker): Promise<void> =>
  new Promise((res, rej) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = ({
      data,
    }: MessageEvent<WorkerResponse<void>>) => {
      channel.port1.close();
      if (data.error) {
        rej(data.error);
      } else {
        res();
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
  const [version, setVersion] = useState<string | null>(null);
  const [totalFrames, setTotalFrames] = useState(0);
  const [matchedFrames, setMatchedFrames] = useState(0);
  const [status, setStatus] = useState("Loading...");
  const [columns, setColumns] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [filterError, setFilterError] = useState<string | null>(null);
  const [currentFilter, setCurrentFilter] = useState("");
  const [selectedFrame, setSelectedFrame] = useState(1);
  const [selectedPacket, setSelectedPacket] = useState<SelectedPacket | null>(
    null
  );
  const [preparedPositions, setPreparedPositions] = useState<
    Map<string, DissectionSelection>
  >(new Map());
  const [selectedTreeEntry, setSelectedTreeEntry] =
    useState<DissectionSelection>(NO_SELECTION);
  const [finishedProcessing, setFinishedProcessing] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [summary, setSummary] = useState<PacketSummary | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [selectedDataSourceIndex, setSelectedDataSourceIndex] = useState(0);
  const [fileName, setFileName] = useState("");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [dissectionNonce, setDissectionNonce] = useState(0);

  const clear = useMemo(
    () => () => {
      setSelectedFrame(1);
      setSelectedPacket(null);
      setPreparedPositions(new Map());
      setSelectedTreeEntry(NO_SELECTION);
      setSelectedDataSourceIndex(0);
    },
    []
  );

  useEffect(() => {
    setSelectedDataSourceIndex(selectedTreeEntry.idx);
  }, [selectedTreeEntry]);

  const processData = useMemo(
    () => (name: string, data: ArrayBuffer) => {
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
      if (!example) return;
      const name = example.toString().split("/").pop() ?? "example.cap";

      const res = await fetch(example);
      const body = await res.arrayBuffer();

      processData(name, body);
    },
    [processData]
  );

  const preparePositions = useMemo(
    () =>
      (id: string, node: DissectionNode): Map<string, DissectionSelection> => {
        let map = new Map<string, DissectionSelection>();

        if (node.tree && node.tree.length > 0) {
          for (let i = 0; i < node.tree.length; i++) {
            const childNode = node.tree[i];
            if (childNode) {
              map = new Map([
                ...map,
                ...preparePositions(`${id}-${i}`, childNode),
              ]);
            }
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
    () => (src_idx: number, pos: number) => {
      // find the smallest one
      let current: string | null = null;

      for (const [k, pp] of preparedPositions) {
        if (pp.idx !== src_idx) continue;

        if (pos >= pp.start && pos <= pp.start + pp.length) {
          if (
            current != null &&
            preparedPositions.get(current)!.length > pp.length
          ) {
            current = k;
          } else {
            current = k;
          }
        }
      }

      if (current != null) {
        const selection = preparedPositions.get(current);
        if (selection) {
          setSelectedTreeEntry(selection);
        }
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
        setFilterError(String(e));
      });
  }, [filter, worker, initialized]);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    getVersion(worker)
      .then((version) => {
        setVersion(version);
      })
      .catch((_e) => {
        // Silent error
      });
  }, [worker, initialized]);

  useEffect(() => {
    clear();
    if (window.Worker) {
      worker.onmessage = (e: MessageEvent) => {
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
          const response: {
            code: number;
            data: ProcessedResponse;
            name: string;
          } = e.data;

          setFinishedProcessing(true);
          setFileName(e.data.name);

          // -12 is short read
          if (response.data.code === 0 || response.data.code === -12) {
            // in case of a reload, update the dissection nonce
            setDissectionNonce(Math.random());
            if (response.data.code !== 0) {
              setStatus(`Code: ${response.data.code}`);
            }
            setTotalFrames(response.data.summary.packet_count);
            setSummary(response.data.summary);
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
    () => (f: File) => {
      clear();
      setFinishedProcessing(false);
      worker.postMessage({ type: "process", file: f });
    },
    [worker, clear]
  );

  const fetchPackets = useMemo(
    () => async (filter: string, skip: number, limit: number) => {
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
    () => (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;

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
    () => async (name: string) => {
      return await loadPreferencesFromWorker(worker, name);
    },
    [worker]
  );

  const uploadFile = useMemo(
    () => async (file: File) => {
      return await uploadFileToWorker(worker, file);
    },
    [worker]
  );

  const updatePreference = useMemo(
    () => async (module: string, key: string, value: string) => {
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
        <FileButton variant="ghost" onFileSelected={loadFile}>
          Load File
        </FileButton>
        <Button className="ml-5" variant="text" onClick={loadExample}>
          Load Random Example
        </Button>
        <Button
          className="ml-5"
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
          <Tag className="ml-5" color="emerald">
            {currentFilter}
          </Tag>
        )}
        {summary != null && (
          <Button
            className="ml-5"
            variant="text"
            onClick={() => setSummaryOpen(true)}
          >
            Summary
          </Button>
        )}
        {version != null && <div className="ml-auto text-sm">v{version}</div>}
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
        autoComplete="off"
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
                            const pos: [number, number] =
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
