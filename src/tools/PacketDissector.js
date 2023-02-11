import { useEffect, useMemo, useState } from 'react';
import FileButton from '../components/FileButton';
import TextInput from '../components/TextInput';
import { Buffer } from "buffer"
import DissectionTree from '../components/DissectionTree';
import DissectionDump from '../components/DissectionDump';
import { Allotment } from 'allotment';
import "allotment/dist/style.css";
import PacketVirtualTable from '../components/PacketVirtualTable';
import { Button } from '../components/Button';
import PacketSummaryModal from '../components/PacketSummaryModal';
import { Tab } from '@headlessui/react';
import TabButton from '../components/TabButton';

export const NO_SELECTION = { id: "", position: [0, 0, 0] }

const EXAMPLE_CAPTURES = [
  new URL("../examples/captures/http.cap", import.meta.url),
  new URL("../examples/captures/bfd-raw-auth-simple.pcap", import.meta.url),
  new URL("../examples/captures/dns.cap", import.meta.url),
]

function PacketDissector() {
  const worker = useMemo(
    () => new Worker(new URL("../workers/wiregasm.worker.js", import.meta.url)),
    []
  );

  const [ packets, setPackets ] = useState([]);
  const [ status, setStatus ] = useState("Loading...");
  const [ columns, setColumns ] = useState([]);
  const [ filter, setFilter ] = useState("")
  const [ selectedFile, setSelectedFile ] = useState(null);
  const [ selectedIndex, setSelectedIndex ] = useState(0);
  const [ selectedPacket, setSelectedPacket ] = useState(null);
  const [ preparedPositions, setPreparedPositions ] = useState(new Map());
  const [ selectedTreeEntry, setSelectedTreeEntry ] = useState(NO_SELECTION);
  const [ finishedProcessing, setFinishedProcessing ] = useState(true);
  const [ summary, setSummary ] = useState(null);
  const [ summaryOpen, setSummaryOpen ] = useState(false);
  const [ currentExampleData, setCurrentExampleData ] = useState(null);
  const [ selectedDataSourceIndex, setSelectedDataSourceIndex ] = useState(0);

  const addPacket = useMemo(() => (packet) => {
    setPackets(prev => [...prev, packet])
  }, [])

  const clear = useMemo(() => () => {
    setPackets([])
    setSelectedIndex(0)
    setSelectedPacket(null)
    setPreparedPositions({})
    setSelectedTreeEntry(NO_SELECTION)
    setSelectedDataSourceIndex(0);
  }, [])

  useEffect(() => {
    setSelectedDataSourceIndex(selectedTreeEntry.position[0])
  }, [ selectedTreeEntry ])

  const processData = useMemo(() => (name, data) => {
    clear()
    setSelectedFile(null)
    setSummary(null)
    setFinishedProcessing(false)
    worker.postMessage({ type: "process-data", name: name, data: data, filter: filter })
  }, [ clear, filter, worker ])

  const loadExample = useMemo(() => async () => {
    const example = EXAMPLE_CAPTURES[Math.floor(Math.random()*EXAMPLE_CAPTURES.length)];
    const name = example.toString().split('/').pop();

    const res = await fetch(example)
    const body = await res.arrayBuffer();

    setCurrentExampleData({ name: name, data: body })
    processData(name, body)
  }, [ processData ])

  const preparePositions = useMemo(() => (id, node) => {
    let map = new Map();

    if (node.tree && node.tree.length > 0) {
      for (let i=0; i<node.tree.length; i++) {
        map = new Map([...map, ...preparePositions(`${id}-${i}`, node.tree[i])])
      }
    } else if (node.position && node.position[2] > 0) {
      map.set(id, node.position);
    }

    return map;
  }, []);

  const findSelection = useMemo(() => (src_idx, pos) => {
    // find the smallest one
    let current = null;

    for (let [k, pp] of preparedPositions) {
      if (pp[0] !== src_idx)
        continue;

      if (pos >= pp[1] && pos <= pp[1] + pp[2]) {
        if (current != null && preparedPositions.get(current)[2] > pp[2] ) {
          current = k
        } else {
          current = k
        }
      }
    }

    if (current != null) {
      setSelectedTreeEntry({ id: current, position: preparedPositions.get(current) })
    }
  }, [ preparedPositions ])

  useEffect(() => {
    clear()
    if (window.Worker) {
      worker.onmessage = (e) => {
        if (e.data.type === "init") {
          worker.postMessage({ type: "columns" })
        } else if (e.data.type === "columns") {
          setColumns(e.data.data);
        } else if (e.data.type === "status") {
          setStatus(e.data.status);
        } else if (e.data.type === "error") {
          setStatus(`Error: ${e.data.error}`);
        } else if (e.data.type === "packet") {
          addPacket(e.data.packet);
        } else if (e.data.type === "packets") {
          setPackets(prev => [...prev, ...e.data.data])
        } else if (e.data.type === "end") {
          setStatus(`Finished processing file`);
          setFinishedProcessing(true);
          setSummary(e.data.summary);
        } else if (e.data.type === "selected") {
          setSelectedPacket(e.data.data);
          setPreparedPositions(preparePositions("root", e.data.data))
          setSelectedTreeEntry(NO_SELECTION)
          setSelectedDataSourceIndex(0)
        } else if (e.data.type === "processed" && e.data.code !== 0) {
          setStatus(`Error: non-zero return code (${e.data.code})`);
        }
      };
    }

    return () => {
      worker.terminate();
    };
  }, [worker, preparePositions, addPacket, clear]);

  useEffect(() => {
    if (finishedProcessing && selectedIndex >= 0 && selectedIndex < packets.length) {
      worker.postMessage({ type: "select", number: packets[selectedIndex].number })
    }
  }, [ selectedIndex, packets, worker, finishedProcessing ])

  const process = useMemo(() => (f) => {
    clear()
    setFinishedProcessing(false)
    worker.postMessage({ type: "process", file: f, filter: filter })
  }, [ worker, filter, clear ])

  const filterFile = useMemo(() => () => {
    if (selectedFile !== null) {
      process(selectedFile)
    } else if (currentExampleData !== null) {
      processData(currentExampleData.name, currentExampleData.data)
    }
  }, [ selectedFile, currentExampleData, process, processData ])

  const loadFile = useMemo(() => (e) => {
    const f = e.target.files[0];
    setSummary(null)
    setSelectedIndex(0)
    setSelectedPacket(null)
    setSelectedFile(f)
    setCurrentExampleData(null)
    process(f)
  }, [ process ])

  return (
    <div>
      <PacketSummaryModal open={summaryOpen} setOpen={setSummaryOpen} summary={summary} />
      <div className='flex items-center w-full'>
        <FileButton variant="text" onFileSelected={loadFile}>Load File</FileButton>
        <Button className={"ml-5"} variant="text" onClick={loadExample}>Load Random Example</Button>
        <div className="ml-5 text-sm text-gray-500">
          <strong>Status: </strong>
          {status}
        </div>
        { summary != null && (
          <Button className={"ml-5"} variant="text" onClick={() => setSummaryOpen(true)}>Summary</Button>
        )}
        <div className="ml-auto text-sm">
          {packets.length} packets
        </div>
      </div>
      <TextInput
        type="text"
        name="filter"
        id="filter"
        className="py-1 mt-2 w-full"
        placeholder="display filter, example: tcp"
        value={filter}
        onEnter={filterFile}
        onChange={(e) => setFilter(e.target.value)}
        autoComplete={"off"}
      />
      <div className='h-[70vh] mt-3'>
        <Allotment vertical>
          <Allotment.Pane minSize={200} preferredSize={200}>
            <PacketVirtualTable columns={columns} packets={packets} selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} />
          </Allotment.Pane>
          <Allotment.Pane>
          {selectedPacket != null && (
            <div className="h-full">
              <Allotment>
                <Allotment.Pane>
                  <div className="font-mono text-xs whitespace-nowrap pt-3 pb-3 overflow-y-auto h-full select-none">
                    <DissectionTree id="root" select={(entry) => setSelectedTreeEntry(entry)} selected={selectedTreeEntry.id} tree={selectedPacket.tree} root />
                  </div>
                </Allotment.Pane>
                <Allotment.Pane>
                  <div className='ml-5 pt-3 pb-3 overflow-y-auto h-full'>
                    <Tab.Group selectedIndex={selectedDataSourceIndex} onChange={setSelectedDataSourceIndex}>
                      <Tab.List className="flex space-x-4">
                        {selectedPacket.data_sources.map((ds) => (
                          <TabButton className="px-1 py-0 text-xs" key={`tb-${ds.idx}`}>{ds.name}</TabButton>
                        ))}
                      </Tab.List>
                      <Tab.Panels className="mt-2">
                        {selectedPacket.data_sources.map((ds) => {
                          const pos = ds.idx === selectedTreeEntry.position[0] ? [ selectedTreeEntry.position[1], selectedTreeEntry.position[2] ] : [0, 0]
                          return (
                            <Tab.Panel key={`tp-${ds.idx}`}>
                              <DissectionDump buffer={Buffer.from(ds.data, "base64")} select={(pos) => findSelection(ds.idx, pos)} selected={pos} />
                            </Tab.Panel>
                          )
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
  )
}

export default PacketDissector