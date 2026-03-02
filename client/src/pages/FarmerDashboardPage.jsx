import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import api from '../api/client';
import {
  fetchFarmerAnalytics,
  fetchFarmerOrders,
  setFarmerDecision,
  setOrderStatus,
} from '../features/orders/ordersSlice';
import {
  createProduct,
  deleteProduct,
  fetchCategories,
  fetchFarmerProducts,
  quickUpdateProduct,
} from '../features/products/productsSlice';
import { formatCurrency, formatDate } from '../utils/format';
import usePageTitle from '../hooks/usePageTitle';
import { getSocket } from '../utils/socket';
import {
  BoltIcon,
  CandleChartIcon,
  CheckCircleIcon,
  ClockIcon,
  DropletIcon,
  LeafIcon,
  PackageIcon,
  ShieldCheckIcon,
  SparkleIcon,
  StoreIcon,
  ThermometerIcon,
  TrendUpIcon,
  TruckIcon,
  UserGroupIcon,
} from '../components/icons/AppIcons';

const FarmerDashboardPage = () => {
  usePageTitle('Farmer Dashboard');

  const dispatch = useAppDispatch();
  const { user, token } = useAppSelector((state) => state.auth);
  const { categories, farmerProducts } = useAppSelector((state) => state.products);
  const { farmerAnalytics, farmerOrders } = useAppSelector((state) => state.orders);

  const [weather, setWeather] = useState(null);
  const [formValues, setFormValues] = useState({
    name: '',
    category: '',
    description: '',
    pricePerUnit: '',
    quantityAvailable: '',
    harvestDate: '',
    organic: false,
    district: user?.location?.district || '',
    province: user?.location?.province || '',
    country: 'Nepal',
    tags: '',
  });
  const [imageFiles, setImageFiles] = useState([]);
  const [videoFiles, setVideoFiles] = useState([]);
  const [suggestedPrice, setSuggestedPrice] = useState(null);
  const [inventoryDraft, setInventoryDraft] = useState({});
  const [demandInsights, setDemandInsights] = useState([]);
  const [customerInsights, setCustomerInsights] = useState([]);
  const [farmerIntelLoading, setFarmerIntelLoading] = useState(false);

  useEffect(() => {
    dispatch(fetchCategories());
    dispatch(fetchFarmerProducts());
    dispatch(fetchFarmerOrders());
    dispatch(fetchFarmerAnalytics());
  }, [dispatch]);

  useEffect(() => {
    if (!user?._id) return;
    const socket = getSocket({ userId: user._id, token });
    socket.on('inventory:update', () => {
      dispatch(fetchFarmerProducts());
      loadAdvancedInsights();
    });
    return () => socket.off('inventory:update');
  }, [dispatch, token, user?._id]);

  useEffect(() => {
    const loadWeather = async () => {
      if (!user?.location?.district) return;
      try {
        const { data } = await api.get('/weather', { params: { district: user.location.district } });
        setWeather(data.weather);
      } catch (_error) {
        setWeather(null);
      }
    };
    loadWeather();
  }, [user?.location?.district]);

  useEffect(() => {
    loadAdvancedInsights();
  }, []);

  const lowStockProducts = useMemo(
    () => farmerProducts.filter((product) => Number(product.quantityAvailable) < 30),
    [farmerProducts],
  );

  const criticalStockCount = useMemo(
    () => demandInsights.filter((item) => item.metrics?.stockRisk === 'critical').length,
    [demandInsights],
  );

  const vipCustomerCount = useMemo(
    () => customerInsights.filter((item) => item.metrics?.segment === 'vip').length,
    [customerInsights],
  );

  const loadAdvancedInsights = async () => {
    setFarmerIntelLoading(true);
    try {
      const [demandResponse, customerResponse] = await Promise.all([
        api.get('/users/insights/farmer-demand'),
        api.get('/users/insights/farmer-customers'),
      ]);

      setDemandInsights(demandResponse.data?.insights?.productInsights || []);
      setCustomerInsights(customerResponse.data?.insights?.customers || []);
    } catch (_error) {
      setDemandInsights([]);
      setCustomerInsights([]);
    } finally {
      setFarmerIntelLoading(false);
    }
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const requestPriceSuggestion = async () => {
    try {
      const { data } = await api.post('/products/price-suggestion', {
        basePrice: Number(formValues.pricePerUnit),
        organic: formValues.organic,
        quantity: Number(formValues.quantityAvailable),
      });
      setSuggestedPrice(data.suggestedPrice);
      toast.success(`Suggested price: NPR ${data.suggestedPrice}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Price suggestion unavailable');
    }
  };

  const submitProduct = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    Object.entries(formValues).forEach(([key, value]) => formData.append(key, value));
    imageFiles.forEach((file) => formData.append('images', file));
    videoFiles.forEach((file) => formData.append('videos', file));

    const action = await dispatch(createProduct(formData));
    if (createProduct.fulfilled.match(action)) {
      toast.success('Product submitted for admin review');
      setFormValues((prev) => ({
        ...prev,
        name: '',
        description: '',
        pricePerUnit: '',
        quantityAvailable: '',
        harvestDate: '',
      }));
      setImageFiles([]);
      setVideoFiles([]);
      dispatch(fetchFarmerProducts());
      loadAdvancedInsights();
    } else {
      toast.error(action.payload || 'Failed to create product');
    }
  };

  const quickSaveInventory = async (productId) => {
    const draft = inventoryDraft[productId];
    if (!draft) return;
    const action = await dispatch(quickUpdateProduct({ id: productId, payload: draft }));
    if (quickUpdateProduct.fulfilled.match(action)) {
      toast.success('Inventory updated');
      setInventoryDraft((prev) => ({ ...prev, [productId]: undefined }));
      loadAdvancedInsights();
    } else {
      toast.error(action.payload || 'Failed to update inventory');
    }
  };

  const applySuggestedPrice = async (insight) => {
    const productId = insight?.product?._id;
    const suggested = insight?.metrics?.suggestedPrice;
    if (!productId || !Number.isFinite(Number(suggested))) return;

    const action = await dispatch(
      quickUpdateProduct({
        id: productId,
        payload: { pricePerUnit: Number(suggested) },
      }),
    );

    if (quickUpdateProduct.fulfilled.match(action)) {
      toast.success('Suggested price applied');
      loadAdvancedInsights();
    } else {
      toast.error(action.payload || 'Failed to apply suggested price');
    }
  };

  const applyRestockPlan = async (insight) => {
    const productId = insight?.product?._id;
    const recommendedRestock = Number(insight?.metrics?.recommendedRestock || 0);
    const currentQty = Number(insight?.product?.quantityAvailable || 0);
    if (!productId || recommendedRestock <= 0) return;

    const action = await dispatch(
      quickUpdateProduct({
        id: productId,
        payload: { quantityAvailable: currentQty + recommendedRestock },
      }),
    );

    if (quickUpdateProduct.fulfilled.match(action)) {
      toast.success(`Restock applied (+${recommendedRestock})`);
      loadAdvancedInsights();
    } else {
      toast.error(action.payload || 'Failed to apply restock plan');
    }
  };

  const decideOrder = async (id, decision) => {
    const action = await dispatch(setFarmerDecision({ id, decision }));
    if (setFarmerDecision.fulfilled.match(action)) {
      toast.success(`Order ${decision}`);
      dispatch(fetchFarmerOrders());
      loadAdvancedInsights();
    } else {
      toast.error(action.payload || 'Failed to update order');
    }
  };

  const markOrderStatus = async (id, status) => {
    const action = await dispatch(setOrderStatus({ id, status }));
    if (setOrderStatus.fulfilled.match(action)) {
      toast.success(`Order marked ${status}`);
      dispatch(fetchFarmerOrders());
      loadAdvancedInsights();
    } else {
      toast.error(action.payload || 'Failed to mark status');
    }
  };

  return (
    <div className="space-y-6">
      <section className="hero-panel bg-gradient-to-r from-[#173c22] via-[#2b6d3d] to-[#7aae4a] p-6 text-white md:p-7">
        <h1 className="font-['Sora'] text-3xl font-bold">Farmer Business Hub</h1>
        <p className="mt-2 text-sm text-white/90">
          Manage inventory, publish produce, process orders, and monitor revenue insights from a single dashboard.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {user?.isFarmerVerified && (
            <span className="badge-verified border-white/30 bg-white/15 text-white">
              <ShieldCheckIcon className="h-3.5 w-3.5" />
              Verified Farmer
            </span>
          )}
          {(farmerAnalytics?.badges || []).map((badge) => (
            <span key={badge} className="badge border-white/30 bg-white/15 text-white">
              <SparkleIcon className="h-3.5 w-3.5" />
              {badge}
            </span>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <article className="metric-card p-4">
          <p className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <TrendUpIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
            Revenue
          </p>
          <p className="mt-1 text-2xl font-bold">{formatCurrency(farmerAnalytics?.revenue || 0)}</p>
        </article>
        <article className="metric-card p-4">
          <p className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <StoreIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
            Units sold
          </p>
          <p className="mt-1 text-2xl font-bold">{farmerAnalytics?.unitsSold || 0}</p>
        </article>
        <article className="metric-card p-4">
          <p className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <PackageIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
            Orders
          </p>
          <p className="mt-1 text-2xl font-bold">{farmerAnalytics?.ordersCount || 0}</p>
        </article>
        <article className="metric-card p-4">
          <p className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <CheckCircleIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
            Wallet
          </p>
          <p className="mt-1 text-2xl font-bold">{formatCurrency(farmerAnalytics?.walletBalance || 0)}</p>
        </article>
        <article className="metric-card p-4">
          <p className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <BoltIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
            Critical stock
          </p>
          <p className="mt-1 text-2xl font-bold">{criticalStockCount}</p>
        </article>
        <article className="metric-card p-4">
          <p className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <UserGroupIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
            VIP buyers
          </p>
          <p className="mt-1 text-2xl font-bold">{vipCustomerCount}</p>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="app-card p-5">
          <h2 className="inline-flex items-center gap-2 panel-title">
            <TrendUpIcon className="h-5 w-5 text-[var(--accent)]" />
            Sales Trend
          </h2>
          {farmerAnalytics?.monthlySales?.length ? (
            <div className="mt-3 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={farmerAnalytics.monthlySales.map((item) => ({ month: item._id, sales: item.sales }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="sales" stroke="var(--accent)" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-muted)]">Analytics appear after paid orders.</p>
          )}
        </div>

        <div className="app-card space-y-3 p-5">
          <h2 className="panel-title">Farm Insights</h2>
          <div className="rounded-xl border border-[var(--line)] p-3 text-sm">
            <p className="font-semibold">Weather</p>
            {weather ? (
              <>
                <p className="mt-1 text-[var(--text-muted)]">{weather.location || user?.location?.district}</p>
                <p className="inline-flex items-center gap-2 text-[var(--text-muted)]">
                  <ThermometerIcon className="h-3.5 w-3.5" />
                  {weather.temperature ?? '-'} C
                </p>
                <p className="inline-flex items-center gap-2 text-[var(--text-muted)]">
                  <DropletIcon className="h-3.5 w-3.5" />
                  {weather.humidity ?? '-'}% humidity
                </p>
                <p className="text-[var(--text-muted)]">{weather.condition || weather.note || 'N/A'}</p>
              </>
            ) : (
              <p className="text-[var(--text-muted)]">Weather unavailable</p>
            )}
          </div>
          <div className="rounded-xl border border-[var(--line)] p-3 text-sm">
            <p className="font-semibold">Low Stock Alerts</p>
            {lowStockProducts.slice(0, 5).map((item) => (
              <p key={item._id} className="mt-1 text-[var(--text-muted)]">
                {item.name} - {item.quantityAvailable} left
              </p>
            ))}
            {!lowStockProducts.length && <p className="text-[var(--text-muted)]">No low-stock products.</p>}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="app-card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 panel-title">
              <CandleChartIcon className="h-5 w-5 text-[var(--accent)]" />
              Smart Inventory & Pricing Engine
            </h2>
            {farmerIntelLoading ? <span className="text-xs text-[var(--text-muted)]">Refreshing insights...</span> : null}
          </div>
          {demandInsights.length ? (
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Demand</th>
                    <th>Stock Risk</th>
                    <th>30d Units</th>
                    <th>Stockout ETA</th>
                    <th>Suggested Price</th>
                    <th>Automation</th>
                  </tr>
                </thead>
                <tbody>
                  {demandInsights.slice(0, 10).map((insight) => (
                    <tr key={insight.product?._id}>
                      <td>
                        <p className="font-semibold">{insight.product?.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">{insight.product?.category?.name || 'Uncategorized'}</p>
                      </td>
                      <td className="capitalize">{insight.metrics?.demandSignal || 'steady'}</td>
                      <td>
                        <span
                          className={`badge ${
                            insight.metrics?.stockRisk === 'critical'
                              ? 'border-rose-400/40 bg-rose-500/10 text-rose-700'
                              : insight.metrics?.stockRisk === 'watch'
                                ? 'border-amber-400/40 bg-amber-500/10 text-amber-700'
                                : ''
                          }`}
                        >
                          {insight.metrics?.stockRisk || 'stable'}
                        </span>
                      </td>
                      <td>{insight.metrics?.sold30d || 0}</td>
                      <td>
                        {Number.isFinite(insight.metrics?.daysToStockout)
                          ? `${insight.metrics.daysToStockout} days`
                          : 'N/A'}
                      </td>
                      <td>
                        <p className="font-semibold">{formatCurrency(insight.metrics?.suggestedPrice || 0)}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {insight.metrics?.suggestedPriceDelta >= 0 ? '+' : ''}
                          {formatCurrency(insight.metrics?.suggestedPriceDelta || 0)} vs current
                        </p>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <button type="button" className="btn-secondary" onClick={() => applySuggestedPrice(insight)}>
                            Apply price
                          </button>
                          {insight.metrics?.recommendedRestock > 0 && (
                            <button type="button" className="btn-primary" onClick={() => applyRestockPlan(insight)}>
                              Restock +{insight.metrics.recommendedRestock}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              Demand intelligence appears after paid or delivered order history.
            </p>
          )}
        </div>

        <div className="app-card p-5">
          <h2 className="inline-flex items-center gap-2 panel-title">
            <UserGroupIcon className="h-5 w-5 text-[var(--accent)]" />
            Buyer Intelligence CRM
          </h2>
          <div className="mt-3 space-y-2">
            {customerInsights.slice(0, 8).map((entry) => (
              <article key={entry.buyer?._id} className="rounded-xl border border-[var(--line)] p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{entry.buyer?.name}</p>
                  <span
                    className={`badge ${
                      entry.metrics?.segment === 'vip'
                        ? 'border-indigo-400/40 bg-indigo-500/10 text-indigo-700'
                        : entry.metrics?.segment === 'loyal'
                          ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-700'
                          : ''
                    }`}
                  >
                    {entry.metrics?.segment || 'emerging'}
                  </span>
                </div>
                <p className="mt-1 text-[var(--text-muted)]">
                  {entry.metrics?.ordersCount || 0} orders | {formatCurrency(entry.metrics?.totalSpend || 0)}
                </p>
                <p className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <ClockIcon className="h-3.5 w-3.5" />
                  Last order {entry.metrics?.daysSinceLastOrder ?? '-'} day(s) ago
                </p>
              </article>
            ))}
            {!customerInsights.length && (
              <p className="text-sm text-[var(--text-muted)]">
                Customer intelligence will show as repeat buyer data grows.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_1fr]">
        <form onSubmit={submitProduct} className="app-card space-y-3 p-5">
          <h2 className="inline-flex items-center gap-2 panel-title">
            <LeafIcon className="h-5 w-5 text-[var(--accent)]" />
            Add New Product
          </h2>
          <input name="name" value={formValues.name} onChange={handleInputChange} placeholder="Product name" className="input" required />
          <select name="category" value={formValues.category} onChange={handleInputChange} className="select" required>
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>{category.name}</option>
            ))}
          </select>
          <textarea name="description" value={formValues.description} onChange={handleInputChange} placeholder="Description" className="textarea" rows="3" required />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input type="number" name="pricePerUnit" value={formValues.pricePerUnit} onChange={handleInputChange} placeholder="Price per unit" className="input" required />
            <input type="number" name="quantityAvailable" value={formValues.quantityAvailable} onChange={handleInputChange} placeholder="Quantity" className="input" required />
            <input type="date" name="harvestDate" value={formValues.harvestDate} onChange={handleInputChange} className="input" />
            <input name="tags" value={formValues.tags} onChange={handleInputChange} placeholder="Tags (comma separated)" className="input" />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input name="district" value={formValues.district} onChange={handleInputChange} placeholder="District" className="input" />
            <input name="province" value={formValues.province} onChange={handleInputChange} placeholder="Province" className="input" />
            <input name="country" value={formValues.country} onChange={handleInputChange} placeholder="Country" className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="organic" checked={formValues.organic} onChange={handleInputChange} />
            Organic product
          </label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input type="file" multiple accept="image/*" onChange={(event) => setImageFiles(Array.from(event.target.files || []))} className="input" />
            <input type="file" multiple accept="video/*" onChange={(event) => setVideoFiles(Array.from(event.target.files || []))} className="input" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={requestPriceSuggestion} className="btn-secondary">
              Smart price suggestion
            </button>
            {suggestedPrice && <p className="self-center text-sm text-[var(--text-muted)]">Suggested: NPR {suggestedPrice}</p>}
            <button type="submit" className="btn-primary ml-auto">
              Submit product
            </button>
          </div>
        </form>

        <div className="app-card space-y-3 p-5">
          <h2 className="inline-flex items-center gap-2 panel-title">
            <TruckIcon className="h-5 w-5 text-[var(--accent)]" />
            Order Actions
          </h2>
          {farmerOrders.slice(0, 8).map((order) => (
            <article key={order._id} className="rounded-xl border border-[var(--line)] p-3 text-sm">
              <p className="font-semibold">#{order._id.slice(-8)}</p>
              <p className="text-[var(--text-muted)]">{order.status} | {formatCurrency(order.totalAmount)}</p>
              <p className="text-xs text-[var(--text-muted)]">{formatDate(order.createdAt)}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {order.status === 'placed' && (
                  <>
                    <button type="button" className="btn-primary" onClick={() => decideOrder(order._id, 'accepted')}>Accept</button>
                    <button type="button" className="btn-danger" onClick={() => decideOrder(order._id, 'rejected')}>Reject</button>
                  </>
                )}
                {['accepted', 'paid'].includes(order.status) && (
                  <button type="button" className="btn-secondary" onClick={() => markOrderStatus(order._id, 'shipped')}>Mark shipped</button>
                )}
                {order.status === 'shipped' && (
                  <button type="button" className="btn-secondary" onClick={() => markOrderStatus(order._id, 'delivered')}>Mark delivered</button>
                )}
              </div>
            </article>
          ))}
          {!farmerOrders.length && <p className="text-sm text-[var(--text-muted)]">No incoming orders yet.</p>}
        </div>
      </section>

      <section className="app-card p-5">
        <h2 className="inline-flex items-center gap-2 panel-title">
          <PackageIcon className="h-5 w-5 text-[var(--accent)]" />
          Inventory Operations
        </h2>
        <div className="table-shell mt-3">
          <table className="data-table">
            <thead>
              <tr><th>Product</th><th>Status</th><th>Price</th><th>Quantity</th><th>Quick Ops</th><th>Delete</th></tr>
            </thead>
            <tbody>
              {farmerProducts.map((product) => (
                <tr key={product._id}>
                  <td><p className="font-semibold">{product.name}</p><p className="text-xs text-[var(--text-muted)]">{product.category?.name || ''}</p></td>
                  <td className="capitalize">{product.status}</td>
                  <td>
                    <input
                      type="number"
                      className="input w-28"
                      defaultValue={product.pricePerUnit}
                      onChange={(event) =>
                        setInventoryDraft((prev) => ({
                          ...prev,
                          [product._id]: { ...prev[product._id], pricePerUnit: Number(event.target.value) },
                        }))
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input w-24"
                      defaultValue={product.quantityAvailable}
                      onChange={(event) =>
                        setInventoryDraft((prev) => ({
                          ...prev,
                          [product._id]: { ...prev[product._id], quantityAvailable: Number(event.target.value) },
                        }))
                      }
                    />
                  </td>
                  <td>
                    <button type="button" className="btn-secondary" onClick={() => quickSaveInventory(product._id)}>Save</button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() =>
                        dispatch(deleteProduct(product._id)).then(() => {
                          dispatch(fetchFarmerProducts());
                          loadAdvancedInsights();
                        })
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!farmerProducts.length && (
                <tr><td colSpan="6" className="text-[var(--text-muted)]">No products yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default FarmerDashboardPage;
