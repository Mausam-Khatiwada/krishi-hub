import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { clearAuthError, loginUser } from '../features/auth/authSlice';
import usePageTitle from '../hooks/usePageTitle';
import { ArrowRightIcon, CompassIcon, LockIcon, MailIcon, ShieldCheckIcon, SparkleIcon } from '../components/icons/AppIcons';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const LoginPage = () => {
  usePageTitle('Login');

  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, user, error } = useAppSelector((state) => state.auth);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values) => {
    const action = await dispatch(loginUser(values));

    if (loginUser.fulfilled.match(action)) {
      toast.success('Login successful');
      const redirectTo = location.state?.from || '/';
      navigate(redirectTo, { replace: true });
    }
  };

  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearAuthError());
    }
  }, [dispatch, error]);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [navigate, user]);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_1fr]">
      <section className="hero-panel bg-gradient-to-br from-[#103d26] via-[#1e7f47] to-[#8fc95a] p-6 text-white md:p-8">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
          <SparkleIcon className="h-4 w-4" />
          Secure access
        </p>
        <h1 className="mt-4 font-['Sora'] text-3xl font-bold leading-tight md:text-4xl">{t('welcomeBack')}</h1>
        <p className="mt-3 max-w-xl text-sm text-white/90 md:text-base">
          Continue your marketplace workflow with protected account sessions, real-time order visibility, and role-based dashboards.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <article className="rounded-xl border border-white/20 bg-white/10 p-3 text-sm">
            <p className="inline-flex items-center gap-1.5 font-semibold">
              <ShieldCheckIcon className="h-4 w-4" />
              Protected
            </p>
            <p className="mt-1 text-xs text-white/85">JWT-secured access</p>
          </article>
          <article className="rounded-xl border border-white/20 bg-white/10 p-3 text-sm">
            <p className="inline-flex items-center gap-1.5 font-semibold">
              <CompassIcon className="h-4 w-4" />
              Smart routing
            </p>
            <p className="mt-1 text-xs text-white/85">Role aware navigation</p>
          </article>
          <article className="rounded-xl border border-white/20 bg-white/10 p-3 text-sm">
            <p className="inline-flex items-center gap-1.5 font-semibold">
              <SparkleIcon className="h-4 w-4" />
              Fast UI
            </p>
            <p className="mt-1 text-xs text-white/85">Optimized page loading</p>
          </article>
        </div>
      </section>

      <section className="app-card p-6 md:p-7">
        <h2 className="font-['Sora'] text-2xl font-bold">Sign In</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Farmer, buyer, and admin account access.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-semibold">
              <MailIcon className="h-4 w-4 text-[var(--accent)]" />
              Email
            </label>
            <input id="email" type="email" {...register('email')} className="input" />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-semibold">
              <LockIcon className="h-4 w-4 text-[var(--accent)]" />
              Password
            </label>
            <input id="password" type="password" {...register('password')} className="input" />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
            {loading ? 'Signing in...' : t('login')}
            {!loading && <ArrowRightIcon className="h-4 w-4" />}
          </button>
        </form>

        <p className="mt-4 text-sm text-[var(--text-muted)]">
          New to Krishihub?{' '}
          <Link to="/register" className="font-semibold text-[var(--accent)] transition hover:underline">
            {t('register')}
          </Link>
        </p>
      </section>
    </div>
  );
};

export default LoginPage;
