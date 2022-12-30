import { Suspense } from "react";
import { Helmet } from 'react-helmet-async';

function WrappedTool(props) {
  const { tool } = props;
  return (
    <>
      <Helmet>
        <title>good.tools · {tool.title}</title>
      </Helmet>
      <h2 className="text-xl mb-4 pb-6 border-b dark:border-zinc-700">{tool.title}</h2>
      <Suspense fallback={<div>Loading...</div>}>
        <tool.component />
      </Suspense>
    </>
  )
}

export default WrappedTool