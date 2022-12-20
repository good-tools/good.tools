import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";
import Home from "./pages/Home";
import WrappedTool from "./pages/WrappedTool";
import { tools } from "./tools";
import { HelmetProvider } from 'react-helmet-async';

function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          {tools.map(t => (
            <Route path={t.href} element={<WrappedTool tool={t} />} />
          ))}
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  )
}

export default App;
