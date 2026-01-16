import { Dialog, Transition } from "@headlessui/react";
import { Allotment } from "allotment";
import { Fragment, useEffect, useRef, useState } from "react";
import WiregasmPreferenceTree, {
  type ModuleNode,
} from "@/components/WiregasmPreferenceTree";
import WiregasmModulePreferences, {
  type Preference,
} from "@/components/WiregasmModulePreferences";

function recursiveFilter(tree: ModuleNode[], filter: string): ModuleNode[] {
  const filtered: ModuleNode[] = [];

  for (const node of tree) {
    if (node.submodules && node.submodules.length > 0) {
      const filteredChildren = recursiveFilter(node.submodules, filter);
      if (filteredChildren.length > 0) {
        filtered.push({
          ...node,
          submodules: filteredChildren,
        });
      }
    } else if (
      node.name.toLowerCase().includes(filter) ||
      node.title.toLowerCase().includes(filter)
    ) {
      filtered.push(node);
    }
  }

  return filtered;
}

interface WiregasmPreferencesModalProps {
  initialized: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  loadModuleTree: () => Promise<ModuleNode[]>;
  loadPreferences: (moduleName: string) => Promise<Preference[]>;
  uploadFile: (file: File) => Promise<string>;
  updatePreference: (
    moduleName: string,
    key: string,
    value: string,
  ) => Promise<void>;
  applyPreferences: () => Promise<void>;
}

function WiregasmPreferencesModal({
  initialized,
  open,
  setOpen,
  loadModuleTree,
  loadPreferences,
  uploadFile,
  updatePreference,
  applyPreferences,
}: WiregasmPreferencesModalProps) {
  const cancelButtonRef = useRef(null);
  const [moduleTree, setModuleTree] = useState<ModuleNode[]>([]);
  const [selectedModule, setSelectedModule] = useState<ModuleNode | null>(null);
  const [modulePreferences, setModulePreferences] = useState<
    Preference[] | null
  >(null);
  const [updatedNonce, setUpdatedNonce] = useState(0);
  const [filter, setFilter] = useState("");
  const [filteredTree, setFilteredTree] = useState<ModuleNode[]>([]);

  useEffect(() => {
    if (!moduleTree) {
      return;
    }

    if (!filter || filter === "") {
      setFilteredTree(moduleTree);
      return;
    }

    const filtered = recursiveFilter(moduleTree, filter.toLowerCase());

    setFilteredTree(filtered);
  }, [moduleTree, filter]);

  useEffect(() => {
    if (!initialized) {
      return;
    }
    void loadModuleTree().then((data) => {
      setModuleTree(data);
    });
  }, [loadModuleTree, initialized]);

  useEffect(() => {
    setModulePreferences(null);

    if (!selectedModule) {
      return;
    }

    void loadPreferences(selectedModule.name).then((data) => {
      setModulePreferences(data);
    });
  }, [loadPreferences, selectedModule, updatedNonce]);

  const updatePreferenceValue = (key: string, value: string) => {
    if (!selectedModule) {
      return Promise.reject(new Error("No module selected"));
    }
    return updatePreference(selectedModule.name, key, value);
  };

  const applyPreferenceValues = () => {
    setUpdatedNonce(updatedNonce + 1);
    void applyPreferences().then(() => {
      setOpen(false);
    });
  };

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        initialFocus={cancelButtonRef}
        onClose={setOpen}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-5xl sm:p-6">
                <div className="h-96">
                  <Allotment defaultSizes={[80, 250]}>
                    <Allotment.Pane minSize={80}>
                      <div className="overflow-auto h-full pr-5">
                        <input
                          type="text"
                          value={filter}
                          onChange={(e) => setFilter(e.target.value)}
                          placeholder="Filter preferences..."
                          className="text-sm border-gray-300 w-full p-1 pl-2 rounded focus:ring-zinc-500"
                        />
                        <hr className="my-2" />
                        <WiregasmPreferenceTree
                          tree={filteredTree}
                          select={(n) => setSelectedModule(n)}
                          selected={selectedModule}
                        />
                      </div>
                    </Allotment.Pane>
                    <Allotment.Pane>
                      <div className="pl-3 overflow-auto h-full">
                        {selectedModule ? (
                          <div>
                            <div className="text-lg font-bold">
                              {selectedModule.description}
                            </div>
                            <WiregasmModulePreferences
                              preferences={modulePreferences}
                              uploadFile={uploadFile}
                              updatePreferenceValue={updatePreferenceValue}
                            />
                          </div>
                        ) : (
                          <div className="pl-4 text-sm">
                            Select a module to view and edit its preferences.
                          </div>
                        )}
                      </div>
                    </Allotment.Pane>
                  </Allotment>
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:text-sm"
                    onClick={() => setOpen(false)}
                    ref={cancelButtonRef}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:text-sm"
                    onClick={applyPreferenceValues}
                  >
                    Apply
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}

export default WiregasmPreferencesModal;
