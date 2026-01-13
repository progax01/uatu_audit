import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 hover:bg-slate-100 dark:hover:bg-slate-800 group"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* Sun icon */}
      <Sun
        size={18}
        strokeWidth={2}
        className={`absolute transition-all duration-300 ${
          isDark
            ? 'opacity-0 rotate-90 scale-0'
            : 'opacity-100 rotate-0 scale-100 text-amber-500'
        }`}
      />
      {/* Moon icon */}
      <Moon
        size={18}
        strokeWidth={2}
        className={`absolute transition-all duration-300 ${
          isDark
            ? 'opacity-100 rotate-0 scale-100 text-indigo-400'
            : 'opacity-0 -rotate-90 scale-0'
        }`}
      />
    </button>
  );
}
