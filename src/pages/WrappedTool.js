import { Suspense, useState } from "react";
import { Helmet } from 'react-helmet-async';
import { Button } from "../components/Button";
import { Tag } from "../components/Tag";

function WrappedTool(props) {
  const { tool } = props;
  const [ proceed, setProceed ] = useState(false);

  return (
    <>
      <Helmet>
        <title>good.tools · {tool.title}</title>
        <meta name="description" content={tool.description} />
        <meta name="keywords" content={tool.tags.join(",")} />
      </Helmet>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="mb-8 pb-6 border-b border-zinc-200 dark:border-zinc-700">
            <h1 className="text-3xl font-bold mb-3 text-zinc-900 dark:text-white">
              {tool.title}
            </h1>
            <p className="text-base text-zinc-600 dark:text-zinc-400">{tool.description}</p>
          </div>
          
          {tool.warning && !proceed ? (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
              <div className="text-zinc-900 dark:text-white mb-4">
                <tool.warning />
              </div>
              <p className="text-zinc-700 dark:text-zinc-300 mb-4">Proceed at your own risk.</p>
              <Button onClick={() => setProceed(true)} className="mt-2">Continue</Button>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
              <Suspense fallback={
                <div className="flex items-center justify-center py-16">
                  <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
                </div>
              }>
                <tool.component />
              </Suspense>
            </div>
          )}
          
          {typeof tool.dependencies !== "undefined" && (
            <div className="mt-8 p-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
              {tool.online && (
                <div className="text-sm flex items-center mb-3 text-amber-700 dark:text-amber-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2 flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  This is an online tool, the data you submit gets processed on a remote server.
                </div>
              )}
              <div className="text-sm flex items-start text-zinc-600 dark:text-zinc-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
                <div className="flex-1">
                  <span className="mr-2">Built using</span>
                  <span className="inline-flex flex-wrap gap-2 mt-2">
                    {tool.dependencies.map((d, i) => (
                      <Tag key={`tag-${i}`} color="sky" type="a" target="_blank" rel="noopener" href={d.url}>{d.name}</Tag>
                    ))}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default WrappedTool