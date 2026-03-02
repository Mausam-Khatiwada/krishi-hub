import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchMe, logoutUser, updateProfile } from '../features/auth/authSlice';
import { restoreTheme } from '../features/ui/uiSlice';
import usePageTitle from '../hooks/usePageTitle';
import { formatCurrency, formatDate } from '../utils/format';
import { CheckCircleIcon, LockIcon, ShieldCheckIcon, SparkleIcon } from '../components/icons/AppIcons';

const DEFAULT_ADDRESS = {
  label: '',
  fullName: '',
  phone: '',
  district: '',
  province: '',
  country: 'Nepal',
  addressLine: '',
  isDefault: false,
};

const NOTIFICATION_FIELDS = [
  { key: 'inApp', label: 'In-app notifications' },
  { key: 'email', label: 'Email notifications' },
  { key: 'orderUpdates', label: 'Order updates' },
  { key: 'chatMessages', label: 'Chat messages' },
  { key: 'marketing', label: 'Marketing updates' },
];

const normalizeAddressList = (list = []) => {
  const cleaned = list
    .slice(0, 10)
    .map((address) => ({
      label: address.label || '',
      fullName: address.fullName || '',
      phone: address.phone || '',
      district: address.district || '',
      province: address.province || '',
      country: address.country || 'Nepal',
      addressLine: address.addressLine || '',
      isDefault: Boolean(address.isDefault),
    }))
    .filter((address) => address.addressLine || address.district || address.province);

  const defaultIndex = cleaned.findIndex((address) => address.isDefault);
  const safeDefaultIndex = defaultIndex >= 0 ? defaultIndex : cleaned.length ? 0 : -1;

  return cleaned.map((address, index) => ({
    ...address,
    isDefault: safeDefaultIndex >= 0 ? index === safeDefaultIndex : false,
  }));
};

