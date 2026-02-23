import { useTranslation } from 'react-i18next';
import { GlobeIcon } from './icons/AppIcons';

const LanguageToggle = () => {
  const { i18n } = useTranslation();

  const current = i18n.language?.startsWith('ne') ? 'ne' : 'en';

  const toggleLanguage = () => {
    const next = current === 'en' ? 'ne' : 'en';
    i18n.changeLanguage(next);
    localStorage.setItem('krishihub_lang', next);
  };

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="btn-ghost"
      title={current === 'en' ? 'Switch to Nepali' : 'Switch to English'}
    >
      <GlobeIcon className="h-4 w-4" />
      {current === 'en' ? 'नेपाली' : 'English'}
    </button>
  );
};

export default LanguageToggle;
