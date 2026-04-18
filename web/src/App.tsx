import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Toaster } from "./components/Toaster";
import { HomePage } from "./pages/Home";
import { RequestPage } from "./pages/Request";
import { QueuePage } from "./pages/Queue";
import { DashboardPage } from "./pages/Dashboard";
import { LoginPage } from "./pages/Login";

export default function App() {
  const location = useLocation();
  const wide = location.pathname.includes("/queue") || location.pathname.startsWith("/dashboard");
  return (
    <Layout wide={wide}>
      <Toaster />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/d/:domain/request" element={<RequestPage />} />
        <Route path="/d/:domain/queue" element={<QueuePage />} />
        <Route path="/dashboard" element={<Navigate to="/dashboard/beds" replace />} />
        <Route path="/dashboard/:tab" element={<DashboardPage />} />
        <Route path="/admin" element={<Navigate to="/dashboard/beds" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
