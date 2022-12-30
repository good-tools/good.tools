import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";
import Home from "./pages/Home";
import WrappedTool from "./pages/WrappedTool";
import { tools } from "./tools";
import { HelmetProvider } from 'react-helmet-async';
import { Layout } from "./pages/Layout";
import { DarkModeProvider } from "./components/ModeToggle";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <DarkModeProvider>
      <HelmetProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              {tools.map((t, idx) => (
                <Route key={`r-${idx}`} path={t.href} element={<WrappedTool tool={t} />} />
              ))}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </HelmetProvider>
    </DarkModeProvider>
  )
}

export default App;
