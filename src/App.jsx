import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Layout from './components/Layout';
import { Loading, Toaster } from './components/ui';
import Login from './pages/Login';
import Today from './pages/Today';
import Foods from './pages/Foods';
import Progress from './pages/Progress';
import Profile from './pages/Profile';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center">
        <Loading label="Um instante" />
      </div>
    );
  }

  return (
    <>
      {!user ? (
        <Login />
      ) : (
        <Layout>
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/alimentos" element={<Foods />} />
            <Route path="/progresso" element={<Progress />} />
            <Route path="/perfil" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      )}
      <Toaster />
    </>
  );
}
