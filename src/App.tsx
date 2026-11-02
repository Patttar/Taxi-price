import { HashRouter, Routes, Route } from 'react-router-dom';
import History from './pages/History';
import Home from './pages/Home';
import Places from './pages/Places';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/history" element={<History />} />
        <Route path="/places" element={<Places />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
