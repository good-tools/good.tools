import { Wiregasm, vectorToArray } from "@goodtools/wiregasm";
import loadWiregasm from "@goodtools/wiregasm/dist/wiregasm";
import { Buffer } from "buffer";
import pako from "pako";
import wasmPath from "@goodtools/wiregasm/dist/wiregasm.wasm.gz?url";
import dataPath from "@goodtools/wiregasm/dist/wiregasm.data.gz?url";

const wasmUrl = self.location.origin + wasmPath;
const dataUrl = self.location.origin + dataPath;

const wg = new Wiregasm();

function replacer(key, value) {
  if (value.constructor.name.startsWith("Vector")) {
    return vectorToArray(value);
  }
  return value;
}

const inflateRemoteBuffer = async (url) => {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const view = new Uint8Array(buf);

  if (view[0] === 0x1f && view[1] === 0x8b) {
    return pako.inflate(buf);
  }

  return view;
}

const fetchPackages = async () => {
  console.log("Fetching packages!");
  let [wasm, data] = await Promise.all([
    await inflateRemoteBuffer(wasmUrl),
    await inflateRemoteBuffer(dataUrl),
  ]);

  return { wasm, data };
};

fetchPackages()
  .then(({ wasm, data }) => {
    wg.init(loadWiregasm, {
      wasmBinary: wasm.buffer,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      getPreloadedPackage(name, size) {
        return data.buffer;
      },
      handleStatus: (type, status) =>
        postMessage({ type: "status", code: type, status: status }),
      handleError: (error) => postMessage({ type: "error", error: error }),
    })
      .then(() => {
        postMessage({ type: "init" });
      })
      .catch((e) => {
        postMessage({ type: "error", error: e });
      });
  })
  .catch((e) => {
    postMessage({ type: "error", error: e });
  });

onmessage = (event) => {
  if (event.data.type === "columns") {
    postMessage({ type: "columns", data: wg.columns() });
  } else if (event.data.type === "select") {
    const number = event.data.number;
    const res = wg.frame(number);
    postMessage({
      type: "selected",
      data: JSON.parse(JSON.stringify(res, replacer)),
    });
  } else if (event.data.type === "select-frames") {
    const skip = event.data.skip;
    const limit = event.data.limit;
    const filter = event.data.filter;
    const res = wg.frames(filter, skip, limit);

    // send it to the correct port
    event.ports[0].postMessage({
      result: JSON.parse(JSON.stringify(res, replacer)),
    });
  } else if (event.data.type === "check-filter") {
    const filter = event.data.filter;
    const res = wg.lib.checkFilter(filter);

    if (res.ok) {
      event.ports[0].postMessage({ result: true });
    } else {
      event.ports[0].postMessage({ error: res.error });
    }
  } else if (event.data.type === "process") {
    const f = event.data.file;
    const reader = new FileReader();
    reader.addEventListener("load", (event) => {
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
  } else if (event.data.type === "reload-quick") {
    if (wg.session) {
      // TODO: this is a hack, we should be able to reload the session
      const name = event.data.name;
      const res = wg.session.load();

      postMessage({ type: "processed", name: name, data: res });
    }
  } else if (event.data.type === "module-tree") {
    const res = wg.list_modules();
    // send it to the correct port
    event.ports[0].postMessage({
      result: JSON.parse(JSON.stringify(res, replacer)),
    });
  } else if (event.data.type === "module-prefs") {
    const res = wg.list_prefs(event.data.name);
    // send it to the correct port
    event.ports[0].postMessage({
      result: JSON.parse(JSON.stringify(res, replacer)),
    });
  } else if (event.data.type === "upload-file") {
    const f = event.data.file;
    const reader = new FileReader();
    reader.addEventListener("load", (e) => {
      // XXX: this blocks the worker thread
      const path = "/uploads/" + f.name;
      wg.lib.FS.writeFile(path, Buffer.from(e.target.result));
      event.ports[0].postMessage({ result: path });
    });
    reader.readAsArrayBuffer(f);
  } else if (event.data.type === "update-pref") {
    try {
      console.log(
        `set_pref(${event.data.module}, ${event.data.key}, ${event.data.value})`
      );
      wg.set_pref(event.data.module, event.data.key, event.data.value);
      event.ports[0].postMessage({ result: "ok" });
    } catch (e) {
      console.error(
        `set_pref(${event.data.module}, ${event.data.key}, ${event.data.value}) failed: ${e.message}`
      );
      event.ports[0].postMessage({ error: e.message });
    }
  } else if (event.data.type === "apply-prefs") {
    console.log(`apply_prefs()`);
    wg.apply_prefs();
    event.ports[0].postMessage({ result: "ok" });
  } else if (event.data.type === "get-version") {
    event.ports[0].postMessage({ result: wg.lib.wiresharkVersion() });
  }
};

export {};
