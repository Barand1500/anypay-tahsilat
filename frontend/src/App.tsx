import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppShell } from './components/layout/AppShell';
import CustomersPage from './pages/customers/CustomersPage';
import CustomerFormPage from './pages/customers/CustomerFormPage';
import CustomerDetailPage from './pages/customers/CustomerDetailPage';
import PaymentCollectPage from './pages/payments/PaymentCollectPage';
import PaymentRequestPage from './pages/payments/PaymentRequestPage';
import QuickPayPage from './pages/payments/QuickPayPage';
import TransactionsPage from './pages/transactions/TransactionsPage';
import PaymentRequestsPage from './pages/payment-requests/PaymentRequestsPage';
import LoginPage from './pages/login/LoginPage';
import ModulesPage from './pages/modules/ModulesPage';
import OverviewPage from './pages/overview/OverviewPage';
import ProfilePage from './pages/profile/ProfilePage';
import StatisticsPage from './pages/reports/StatisticsPage';
import CollectionReportPage from './pages/reports/CollectionReportPage';
import CustomerCollectionReportPage from './pages/reports/CustomerCollectionReportPage';
import CardCollectionReportPage from './pages/reports/CardCollectionReportPage';
import BankCollectionReportPage from './pages/reports/BankCollectionReportPage';
import SendHistoryPage from './pages/reports/SendHistoryPage';
import ReportsLayout from './pages/reports/ReportsLayout';
import DefinitionsLayout from './pages/definitions/DefinitionsLayout';
import CurrenciesPage from './pages/definitions/CurrenciesPage';
import AccountTypesPage from './pages/definitions/AccountTypesPage';
import BranchesPage from './pages/definitions/BranchesPage';
import ApiSettingsPage from './pages/definitions/ApiSettingsPage';
import ContractsPage from './pages/definitions/ContractsPage';
import PosKartLayout from './pages/definitions/PosKartLayout';
import VirtualPosPage from './pages/definitions/VirtualPosPage';
import CommonVirtualPosPage from './pages/definitions/CommonVirtualPosPage';
import BankCardAgreementPage from './pages/definitions/BankCardAgreementPage';
import CustomerCardAgreementPage from './pages/definitions/CustomerCardAgreementPage';
import CardAgreementsPage from './pages/definitions/CardAgreementsPage';
import CardAgreementDetailPage from './pages/definitions/CardAgreementDetailPage';
import CardTypesPage from './pages/definitions/CardTypesPage';
import CardKindsPage from './pages/definitions/CardKindsPage';
import CardBrandsPage from './pages/definitions/CardBrandsPage';
import SettingsLayout from './pages/settings/SettingsLayout';
import GeneralSettingsPage from './pages/settings/GeneralSettingsPage';
import ContactSettingsPage from './pages/settings/ContactSettingsPage';
import DefaultsSettingsPage from './pages/settings/DefaultsSettingsPage';
import EmailSettingsPage from './pages/settings/EmailSettingsPage';
import SmsSettingsPage from './pages/settings/SmsSettingsPage';
import TemplateVariablesPage from './pages/settings/TemplateVariablesPage';
import ErpSettingsPage from './pages/settings/ErpSettingsPage';
import RolesPage from './pages/roles/RolesPage';
import UserDetailPage from './pages/users/UserDetailPage';
import UsersPage from './pages/users/UsersPage';
import LogsPage from './pages/logs/LogsPage';
import SystemResetPage from './pages/system-reset/SystemResetPage';
import VersionsPage from './pages/versions/VersionsPage';
import { getDefaultLandingPath } from './pages/settings/defaultsStore';

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
  if (token) return <Navigate to={getDefaultLandingPath()} replace />;
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
        <Route path="musteriler" element={<CustomersPage />} />
        <Route path="musteriler/yeni" element={<CustomerFormPage />} />
        <Route path="musteriler/:id/odeme-al" element={<PaymentCollectPage />} />
        <Route path="musteriler/:id/odeme-istegi" element={<PaymentRequestPage />} />
        <Route path="musteriler/:id" element={<CustomerDetailPage />} />
        <Route path="hareketler" element={<TransactionsPage />} />
        <Route path="odeme-istekleri" element={<PaymentRequestsPage />} />
        <Route path="odeme-istekleri/yeni" element={<PaymentRequestPage forPanel />} />
        <Route path="hizli-odeme" element={<QuickPayPage />} />
        <Route path="raporlar" element={<ReportsLayout />}>
          <Route index element={<Navigate to="istatistikler" replace />} />
          <Route path="istatistikler" element={<StatisticsPage />} />
          <Route path="tahsilat-raporu" element={<CollectionReportPage />} />
          <Route path="musteri-tahsilat-raporu" element={<CustomerCollectionReportPage />} />
          <Route path="musteri-kart-tahsilat" element={<CardCollectionReportPage />} />
          <Route path="banka-tahsilat-raporu" element={<BankCollectionReportPage />} />
          <Route path="gonderim-gecmisi" element={<SendHistoryPage />} />
        </Route>
        <Route path="tanimlamalar" element={<DefinitionsLayout />}>
          <Route index element={<Navigate to="para-birimleri" replace />} />
          <Route path="para-birimleri" element={<CurrenciesPage />} />
          <Route path="cari-tipleri" element={<AccountTypesPage />} />
          <Route path="subeler" element={<BranchesPage />} />
          <Route path="pos-kart" element={<PosKartLayout />}>
            <Route index element={<Navigate to="sanal-pos" replace />} />
            <Route path="sanal-pos" element={<VirtualPosPage />} />
            <Route path="sanal-pos/:id/banka-anlasma" element={<BankCardAgreementPage />} />
            <Route path="sanal-pos/:id/musteri-anlasma" element={<CustomerCardAgreementPage />} />
            <Route path="ortak-sanal-pos" element={<CommonVirtualPosPage />} />
            <Route path="anlasmalar" element={<CardAgreementsPage />} />
            <Route path="anlasmalar/:id" element={<CardAgreementDetailPage />} />
            <Route path="tipler" element={<CardTypesPage />} />
            <Route path="turler" element={<CardKindsPage />} />
            <Route path="markalar" element={<CardBrandsPage />} />
          </Route>
          <Route path="sozlesmeler" element={<ContractsPage />} />
          <Route path="api-ayarlari" element={<ApiSettingsPage />} />
        </Route>
        <Route path="ayarlar" element={<SettingsLayout />}>
          <Route index element={<Navigate to="genel" replace />} />
          <Route path="genel" element={<GeneralSettingsPage />} />
          <Route path="iletisim" element={<ContactSettingsPage />} />
          <Route path="varsayilanlar" element={<DefaultsSettingsPage />} />
          <Route path="e-posta" element={<EmailSettingsPage />} />
          <Route path="sms" element={<SmsSettingsPage />} />
          <Route path="sablon-degiskenleri" element={<TemplateVariablesPage />} />
          <Route path="erp" element={<ErpSettingsPage />} />
          {/* Bilinmeyen ayarlar alt yolu → özet değil, genel ayarlar */}
          <Route path="*" element={<Navigate to="genel" replace />} />
        </Route>
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
