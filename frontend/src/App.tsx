import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { DashboardLayout } from "./components/DashboardLayout";
import { LoginPage } from "./pages/LoginPage";
import { LedgerPage } from "./pages/LedgerPage";
import { TypePage } from "./pages/TypePage";
import { UserPage } from "./pages/UserPage";

function PrivateRoutes() {
  const { user, loading } = useAuth();
  if (loading) {
    return null;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/ledger" replace />} />
        <Route path="/ledger" element={<LedgerPage />} />
        <Route path="/types" element={<TypePage />} />
        {user.role === "SUPER_ADMIN" && <Route path="/users" element={<UserPage />} />}
        <Route path="*" element={<Navigate to="/ledger" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

export function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#186f65",
          borderRadius: 14,
          fontFamily: "'Segoe UI', 'PingFang SC', sans-serif"
        }
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<PrivateRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
}
