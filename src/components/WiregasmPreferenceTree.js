import {
  Bars2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useState } from "react";

function SubTree({ id, nodes, select, selected, root = false }) {
  const [open, setOpen] = useState(false);

  return (
    <ul
      className={clsx(
        "text-sm",
        root ? "" : "border-l",
        root ? "" : "pl-2 ml-2"
      )}
    >
      {nodes
        .filter((n) => n.use_gui)
        .map((n, i) => (
          <li key={`${id}-${i}`}>
            {n.submodules.length > 0 ? (
              <>
                <div className="inline-flex items-center cursor-pointer">
                  <div onClick={() => setOpen(!open)}>
                    {open ? (
                      <ChevronDownIcon className="w-4 h-4 text-gray-200 dark:text-gray-600 fill-gray-500" />
                    ) : (
                      <ChevronRightIcon className="w-4 h-4 text-gray-200 dark:text-gray-600 fill-gray-500" />
                    )}
                  </div>
                  <span
                    className={clsx(
                      "ml-1",
                      selected && selected.name === n.name
                        ? "font-bold text-zinc-600 dark:text-zinc-300"
                        : ""
                    )}
                    onClick={() => select(n)}
                    onDoubleClick={() => setOpen(!open)}
                  >
                    {n.title}
                  </span>
                </div>
                {open && (
                  <SubTree
                    id={n.name}
                    nodes={n.submodules}
                    select={select}
                    selected={selected}
                  />
                )}
              </>
            ) : (
              <div
                onClick={() => select(n)}
                className="inline-flex items-center cursor-pointer"
              >
                <Bars2Icon className="w-4 h-4 text-gray-200 dark:text-gray-600 fill-gray-500" />
                <span
                  className={clsx(
                    "ml-1",
                    selected && selected.name === n.name
                      ? "font-bold text-zinc-600 dark:text-zinc-300"
                      : ""
                  )}
                >
                  {n.title}
                </span>
              </div>
            )}
          </li>
        ))}
    </ul>
  );
}

function WiregasmPreferenceTree({ tree, select, selected }) {
  return (
    <SubTree
      id={"root"}
      nodes={tree}
      select={select}
      selected={selected}
      root={true}
    />
  );
}

export default WiregasmPreferenceTree;
