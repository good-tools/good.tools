import { Suspense } from "react";
import { Helmet } from 'react-helmet-async';
import { Tag } from "../components/Tag";

function WrappedTool(props) {
  const { tool } = props;
  return (
    <>
      <Helmet>
        <title>good.tools · {tool.title}</title>
      </Helmet>
      <div className="mb-4 pb-2 border-b dark:border-zinc-700">
        <div className="text-xl">
          {tool.title}
        </div>
        <div className="text-xs">{tool.description}</div>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <tool.component />
      </Suspense>

      {typeof tool.dependencies !== "undefined" && (
        <div className="border-t border-zinc-900/5 mt-6 pt-3 dark:border-white/5 text-zinc-600 dark:text-zinc-400">
          <div className="text-xs space-x-2">
            <span>Uses</span>
            {tool.dependencies.map(d => (
              <Tag color="sky">{d.name}</Tag>
            ))}
          </div>
          {tool.online && (
            <div className="text-xs flex">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 mr-1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              This is an online tool, the data you submit gets processed on a remote server.
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default WrappedTool