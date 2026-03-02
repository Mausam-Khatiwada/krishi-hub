import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import api from '../api/client';
import {
  fetchAdminDashboard,
  fetchAdminReport,
  fetchAdminUsers,
  setUserAccountStatus,
  sendAnnouncement,
  toggleUserBlock,
  verifyFarmer,
} from '../features/admin/adminSlice';
import { formatCurrency, formatDate } from '../utils/format';
import usePageTitle from '../hooks/usePageTitle';

const tabs = ['overview', 'intelligence', 'users', 'products', 'orders', 'coupons', 'audit', 'content'];

const AdminDashboardPage = () => {
  usePageTitle('Admin Dashboard');

  const dispatch = useAppDispatch();
  const { stats, users, report } = useAppSelector((state) => state.admin);

  const [tab, setTab] = useState('overview');
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('block');
  const [walletDelta, setWalletDelta] = useState({});
  const [announcement, setAnnouncement] = useState({ title: '', message: '', role: 'all' });
  const [announcementHistory, setAnnouncementHistory] = useState([]);
  const [categoryName, setCategoryName] = useState('');

  const [productFilter, setProductFilter] = useState({ status: 'pending', search: '' });
  const [adminProducts, setAdminProducts] = useState([]);

  const [orderFilter, setOrderFilter] = useState({ status: '', paymentStatus: '' });
  const [adminOrders, setAdminOrders] = useState([]);
  const [tracking, setTracking] = useState({});

  const [coupons, setCoupons] = useState([]);
  const [couponForm, setCouponForm] = useState({
    code: '',
    discountType: 'percent',
    value: 10,
    minOrderAmount: 0,
    usageLimit: 100,
    expiresAt: '',
  });

  const [forumPosts, setForumPosts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditFilter, setAuditFilter] = useState({ action: '', targetType: '', search: '' });
  const [auditMeta, setAuditMeta] = useState({ page: 1, total: 0, hasMore: false });
  const [intelligence, setIntelligence] = useState(null);
  const [pricingInsights, setPricingInsights] = useState({ summary: null, recommendations: [] });
  const [selectedPricingIds, setSelectedPricingIds] = useState([]);
  const [inventoryInsights, setInventoryInsights] = useState({ summary: null, criticalItems: [] });
  const [marketingInsights, setMarketingInsights] = useState({
    segments: null,
    couponPerformance: [],
    campaigns: [],
    recommendedCampaigns: [],
  });
  const [inventoryAutomationMode, setInventoryAutomationMode] = useState('notify-and-tag');
  const [inventoryThresholdDays, setInventoryThresholdDays] = useState(10);
  const [campaignDraft, setCampaignDraft] = useState({
    campaignType: 'reactivation',
    targetSegment: 'dormant-buyers',
    title: 'We miss you on Krishihub',
    message: 'Fresh harvests and better prices are waiting. Return today and unlock your reward.',
    createCoupon: true,
    codePrefix: 'BACK',
    discountType: 'percent',
    value: 10,
    minOrderAmount: 0,
    usageLimit: 400,
    expiresDays: 7,
  });

  const refreshCore = () => {
    dispatch(fetchAdminDashboard());
    dispatch(fetchAdminUsers());
    dispatch(fetchAdminReport());
  };

  const loadAdminProducts = async () => {
    const { data } = await api.get('/admin/products', { params: productFilter });
    setAdminProducts(data.products || []);
  };

  const loadAdminOrders = async () => {
    const { data } = await api.get('/admin/orders', { params: orderFilter });
    setAdminOrders(data.orders || []);
  };

  const loadCoupons = async () => {
    const { data } = await api.get('/coupons');
    setCoupons(data.coupons || []);
  };

  const loadForum = async () => {
    const { data } = await api.get('/forum');
    setForumPosts(data.posts || []);
  };

  const loadAnnouncementHistory = async () => {
    const { data } = await api.get('/admin/announcements/history');
    setAnnouncementHistory(data.history || []);
  };

  const loadAuditLogs = async ({ page = 1, filtersOverride } = {}) => {
    const effectiveFilters = filtersOverride || auditFilter;
    const { data } = await api.get('/admin/audit-logs', {
      params: { ...effectiveFilters, page, limit: 40 },
    });
    setAuditLogs(data.logs || []);
    setAuditMeta({
      page: data.page || page,
      total: data.total || 0,
      hasMore: Boolean(data.hasMore),
    });
  };

  const loadAdminIntelligence = async () => {
    const [overviewRes, pricingRes, inventoryRes, marketingRes] = await Promise.all([
      api.get('/admin/intelligence/overview'),
      api.get('/admin/intelligence/dynamic-pricing', { params: { limit: 80 } }),
      api.get('/admin/intelligence/inventory'),
      api.get('/admin/intelligence/marketing'),
    ]);

    setIntelligence(overviewRes.data.intelligence || null);
    setPricingInsights({
      summary: pricingRes.data.summary || null,
      recommendations: pricingRes.data.recommendations || [],
    });
    setInventoryInsights({
      summary: inventoryRes.data.summary || null,
      criticalItems: inventoryRes.data.criticalItems || [],
    });
    setMarketingInsights({
      segments: marketingRes.data.segments || null,
      couponPerformance: marketingRes.data.couponPerformance || [],
      campaigns: marketingRes.data.campaigns || [],
      recommendedCampaigns: marketingRes.data.recommendedCampaigns || [],
    });
  };

  useEffect(() => {
    const boot = async () => {
      try {
        refreshCore();
        await Promise.all([
          loadAdminProducts(),
          loadAdminOrders(),
          loadCoupons(),
          loadForum(),
          loadAnnouncementHistory(),
          loadAuditLogs(),
          loadAdminIntelligence(),
        ]);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to load admin data');
      }
    };
    boot();
  }, []);

  useEffect(() => {
    loadAdminProducts().catch((error) =>
      toast.error(error.response?.data?.message || 'Failed to refresh products'),
    );
  }, [productFilter.status]);

  useEffect(() => {
    loadAdminOrders().catch((error) =>
      toast.error(error.response?.data?.message || 'Failed to refresh orders'),
    );
  }, [orderFilter.status, orderFilter.paymentStatus]);

  useEffect(() => {
    const knownUserIds = new Set(users.map((user) => user._id));
    setSelectedUserIds((prev) => prev.filter((id) => knownUserIds.has(id)));
  }, [users]);

  useEffect(() => {
    if (tab !== 'audit') return;
    loadAuditLogs({ page: 1 }).catch((error) =>
      toast.error(error.response?.data?.message || 'Failed to refresh audit logs'),
    );
  }, [tab]);

  useEffect(() => {
    if (tab !== 'intelligence') return;
    loadAdminIntelligence().catch((error) =>
      toast.error(error.response?.data?.message || 'Failed to load intelligence suite'),
    );
  }, [tab]);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter((user) => user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q));
  }, [users, userSearch]);

  const visibleUsers = useMemo(() => filteredUsers.slice(0, 120), [filteredUsers]);
  const visibleUserIds = useMemo(() => visibleUsers.map((user) => user._id), [visibleUsers]);
  const allVisibleSelected = useMemo(
    () => visibleUserIds.length > 0 && visibleUserIds.every((id) => selectedUserIds.includes(id)),
    [selectedUserIds, visibleUserIds],
  );

  const formatAuditDetails = (details) => {
    if (!details || typeof details !== 'object') return '-';
    const entries = Object.entries(details).slice(0, 4);
    if (!entries.length) return '-';
    return entries
      .map(([key, value]) => {
        if (Array.isArray(value)) return `${key}: ${value.length} items`;
        if (value && typeof value === 'object') return `${key}: {...}`;
        return `${key}: ${String(value)}`;
      })
      .join(' | ');
  };

  const updateWallet = async (id) => {
    const amount = Number(walletDelta[id] || 0);
    if (!amount) return toast.error('Enter a wallet amount');
    await api.patch(`/admin/users/${id}/wallet`, { amount, mode: 'increment' });
    toast.success('Wallet updated');
    setWalletDelta((prev) => ({ ...prev, [id]: '' }));
    dispatch(fetchAdminUsers());
    loadAuditLogs({ page: 1 });
  };

  const updateAccountStatus = async (userId, isActive) => {
    const action = await dispatch(setUserAccountStatus({ userId, isActive }));

    if (setUserAccountStatus.fulfilled.match(action)) {
      toast.success(isActive ? 'Account activated' : 'Account deactivated');
      loadAuditLogs({ page: 1 });
    } else {
      toast.error(action.payload || 'Failed to update account status');
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const toggleSelectAllVisibleUsers = () => {
    setSelectedUserIds((prev) => {
      if (allVisibleSelected) {
        return prev.filter((id) => !visibleUserIds.includes(id));
      }

      return [...new Set([...prev, ...visibleUserIds])];
    });
  };

  const runBulkUserAction = async () => {
    if (!selectedUserIds.length) {
      toast.error('Select at least one user for bulk actions');
      return;
    }

    try {
      const { data } = await api.patch('/admin/users/bulk', {
        userIds: selectedUserIds,
        action: bulkAction,
      });

      toast.success(`Bulk action complete: ${data.updatedCount}/${data.requested} users updated`);

      if (data.skipped?.length) {
        const firstReason = data.skipped[0]?.reason || 'Some users were skipped';
        toast.error(`${data.skipped.length} skipped: ${firstReason}`);
      }

      setSelectedUserIds([]);
      dispatch(fetchAdminUsers());
      loadAuditLogs({ page: 1 });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Bulk action failed');
    }
  };

  const togglePricingSelection = (productId) => {
    setSelectedPricingIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
    );
  };

  const selectTopPricingByConfidence = () => {
    const topIds = (pricingInsights.recommendations || [])
      .slice(0, 20)
      .map((item) => item.productId);
    setSelectedPricingIds(topIds);
  };

  const applySelectedDynamicPricing = async () => {
    if (!selectedPricingIds.length) {
      toast.error('Select at least one pricing recommendation');
      return;
    }

    const updates = pricingInsights.recommendations
      .filter((item) => selectedPricingIds.includes(item.productId))
      .map((item) => ({ productId: item.productId, pricePerUnit: item.recommendedPrice }));

    try {
      const { data } = await api.post('/admin/intelligence/dynamic-pricing/apply', { updates });
      toast.success(`Dynamic pricing applied to ${data.updatedCount} products`);
      if (data.skippedCount) {
        toast.error(`${data.skippedCount} products skipped by safety rules`);
      }
      setSelectedPricingIds([]);
      refreshCore();
      await loadAdminIntelligence();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to apply dynamic pricing');
    }
  };

  const runInventoryAutomationAction = async () => {
    try {
      const { data } = await api.post('/admin/intelligence/inventory/automate', {
        mode: inventoryAutomationMode,
        thresholdDays: Number(inventoryThresholdDays) || 10,
      });

      toast.success(
        `Inventory automation complete: targeted ${data.targetedCount}, notified ${data.notifiedCount}, tagged ${data.taggedCount}`,
      );
      await loadAdminIntelligence();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Inventory automation failed');
    }
  };

  const launchMarketingAutomationCampaign = async (event) => {
    event.preventDefault();

    try {
      const payload = {
        campaignType: campaignDraft.campaignType,
        targetSegment: campaignDraft.targetSegment,
        title: campaignDraft.title,
        message: campaignDraft.message,
        createCoupon: campaignDraft.createCoupon
          ? {
              enabled: true,
              codePrefix: campaignDraft.codePrefix,
              discountType: campaignDraft.discountType,
              value: Number(campaignDraft.value) || 10,
              minOrderAmount: Number(campaignDraft.minOrderAmount) || 0,
              usageLimit: Number(campaignDraft.usageLimit) || 400,
              expiresDays: Number(campaignDraft.expiresDays) || 7,
            }
          : { enabled: false },
      };

      const { data } = await api.post('/admin/intelligence/marketing/launch', payload);
      toast.success(`Campaign launched to ${data.campaign?.recipients || 0} users`);
      if (data.campaign?.coupon?.code) {
        toast.success(`Coupon generated: ${data.campaign.coupon.code}`);
      }
      await loadAdminIntelligence();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to launch automated campaign');
    }
  };

  const moderateProduct = async (id, status) => {
    await api.patch(`/products/${id}/moderate`, { status });
    toast.success(`Product ${status}`);
    await loadAdminProducts();
    dispatch(fetchAdminDashboard());
    loadAuditLogs({ page: 1 });
  };

  const removeProduct = async (id) => {
    await api.delete(`/admin/products/${id}`);
    toast.success('Product removed');
    await loadAdminProducts();
    dispatch(fetchAdminDashboard());
    loadAuditLogs({ page: 1 });
  };

  const setOrderStatus = async (id, status) => {
    await api.patch(`/orders/${id}/status`, { status });
    toast.success(`Order marked ${status}`);
    await loadAdminOrders();
    loadAuditLogs({ page: 1 });
  };

  const setOrderTracking = async (id) => {
    await api.patch(`/orders/${id}/tracking`, tracking[id] || {});
    toast.success('Tracking updated');
    await loadAdminOrders();
    loadAuditLogs({ page: 1 });
  };

  const submitAnnouncement = async (event) => {
    event.preventDefault();
    const action = await dispatch(sendAnnouncement(announcement));
    if (sendAnnouncement.fulfilled.match(action)) {
      toast.success(`Announcement sent to ${action.payload} users`);
      setAnnouncement({ title: '', message: '', role: 'all' });
      loadAnnouncementHistory();
      loadAuditLogs({ page: 1 });
    } else {
      toast.error(action.payload || 'Failed to send');
    }
  };

  const createCoupon = async (event) => {
    event.preventDefault();
    await api.post('/coupons', { ...couponForm, code: couponForm.code.toUpperCase() });
    toast.success('Coupon created');
    setCouponForm({ code: '', discountType: 'percent', value: 10, minOrderAmount: 0, usageLimit: 100, expiresAt: '' });
    loadCoupons();
  };

  const toggleCoupon = async (coupon) => {
    await api.patch(`/coupons/${coupon._id}`, { isActive: !coupon.isActive });
    toast.success('Coupon updated');
    loadCoupons();
  };

  const deleteCoupon = async (id) => {
    await api.delete(`/coupons/${id}`);
    toast.success('Coupon deleted');
    loadCoupons();
  };

  const removeForumPost = async (id) => {
    await api.delete(`/admin/forum/${id}`);
    toast.success('Forum post removed');
    loadForum();
    loadAuditLogs({ page: 1 });
  };

  const createCategory = async () => {
    if (!categoryName.trim()) return;
    await api.post('/categories', { name: categoryName.trim() });
    toast.success('Category created');
    setCategoryName('');
    dispatch(fetchAdminReport());
  };

  const deleteCategory = async (id) => {
    await api.delete(`/categories/${id}`);
    toast.success('Category deleted');
    dispatch(fetchAdminReport());
  };

  const exportCsv = async (type) => {
    const response = await api.get('/admin/export', { params: { type }, responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `krishihub-${type}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <section className="hero-panel bg-gradient-to-r from-[#102a18] via-[#1f4c2f] to-[#436d3b] p-6 text-white">
        <h1 className="text-3xl font-bold">Admin Operations Suite</h1>
        <p className="mt-2 text-sm text-white/90">Advanced moderation, finance, content, and growth controls for Krishihub.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button key={item} type="button" onClick={() => setTab(item)} className={`tab-button ${tab === item ? 'active' : ''}`}>
              {item}
            </button>
          ))}
        </div>
      </section>

      {tab === 'overview' && (
        <section className="stagger-fade space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <div className="metric-card p-3"><p className="text-xs text-[var(--text-muted)]">Users</p><p className="text-2xl font-bold">{stats?.totalUsers || 0}</p></div>
            <div className="metric-card p-3"><p className="text-xs text-[var(--text-muted)]">Farmers</p><p className="text-2xl font-bold">{stats?.totalFarmers || 0}</p></div>
            <div className="metric-card p-3"><p className="text-xs text-[var(--text-muted)]">Buyers</p><p className="text-2xl font-bold">{stats?.totalBuyers || 0}</p></div>
            <div className="metric-card p-3"><p className="text-xs text-[var(--text-muted)]">Products</p><p className="text-2xl font-bold">{stats?.totalProducts || 0}</p></div>
            <div className="metric-card p-3"><p className="text-xs text-[var(--text-muted)]">Orders</p><p className="text-2xl font-bold">{stats?.totalOrders || 0}</p></div>
            <div className="metric-card p-3"><p className="text-xs text-[var(--text-muted)]">Pending Products</p><p className="text-2xl font-bold">{stats?.pendingProducts || 0}</p></div>
            <div className="metric-card p-3"><p className="text-xs text-[var(--text-muted)]">Active Coupons</p><p className="text-2xl font-bold">{stats?.activeCoupons || 0}</p></div>
            <div className="metric-card p-3"><p className="text-xs text-[var(--text-muted)]">Revenue</p><p className="text-lg font-bold">{formatCurrency(stats?.revenue || 0)}</p></div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="app-card p-4"><p className="panel-title">Monthly Revenue</p><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={(stats?.salesByMonth || []).map((i) => ({ month: i._id, revenue: i.revenue }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Bar dataKey="revenue" fill="#2e7d32" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
            <div className="app-card p-4"><p className="panel-title">Order Status</p><div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={(stats?.ordersByStatus || []).map((i) => ({ name: i._id || 'n/a', value: i.count }))} dataKey="value" nameKey="name" outerRadius={90} fill="#3c8f52" label /><Tooltip /></PieChart></ResponsiveContainer></div></div>
          </div>

          <div className="app-card p-4">
            <p className="panel-title">Data Export</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => exportCsv('users')} className="btn-secondary">Users CSV</button>
              <button type="button" onClick={() => exportCsv('products')} className="btn-secondary">Products CSV</button>
              <button type="button" onClick={() => exportCsv('orders')} className="btn-secondary">Orders CSV</button>
            </div>
            <div className="mt-4 rounded-xl border border-[var(--line)] p-3">
              <p className="text-sm font-semibold">Category Management</p>
              <div className="mt-2 flex gap-2">
                <input className="input" placeholder="New category" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
                <button type="button" onClick={createCategory} className="btn-primary">Add</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(report?.categories || []).slice(0, 10).map((cat) => (
                  <button key={cat._id} type="button" className="badge badge-danger" onClick={() => deleteCategory(cat._id)}>
                    {cat.name} x
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold">Recent Announcements</p>
              {announcementHistory.slice(0, 6).map((item) => (
                <article key={`${item.title}-${item.createdAt}`} className="rounded-xl border border-[var(--line)] p-2 text-xs">
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-[var(--text-muted)] line-clamp-2">{item.message}</p>
                  <p className="mt-1 text-[10px] text-[var(--text-muted)]">{formatDate(item.createdAt)}  |  {item.recipients} recipients</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === 'intelligence' && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <div className="metric-card p-3">
              <p className="text-xs text-[var(--text-muted)]">Revenue (30d)</p>
              <p className="text-lg font-bold">{formatCurrency(intelligence?.kpis?.totalRevenue30 || 0)}</p>
            </div>
            <div className="metric-card p-3">
              <p className="text-xs text-[var(--text-muted)]">Orders (30d)</p>
              <p className="text-2xl font-bold">{intelligence?.kpis?.totalOrders30 || 0}</p>
            </div>
            <div className="metric-card p-3">
              <p className="text-xs text-[var(--text-muted)]">AOV (30d)</p>
              <p className="text-lg font-bold">{formatCurrency(intelligence?.kpis?.avgOrderValue30 || 0)}</p>
            </div>
            <div className="metric-card p-3">
              <p className="text-xs text-[var(--text-muted)]">Projected Rev (7d)</p>
              <p className="text-lg font-bold">{formatCurrency(intelligence?.kpis?.projectedRevenueNext7Days || 0)}</p>
            </div>
            <div className="metric-card p-3">
              <p className="text-xs text-[var(--text-muted)]">Fulfillment Risk</p>
              <p className="text-2xl font-bold">{intelligence?.kpis?.fulfillmentRiskScore || 0}</p>
            </div>
            <div className="metric-card p-3">
              <p className="text-xs text-[var(--text-muted)]">Avg Review (30d)</p>
              <p className="text-2xl font-bold">{intelligence?.kpis?.avgReviewRating30 || 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="app-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="panel-title">Dynamic Pricing Engine</p>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary" onClick={selectTopPricingByConfidence}>
                    Select top
                  </button>
                  <button type="button" className="btn-primary" onClick={applySelectedDynamicPricing}>
                    Apply selected ({selectedPricingIds.length})
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                {pricingInsights.summary
                  ? `${pricingInsights.summary.recommendationCount} recommendations | Avg confidence ${pricingInsights.summary.averageConfidence}%`
                  : 'No pricing recommendations available'}
              </p>
              <div className="table-shell mt-3 max-h-[22rem] overflow-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th />
                      <th>Product</th>
                      <th>Current</th>
                      <th>Recommended</th>
                      <th>Delta</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pricingInsights.recommendations || []).slice(0, 80).map((item) => (
                      <tr key={item.productId}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedPricingIds.includes(item.productId)}
                            onChange={() => togglePricingSelection(item.productId)}
                            aria-label={`Select pricing recommendation ${item.name}`}
                          />
                        </td>
                        <td>{item.name}</td>
                        <td>{formatCurrency(item.currentPrice)}</td>
                        <td>{formatCurrency(item.recommendedPrice)}</td>
                        <td className={item.deltaPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {item.deltaPercent}%
                        </td>
                        <td>{item.confidence}%</td>
                      </tr>
                    ))}
                    {!pricingInsights.recommendations?.length && (
                      <tr>
                        <td colSpan="6" className="text-center text-[var(--text-muted)]">No pricing insights yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="app-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="panel-title">Smart Inventory & Supply Automation</p>
                <button type="button" className="btn-secondary" onClick={loadAdminIntelligence}>Refresh</button>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Critical: {inventoryInsights.summary?.criticalCount || 0} | High: {inventoryInsights.summary?.highCount || 0} | Delayed Shipments: {inventoryInsights.summary?.delayedShipmentCount || 0}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                <select
                  className="select"
                  value={inventoryAutomationMode}
                  onChange={(event) => setInventoryAutomationMode(event.target.value)}
                >
                  <option value="notify-and-tag">Notify + tag critical</option>
                  <option value="notify">Notify only</option>
                  <option value="tag-critical">Tag only</option>
                </select>
                <input
                  type="number"
                  className="input"
                  min="3"
                  max="45"
                  value={inventoryThresholdDays}
                  onChange={(event) => setInventoryThresholdDays(event.target.value)}
                  placeholder="Threshold days"
                />
                <button type="button" className="btn-primary" onClick={runInventoryAutomationAction}>
                  Run Automation
                </button>
              </div>
              <div className="table-shell mt-3 max-h-[20rem] overflow-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Stock</th>
                      <th>Velocity/day</th>
                      <th>Stockout</th>
                      <th>Risk</th>
                      <th>Reorder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inventoryInsights.criticalItems || []).slice(0, 60).map((item) => (
                      <tr key={item.productId}>
                        <td>{item.name}</td>
                        <td>{item.stock}</td>
                        <td>{item.velocityPerDay}</td>
                        <td>{item.daysToStockout ?? '-'}</td>
                        <td className={item.riskLevel === 'critical' ? 'text-rose-600 font-semibold' : ''}>{item.riskLevel}</td>
                        <td>{item.recommendedReorderQty}</td>
                      </tr>
                    ))}
                    {!inventoryInsights.criticalItems?.length && (
                      <tr>
                        <td colSpan="6" className="text-center text-[var(--text-muted)]">No critical inventory alerts</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
            <form onSubmit={launchMarketingAutomationCampaign} className="app-card p-4 space-y-3">
              <p className="panel-title">Advanced Marketing Automation</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <select
                  className="select"
                  value={campaignDraft.campaignType}
                  onChange={(event) => setCampaignDraft((prev) => ({ ...prev, campaignType: event.target.value }))}
                >
                  <option value="reactivation">Reactivation</option>
                  <option value="upsell">Upsell</option>
                  <option value="flash-sale">Flash Sale</option>
                  <option value="new-arrivals">New Arrivals</option>
                  <option value="farmer-verification">Farmer Verification</option>
                  <option value="custom">Custom</option>
                </select>
                <select
                  className="select"
                  value={campaignDraft.targetSegment}
                  onChange={(event) => setCampaignDraft((prev) => ({ ...prev, targetSegment: event.target.value }))}
                >
                  <option value="all-buyers">All buyers</option>
                  <option value="dormant-buyers">Dormant buyers</option>
                  <option value="high-value-buyers">High-value buyers</option>
                  <option value="new-buyers">New buyers</option>
                  <option value="active-farmers">Active farmers</option>
                  <option value="farmers-pending-verification">Farmers pending verification</option>
                </select>
              </div>
              <input
                className="input"
                placeholder="Campaign title"
                value={campaignDraft.title}
                onChange={(event) => setCampaignDraft((prev) => ({ ...prev, title: event.target.value }))}
              />
              <textarea
                rows="3"
                className="textarea"
                placeholder="Campaign message"
                value={campaignDraft.message}
                onChange={(event) => setCampaignDraft((prev) => ({ ...prev, message: event.target.value }))}
              />
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={campaignDraft.createCoupon}
                  onChange={(event) => setCampaignDraft((prev) => ({ ...prev, createCoupon: event.target.checked }))}
                />
                Auto-generate coupon
              </label>
              {campaignDraft.createCoupon && (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <input
                    className="input"
                    placeholder="Prefix"
                    value={campaignDraft.codePrefix}
                    onChange={(event) => setCampaignDraft((prev) => ({ ...prev, codePrefix: event.target.value }))}
                  />
                  <select
                    className="select"
                    value={campaignDraft.discountType}
                    onChange={(event) => setCampaignDraft((prev) => ({ ...prev, discountType: event.target.value }))}
                  >
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed</option>
                  </select>
                  <input
                    type="number"
                    className="input"
                    placeholder="Value"
                    value={campaignDraft.value}
                    onChange={(event) => setCampaignDraft((prev) => ({ ...prev, value: event.target.value }))}
                  />
                  <input
                    type="number"
                    className="input"
                    placeholder="Expires days"
                    value={campaignDraft.expiresDays}
                    onChange={(event) => setCampaignDraft((prev) => ({ ...prev, expiresDays: event.target.value }))}
                  />
                </div>
              )}
              <button type="submit" className="btn-primary">Launch Automated Campaign</button>
            </form>

            <div className="app-card p-4 space-y-3">
              <p className="panel-title">Marketing Segment Intelligence</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-[var(--line)] p-2">
                  <p className="text-xs text-[var(--text-muted)]">Dormant buyers</p>
                  <p className="text-lg font-bold">{marketingInsights.segments?.dormantBuyers || 0}</p>
                </div>
                <div className="rounded-lg border border-[var(--line)] p-2">
                  <p className="text-xs text-[var(--text-muted)]">High-value buyers</p>
                  <p className="text-lg font-bold">{marketingInsights.segments?.highValueBuyers || 0}</p>
                </div>
                <div className="rounded-lg border border-[var(--line)] p-2">
                  <p className="text-xs text-[var(--text-muted)]">Active farmers</p>
                  <p className="text-lg font-bold">{marketingInsights.segments?.activeFarmers || 0}</p>
                </div>
                <div className="rounded-lg border border-[var(--line)] p-2">
                  <p className="text-xs text-[var(--text-muted)]">Pending farmers</p>
                  <p className="text-lg font-bold">{marketingInsights.segments?.pendingFarmers || 0}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">Recommended campaigns</p>
                {(marketingInsights.recommendedCampaigns || []).map((item) => (
                  <article key={`${item.type}-${item.targetSegment}`} className="rounded-lg border border-[var(--line)] p-2 text-xs">
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-[var(--text-muted)]">{item.reason}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === 'users' && (
        <section className="space-y-4">
          <div className="app-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="panel-title">User Controls</p>
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users"
                className="input max-w-sm"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-3">
              <p className="text-xs font-semibold text-[var(--text-muted)]">
                {selectedUserIds.length} selected
              </p>
              <select
                value={bulkAction}
                onChange={(event) => setBulkAction(event.target.value)}
                className="select max-w-[220px]"
              >
                <option value="block">Block selected users</option>
                <option value="unblock">Unblock selected users</option>
                <option value="activate">Activate selected users</option>
                <option value="deactivate">Deactivate selected users</option>
                <option value="verify-farmers">Verify selected farmers</option>
              </select>
              <button
                type="button"
                className="btn-primary"
                onClick={runBulkUserAction}
                disabled={!selectedUserIds.length}
              >
                Run bulk action
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedUserIds([])}
                disabled={!selectedUserIds.length}
              >
                Clear selection
              </button>
            </div>
            <div className="table-shell mt-3">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisibleUsers}
                        aria-label="Select all visible users"
                      />
                    </th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Wallet</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((u) => (
                    <tr key={u._id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(u._id)}
                          onChange={() => toggleUserSelection(u._id)}
                          aria-label={`Select ${u.name}`}
                        />
                      </td>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td className="uppercase">{u.role}</td>
                      <td>
                        {u.isActive ? 'Active' : 'Deactivated'}
                        {u.blocked ? ' | Blocked' : ' | Not blocked'}
                        {u.role === 'farmer' ? ` | ${u.isFarmerVerified ? 'Verified' : 'Pending'}` : ''}
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          Last login: {formatDate(u.lastLoginAt)}
                        </p>
                      </td>
                      <td>{formatCurrency(u.walletBalance || 0)}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              dispatch(toggleUserBlock(u._id)).then(() => {
                                dispatch(fetchAdminUsers());
                                loadAuditLogs({ page: 1 });
                              })
                            }
                            className="btn-secondary"
                          >
                            {u.blocked ? 'Unblock' : 'Block'}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateAccountStatus(u._id, !u.isActive)}
                            className={u.isActive ? 'btn-danger' : 'btn-primary'}
                          >
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          {u.role === 'farmer' && (
                            <button
                              type="button"
                              onClick={() =>
                                dispatch(verifyFarmer(u._id)).then(() => {
                                  dispatch(fetchAdminUsers());
                                  loadAuditLogs({ page: 1 });
                                })
                              }
                              className="btn-secondary"
                            >
                              Verify
                            </button>
                          )}
                          <input
                            type="number"
                            className="input w-24"
                            placeholder="+/-"
                            value={walletDelta[u._id] || ''}
                            onChange={(e) =>
                              setWalletDelta((p) => ({ ...p, [u._id]: e.target.value }))
                            }
                          />
                          <button type="button" className="btn-primary" onClick={() => updateWallet(u._id)}>
                            Wallet
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="app-card p-4">
            <p className="panel-title">Send Announcement</p>
            <form onSubmit={submitAnnouncement} className="mt-3 space-y-2">
              <input className="input" placeholder="Title" value={announcement.title} onChange={(e) => setAnnouncement((p) => ({ ...p, title: e.target.value }))} />
              <textarea className="textarea" rows="3" placeholder="Message" value={announcement.message} onChange={(e) => setAnnouncement((p) => ({ ...p, message: e.target.value }))} />
              <select className="select" value={announcement.role} onChange={(e) => setAnnouncement((p) => ({ ...p, role: e.target.value }))}><option value="all">All users</option><option value="farmer">Farmers</option><option value="buyer">Buyers</option></select>
              <button type="submit" className="btn-primary">Send</button>
            </form>
          </div>
        </section>
      )}

      {tab === 'products' && (
        <section className="app-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="panel-title">Product Moderation</p><div className="flex gap-2"><select className="select w-36" value={productFilter.status} onChange={(e) => setProductFilter((p) => ({ ...p, status: e.target.value }))}><option value="all">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><input className="input w-48" value={productFilter.search} onChange={(e) => setProductFilter((p) => ({ ...p, search: e.target.value }))} placeholder="Search" /><button type="button" onClick={loadAdminProducts} className="btn-secondary">Refresh</button></div></div>
          <div className="table-shell mt-3"><table className="data-table"><thead><tr><th>Product</th><th>Farmer</th><th>Status</th><th>Price</th><th>Qty</th><th>Actions</th></tr></thead><tbody>{adminProducts.map((p) => (<tr key={p._id}><td><p className="font-semibold">{p.name}</p><p className="text-xs text-[var(--text-muted)]">{p.category?.name}</p></td><td>{p.farmer?.name || '-'}</td><td>{p.status}</td><td>{formatCurrency(p.pricePerUnit)}</td><td>{p.quantityAvailable}</td><td><div className="flex flex-wrap gap-1"><button type="button" className="btn-primary" onClick={() => moderateProduct(p._id, 'approved')}>Approve</button><button type="button" className="btn-secondary" onClick={() => moderateProduct(p._id, 'rejected')}>Reject</button><button type="button" className="btn-danger" onClick={() => removeProduct(p._id)}>Remove</button></div></td></tr>))}</tbody></table></div>
        </section>
      )}

      {tab === 'orders' && (
        <section className="app-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="panel-title">Order & Delivery Controls</p><div className="flex gap-2"><select className="select w-36" value={orderFilter.status} onChange={(e) => setOrderFilter((p) => ({ ...p, status: e.target.value }))}><option value="">All status</option><option value="placed">Placed</option><option value="accepted">Accepted</option><option value="paid">Paid</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select><select className="select w-36" value={orderFilter.paymentStatus} onChange={(e) => setOrderFilter((p) => ({ ...p, paymentStatus: e.target.value }))}><option value="">All payment</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="failed">Failed</option></select></div></div>
          {adminOrders.map((o) => (<article key={o._id} className="rounded-xl border border-[var(--line)] p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">#{o._id.slice(-8)}</p><p className="text-[var(--text-muted)]">{o.status}  |  {o.paymentStatus}  |  {formatCurrency(o.totalAmount)}</p></div><p className="text-xs text-[var(--text-muted)] mt-1">Buyer: {o.buyer?.name || '-'}  |  {formatDate(o.createdAt)}</p><div className="mt-2 flex flex-wrap gap-1"><button type="button" className="btn-secondary" onClick={() => setOrderStatus(o._id, 'paid')}>Paid</button><button type="button" className="btn-secondary" onClick={() => setOrderStatus(o._id, 'shipped')}>Shipped</button><button type="button" className="btn-primary" onClick={() => setOrderStatus(o._id, 'delivered')}>Delivered</button><button type="button" className="btn-danger" onClick={() => setOrderStatus(o._id, 'cancelled')}>Cancel</button></div><div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4"><input className="input" placeholder="Partner" value={tracking[o._id]?.partnerName || ''} onChange={(e) => setTracking((p) => ({ ...p, [o._id]: { ...p[o._id], partnerName: e.target.value } }))} /><input className="input" placeholder="Tracking ID" value={tracking[o._id]?.trackingId || ''} onChange={(e) => setTracking((p) => ({ ...p, [o._id]: { ...p[o._id], trackingId: e.target.value } }))} /><input className="input" placeholder="Status" value={tracking[o._id]?.status || ''} onChange={(e) => setTracking((p) => ({ ...p, [o._id]: { ...p[o._id], status: e.target.value } }))} /><input className="input" placeholder="Last location" value={tracking[o._id]?.lastLocation || ''} onChange={(e) => setTracking((p) => ({ ...p, [o._id]: { ...p[o._id], lastLocation: e.target.value } }))} /></div><button type="button" className="btn-secondary mt-2" onClick={() => setOrderTracking(o._id)}>Update tracking</button></article>))}
        </section>
      )}

      {tab === 'coupons' && (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1.9fr]">
          <form onSubmit={createCoupon} className="app-card p-4 space-y-2"><p className="panel-title">Create Coupon</p><input className="input" placeholder="Code" value={couponForm.code} onChange={(e) => setCouponForm((p) => ({ ...p, code: e.target.value }))} /><div className="grid grid-cols-2 gap-2"><select className="select" value={couponForm.discountType} onChange={(e) => setCouponForm((p) => ({ ...p, discountType: e.target.value }))}><option value="percent">Percent</option><option value="fixed">Fixed</option></select><input type="number" className="input" placeholder="Value" value={couponForm.value} onChange={(e) => setCouponForm((p) => ({ ...p, value: Number(e.target.value) }))} /><input type="number" className="input" placeholder="Min Order" value={couponForm.minOrderAmount} onChange={(e) => setCouponForm((p) => ({ ...p, minOrderAmount: Number(e.target.value) }))} /><input type="number" className="input" placeholder="Usage Limit" value={couponForm.usageLimit} onChange={(e) => setCouponForm((p) => ({ ...p, usageLimit: Number(e.target.value) }))} /></div><input type="date" className="input" value={couponForm.expiresAt} onChange={(e) => setCouponForm((p) => ({ ...p, expiresAt: e.target.value }))} /><button type="submit" className="btn-primary">Create</button></form>
          <div className="app-card p-4 space-y-2"><p className="panel-title">Coupon List</p>{coupons.map((c) => (<article key={c._id} className="rounded-xl border border-[var(--line)] p-2 text-sm"><div className="flex items-center justify-between gap-2"><p className="font-semibold">{c.code}</p><span className={`badge ${c.isActive ? '' : 'badge-danger'}`}>{c.isActive ? 'Active' : 'Inactive'}</span></div><p className="text-[var(--text-muted)]">{c.discountType === 'percent' ? `${c.value}% off` : `${formatCurrency(c.value)} off`}  |  Min {formatCurrency(c.minOrderAmount)}</p><p className="text-xs text-[var(--text-muted)]">Expires {formatDate(c.expiresAt)}</p><div className="mt-1 flex gap-1"><button type="button" className="btn-secondary" onClick={() => toggleCoupon(c)}>{c.isActive ? 'Deactivate' : 'Activate'}</button><button type="button" className="btn-danger" onClick={() => deleteCoupon(c._id)}>Delete</button></div></article>))}</div>
        </section>
      )}

      {tab === 'audit' && (
        <section className="app-card space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="panel-title">Audit Trail</p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => loadAuditLogs({ page: auditMeta.page || 1 })}
            >
              Refresh logs
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <input
              className="input md:col-span-2"
              placeholder="Search admin, action, or target"
              value={auditFilter.search}
              onChange={(event) =>
                setAuditFilter((prev) => ({ ...prev, search: event.target.value }))
              }
            />
            <select
              className="select"
              value={auditFilter.action}
              onChange={(event) =>
                setAuditFilter((prev) => ({ ...prev, action: event.target.value }))
              }
            >
              <option value="">All actions</option>
              <option value="users.bulk_action">users.bulk_action</option>
              <option value="user.block">user.block</option>
              <option value="user.unblock">user.unblock</option>
              <option value="user.activate">user.activate</option>
              <option value="user.deactivate">user.deactivate</option>
              <option value="user.wallet_adjust">user.wallet_adjust</option>
              <option value="farmer.verify">farmer.verify</option>
              <option value="product.remove">product.remove</option>
              <option value="order.update_status">order.update_status</option>
              <option value="order.update_tracking">order.update_tracking</option>
              <option value="announcement.send">announcement.send</option>
            </select>
            <select
              className="select"
              value={auditFilter.targetType}
              onChange={(event) =>
                setAuditFilter((prev) => ({ ...prev, targetType: event.target.value }))
              }
            >
              <option value="">All targets</option>
              <option value="user">User</option>
              <option value="product">Product</option>
              <option value="order">Order</option>
              <option value="forum_post">Forum Post</option>
              <option value="notification">Notification</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => loadAuditLogs({ page: 1 })}>
              Apply filters
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const resetFilter = { action: '', targetType: '', search: '' };
                setAuditFilter(resetFilter);
                loadAuditLogs({ page: 1, filtersOverride: resetFilter });
              }}
            >
              Reset
            </button>
            <p className="self-center text-xs text-[var(--text-muted)]">
              Total logs: {auditMeta.total}
            </p>
          </div>
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Details</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((entry) => (
                  <tr key={entry._id}>
                    <td>{formatDate(entry.createdAt)}</td>
                    <td>{entry.actorName || '-'}</td>
                    <td>{entry.action}</td>
                    <td>
                      {entry.targetType}
                      {entry.targetLabel ? ` | ${entry.targetLabel}` : ''}
                    </td>
                    <td className="text-xs text-[var(--text-muted)]">{formatAuditDetails(entry.details)}</td>
                    <td className="text-xs text-[var(--text-muted)]">{entry.ipAddress || '-'}</td>
                  </tr>
                ))}
                {!auditLogs.length && (
                  <tr>
                    <td colSpan="6" className="text-center text-[var(--text-muted)]">
                      No audit events found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'content' && (
        <section className="app-card p-4 space-y-3">
          <p className="panel-title">Forum Moderation</p>
          {forumPosts.map((post) => (
            <article key={post._id} className="rounded-xl border border-[var(--line)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{post.title}</p>
                <button type="button" className="btn-danger" onClick={() => removeForumPost(post._id)}>Remove</button>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">By {post.user?.name || '-'}  |  {formatDate(post.createdAt)}</p>
              <p className="mt-2 text-sm text-[var(--text-muted)] line-clamp-2">{post.content}</p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
};

export default AdminDashboardPage;

