import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { clearAuthError, registerUser } from '../features/auth/authSlice';
import usePageTitle from '../hooks/usePageTitle';
import { ArrowRightIcon, LeafIcon, MailIcon, MapPinIcon, ShieldCheckIcon, UserIcon } from '../components/icons/AppIcons';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['farmer', 'buyer']),
  district: z.string().min(2, 'District is required'),
  province: z.string().min(2, 'Province is required'),
});

const RegisterPage = () => {
  usePageTitle('Register');

  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loading, user, error } = useAppSelector((state) => state.auth);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      role: 'buyer',
    },
  });

  const selectedRole = watch('role');

  const onSubmit = async (values) => {
    const payload = {
      name: values.name,
      email: values.email,
      password: values.password,
      role: values.role,
      location: {
        district: values.district,
        province: values.province,
        country: 'Nepal',
      },
    };

    const action = await dispatch(registerUser(payload));

    if (registerUser.fulfilled.match(action)) {
      toast.success('Account created');
      navigate('/');
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
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.2fr]">
      <section className="hero-panel bg-gradient-to-br from-[#0f3d25] via-[#1f7f45] to-[#79bc53] p-6 text-white md:p-8">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
          <LeafIcon className="h-4 w-4" />
          Join Krishihub
        </p>
        <h1 className="mt-4 font-['Sora'] text-3xl font-bold leading-tight md:text-4xl">{t('createAccount')}</h1>
        <p className="mt-3 max-w-xl text-sm text-white/90 md:text-base">
          Build your agricultural commerce profile in minutes. Switch between buyer and farmer workflows instantly after onboarding.
        </p>
        <div className="mt-6 space-y-2">
          <article className="rounded-xl border border-white/20 bg-white/12 p-3 text-sm">
            <p className="inline-flex items-center gap-1.5 font-semibold">
              <ShieldCheckIcon className="h-4 w-4" />
              Secure identity
            </p>
            <p className="mt-1 text-xs text-white/85">Role-based access and protected routes</p>
          </article>
          <article className="rounded-xl border border-white/20 bg-white/12 p-3 text-sm">
            <p className="inline-flex items-center gap-1.5 font-semibold">
              <MapPinIcon className="h-4 w-4" />
              Local marketplace
            </p>
            <p className="mt-1 text-xs text-white/85">Location-aware product discovery and operations</p>
          </article>
        </div>
      </section>

      <section className="app-card p-6 md:p-7">
        <h2 className="font-['Sora'] text-2xl font-bold">Create Your Profile</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Register as a farmer or buyer to get started.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="name" className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-semibold">
              <UserIcon className="h-4 w-4 text-[var(--accent)]" />
              Name
            </label>
            <input id="name" {...register('name')} className="input" />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="email" className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-semibold">
              <MailIcon className="h-4 w-4 text-[var(--accent)]" />
              Email
            </label>
            <input id="email" type="email" {...register('email')} className="input" />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="password" className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-semibold">
              <ShieldCheckIcon className="h-4 w-4 text-[var(--accent)]" />
              Password
            </label>
            <input id="password" type="password" {...register('password')} className="input" />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
          </div>

          <div>
            <label htmlFor="role" className="mb-1.5 block text-sm font-semibold">Role</label>
            <select id="role" {...register('role')} className="select">
              <option value="buyer">{t('buyer')}</option>
              <option value="farmer">{t('farmer')}</option>
            </select>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/70 p-3 text-xs text-[var(--text-muted)]">
            {selectedRole === 'farmer'
              ? 'Farmer account includes product management, inventory, and order operations.'
              : 'Buyer account includes wishlist, cart, checkout, and order tracking.'}
          </div>

          <div>
            <label htmlFor="district" className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-semibold">
              <MapPinIcon className="h-4 w-4 text-[var(--accent)]" />
              District
            </label>
            <input id="district" {...register('district')} className="input" />
            {errors.district && <p className="mt-1 text-xs text-red-600">{errors.district.message}</p>}
          </div>

          <div>
            <label htmlFor="province" className="mb-1.5 block text-sm font-semibold">Province</label>
            <input id="province" {...register('province')} className="input" />
            {errors.province && <p className="mt-1 text-xs text-red-600">{errors.province.message}</p>}
          </div>

          <button type="submit" disabled={loading} className="btn-primary md:col-span-2 w-full justify-center py-2.5">
            {loading ? 'Creating...' : t('register')}
            {!loading && <ArrowRightIcon className="h-4 w-4" />}
          </button>
        </form>

        <p className="mt-4 text-sm text-[var(--text-muted)]">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[var(--accent)] transition hover:underline">
            {t('login')}
          </Link>
        </p>
      </section>
    </div>
  );
};

export default RegisterPage;
