import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppShell } from './components/layout/AppShell';
import ComingSoonPage from './pages/ComingSoonPage';
import LoginPage from './pages/login/LoginPage';
import ModulesPage from './pages/modules/ModulesPage';
import OverviewPage from './pages/overview/OverviewPage';
import ProfilePage from './pages/profile/ProfilePage';
import RolesPage from './pages/roles/RolesPage';
import UserDetailPage from './pages/users/UserDetailPage';
import UsersPage from './pages/users/UsersPage';
import LogsPage from './pages/logs/LogsPage';
import SystemResetPage from './pages/system-reset/SystemResetPage';
import VersionsPage from './pages/versions/VersionsPage';

function Protected({ children }: { children: ReactNode }) {
  const { token, booting } = useAuth();
  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--panel-muted)]">
        Yükleniyor…
      </div>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { token, booting } = useAuth();
  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--panel-muted)]">
        Yükleniyor…
      </div>
    );
  }
  if (token) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />

      <Route
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="profil" element={<ProfilePage />} />
        <Route path="musteriler" element={<ComingSoonPage title="Müşteriler" />} />
        <Route path="hareketler" element={<ComingSoonPage title="Hareketler" />} />
        <Route path="odeme-istekleri" element={<ComingSoonPage title="Ödeme İstekleri" />} />
        <Route path="raporlar" element={<ComingSoonPage title="Raporlar" />} />
        <Route path="tanimlamalar" element={<ComingSoonPage title="Tanımlamalar" />} />
        <Route path="ayarlar" element={<ComingSoonPage title="Ayarlar" />} />
        <Route path="moduller" element={<ModulesPage />} />
        <Route path="roller" element={<RolesPage />} />
        <Route path="kullanicilar" element={<UsersPage />} />
        <Route path="kullanicilar/:id" element={<UserDetailPage />} />
        <Route path="surum-gecmisi" element={<VersionsPage />} />
        <Route path="log-kayitlari" element={<LogsPage />} />
        <Route path="sistem-sifirlama" element={<SystemResetPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
