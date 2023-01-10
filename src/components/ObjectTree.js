import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline"
import { useState } from "react"

function isObject(v) {
  return typeof v === 'object' && !Array.isArray(v) && v !== null
}

function ObjectNode({ id, object }) {
  const [ open, setOpen ] = useState(false)
  const children = Object.keys(object)

  const toggle = () => {
    setOpen(!open)
  }

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
        <span
          className="ml-1"
        >
        [ object ]
        </span>
      </div>
      {children.length > 0 && open && (
        <ul
          className={'pl-2 ml-2 text-sm border-l'}
        >
        {children.map((n, i) => (
          <li key={`${id}-${i}`}>
            <ValueNode id={`${id}-${i}-v`} object={object[n]} name={n} />
          </li>
        ))}
        </ul>
      )}
    </>
  )
}

function ArrayNode({id, object}) {
  const [ open, setOpen ] = useState(false)

  const toggle = () => {
    setOpen(!open)
  }

  return (
    <>
      <div
        onClick={toggle}
        className="inline-flex items-center cursor-pointer  select-none"
      >
        {open ? (
          <ChevronDownIcon className="w-4 h-4 text-gray-200 dark:text-gray-600 fill-gray-500" />
        ) : (
          <ChevronRightIcon className="w-4 h-4 text-gray-200 dark:text-gray-600 fill-gray-500" />
        )}
        <span
          className="ml-1"
        >
        array [{object.length}]
        </span>
      </div>
      {object.length > 0 && open && (
        <ul
          className={'pl-2 ml-2 text-sm border-l'}
        >
          {object.map((n, i) => (
            <li key={`${id}-${i}`}>
              <ValueNode id={`${id}-${i}-v`} object={n} name={`${i}`} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function ValueNode({ id, name = null, object }) {
  return (
    <div className="text-sm">
      {name != null && (
        <>
          {name}:
        </>
      )}
      {isObject(object) ? (
        <ObjectNode id={id} object={object} />
      ) : Array.isArray(object) ? (
        <ArrayNode id={id} object={object} />
      ) : (
        <span className="ml-3">
          {object === null ? "null" : (<>{object}</>)}
        </span>
      )}
    </div>
  )
}

function ObjectTree({ object }) {
  return (
    <div>
      <ValueNode id="root" object={object} />
    </div>
  )
}

export default ObjectTree