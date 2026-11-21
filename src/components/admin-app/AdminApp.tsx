import React, { useState, useMemo, lazy, Suspense } from 'react';
import { AdminTabType, Order } from '../../types';
import { useApp } from '../../context/AppContext';
import { AdminNav } from './AdminNav';

const DashboardTab = lazy(() => import('./tabs/DashboardTab').then((m) => ({ default: m.DashboardTab })));
const AdminDiscussionsTab = lazy(() =>
  import('./tabs/AdminDiscussionsTab').then((m) => ({ default: m.AdminDiscussionsTab }))
);
const AdminOrderDetailModal = lazy(() =>
  import('./modals/AdminOrderDetailModal').then((m) => ({ default: m.AdminOrderDetailModal }))
);
const AdminProfileTab = lazy(() => import('./tabs/AdminProfileTab').then((m) => ({ default: m.AdminProfileTab })));
const AdminUsersTab = lazy(() => import('./tabs/AdminUsersTab').then((m) => ({ default: m.AdminUsersTab })));
const AdminTrendsTab = lazy(() => import('./tabs/AdminTrendsTab').then((m) => ({ default: m.AdminTrendsTab })));

const AdminTabFallback = () => (
  <div className="w-full h-full bg-[#0A0A0A] flex items-center justify-center">
    <div className="w-7 h-7 rounded-full border-2 border-white/15 border-t-emerald-400 animate-spin" />
  </div>
);

export const AdminApp: React.FC = () => {
  const { adminUsers } = useApp();
  const [activeTab, setActiveTab] = useState<AdminTabType>('dashboard');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const pending = useMemo(
    () => adminUsers.filter((u) => u.status === 'pending_verification').length,
    [adminUsers]
  );

  return (
    <div id="djassa-admin-app-root" className="relative w-full h-[100dvh] bg-[#0A0A0A] text-white flex flex-col overflow-hidden font-sans select-none">
      <main className="flex-1 relative overflow-hidden">
        <Suspense fallback={<AdminTabFallback />}>
          {activeTab === 'dashboard' && <DashboardTab onNavigateTab={setActiveTab} onSelectOrder={setSelectedOrder} />}
          {activeTab === 'utilisateurs' && <AdminUsersTab onNavigateTab={setActiveTab} />}
          {activeTab === 'discussions' && <AdminDiscussionsTab onNavigateTab={setActiveTab} onSelectOrder={setSelectedOrder} />}
          {activeTab === 'tendances' && <AdminTrendsTab onNavigateTab={setActiveTab} onSelectOrder={setSelectedOrder} />}
          {activeTab === 'profil' && <AdminProfileTab onNavigateTab={setActiveTab} />}
        </Suspense>
      </main>
      <AdminNav activeTab={activeTab} onChangeTab={setActiveTab} pendingKycCount={pending} />
      {selectedOrder && (
        <Suspense fallback={null}>
          <AdminOrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
        </Suspense>
      )}
    </div>
  );
};

