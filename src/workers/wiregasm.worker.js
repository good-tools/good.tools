import { Wiregasm } from '@goodtools/wiregasm'
import loadWiregasm from '@goodtools/wiregasm/dist/wiregasm'
import wasmModule from '@goodtools/wiregasm/dist/wiregasm.wasm'
import wasmData from '@goodtools/wiregasm/dist/wiregasm.data'
import { Buffer } from "buffer"

const wg = new Wiregasm();

// hold the data here
const MAX_BATCH_ELEMS = 1000;
const packets = new Map();
let batch = [];

const batchAway = (packet, end = false) => {
  if (packet != null) {
    // only save metadata
    batch.push({
      bg: packet.bg,
      fg: packet.fg,
      number: packet.number,
      columns: packet.columns,
    })
  }

  if (end || batch.length >= MAX_BATCH_ELEMS) {
    postMessage({ type: "packets", data: batch });

    // empty the batch
    batch = []
  }
}

wg.init(loadWiregasm, {
  locateFile: (path, prefix) => {
    if (path.endsWith(".data")) return wasmData;
    if (path.endsWith(".wasm")) return wasmModule;
    return prefix + path;
  },
  handlePacket: (packet) => {
    packets.set(packet.number, packet);
    batchAway(packet);
  },
  handleStatus: (status) => postMessage({ type: "status", status: status }),
  handleEnd: (summary) => {
    batchAway(null, true);
    postMessage({ type: "end", summary: summary });
  },
  handleError: (error) => postMessage({ type: "error", error: error }),
}).then(() => {
  postMessage({ type: "init" })
}).catch((e) => {
  postMessage({ type: "error", error: e })
})

onmessage = (event) => {
  if (event.data.type === "columns") {
    postMessage({ type: "columns", data: wg.columns() })
  } else if (event.data.type === "select") {
    const number = event.data.number;
    if (packets.has(number)) {
      postMessage({ type: "selected", data: packets.get(number) })
    }
  } else if (event.data.type === "process") {
    // clear old packets
    packets.clear();

    const f = event.data.file;
    const filter = event.data.filter;
    const reader = new FileReader();
    reader.addEventListener('load', (event) => {
      // XXX: this blocks the worker thread
      const code = wg.process_file(f.name, Buffer.from(event.target.result), filter);
      postMessage({ type: "processed", code: code });
    });
    reader.readAsArrayBuffer(f);
  } else if (event.data.type === "process-data") {
    // clear old packets
    packets.clear();

    const name = event.data.name;
    const data = event.data.data;
    const filter = event.data.filter;
    const code = wg.process_file(name, Buffer.from(data), filter);
    postMessage({ type: "processed", code: code });
  }
};

export {};