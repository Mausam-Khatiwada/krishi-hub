import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import api from '../api/client';
import ProductCard from '../components/ProductCard';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ArrowRightIcon,
  LeafIcon,
  MapPinIcon,
  SearchIcon,
  SparkleIcon,
  StoreIcon,
  TrendUpIcon,
} from '../components/icons/AppIcons';
import {
  fetchCategories,
  fetchProducts,
  fetchRecommendations,
  setProductFilters,
} from '../features/products/productsSlice';
import usePageTitle from '../hooks/usePageTitle';

const HomePage = () => {
  usePageTitle('Marketplace');

  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { products, categories, recommendations, loading, filters, total } = useAppSelector(
    (state) => state.products,
  );

  const [localFilters, setLocalFilters] = useState(filters);
  const [trends, setTrends] = useState([]);

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

  const trendData = useMemo(
    () =>
      trends.map((item) => ({
        name: item.categoryName,
        price: item.averagePrice,
      })),
    [trends],
  );

  const submitFilters = (event) => {
    event.preventDefault();
    dispatch(setProductFilters(localFilters));
  };

  return (
    <div className="space-y-8">
      <section className="hero-panel overflow-hidden border-none bg-gradient-to-br from-[#0f4427] via-[#1f7a40] to-[#78b956] px-6 pb-8 pt-7 text-white md:px-8">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-end">
          <div>
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
              <LeafIcon className="h-3.5 w-3.5" />
              {t('directFarmConnect')}
            </p>
            <h1 className="max-w-3xl font-['Sora'] text-4xl font-bold leading-tight md:text-5xl">{t('shopFresh')}</h1>
            <p className="mt-3 max-w-3xl text-sm text-white/90 md:text-base">{t('tagline')}</p>
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
              <p className="text-[11px] uppercase tracking-[0.1em] text-white/70">Organic Focus</p>
              <p className="mt-1 text-2xl font-bold">Farm</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/12 p-3 backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-[0.1em] text-white/70">Direct Trade</p>
              <p className="mt-1 text-2xl font-bold">Buyer</p>
            </div>
          </div>
        </div>

        <form onSubmit={submitFilters} className="relative z-10 mt-7 rounded-2xl border border-white/20 bg-white/92 p-4 text-[#1f2b16] shadow-xl backdrop-blur-md">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <label className="relative md:col-span-2">
              <SearchIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#5d6d5a]" />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={localFilters.search}
                onChange={(event) => setLocalFilters((prev) => ({ ...prev, search: event.target.value }))}
                className="input bg-white pl-9 text-[#1f2b16]"
              />
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
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="inline-flex items-center gap-2 text-2xl font-bold">
              <StoreIcon className="h-5 w-5 text-[var(--accent)]" />
              Fresh Listings
            </h2>
            <p className="text-sm text-[var(--text-muted)]">{total} products available</p>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
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
              <ProductCard key={product._id} product={product} />
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
    </div>
  );
};

export default HomePage;
