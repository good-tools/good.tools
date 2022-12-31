import {
  Routes,
  Route,
} from "react-router-dom";
import Home from "./pages/Home";
import WrappedTool from "./pages/WrappedTool";
import { tools } from "./tools";
import { Layout } from "./pages/Layout";
import NotFound from "./pages/NotFound";
import { usePageTracking } from "./lib/tracking";

function App() {

  usePageTracking()

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        {tools.map((t, idx) => (
          <Route key={`r-${idx}`} path={t.href} element={<WrappedTool tool={t} />} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App;
