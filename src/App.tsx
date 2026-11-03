import { HashRouter, Routes, Route } from 'react-router-dom';
import History from './pages/History';
import Home from './pages/Home';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