const SettingsPage = () => {
  usePageTitle('Account Settings');

  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const [tab, setTab] = useState('overview');
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [overview, setOverview] = useState(null);

  const [profile, setProfile] = useState({
    name: '',
    avatar: '',
    phone: '',
    bio: '',
    district: '',
    province: '',
    country: 'Nepal',
    lat: '',
    lng: '',
  });

  const [preferences, setPreferences] = useState({
    language: 'en',
    theme: 'light',
    notifications: {
      inApp: true,
      email: false,
      orderUpdates: true,
      chatMessages: true,
      marketing: false,
    },
  });

  const [securityForm, setSecurityForm] = useState({
    loginAlerts: true,
  });
  const [twoFactorSetup, setTwoFactorSetup] = useState({
    qrCodeDataUrl: '',
    secret: '',
    token: '',
    disableToken: '',
    preparing: false,
    enabling: false,
    disabling: false,
  });

  const [addresses, setAddresses] = useState([]);
  const [addressDraft, setAddressDraft] = useState(DEFAULT_ADDRESS);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [emailForm, setEmailForm] = useState({
    newEmail: '',
    password: '',
  });

  const [deactivatePassword, setDeactivatePassword] = useState('');
  const [roleProfileForm, setRoleProfileForm] = useState({});

  const tabs = useMemo(
    () => [
      { key: 'overview', label: 'Overview' },
      { key: 'profile', label: 'Profile' },
      { key: 'preferences', label: 'Preferences' },
      { key: 'addresses', label: 'Addresses' },
      { key: 'role', label: 'Role Settings' },
      { key: 'security', label: 'Security' },
    ],
    [],
  );

  const loadOverview = async () => {
    if (!user?._id) return;

    setLoadingOverview(true);
    try {
      const { data } = await api.get('/auth/account-overview');
      setOverview(data.overview || null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load account overview');
    } finally {
      setLoadingOverview(false);
    }
  };

  const refreshUserAndOverview = async () => {
    await dispatch(fetchMe());
    await loadOverview();
  };

  useEffect(() => {
    if (!user) return;

    setProfile({
      name: user.name || '',
      avatar: user.avatar || '',
      phone: user.phone || '',
      bio: user.bio || '',
      district: user.location?.district || '',
      province: user.location?.province || '',
      country: user.location?.country || 'Nepal',
      lat: user.location?.lat || '',
      lng: user.location?.lng || '',
    });

    setPreferences({
      language: user.preferences?.language || 'en',
      theme: user.preferences?.theme || 'light',
      notifications: {
        inApp: user.preferences?.notifications?.inApp ?? true,
        email: user.preferences?.notifications?.email ?? false,
        orderUpdates: user.preferences?.notifications?.orderUpdates ?? true,
        chatMessages: user.preferences?.notifications?.chatMessages ?? true,
        marketing: user.preferences?.notifications?.marketing ?? false,
      },
    });

    setSecurityForm({
      loginAlerts: user.security?.loginAlerts ?? true,
    });

    setAddresses(normalizeAddressList(user.addresses || []));
    setEmailForm((previous) => ({ ...previous, newEmail: user.email || '' }));

    if (user.role === 'farmer') {
      setRoleProfileForm({
        farmName: user.farmerProfile?.farmName || '',
        farmType: user.farmerProfile?.farmType || '',
        farmSizeAcres: user.farmerProfile?.farmSizeAcres || '',
        primaryCrops: (user.farmerProfile?.primaryCrops || []).join(', '),
        certifications: (user.farmerProfile?.certifications || []).join(', '),
        experienceYears: user.farmerProfile?.experienceYears || '',
        pickupInstructions: user.farmerProfile?.pickupInstructions || '',
        website: user.farmerProfile?.website || '',
      });
    } else if (user.role === 'buyer') {
      setRoleProfileForm({
        preferredPaymentMethod: user.buyerProfile?.preferredPaymentMethod || 'stripe',
        deliveryInstructions: user.buyerProfile?.deliveryInstructions || '',
        weeklyBudget: user.buyerProfile?.weeklyBudget || '',
      });
    } else {
      setRoleProfileForm({
        dashboardDensity: user.adminProfile?.dashboardDensity || 'comfortable',
        criticalAlertsOnly: Boolean(user.adminProfile?.criticalAlertsOnly),
        reportDigestEmail: user.adminProfile?.reportDigestEmail || '',
      });
    }
  }, [user]);

  useEffect(() => {
    loadOverview();
  }, [user?._id]);

  const onSaveProfile = async () => {
    const payload = {
      name: profile.name,
      avatar: profile.avatar,
      phone: profile.phone,
      bio: profile.bio,
      location: {
        district: profile.district,
        province: profile.province,
        country: profile.country || 'Nepal',
        lat: profile.lat ? Number(profile.lat) : undefined,
        lng: profile.lng ? Number(profile.lng) : undefined,
      },
    };

    const action = await dispatch(updateProfile(payload));
    if (updateProfile.fulfilled.match(action)) {
      toast.success('Profile updated');
      await loadOverview();
    } else {
      toast.error(action.payload || 'Failed to update profile');
    }
  };

  const onSavePreferences = async () => {
    try {
      await api.patch('/auth/preferences', { preferences });
      localStorage.setItem('krishihub_lang', preferences.language);
      localStorage.setItem('krishihub_theme', preferences.theme);
      i18n.changeLanguage(preferences.language);
      dispatch(restoreTheme());
      await refreshUserAndOverview();
      toast.success('Preferences updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update preferences');
    }
  };

  const onSaveSecuritySettings = async () => {
    try {
      await api.patch('/auth/security', {
        security: {
          loginAlerts: securityForm.loginAlerts,
        },
      });
      await refreshUserAndOverview();
      toast.success('Security settings updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update security settings');
    }
  };

  const startTwoFactorSetup = async () => {
    try {
      setTwoFactorSetup((previous) => ({ ...previous, preparing: true }));
      const { data } = await api.post('/auth/2fa/setup');

      setTwoFactorSetup((previous) => ({
        ...previous,
        qrCodeDataUrl: data.setup?.qrCodeDataUrl || '',
        secret: data.setup?.secret || '',
        token: '',
      }));
      toast.success('Authenticator setup generated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to start 2FA setup');
    } finally {
      setTwoFactorSetup((previous) => ({ ...previous, preparing: false }));
    }
  };

  const onEnableTwoFactor = async () => {
    const token = twoFactorSetup.token.trim();
    if (!token || token.length !== 6) {
      toast.error('Enter a valid 6-digit code');
      return;
    }

    try {
      setTwoFactorSetup((previous) => ({ ...previous, enabling: true }));
      await api.post('/auth/2fa/enable', { token });
      await refreshUserAndOverview();
      setTwoFactorSetup({
        qrCodeDataUrl: '',
        secret: '',
        token: '',
        disableToken: '',
        preparing: false,
        enabling: false,
        disabling: false,
      });
      toast.success('Two-factor authentication enabled');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to enable 2FA');
    } finally {
      setTwoFactorSetup((previous) => ({ ...previous, enabling: false }));
    }
  };

  const onDisableTwoFactor = async () => {
    const token = twoFactorSetup.disableToken.trim();
    if (!token || token.length !== 6) {
      toast.error('Enter a valid 6-digit code');
      return;
    }

    try {
      setTwoFactorSetup((previous) => ({ ...previous, disabling: true }));
      await api.post('/auth/2fa/disable', { token });
      await refreshUserAndOverview();
      setTwoFactorSetup((previous) => ({
        ...previous,
        qrCodeDataUrl: '',
        secret: '',
        token: '',
        disableToken: '',
      }));
      toast.success('Two-factor authentication disabled');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to disable 2FA');
    } finally {
      setTwoFactorSetup((previous) => ({ ...previous, disabling: false }));
    }
  };

  const addAddress = () => {
    if (!addressDraft.addressLine.trim()) {
      toast.error('Address line is required');
      return;
    }

    const baseList = addressDraft.isDefault
      ? addresses.map((address) => ({ ...address, isDefault: false }))
      : addresses;
    const nextAddresses = normalizeAddressList([...baseList, addressDraft]);
    setAddresses(nextAddresses);
    setAddressDraft(DEFAULT_ADDRESS);
  };

  const setDefaultAddress = (index) => {
    setAddresses((current) =>
      normalizeAddressList(
        current.map((address, addressIndex) => ({
          ...address,
          isDefault: addressIndex === index,
        })),
      ),
    );
  };

  const removeAddress = (index) => {
    setAddresses((current) => normalizeAddressList(current.filter((_item, i) => i !== index)));
  };

  const onSaveAddresses = async () => {
    try {
      await api.patch('/auth/addresses', { addresses: normalizeAddressList(addresses) });
      await refreshUserAndOverview();
      toast.success('Addresses updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save addresses');
    }
  };

  const onSaveRoleProfile = async () => {
    try {
      let payload = { ...roleProfileForm };

      if (user.role === 'farmer') {
        payload = {
          ...payload,
          farmSizeAcres: payload.farmSizeAcres ? Number(payload.farmSizeAcres) : undefined,
          experienceYears: payload.experienceYears ? Number(payload.experienceYears) : undefined,
          primaryCrops: payload.primaryCrops,
          certifications: payload.certifications,
        };
      }

      if (user.role === 'buyer') {
        payload = {
          ...payload,
          weeklyBudget: payload.weeklyBudget ? Number(payload.weeklyBudget) : undefined,
        };
      }

      await api.patch('/auth/role-profile', payload);
      await refreshUserAndOverview();
      toast.success('Role settings updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update role settings');
    }
  };

  const onChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New password and confirm password must match');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast.error('Use at least 8 characters for stronger password security');
      return;
    }

    try {
      const { data } = await api.patch('/auth/change-password', passwordForm);
      if (data.token) {
        localStorage.setItem('krishihub_token', data.token);
      }
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      await refreshUserAndOverview();
      toast.success('Password updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update password');
    }
  };

  const onChangeEmail = async () => {
    try {
      await api.patch('/auth/change-email', emailForm);
      setEmailForm((previous) => ({ ...previous, password: '' }));
      await refreshUserAndOverview();
      toast.success('Email updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update email');
    }
  };

  const onDeactivateAccount = async () => {
    if (!deactivatePassword) {
      toast.error('Password is required');
      return;
    }

    try {
      await api.delete('/auth/deactivate', { data: { password: deactivatePassword } });
      localStorage.removeItem('krishihub_token');
      await dispatch(logoutUser());
      toast.success('Account deactivated');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to deactivate account');
    }
  };

  if (!user) {
    return <div className="app-card p-5 text-sm text-[var(--text-muted)]">Loading account settings...</div>;
  }

  const statusBadges = [
    user.isActive ? 'Active account' : 'Deactivated account',
    user.blocked ? 'Blocked' : 'Not blocked',
    user.role === 'farmer' ? (user.isFarmerVerified ? 'Verified farmer' : 'Farmer pending verification') : null,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <section className="hero-panel bg-gradient-to-r from-[#13291b] via-[#1f4e34] to-[#40713d] p-6 text-white">
        <h1 className="text-3xl font-bold">Account Settings Center</h1>
        <p className="mt-2 text-sm text-white/90">
          Manage profile, security, notifications, addresses, and role-specific controls.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {statusBadges.map((badgeText) => (
            <span
              key={badgeText}
              className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold"
            >
              {badgeText}
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`tab-button ${tab === item.key ? 'active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {tab === 'overview' && (
        <section className="stagger-fade space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className="metric-card p-4">
              <p className="text-xs text-[var(--text-muted)]">Role</p>
              <p className="text-2xl font-bold uppercase">{user.role}</p>
            </article>
            <article className="metric-card p-4">
              <p className="text-xs text-[var(--text-muted)]">Wallet Balance</p>
              <p className="text-2xl font-bold">{formatCurrency(user.walletBalance || 0)}</p>
            </article>
            <article className="metric-card p-4">
              <p className="text-xs text-[var(--text-muted)]">Unread Notifications</p>
              <p className="text-2xl font-bold">{overview?.unreadNotifications ?? 0}</p>
            </article>
            <article className="metric-card p-4">
              <p className="text-xs text-[var(--text-muted)]">Saved Addresses</p>
              <p className="text-2xl font-bold">{overview?.addressesCount ?? addresses.length}</p>
            </article>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <article className="app-card space-y-2 p-5">
              <h2 className="panel-title">Account Activity</h2>
              <p className="text-sm text-[var(--text-muted)]">Joined: {formatDate(user.createdAt)}</p>
              <p className="text-sm text-[var(--text-muted)]">Last profile update: {formatDate(user.updatedAt)}</p>
              <p className="text-sm text-[var(--text-muted)]">Last login: {formatDate(user.lastLoginAt)}</p>
              <p className="text-sm text-[var(--text-muted)]">
                Password changed: {formatDate(user.accountActivity?.lastPasswordChangedAt)}
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                Email changed: {formatDate(user.accountActivity?.lastEmailChangedAt)}
              </p>
              <p className="text-sm text-[var(--text-muted)]">Account age: {overview?.accountAgeDays ?? 0} days</p>
            </article>

            <article className="app-card space-y-2 p-5">
              <h2 className="panel-title">Role Insights</h2>
              {loadingOverview && <p className="text-sm text-[var(--text-muted)]">Refreshing insights...</p>}
              {!loadingOverview && !overview?.roleStats && (
                <p className="text-sm text-[var(--text-muted)]">No role insights available yet.</p>
              )}
              {!loadingOverview &&
                overview?.roleStats &&
                Object.entries(overview.roleStats).map(([key, value]) => (
                  <p key={key} className="text-sm text-[var(--text-muted)]">
                    <span className="font-semibold text-[var(--text)]">{key}</span>: {String(value)}
                  </p>
                ))}
            </article>
          </div>
        </section>
      )}

      {tab === 'profile' && (
        <section className="app-card space-y-3 p-5">
          <h2 className="panel-title">Profile Information</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input className="input" placeholder="Full name" value={profile.name} onChange={(event) => setProfile((previous) => ({ ...previous, name: event.target.value }))} />
            <input className="input" placeholder="Phone" value={profile.phone} onChange={(event) => setProfile((previous) => ({ ...previous, phone: event.target.value }))} />
            <input className="input md:col-span-2" placeholder="Avatar URL" value={profile.avatar} onChange={(event) => setProfile((previous) => ({ ...previous, avatar: event.target.value }))} />
            <textarea className="textarea md:col-span-2" rows="3" placeholder="Bio" value={profile.bio} onChange={(event) => setProfile((previous) => ({ ...previous, bio: event.target.value }))} />
            <input className="input" placeholder="District" value={profile.district} onChange={(event) => setProfile((previous) => ({ ...previous, district: event.target.value }))} />
            <input className="input" placeholder="Province" value={profile.province} onChange={(event) => setProfile((previous) => ({ ...previous, province: event.target.value }))} />
            <input className="input" placeholder="Country" value={profile.country} onChange={(event) => setProfile((previous) => ({ ...previous, country: event.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Latitude" value={profile.lat} onChange={(event) => setProfile((previous) => ({ ...previous, lat: event.target.value }))} />
              <input className="input" placeholder="Longitude" value={profile.lng} onChange={(event) => setProfile((previous) => ({ ...previous, lng: event.target.value }))} />
            </div>
          </div>
          <button type="button" className="btn-primary" onClick={onSaveProfile}>
            Save profile
          </button>
        </section>
      )}

      {tab === 'preferences' && (
        <section className="app-card space-y-4 p-5">
          <h2 className="panel-title">Preferences</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select className="select" value={preferences.language} onChange={(event) => setPreferences((previous) => ({ ...previous, language: event.target.value }))}>
              <option value="en">English</option>
              <option value="ne">Nepali</option>
            </select>
            <select className="select" value={preferences.theme} onChange={(event) => setPreferences((previous) => ({ ...previous, theme: event.target.value }))}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {NOTIFICATION_FIELDS.map((item) => (
              <label key={item.key} className="rounded-xl border border-[var(--line)] p-3 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(preferences.notifications[item.key])}
                  onChange={(event) =>
                    setPreferences((previous) => ({
                      ...previous,
                      notifications: {
                        ...previous.notifications,
                        [item.key]: event.target.checked,
                      },
                    }))
                  }
                  className="mr-2"
                />
                {item.label}
              </label>
            ))}
          </div>
          <button type="button" className="btn-primary" onClick={onSavePreferences}>
            Save preferences
          </button>
        </section>
      )}

      {tab === 'addresses' && (
        <section className="app-card space-y-3 p-5">
          <h2 className="panel-title">Address Book</h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <input className="input" placeholder="Label (Home or Office)" value={addressDraft.label} onChange={(event) => setAddressDraft((previous) => ({ ...previous, label: event.target.value }))} />
            <input className="input" placeholder="Full name" value={addressDraft.fullName} onChange={(event) => setAddressDraft((previous) => ({ ...previous, fullName: event.target.value }))} />
            <input className="input" placeholder="Phone" value={addressDraft.phone} onChange={(event) => setAddressDraft((previous) => ({ ...previous, phone: event.target.value }))} />
            <input className="input" placeholder="District" value={addressDraft.district} onChange={(event) => setAddressDraft((previous) => ({ ...previous, district: event.target.value }))} />
            <input className="input" placeholder="Province" value={addressDraft.province} onChange={(event) => setAddressDraft((previous) => ({ ...previous, province: event.target.value }))} />
            <input className="input" placeholder="Country" value={addressDraft.country} onChange={(event) => setAddressDraft((previous) => ({ ...previous, country: event.target.value }))} />
            <input className="input md:col-span-2" placeholder="Address line" value={addressDraft.addressLine} onChange={(event) => setAddressDraft((previous) => ({ ...previous, addressLine: event.target.value }))} />
            <label className="rounded-xl border border-[var(--line)] p-3 text-sm md:col-span-2">
              <input type="checkbox" checked={addressDraft.isDefault} onChange={(event) => setAddressDraft((previous) => ({ ...previous, isDefault: event.target.checked }))} className="mr-2" />
              Mark as default address
            </label>
          </div>
          <button type="button" className="btn-secondary" onClick={addAddress}>
            Add address
          </button>

          <div className="space-y-2">
            {addresses.map((address, index) => (
              <article key={`${address.label}-${index}`} className="rounded-xl border border-[var(--line)] p-3 text-sm">
                <p className="font-semibold">{address.label || 'Address'} {address.isDefault && <span className="badge">Default</span>}</p>
                <p className="text-[var(--text-muted)]">{address.fullName} | {address.phone}</p>
                <p className="text-[var(--text-muted)]">{address.addressLine}</p>
                <p className="text-[var(--text-muted)]">{address.district}, {address.province}, {address.country}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setDefaultAddress(index)}>Set default</button>
                  <button type="button" className="btn-danger" onClick={() => removeAddress(index)}>Remove</button>
                </div>
              </article>
            ))}
            {!addresses.length && <p className="text-sm text-[var(--text-muted)]">No addresses saved yet.</p>}
          </div>

          <button type="button" className="btn-primary" onClick={onSaveAddresses}>
            Save addresses
          </button>
        </section>
      )}

      {tab === 'role' && (
        <section className="app-card space-y-3 p-5">
          <h2 className="panel-title">Role Specific Settings ({user.role})</h2>
          {user.role === 'farmer' && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input className="input" placeholder="Farm name" value={roleProfileForm.farmName || ''} onChange={(event) => setRoleProfileForm((previous) => ({ ...previous, farmName: event.target.value }))} />
              <input className="input" placeholder="Farm type" value={roleProfileForm.farmType || ''} onChange={(event) => setRoleProfileForm((previous) => ({ ...previous, farmType: event.target.value }))} />
              <input className="input" placeholder="Farm size (acres)" value={roleProfileForm.farmSizeAcres || ''} onChange={(event) => setRoleProfileForm((previous) => ({ ...previous, farmSizeAcres: event.target.value }))} />
              <input className="input" placeholder="Experience (years)" value={roleProfileForm.experienceYears || ''} onChange={(event) => setRoleProfileForm((previous) => ({ ...previous, experienceYears: event.target.value }))} />
              <input className="input md:col-span-2" placeholder="Primary crops (comma separated)" value={roleProfileForm.primaryCrops || ''} onChange={(event) => setRoleProfileForm((previous) => ({ ...previous, primaryCrops: event.target.value }))} />
              <input className="input md:col-span-2" placeholder="Certifications (comma separated)" value={roleProfileForm.certifications || ''} onChange={(event) => setRoleProfileForm((previous) => ({ ...previous, certifications: event.target.value }))} />
              <input className="input md:col-span-2" placeholder="Website URL" value={roleProfileForm.website || ''} onChange={(event) => setRoleProfileForm((previous) => ({ ...previous, website: event.target.value }))} />
              <textarea className="textarea md:col-span-2" rows="3" placeholder="Pickup instructions" value={roleProfileForm.pickupInstructions || ''} onChange={(event) => setRoleProfileForm((previous) => ({ ...previous, pickupInstructions: event.target.value }))} />
            </div>
          )}

          {user.role === 'buyer' && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <select className="select" value={roleProfileForm.preferredPaymentMethod || 'stripe'} onChange={(event) => setRoleProfileForm((previous) => ({ ...previous, preferredPaymentMethod: event.target.value }))}>
                <option value="stripe">Stripe</option>
                <option value="cod">Cash on Delivery</option>
                <option value="wallet">Wallet</option>
                <option value="esewa">eSewa</option>
                <option value="khalti">Khalti</option>
              </select>
              <input className="input" placeholder="Weekly budget (NPR)" value={roleProfileForm.weeklyBudget || ''} onChange={(event) => setRoleProfileForm((previous) => ({ ...previous, weeklyBudget: event.target.value }))} />
              <textarea className="textarea md:col-span-2" rows="3" placeholder="Delivery instructions" value={roleProfileForm.deliveryInstructions || ''} onChange={(event) => setRoleProfileForm((previous) => ({ ...previous, deliveryInstructions: event.target.value }))} />
            </div>
          )}

          {user.role === 'admin' && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <select className="select" value={roleProfileForm.dashboardDensity || 'comfortable'} onChange={(event) => setRoleProfileForm((previous) => ({ ...previous, dashboardDensity: event.target.value }))}>
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
              <input className="input" placeholder="Digest report email" value={roleProfileForm.reportDigestEmail || ''} onChange={(event) => setRoleProfileForm((previous) => ({ ...previous, reportDigestEmail: event.target.value }))} />
              <label className="rounded-xl border border-[var(--line)] p-3 text-sm md:col-span-2">
                <input type="checkbox" checked={Boolean(roleProfileForm.criticalAlertsOnly)} onChange={(event) => setRoleProfileForm((previous) => ({ ...previous, criticalAlertsOnly: event.target.checked }))} className="mr-2" />
                Receive only critical alerts in admin workspace
              </label>
            </div>
          )}

          <button type="button" className="btn-primary" onClick={onSaveRoleProfile}>
            Save role settings
          </button>
        </section>
      )}

      {tab === 'security' && (
        <section className="space-y-4">
          <div className="app-card space-y-4 p-5">
            <h2 className="panel-title inline-flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5 text-[var(--accent)]" />
              Security Controls
            </h2>
            <label className="rounded-xl border border-[var(--line)] p-3 text-sm">
              <input type="checkbox" checked={Boolean(securityForm.loginAlerts)} onChange={(event) => setSecurityForm((previous) => ({ ...previous, loginAlerts: event.target.checked }))} className="mr-2" />
              Login alerts
            </label>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/70 p-3 text-sm">
              <p className="inline-flex items-center gap-1.5 font-semibold">
                <LockIcon className="h-4 w-4 text-[var(--accent)]" />
                Two-factor authentication
              </p>
              <p className="mt-1 text-[var(--text-muted)]">
                Status: {user.security?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </p>
              {user.security?.twoFactorEnabled ? (
                <span className="badge-verified mt-2 inline-flex">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  Authenticator protected
                </span>
              ) : (
                <span className="badge mt-2 inline-flex">Not configured</span>
              )}
            </div>
            <button type="button" className="btn-primary" onClick={onSaveSecuritySettings}>
              Save alert settings
            </button>
          </div>

          {!user.security?.twoFactorEnabled && (
            <div className="app-card space-y-3 p-5">
              <h2 className="panel-title inline-flex items-center gap-2">
                <SparkleIcon className="h-5 w-5 text-[var(--accent)]" />
                Enable Two-Factor Authentication
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                Generate a QR code, scan it with Google Authenticator/Authy, then verify using a 6-digit code.
              </p>
              <button
                type="button"
                className="btn-secondary"
                onClick={startTwoFactorSetup}
                disabled={twoFactorSetup.preparing}
              >
                {twoFactorSetup.preparing ? 'Generating...' : 'Generate setup QR'}
              </button>

              {twoFactorSetup.qrCodeDataUrl && (
                <div className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-3 md:grid-cols-[160px_1fr] md:items-center">
                  <img
                    src={twoFactorSetup.qrCodeDataUrl}
                    alt="Two-factor QR code"
                    className="mx-auto h-36 w-36 rounded-lg border border-[var(--line)] bg-white p-2"
                  />
                  <div className="space-y-2">
                    <p className="text-xs text-[var(--text-muted)]">
                      Manual setup key:
                      <span className="ml-1 rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text)]">
                        {twoFactorSetup.secret}
                      </span>
                    </p>
                    <input
                      className="input tracking-[0.28em]"
                      placeholder="123456"
                      maxLength={6}
                      value={twoFactorSetup.token}
                      onChange={(event) =>
                        setTwoFactorSetup((previous) => ({
                          ...previous,
                          token: event.target.value.replace(/\D/g, ''),
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={onEnableTwoFactor}
                      disabled={twoFactorSetup.enabling}
                    >
                      {twoFactorSetup.enabling ? 'Verifying...' : 'Enable 2FA'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {user.security?.twoFactorEnabled && (
            <div className="app-card space-y-3 p-5">
              <h2 className="panel-title text-[var(--danger)]">Disable Two-Factor Authentication</h2>
              <p className="text-sm text-[var(--text-muted)]">
                Enter a current authenticator code to disable 2FA for this account.
              </p>
              <input
                className="input max-w-xs tracking-[0.28em]"
                placeholder="123456"
                maxLength={6}
                value={twoFactorSetup.disableToken}
                onChange={(event) =>
                  setTwoFactorSetup((previous) => ({
                    ...previous,
                    disableToken: event.target.value.replace(/\D/g, ''),
                  }))
                }
              />
              <button
                type="button"
                className="btn-danger"
                onClick={onDisableTwoFactor}
                disabled={twoFactorSetup.disabling}
              >
                {twoFactorSetup.disabling ? 'Disabling...' : 'Disable 2FA'}
              </button>
            </div>
          )}

          <div className="app-card space-y-3 p-5">
            <h2 className="panel-title">Change Password</h2>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <input className="input" type="password" placeholder="Current password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((previous) => ({ ...previous, currentPassword: event.target.value }))} />
              <input className="input" type="password" placeholder="New password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((previous) => ({ ...previous, newPassword: event.target.value }))} />
              <input className="input" type="password" placeholder="Confirm new password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((previous) => ({ ...previous, confirmPassword: event.target.value }))} />
            </div>
            <button type="button" className="btn-primary" onClick={onChangePassword}>
              Update password
            </button>
          </div>

          <div className="app-card space-y-3 p-5">
            <h2 className="panel-title">Change Email</h2>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input className="input" type="email" placeholder="New email" value={emailForm.newEmail} onChange={(event) => setEmailForm((previous) => ({ ...previous, newEmail: event.target.value }))} />
              <input className="input" type="password" placeholder="Current password" value={emailForm.password} onChange={(event) => setEmailForm((previous) => ({ ...previous, password: event.target.value }))} />
            </div>
            <button type="button" className="btn-secondary" onClick={onChangeEmail}>
              Update email
            </button>
          </div>

          <div className="app-card space-y-3 p-5">
            <h2 className="panel-title text-[var(--danger)]">Danger Zone</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Deactivating your account disables login access until an admin reactivates it.
            </p>
            <input className="input max-w-sm" type="password" placeholder="Password to confirm" value={deactivatePassword} onChange={(event) => setDeactivatePassword(event.target.value)} />
            <button type="button" className="btn-danger" onClick={onDeactivateAccount}>
              Deactivate account
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default SettingsPage;
