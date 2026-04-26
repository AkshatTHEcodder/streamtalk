import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import Home from './pages/Home';
import Auth from './pages/Auth';

function App() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/verify" element={<Auth key={`verify:${token}`} />} />
      <Route path="/reset" element={<Auth key={`reset:${token}`} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
