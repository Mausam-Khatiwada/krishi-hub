import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  clearAuthError,
  clearTwoFactorState,
  loginUser,
  loginWithGoogle,
} from '../features/auth/authSlice';
import usePageTitle from '../hooks/usePageTitle';
import {
  ArrowRightIcon,
  CompassIcon,
  GoogleIcon,
  LockIcon,
  MailIcon,
  ShieldCheckIcon,
  SparkleIcon,
} from '../components/icons/AppIcons';

const GOOGLE_SCRIPT_ID = 'krishihub-google-client-script';

const LoginPage = () => {
  usePageTitle('Login');

  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const googleButtonRef = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  const {
    loading,
    user,
    error,
    twoFactorRequired,
    twoFactorAuthToken,
    twoFactorProvider,
  } =
    useAppSelector((state) => state.auth);
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState('');
  const isChallengeStep = twoFactorRequired;

  const {
    register,
    handleSubmit,
    clearErrors,
    setError,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: '',
      password: '',
      twoFactorCode: '',
    },
  });

  const completeLogin = useCallback(() => {
    dispatch(clearTwoFactorState());
    setPendingGoogleCredential('');
    setValue('twoFactorCode', '');
    toast.success('Login successful');
    const redirectTo = location.state?.from || '/';
    navigate(redirectTo, { replace: true });
  }, [dispatch, location.state?.from, navigate, setValue]);

  const handleGoogleAuth = useCallback(
    async (credential, otpCode) => {
      if (!credential) {
        toast.error('Google credential missing. Try Google login again.');
        return;
      }

      const normalizedOtpCode = otpCode ? String(otpCode).replace(/\D/g, '') : '';

      const payload = {
        credential,
        ...(normalizedOtpCode
          ? {
              ...(normalizedOtpCode ? { twoFactorCode: normalizedOtpCode } : {}),
              twoFactorAuthToken,
            }
          : {}),
      };

      const action = await dispatch(loginWithGoogle(payload));
      if (!loginWithGoogle.fulfilled.match(action)) return;

      if (action.payload.requiresTwoFactor) {
        setPendingGoogleCredential(credential);
        toast('Enter your authenticator app code to continue');
        return;
      }

      completeLogin();
    },
    [completeLogin, dispatch, twoFactorAuthToken],
  );

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current || isChallengeStep) return;

    const initializeGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          if (response?.credential) {
            handleGoogleAuth(response.credential);
          }
        },
      });

      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 320,
      });
    };

    if (window.google?.accounts?.id) {
      initializeGoogleButton();
      return undefined;
    }

    let script = document.getElementById(GOOGLE_SCRIPT_ID);
    if (!script) {
      script = document.createElement('script');
      script.id = GOOGLE_SCRIPT_ID;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    script.addEventListener('load', initializeGoogleButton);

    return () => {
      script?.removeEventListener('load', initializeGoogleButton);
    };
  }, [googleClientId, handleGoogleAuth, isChallengeStep]);

  const onSubmit = async (values) => {
    clearErrors('twoFactorCode');

    if (isChallengeStep) {
      const code = values.twoFactorCode ? String(values.twoFactorCode).replace(/\D/g, '') : '';

      if (twoFactorRequired && (!code || code.length !== 6)) {
        setError('twoFactorCode', {
          type: 'manual',
          message: 'Enter the 6-digit authentication code',
        });
        return;
      }

      if (twoFactorProvider === 'google') {
        await handleGoogleAuth(pendingGoogleCredential, code);
        return;
      }

      const verifyAction = await dispatch(
        loginUser({
          email: values.email,
          password: values.password,
          ...(code ? { twoFactorCode: code } : {}),
          twoFactorAuthToken,
        }),
      );

      if (loginUser.fulfilled.match(verifyAction) && !verifyAction.payload.requiresTwoFactor) {
        completeLogin();
      }
      return;
    }

    const action = await dispatch(
      loginUser({
        email: values.email,
        password: values.password,
      }),
    );

    if (loginUser.fulfilled.match(action) && !action.payload.requiresTwoFactor) {
      completeLogin();
    } else if (loginUser.fulfilled.match(action) && action.payload.requiresTwoFactor) {
      toast('Enter your authenticator app code to continue');
    }
  };

  const cancelTwoFactor = () => {
    dispatch(clearTwoFactorState());
    setPendingGoogleCredential('');
    setValue('twoFactorCode', '');
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

  useEffect(
    () => () => {
      dispatch(clearTwoFactorState());
    },
    [dispatch],
  );

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
            <p className="mt-1 text-xs text-white/85">JWT-secured sessions</p>
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
              <LockIcon className="h-4 w-4" />
              Two-factor ready
            </p>
            <p className="mt-1 text-xs text-white/85">Authenticator app support</p>
          </article>
        </div>
      </section>

      <section className="app-card p-6 md:p-7">
        <h2 className="font-['Sora'] text-2xl font-bold">{isChallengeStep ? 'Security Verification' : 'Sign In'}</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {isChallengeStep
            ? 'Complete the verification step to finish sign in.'
            : 'Farmer, buyer, and admin account access.'}
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          {(twoFactorProvider !== 'google' || !isChallengeStep) && (
            <>
              <div>
                <label htmlFor="email" className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-semibold">
                  <MailIcon className="h-4 w-4 text-[var(--accent)]" />
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  {...register('email', {
                    required: isChallengeStep ? false : 'Email is required',
                  })}
                  className="input"
                />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-semibold">
                  <LockIcon className="h-4 w-4 text-[var(--accent)]" />
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  {...register('password', {
                    required: isChallengeStep ? false : 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  })}
                  className="input"
                />
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
              </div>
            </>
          )}

          {twoFactorRequired && (
            <div>
              <label htmlFor="twoFactorCode" className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-semibold">
                <ShieldCheckIcon className="h-4 w-4 text-[var(--accent)]" />
                Authentication code
              </label>
              <input
                id="twoFactorCode"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                {...register('twoFactorCode')}
                className="input tracking-[0.28em]"
              />
              {errors.twoFactorCode && (
                <p className="mt-1 text-xs text-red-600">{errors.twoFactorCode.message}</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center py-2.5">
              {loading
                ? 'Please wait...'
                : isChallengeStep
                  ? 'Verify and continue'
                  : t('login')}
              {!loading && <ArrowRightIcon className="h-4 w-4" />}
            </button>

            {isChallengeStep && (
              <button type="button" onClick={cancelTwoFactor} className="btn-secondary">
                Cancel
              </button>
            )}
          </div>
        </form>

        {!isChallengeStep && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="h-px flex-1 bg-[var(--line)]" />
              <span>or continue with</span>
              <span className="h-px flex-1 bg-[var(--line)]" />
            </div>

            {googleClientId ? (
              <>
                <div ref={googleButtonRef} className="flex justify-center" />
                <p className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <GoogleIcon className="h-3.5 w-3.5" />
                  Google sign-in enabled
                </p>
              </>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--line)] px-3 py-2 text-xs text-[var(--text-muted)]">
                Set <code>VITE_GOOGLE_CLIENT_ID</code> to enable Google login.
              </p>
            )}
          </div>
        )}

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
