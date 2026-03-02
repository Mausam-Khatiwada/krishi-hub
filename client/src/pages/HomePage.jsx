import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import api from '../api/client';
import ProductCard from '../components/ProductCard';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ArrowRightIcon,
  BoltIcon,
  CandleChartIcon,
  CheckCircleIcon,
  ClockIcon,
  CompareIcon,
  LeafIcon,
  MapPinIcon,
  SearchIcon,
  SparkleIcon,
  StoreIcon,
  TrendUpIcon,
} from '../components/icons/AppIcons';
import {
  clearRecentlyViewed,
  fetchCategories,
  fetchProducts,
  fetchRecommendations,
  setProductFilters,
} from '../features/products/productsSlice';
import { formatCurrency } from '../utils/format';
import usePageTitle from '../hooks/usePageTitle';

const SAVED_FILTERS_STORAGE_KEY = 'krishihub_saved_filter_presets';

const defaultMarketFilters = {
  search: '',
  category: '',
  minPrice: '',
  maxPrice: '',
  location: '',
  organic: false,
  sort: 'newest',
};

const loadSavedPresets = () => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(SAVED_FILTERS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch (_error) {
    return [];
  }
};

const persistSavedPresets = (items) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SAVED_FILTERS_STORAGE_KEY, JSON.stringify((items || []).slice(0, 8)));
};

const serializeFilters = (filters) =>
  JSON.stringify({
    search: filters.search || '',
    category: filters.category || '',
    minPrice: filters.minPrice || '',
    maxPrice: filters.maxPrice || '',
    location: filters.location || '',
    organic: Boolean(filters.organic),
    sort: filters.sort || 'newest',
  });

