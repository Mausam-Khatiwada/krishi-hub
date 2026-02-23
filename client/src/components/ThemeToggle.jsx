import { useAppDispatch, useAppSelector } from '../app/hooks';
import { toggleTheme } from '../features/ui/uiSlice';
import { MoonIcon, SunIcon } from './icons/AppIcons';

const ThemeToggle = () => {
  const dispatch = useAppDispatch();
  const { theme } = useAppSelector((state) => state.ui);
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => dispatch(toggleTheme())}
      className="btn-ghost"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
      {dark ? 'Light' : 'Dark'}
    </button>
  );
};

export default ThemeToggle;
