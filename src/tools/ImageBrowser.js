import { Tab } from "@headlessui/react"
import { ArrowLongRightIcon, XCircleIcon } from "@heroicons/react/24/outline"
import { Allotment } from "allotment"
import { filesize } from "filesize"
import moment from "moment"
import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { CodeGroup } from "../components/Code"
import FileTree from "../components/FileTree"
import "allotment/dist/style.css";
import Editor from "@monaco-editor/react"
import TextInput from "../components/TextInput"
import TabButton from "../components/TabButton"
import { DarkModeContext } from "../components/ModeToggle"

const imageBrowserUrl = "https://image-browser.fly.dev"

// TODO: make it exhaustive?
const isReadable = (mime) => {
  if (typeof mime === "undefined")
    return false

  if (mime.includes("text/") || mime.includes("application/json"))
    return true

  return false
}

function ImageBrowser() {
  const { darkMode } = useContext(DarkModeContext)
  const [ loading, setLoading ] = useState(false)
  const [ data, setData ] = useState(null)
  const [ ref, setRef ] = useState("")
  const [ pulledRef, setPulledRef ] = useState("")
  const [ error, setError ] = useState(null)
  const [ content, setContent ] = useState("")
  const [ selected, setSelected ] = useState(null)
  const editorRef = useRef(null);
  const inputRef = useRef();

  // reset
  useEffect(() => {
    setSelected(null)
    setContent("")
  }, [ pulledRef ])

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
  }

  const select = useCallback(async (node) => {
    setContent("")
    setSelected(node)

    if (!isReadable(node.mime_type)) {
      return
    }

    const path = node.id
    const params = {
      ref: pulledRef,
      path: path
    }

    try {
      const response = await fetch(`${imageBrowserUrl}/download?${new URLSearchParams(params)}`)
      const data = await response.text()
      setContent(data)
    } catch (e) {
      //
    }
  }, [ pulledRef ])

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setScrollPosition({scrollTop: 0});
    }
  }, [ content, ref, editorRef ])

  useEffect(() => {
    inputRef.current.focus()
  }, [inputRef])

  const list = useCallback(async (node) => {
    const path = node === null ? "" : node.id
    const params = {
      ref: pulledRef,
      path: path
    }

    try {
      const response = await fetch(`${imageBrowserUrl}/list?${new URLSearchParams(params)}`)
      const data = await response.json()

      if (response.status >= 400 && response.status < 600) {
        throw new Error(data.message);
      }

      return data.map(d => { return {
        id: `${path}/${d.name}`,
        ...d
      }}).sort((a,b) => a.directory && b.directory ? 0 : a.directory ? -1 : 1)

    } catch (e) {
      //
    }
    return []
  }, [ pulledRef ])

  const pull = useCallback(async () => {
    if (ref.length <= 0) {
      return
    }

    setData(null)
    setError(null)
    setLoading(true)

    const params = {
      ref: ref
    }

    try {
      const response = await fetch(`${imageBrowserUrl}/image?${new URLSearchParams(params)}`)
      const data = await response.json()

      if (response.status >= 400 && response.status < 600) {
        throw new Error(data.message);
      }

      setPulledRef(ref)
      setData(data)
      setLoading(false)
    } catch (e) {
      setLoading(false)
      setError(e.message)
    }
  }, [ ref ])

  return (
    <div>
      <div className="mt-5 sm:flex sm:items-center">
        <div className="w-full">
          <TextInput
            innerRef={inputRef}
            type="text"
            name="image"
            id="image"
            value={ref}
            disabled={loading}
            onChange={(e) => setRef(e.target.value)}
            onEnter={pull}
            className="block w-full"
            placeholder="docker.io/library/nginx:latest"
          />
        </div>
        <button
          onClick={pull}
          type="button"
          disabled={loading}
          className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
        >
          {loading ? (
            <svg aria-hidden="true" className="w-5 h-5 text-gray-200 animate-spin dark:text-gray-600 fill-gray-500" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
              <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill"/>
            </svg>
          ) : (
            <>Pull</>
          )}
        </button>
      </div>
      {error != null && (
        <div className="rounded-md bg-red-50 p-4 mt-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          </div>
        </div>
      )}
      {data != null && (
        <Tab.Group>
          <Tab.List className="mt-4 flex space-x-4">
            <TabButton>Image</TabButton>
            <TabButton>File Browser</TabButton>
          </Tab.List>
          <Tab.Panels className="mt-2">
            <Tab.Panel>
              <div className="mt-3 overflow-hidden w-full dark:bg-zinc-800 shadow dark:shadow-zinc-900 sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg font-medium leading-6">
                    {data.metadata.name}
                  </h3>
                  <span className="text-sm text-gray-500">{data.metadata.digest}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-zinc-700 px-4 py-5 sm:px-6">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-3">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Platform</dt>
                      <dd className="mt-1 text-sm">
                      {data.image.os}/{data.image.architecture}
                      </dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Size</dt>
                      <dd className="mt-1 text-sm">
                        {filesize(data.metadata.size, {base: 2})}
                      </dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Created</dt>
                      <dd className="mt-1 text-sm">
                        {moment(data.image.created).format()}
                      </dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">User</dt>
                      <dd className="mt-1 text-sm">
                        {data.image.config.User || "Not Specified"}
                      </dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Entrypoint</dt>
                      <dd className="mt-1 text-sm">
                        <pre>
                        {data.image.config.Entrypoint?.map((e, i) => (
                          <span key={`ep-${i}`}>{e}</span>
                        ))}
                        </pre>
                      </dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Command</dt>
                      <dd className="mt-1 text-sm">
                        <pre>
                          {data.image.config.Cmd?.join(" ")}
                        </pre>
                      </dd>
                    </div>
                    <div className="sm:col-span-3">
                      <dt className="text-sm font-medium text-gray-500">Environment</dt>
                      <dd className="mt-1 text-sm">
                        <CodeGroup className="m-0">
                          <code>{data.image.config.Env?.join("\n")}</code>
                        </CodeGroup>
                      </dd>
                    </div>
                    <div className="sm:col-span-3">
                      <dt className="text-sm font-medium text-gray-500">Layers ({data.image.rootfs?.diff_ids?.length})</dt>
                      <dd className="mt-1 text-sm">
                        <table className="min-w-full divide-y divide-gray-300">
                          <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                            {data.image.rootfs?.diff_ids?.map((diff, i) => (
                              <tr key={`diff-${i}`}>
                                <td className="whitespace-nowrap font-mono py-1 pr-3 text-sm">
                                  {diff}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </dd>
                    </div>
                    <div className="sm:col-span-3">
                      <dt className="text-sm font-medium text-gray-500">Labels</dt>
                      <dd className="mt-1 text-sm">
                        <table className="min-w-full divide-y divide-gray-300">
                          <tbody className="divide-y divide-gray-200">
                            {Object.keys(data.image.config.Labels || {}).map((k, i) => (
                              <tr key={`label-${i}`}>
                                <td className="whitespace-nowrap py-1 pl-4 pr-3 text-sm text-gray-500 sm:pl-6">
                                  {k}
                                </td>
                                <td className="px-2 py-1 text-sm">{data.image.config.Labels[k]}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </Tab.Panel>
            <Tab.Panel>
              <div className="h-[60vh]">
                <Allotment>
                  <Allotment.Pane>
                    <div className="overflow-auto h-full pt-3">
                      <FileTree load={list} select={select} />
                    </div>
                  </Allotment.Pane>
                  <Allotment.Pane preferredSize={"70%"}>
                    {selected != null ? (
                      <>
                        <div className="border-t border-b border-gray-200 dark:border-gray-500 px-2 py-3 sm:px-4">
                          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-4">
                            <div className="sm:col-span-4">
                              <dt className="text-sm font-medium text-gray-500">Path</dt>
                              <dd className="mt-1 text-sm dark:text-white whitespace-normal inline-flex items-center">
                                {selected.id}
                                {typeof selected.symlink !== "undefined" && (
                                  <>
                                    <ArrowLongRightIcon className="mx-2 h-4 w-4" />
                                    {selected.symlink}
                                  </>
                                )}
                              </dd>
                            </div>
                            <div className="sm:col-span-1">
                              <dt className="text-sm font-medium text-gray-500">Size</dt>
                              <dd className="mt-1 text-sm">
                                {filesize(selected.size, { base: 2 })}
                              </dd>
                            </div>
                            <div className="sm:col-span-1">
                              <dt className="text-sm font-medium text-gray-500">Download</dt>
                              <dd className="mt-1 text-sm">
                                <a
                                  className="text-blue-600 dark:text-blue-500 hover:underline"
                                  target="_blank"
                                  rel="noreferrer"
                                  href={`${imageBrowserUrl}/download?${new URLSearchParams({ ref: ref, path: selected?.id })}`}
                                  >
                                  Click here
                                </a>
                              </dd>
                            </div>
                            <div className="sm:col-span-1">
                              <dt className="text-sm font-medium text-gray-500">Mode</dt>
                              <dd className="mt-1 text-sm font-mono">
                                {selected.mode}
                              </dd>
                            </div>
                            <div className="sm:col-span-1">
                              <dt className="text-sm font-medium text-gray-500">Owner</dt>
                              <dd className="mt-1 text-sm">
                                UID: <strong>{selected.uid}</strong>, GID: <strong>{selected.gid}</strong>
                              </dd>
                            </div>
                          </dl>
                        </div>
                        {!isReadable(selected.mime_type) ? (
                          <div className="p-8">
                            <p>The file content appears to be binary and cannot be viewed in the browser. You may still download the file by clicking the download link above.</p>
                            <p className="mt-5">At the moment, downloading files referenced by symlinks are not allowed.</p>
                          </div>
                        ) : (
                          <Editor
                            onMount={handleEditorDidMount}
                            theme={darkMode ? "vs-dark" : "light"}
                            value={content}
                            path={selected.id}
                            options={{
                              readOnly: true,
                              minimap: {
                                enabled: false
                              }
                            }}
                          />
                        )}
                      </>
                    ) : (
                      <div className="p-2 pl-4">
                        Please select a file from the tree
                      </div>
                    )}
                  </Allotment.Pane>
                </Allotment>
              </div>
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      )}
    </div>
  )
}

export default ImageBrowser