const HomePage = () => {
  usePageTitle('Marketplace');

  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { products, categories, recommendations, recentlyViewed, loading, filters, total } = useAppSelector(
    (state) => state.products,
  );

  const [localFilters, setLocalFilters] = useState({ ...defaultMarketFilters, ...filters });
  const [trends, setTrends] = useState([]);
  const [compareProducts, setCompareProducts] = useState([]);
  const [savedPresets, setSavedPresets] = useState(() => loadSavedPresets());

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  useEffect(() => {
    const params = {
      ...filters,
      organic: filters.organic ? 'true' : undefined,
    };
    dispatch(fetchProducts(params));
  }, [dispatch, filters]);

  useEffect(() => {
    if (user) {
      dispatch(fetchRecommendations());
    }
  }, [dispatch, user]);

  useEffect(() => {
    const loadTrends = async () => {
      try {
        const { data } = await api.get('/analytics/crop-trends');
        setTrends(data.trends || []);
      } catch (_error) {
        setTrends([]);
      }
    };

    loadTrends();
  }, []);

  useEffect(() => {
    setLocalFilters((prev) => ({ ...prev, ...filters }));
  }, [filters]);

  const categoryLookup = useMemo(() => {
    const lookup = new Map();
    categories.forEach((category) => lookup.set(category._id, category.name));
    return lookup;
  }, [categories]);

  const trendData = useMemo(
    () =>
      trends.map((item) => ({
        name: item.categoryName,
        price: item.averagePrice,
      })),
    [trends],
  );

  const quickCategoryFilters = useMemo(() => categories.slice(0, 8), [categories]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.search ||
          filters.category ||
          filters.minPrice ||
          filters.maxPrice ||
          filters.location ||
          filters.organic ||
          filters.sort !== 'newest',
      ),
    [filters],
  );

  const searchSuggestions = useMemo(() => {
    if (!localFilters.search) return [];

    const normalized = localFilters.search.toLowerCase();
    const pool = [...products, ...recommendations, ...recentlyViewed];
    const unique = new Set();

    return pool
      .map((item) => item?.name)
      .filter(Boolean)
      .filter((name) => name.toLowerCase().includes(normalized))
      .filter((name) => {
        const key = name.toLowerCase();
        if (unique.has(key)) return false;
        unique.add(key);
        return true;
      })
      .slice(0, 6);
  }, [localFilters.search, products, recommendations, recentlyViewed]);

  const marketPulse = useMemo(() => {
    if (!products.length) {
      return {
        avgPrice: 0,
        organicRate: 0,
        lowStockCount: 0,
        topDistrict: '-',
      };
    }

    const avgPrice =
      products.reduce((sum, item) => sum + Number(item.pricePerUnit || 0), 0) / products.length;
    const organicRate =
      (products.filter((item) => item.organic).length / products.length) * 100;
    const lowStockCount = products.filter((item) => Number(item.quantityAvailable || 0) <= 20).length;

    const districtCount = products.reduce((acc, item) => {
      const district = item.location?.district || 'Unknown';
      acc[district] = (acc[district] || 0) + 1;
      return acc;
    }, {});

    const topDistrict =
      Object.entries(districtCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

    return {
      avgPrice,
      organicRate,
      lowStockCount,
      topDistrict,
    };
  }, [products]);

  const topCategoryByListing = useMemo(() => {
    const counts = products.reduce((acc, item) => {
      const category = item.category?.name || 'General';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [products]);

  const submitFilters = (event) => {
    event.preventDefault();
    dispatch(setProductFilters(localFilters));
  };

  const applyQuickFilters = (nextFilters) => {
    setLocalFilters(nextFilters);
    dispatch(setProductFilters(nextFilters));
  };

  const resetFilters = () => {
    setLocalFilters(defaultMarketFilters);
    dispatch(setProductFilters(defaultMarketFilters));
  };

  const setQuickCategory = (categoryId = '') => {
    applyQuickFilters({ ...localFilters, category: categoryId });
  };

  const toggleQuickOrganic = () => {
    applyQuickFilters({ ...localFilters, organic: !localFilters.organic });
  };

  const applyPowerMode = (mode) => {
    if (mode === 'value') {
      applyQuickFilters({ ...localFilters, sort: 'price_asc', maxPrice: localFilters.maxPrice || '1000' });
      return;
    }

    if (mode === 'organic') {
      applyQuickFilters({ ...localFilters, organic: true, sort: 'popularity' });
      return;
    }

    if (mode === 'nearby') {
      applyQuickFilters({
        ...localFilters,
        location: user?.location?.district || localFilters.location,
        sort: 'newest',
      });
    }
  };

  const saveCurrentFilterPreset = () => {
    const normalized = serializeFilters(localFilters);
    if (normalized === serializeFilters(defaultMarketFilters)) {
      toast.error('Apply at least one filter before saving');
      return;
    }

    const existing = savedPresets.find((preset) => serializeFilters(preset.filters) === normalized);
    if (existing) {
      toast('This filter is already saved');
      return;
    }

    const categoryName = categoryLookup.get(localFilters.category) || 'All';
    const labelParts = [
      localFilters.search ? `"${localFilters.search}"` : null,
      categoryName !== 'All' ? categoryName : null,
      localFilters.organic ? 'Organic' : null,
    ].filter(Boolean);

    const label = labelParts.length ? labelParts.join(' • ') : `Preset ${savedPresets.length + 1}`;

    const nextPresets = [
      {
        id: `${Date.now()}`,
        label,
        filters: { ...localFilters },
      },
      ...savedPresets,
    ].slice(0, 8);

    setSavedPresets(nextPresets);
    persistSavedPresets(nextPresets);
    toast.success('Smart filter saved');
  };

  const applySavedPreset = (preset) => {
    applyQuickFilters({ ...defaultMarketFilters, ...preset.filters });
  };

  const removeSavedPreset = (id) => {
    const nextPresets = savedPresets.filter((preset) => preset.id !== id);
    setSavedPresets(nextPresets);
    persistSavedPresets(nextPresets);
  };

  const toggleCompare = (product) => {
    setCompareProducts((prev) => {
      const exists = prev.some((item) => item._id === product._id);
      if (exists) return prev.filter((item) => item._id !== product._id);
      if (prev.length >= 3) {
        toast.error('You can compare up to 3 products');
        return prev;
      }
      return [...prev, product];
    });
  };

  const compareIds = useMemo(() => new Set(compareProducts.map((item) => item._id)), [compareProducts]);
  const compareDisabled = compareProducts.length >= 3;

  const insightCards = [
    {
      label: 'Average price',
      value: marketPulse.avgPrice ? formatCurrency(marketPulse.avgPrice) : '-',
      icon: TrendUpIcon,
    },
    {
      label: 'Organic share',
      value: `${marketPulse.organicRate.toFixed(0)}%`,
      icon: LeafIcon,
    },
    {
      label: 'Low-stock listings',
      value: `${marketPulse.lowStockCount}`,
      icon: BoltIcon,
    },
    {
      label: 'Most active district',
      value: marketPulse.topDistrict,
      icon: MapPinIcon,
    },
  ];

  return (
    <div className="space-y-8">
      <section className="hero-panel overflow-hidden border-none bg-gradient-to-br from-[#0d4024] via-[#1b7b43] to-[#f0a327] px-6 pb-8 pt-7 text-white md:px-8">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-end">
          <div>
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
              <SparkleIcon className="h-3.5 w-3.5" />
              Intelligent Marketplace Layer
            </p>
            <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight md:text-5xl">{t('shopFresh')}</h1>
            <p className="mt-3 max-w-3xl text-sm text-white/90 md:text-base">{t('tagline')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => applyPowerMode('value')} className="btn-secondary !border-white/30 !bg-white/15 !text-white">
                <BoltIcon className="h-4 w-4" />
                Value Picks
              </button>
              <button type="button" onClick={() => applyPowerMode('organic')} className="btn-secondary !border-white/30 !bg-white/15 !text-white">
                <LeafIcon className="h-4 w-4" />
                Organic Premium
              </button>
              <button type="button" onClick={() => applyPowerMode('nearby')} className="btn-secondary !border-white/30 !bg-white/15 !text-white">
                <MapPinIcon className="h-4 w-4" />
                Nearby Farms
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-white/20 bg-white/12 p-3 backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-[0.1em] text-white/70">Live Listings</p>
              <p className="mt-1 text-2xl font-bold">{total}</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/12 p-3 backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-[0.1em] text-white/70">Categories</p>
              <p className="mt-1 text-2xl font-bold">{categories.length}</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/12 p-3 backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-[0.1em] text-white/70">Recommendations</p>
              <p className="mt-1 text-2xl font-bold">{recommendations.length}</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/12 p-3 backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-[0.1em] text-white/70">Smart Presets</p>
              <p className="mt-1 text-2xl font-bold">{savedPresets.length}</p>
            </div>
          </div>
        </div>

        <form onSubmit={submitFilters} className="relative z-10 mt-7 rounded-2xl border border-white/20 bg-white/94 p-4 text-[#1f2b16] shadow-xl backdrop-blur-md">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <label className="relative md:col-span-2">
              <SearchIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#5d6d5a]" />
              <input
                type="text"
                list="market-search-suggestions"
                placeholder={t('searchPlaceholder')}
                value={localFilters.search}
                onChange={(event) => setLocalFilters((prev) => ({ ...prev, search: event.target.value }))}
                className="input bg-white pl-9 text-[#1f2b16]"
              />
              <datalist id="market-search-suggestions">
                {searchSuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </label>

            <select
              value={localFilters.category}
              onChange={(event) => setLocalFilters((prev) => ({ ...prev, category: event.target.value }))}
              className="select bg-white text-[#1f2b16]"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="0"
              placeholder="Min price"
              value={localFilters.minPrice}
              onChange={(event) => setLocalFilters((prev) => ({ ...prev, minPrice: event.target.value }))}
              className="input bg-white text-[#1f2b16]"
            />

            <input
              type="number"
              min="0"
              placeholder="Max price"
              value={localFilters.maxPrice}
              onChange={(event) => setLocalFilters((prev) => ({ ...prev, maxPrice: event.target.value }))}
              className="input bg-white text-[#1f2b16]"
            />

            <select
              value={localFilters.sort}
              onChange={(event) => setLocalFilters((prev) => ({ ...prev, sort: event.target.value }))}
              className="select bg-white text-[#1f2b16]"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price Low to High</option>
              <option value="price_desc">Price High to Low</option>
              <option value="popularity">Popularity</option>
            </select>

            <label className="relative md:col-span-2">
              <MapPinIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#5d6d5a]" />
              <input
                type="text"
                placeholder="District or province"
                value={localFilters.location}
                onChange={(event) => setLocalFilters((prev) => ({ ...prev, location: event.target.value }))}
                className="input bg-white pl-9 text-[#1f2b16]"
              />
            </label>

            <label className="inline-flex items-center gap-2 rounded-xl border border-[#d6e3d2] bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={localFilters.organic}
                onChange={(event) => setLocalFilters((prev) => ({ ...prev, organic: event.target.checked }))}
              />
              <LeafIcon className="h-3.5 w-3.5 text-[#228b4a]" />
              {t('organicOnly')}
            </label>

            <button type="submit" className="btn-primary md:justify-self-end">
              Search
              <ArrowRightIcon className="h-4 w-4" />
            </button>

            <button type="button" onClick={saveCurrentFilterPreset} className="btn-info md:justify-self-end">
              <CheckCircleIcon className="h-4 w-4" />
              Save Filter
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#d8e5d5] pt-3">
            <button
              type="button"
              onClick={() => setQuickCategory('')}
              className={`tab-button ${!localFilters.category ? 'active' : ''}`}
            >
              All
            </button>
            {quickCategoryFilters.map((category) => (
              <button
                key={category._id}
                type="button"
                onClick={() => setQuickCategory(category._id)}
                className={`tab-button ${localFilters.category === category._id ? 'active' : ''}`}
              >
                {category.name}
              </button>
            ))}
            <button
              type="button"
              onClick={toggleQuickOrganic}
              className={`tab-button ${localFilters.organic ? 'active' : ''}`}
            >
              Organic
            </button>
            {hasActiveFilters && (
              <button type="button" onClick={resetFilters} className="btn-ghost !px-3 !py-2 !text-xs">
                Reset Filters
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="market-pulse p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 text-xl font-bold">
            <CandleChartIcon className="h-5 w-5 text-[var(--accent)]" />
            Market Pulse
          </h2>
          <p className="text-xs text-[var(--text-muted)]">Real-time snapshot from current listings</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {insightCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.label} className="metric-card p-3.5">
                <p className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <Icon className="h-3.5 w-3.5 text-[var(--accent)]" />
                  {card.label}
                </p>
                <p className="mt-1 text-xl font-bold">{card.value}</p>
              </article>
            );
          })}
        </div>
        {!!topCategoryByListing.length && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="font-semibold">Most listed:</span>
            {topCategoryByListing.map(([name, count]) => (
              <span key={name} className="badge-neutral">{name} ({count})</span>
            ))}
          </div>
        )}
      </section>

      {!!savedPresets.length && (
        <section className="app-card p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 text-xl font-bold">
              <CheckCircleIcon className="h-5 w-5 text-[var(--accent)]" />
              Saved Smart Filters
            </h2>
            <span className="text-xs text-[var(--text-muted)]">One click restore</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {savedPresets.map((preset) => (
              <div key={preset.id} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5">
                <button
                  type="button"
                  onClick={() => applySavedPreset(preset)}
                  className="text-xs font-semibold text-[var(--text)] hover:text-[var(--accent)]"
                >
                  {preset.label}
                </button>
                <button
                  type="button"
                  onClick={() => removeSavedPreset(preset.id)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)]"
                  aria-label="Remove saved filter"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="inline-flex items-center gap-2 text-2xl font-bold">
              <StoreIcon className="h-5 w-5 text-[var(--accent)]" />
              Fresh Listings
            </h2>
            <p className="text-sm text-[var(--text-muted)]">{total} products available</p>
          </div>
          <p className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <CompareIcon className="h-3.5 w-3.5" />
            Compare up to 3 products side by side
          </p>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                onToggleCompare={toggleCompare}
                isCompared={compareIds.has(product._id)}
                compareDisabled={compareDisabled}
              />
            ))}
          </div>
        )}
      </section>

      {!!user && recommendations.length > 0 && (
        <section className="space-y-4">
          <h2 className="inline-flex items-center gap-2 text-2xl font-bold">
            <SparkleIcon className="h-5 w-5 text-[var(--accent)]" />
            AI Recommendations For You
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recommendations.slice(0, 4).map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                onToggleCompare={toggleCompare}
                isCompared={compareIds.has(product._id)}
                compareDisabled={compareDisabled}
              />
            ))}
          </div>
        </section>
      )}

      {!!recentlyViewed.length && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 text-2xl font-bold">
              <ClockIcon className="h-5 w-5 text-[var(--accent)]" />
              Recently Viewed
            </h2>
            <button
              type="button"
              onClick={() => dispatch(clearRecentlyViewed())}
              className="btn-ghost !px-3 !py-1.5 !text-xs"
            >
              Clear history
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentlyViewed.slice(0, 4).map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                onToggleCompare={toggleCompare}
                isCompared={compareIds.has(product._id)}
                compareDisabled={compareDisabled}
              />
            ))}
          </div>
        </section>
      )}

      <section className="app-card p-5">
        <h2 className="mb-4 inline-flex items-center gap-2 text-2xl font-bold">
          <TrendUpIcon className="h-5 w-5 text-[var(--accent)]" />
          {t('cropTrends')}
        </h2>
        {trendData.length ? (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="price" fill="var(--accent)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Trend data will appear when products are added.</p>
        )}
      </section>

      {!!compareProducts.length && (
        <section className="compare-drawer p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
            <h3 className="inline-flex items-center gap-2 text-base font-bold">
              <CompareIcon className="h-4 w-4 text-[var(--accent)]" />
              Compare Products ({compareProducts.length}/3)
            </h3>
            <button type="button" onClick={() => setCompareProducts([])} className="btn-ghost !px-3 !py-1.5 !text-xs">
              Clear Compare
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            {compareProducts.map((product) => (
              <article key={product._id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm">
                <p className="line-clamp-1 font-semibold">{product.name}</p>
                <p className="mt-1 text-[var(--accent)] font-bold">{formatCurrency(product.pricePerUnit)}</p>
                <p className="mt-1 text-[var(--text-muted)]">Stock: {Number(product.quantityAvailable || 0)}</p>
                <p className="text-[var(--text-muted)]">{product.location?.district || 'Unknown'}, {product.location?.province || 'Unknown'}</p>
                <p className="mt-1 text-[var(--text-muted)]">{product.organic ? 'Organic' : 'Conventional'}</p>
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={() => toggleCompare(product)} className="btn-secondary !px-3 !py-1.5 !text-xs">
                    Remove
                  </button>
                  <Link to={`/products/${product._id}`} className="btn-primary !px-3 !py-1.5 !text-xs">
                    View
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default HomePage;

