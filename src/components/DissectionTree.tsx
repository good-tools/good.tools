import {
  Bars2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { NO_SELECTION } from "@/tools/PacketDissector";

interface DissectionNode {
  label: string;
  tree?: DissectionNode[];
  length: number;
  data_source_idx: number;
  start: number;
}

interface DissectionSelection {
  id: string;
  idx: number;
  start: number;
  length: number;
}

interface DissectionSubTreeProps {
  id: string;
  node: DissectionNode;
  select: (selection: DissectionSelection | typeof NO_SELECTION) => void;
  selected: string;
}

function DissectionSubTree({
  id,
  node,
  select,
  selected,
}: DissectionSubTreeProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setOpen(selected.startsWith(id + "-"));
    }
  }, [id, selected, open]);

  const toggle = () => {
    if (open && selected.startsWith(id + "-")) {
      select(NO_SELECTION);
    }

    setOpen(!open);
  };

  return (
    <>
      <div
        className={clsx(
          "inline-flex items-center w-full",
          node.length > 0 ? "cursor-pointer" : "",
          id === selected ? "bg-gray-600 text-white" : ""
        )}
      >
        {node.tree && node.tree.length > 0 ? (
          <>
            {open ? (
              <ChevronDownIcon
                onClick={toggle}
                className="shrink-0 w-4 h-4 text-gray-200 dark:text-gray-600 fill-gray-500"
              />
            ) : (
              <ChevronRightIcon
                onClick={toggle}
                className="shrink-0 w-4 h-4 text-gray-200 dark:text-gray-600 fill-gray-500"
              />
            )}
          </>
        ) : (
          <Bars2Icon className="shrink-0 w-4 h-4 text-gray-200 dark:text-gray-600 fill-gray-500" />
        )}

        <span
          onClick={() => {
            if (node.length > 0) {
              select({
                id: id,
                idx: node.data_source_idx,
                start: node.start,
                length: node.length,
              });
            }
          }}
          onDoubleClick={toggle}
          className="ml-1 w-full"
        >
          {node.label}
        </span>
      </div>
      {node.tree && node.tree.length > 0 && open && (
        <DissectionTree
          id={id}
          tree={node.tree}
          select={select}
          selected={selected}
        />
      )}
    </>
  );
}

interface DissectionTreeProps {
  id: string;
  tree: DissectionNode[];
  select?: (selection: DissectionSelection | typeof NO_SELECTION) => void;
  root?: boolean;
  selected?: string;
}

function DissectionTree({
  id,
  tree,
  select = () => {},
  root = false,
  selected = "",
}: DissectionTreeProps) {
  return (
    <ul className={clsx(root ? "" : "pl-2 ml-2 border-l")}>
      {tree.map((n, i) => (
        <li className="leading-none" key={`${id}-${i}`}>
          <DissectionSubTree
            id={`${id}-${i}`}
            node={n}
            select={select}
            selected={selected}
          />
        </li>
      ))}
    </ul>
  );
}

export default DissectionTree;
export type { DissectionNode, DissectionSelection };
