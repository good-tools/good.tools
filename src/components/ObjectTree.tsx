import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { useState, ReactNode } from "react";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && !Array.isArray(v) && v !== null;
}

interface ObjectNodeProps {
  id: string;
  object: Record<string, unknown>;
}

function ObjectNode({ id, object }: ObjectNodeProps) {
  const [open, setOpen] = useState(false);
  const children = Object.keys(object);

  const toggle = () => {
    setOpen(!open);
  };

  return (
    <>
      <div
        onClick={toggle}
        className="inline-flex items-center cursor-pointer select-none"
      >
        {open ? (
          <ChevronDownIcon className="w-4 h-4 text-gray-200 dark:text-gray-600 fill-gray-500" />
        ) : (
          <ChevronRightIcon className="w-4 h-4 text-gray-200 dark:text-gray-600 fill-gray-500" />
        )}
        <span className="ml-1">[ object ]</span>
      </div>
      {children.length > 0 && open && (
        <ul className={"pl-2 ml-2 text-sm border-l"}>
          {children.map((n, i) => (
            <li key={`${id}-${i}`}>
              <ValueNode id={`${id}-${i}-v`} object={object[n]} name={n} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

interface ArrayNodeProps {
  id: string;
  object: unknown[];
}

function ArrayNode({ id, object }: ArrayNodeProps) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    setOpen(!open);
  };

  return (
    <>
      <div
        onClick={toggle}
        className="inline-flex items-center cursor-pointer select-none"
      >
        {open ? (
          <ChevronDownIcon className="w-4 h-4 text-gray-200 dark:text-gray-600 fill-gray-500" />
        ) : (
          <ChevronRightIcon className="w-4 h-4 text-gray-200 dark:text-gray-600 fill-gray-500" />
        )}
        <span className="ml-1">array [{object.length}]</span>
      </div>
      {object.length > 0 && open && (
        <ul className={"pl-2 ml-2 text-sm border-l"}>
          {object.map((n, i) => (
            <li key={`${id}-${i}`}>
              <ValueNode id={`${id}-${i}-v`} object={n} name={`${i}`} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

interface ValueNodeProps {
  id: string;
  name?: string | null;
  object: unknown;
}

function ValueNode({ id, name = null, object }: ValueNodeProps) {
  return (
    <div className="text-sm">
      {name != null && <>{name}:</>}
      {isObject(object) ? (
        <ObjectNode id={id} object={object} />
      ) : Array.isArray(object) ? (
        <ArrayNode id={id} object={object} />
      ) : (
        <span className="ml-3">
          {object === null ? "null" : <>{String(object)}</>}
        </span>
      )}
    </div>
  );
}

interface ObjectTreeProps {
  object: unknown;
}

function ObjectTree({ object }: ObjectTreeProps) {
  return (
    <div>
      <ValueNode id="root" object={object} />
    </div>
  );
}

export default ObjectTree;
