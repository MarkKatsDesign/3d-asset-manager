import { writable } from 'svelte/store';

export const themes = {
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk Purple',
    font: 'Inter',
    colors: {
      // Backgrounds
      bgPrimary: 'from-slate-900 via-purple-900 to-slate-900',
      bgSecondary: 'bg-slate-900/50',
      bgCard: 'bg-white/5',
      bgCardHover: 'bg-white/10',

      // Glass effects
      glassBase: 'bg-white/5 backdrop-blur-xl border border-white/10',
      glassHover: 'hover:bg-white/10 hover:border-white/20',

      // Text
      textPrimary: 'text-white',
      textSecondary: 'text-white/70',
      textMuted: 'text-white/40',

      // Accent colors
      accentPrimary: 'bg-indigo-600',
      accentHover: 'hover:bg-indigo-500',
      accentText: 'text-indigo-400',

      // Buttons
      buttonPrimary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
      buttonSecondary: 'bg-white/10 hover:bg-white/20 text-white',

      // Borders
      borderPrimary: 'border-white/10',
      borderHover: 'border-white/20',
    }
  },

  macosLight: {
    id: 'macosLight',
    name: 'macOS Light',
    font: 'Manrope',
    colors: {
      // Backgrounds
      bgPrimary: 'from-gray-50 via-gray-100 to-gray-50',
      bgSecondary: 'bg-white',
      bgCard: 'bg-white',
      bgCardHover: 'bg-gray-50',

      // Glass effects (subtle for light theme)
      glassBase: 'bg-white/80 backdrop-blur-xl border border-gray-200 shadow-sm',
      glassHover: 'hover:bg-white hover:border-gray-300 hover:shadow-md',

      // Text
      textPrimary: 'text-gray-900',
      textSecondary: 'text-gray-600',
      textMuted: 'text-gray-400',

      // Accent colors
      accentPrimary: 'bg-blue-500',
      accentHover: 'hover:bg-blue-600',
      accentText: 'text-blue-500',

      // Buttons
      buttonPrimary: 'bg-blue-500 hover:bg-blue-600 text-white',
      buttonSecondary: 'bg-gray-100 hover:bg-gray-200 text-gray-900',

      // Borders
      borderPrimary: 'border-gray-200',
      borderHover: 'border-gray-300',
    }
  },

  macosDark: {
    id: 'macosDark',
    name: 'macOS Dark',
    font: 'Space Grotesk',
    colors: {
      // Backgrounds
      bgPrimary: 'from-zinc-950 via-zinc-900 to-zinc-950',
      bgSecondary: 'bg-zinc-900',
      bgCard: 'bg-zinc-800/50',
      bgCardHover: 'bg-zinc-800',

      // Glass effects
      glassBase: 'bg-zinc-800/50 backdrop-blur-xl border border-zinc-700/50',
      glassHover: 'hover:bg-zinc-800/70 hover:border-zinc-600',

      // Text
      textPrimary: 'text-zinc-100',
      textSecondary: 'text-zinc-400',
      textMuted: 'text-zinc-600',

      // Accent colors
      accentPrimary: 'bg-blue-600',
      accentHover: 'hover:bg-blue-500',
      accentText: 'text-blue-400',

      // Buttons
      buttonPrimary: 'bg-blue-600 hover:bg-blue-500 text-white',
      buttonSecondary: 'bg-zinc-700 hover:bg-zinc-600 text-zinc-100',

      // Borders
      borderPrimary: 'border-zinc-700',
      borderHover: 'border-zinc-600',
    }
  }
};

function createThemeStore() {
  // Load saved theme from localStorage or default to cyberpunk
  const savedTheme = typeof window !== 'undefined'
    ? localStorage.getItem('theme') || 'cyberpunk'
    : 'cyberpunk';

  const { subscribe, set } = writable(savedTheme);

  return {
    subscribe,
    setTheme: (themeId) => {
      set(themeId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', themeId);
      }
    },
    getCurrentTheme: (themeId) => themes[themeId] || themes.cyberpunk
  };
}

export const themeStore = createThemeStore();
