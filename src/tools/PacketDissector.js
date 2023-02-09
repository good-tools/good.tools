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

import ExampleCapture from '../examples/captures/http.cap';

export const NO_SELECTION = { id: "", position: [0, 0] }

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
  const [ preparedPositions, setPreparedPositions ] = useState({});
  const [ selectedTreeEntry, setSelectedTreeEntry ] = useState(NO_SELECTION);
  const [ finishedProcessing, setFinishedProcessing ] = useState(true);

  const addPacket = useMemo(() => (packet) => {
    setPackets(prev => [...prev, packet])
  }, [])

  const clear = useMemo(() => () => {
    setPackets([])
    setSelectedIndex(0)
    setSelectedPacket(null)
    setPreparedPositions({})
    setSelectedTreeEntry(NO_SELECTION)
  }, [])

  const loadExample = useMemo(() => async () => {
    const name = ExampleCapture.split('/').pop();
    console.log(name)
    const res = await fetch(ExampleCapture)
    const body = await res.arrayBuffer();

    clear()
    setFinishedProcessing(false)
    worker.postMessage({ type: "process-data", name: name, data: body, filter: filter })
  }, [ clear, filter, worker ])

  const preparePositions = useMemo(() => (id, node) => {
    let map = {};
    if (node.tree && node.tree.length > 0) {
      for (let i=0; i<node.tree.length; i++) {
        map = Object.assign(map, preparePositions(`${id}-${i}`, node.tree[i]));
      }
    } else if (node.position[1] > 0) {
      map[id] = node.position
    }

    return map;
  }, []);

  const findSelection = useMemo(() => (pos) => {
    // find the smallest one
    let current = null;

    for (let k in preparedPositions) {
      const pp = preparedPositions[k];
      if (pos >= pp[0] && pos <= pp[0] + pp[1]) {
        if (current != null && preparedPositions[current][1] > pp[1] ) {
          current = k
        } else {
          current = k
        }
      }
    }

    if (current != null) {
      setSelectedTreeEntry({ id: current, position: preparedPositions[current] })
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
        } else if (e.data.type === "selected") {
          setSelectedPacket(e.data.data);
          setPreparedPositions(preparePositions("root", e.data.data))
          setSelectedTreeEntry(NO_SELECTION)
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

  const loadFile = useMemo(() => (e) => {
    const f = e.target.files[0];
    setSelectedIndex(0)
    setSelectedPacket(null)
    setSelectedFile(f)
    process(f)
  }, [ process ])

  return (
    <div>
      <div className='flex items-center w-full'>
        <FileButton variant="text" onFileSelected={loadFile}>Load File</FileButton>
        <Button className={"ml-5"} variant="text" onClick={loadExample}>Load Example</Button>
        <div className="ml-5 text-sm text-gray-500">
          <strong>Status: </strong>
          {status}
        </div>
        <div className="ml-auto text-sm">
          {packets.length} packets
        </div>
      </div>
      <TextInput
        type="text"
        name="filter"
        id="filter"
        className="py-1 mt-2 w-full"
        placeholder="display filter"
        value={filter}
        onEnter={() => process(selectedFile)}
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
                    <DissectionDump buffer={Buffer.from(selectedPacket.bytes, "base64")} select={findSelection} selected={selectedTreeEntry.position} />
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