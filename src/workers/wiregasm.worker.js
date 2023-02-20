import { Wiregasm } from '@goodtools/wiregasm'
import loadWiregasm from '@goodtools/wiregasm/dist/wiregasm'
import wasmModule from '@goodtools/wiregasm/dist/wiregasm.wasm'
import wasmData from '@goodtools/wiregasm/dist/wiregasm.data'
import { Buffer } from "buffer"

const wg = new Wiregasm();

function replacer(key, value) {
  if (value.constructor.name.startsWith("Vector")) {
    return new Array(value.size()).fill(0).map((_, id) => value.get(id));
  }
  return value;
}

wg.init(loadWiregasm, {
  locateFile: (path, prefix) => {
    if (path.endsWith(".data")) return wasmData;
    if (path.endsWith(".wasm")) return wasmModule;
    return prefix + path;
  },
  handleStatus: (type, status) => postMessage({ type: "status", code: type, status: status }),
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
    const res = wg.frame(number);
    postMessage({ type: "selected", data: JSON.parse(JSON.stringify(res, replacer)) })
  } else if (event.data.type === "select-frames") {
    const skip = event.data.skip;
    const limit = event.data.limit;
    const filter = event.data.filter;
    const res = wg.frames(filter, skip, limit);

    // send it to the correct port
    event.ports[0].postMessage({result: JSON.parse(JSON.stringify(res, replacer))});
  } else if (event.data.type === "check-filter") {
    const filter = event.data.filter;
    const res = wg.lib.checkFilter(filter);

    if (res.ok) {
      event.ports[0].postMessage({result: true });
    } else {
      event.ports[0].postMessage({error: res.error });
    }
  } else if (event.data.type === "process") {
    const f = event.data.file;
    const reader = new FileReader();
    reader.addEventListener('load', (event) => {
      // XXX: this blocks the worker thread
      const res = wg.load(f.name, Buffer.from(event.target.result));
      postMessage({ type: "processed", name: f.name, data: res });
    });
    reader.readAsArrayBuffer(f);
  } else if (event.data.type === "process-data") {
    const name = event.data.name;
    const data = event.data.data;
    const res = wg.load(name, Buffer.from(data));
    postMessage({ type: "processed", name: name, data: res });
  }
};

export {};