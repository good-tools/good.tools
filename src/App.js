import './App.css';
import packageJson from '../package.json';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <p>
          <strong>good.tools</strong> v{packageJson.version}
        </p>
      </header>
    </div>
  );
}

export default App;
