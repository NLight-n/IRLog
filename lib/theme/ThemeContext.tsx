import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';

interface ThemeContextType {
  theme: string;
  setTheme: (theme: string) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {},
  accentColor: '#3b82f6',
  setAccentColor: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState('light');
  const [accentColor, setAccentColorState] = useState('#3b82f6');
  const didInit = useRef(false);

  // Utility to darken a hex color by a percent (0.2 = 20%)
  function darkenColor(hex: string, percent: number) {
    hex = hex.replace(/^#/, '');
    const r = Math.floor(parseInt(hex.substring(0,2), 16) * (1 - percent));
    const g = Math.floor(parseInt(hex.substring(2,4), 16) * (1 - percent));
    const b = Math.floor(parseInt(hex.substring(4,6), 16) * (1 - percent));
    return `#${[r,g,b].map(x => x.toString(16).padStart(2,'0')).join('')}`;
  }
  // Utility to get best contrast color (white or black) for a given hex color
  function getContrastColor(hex: string) {
    hex = hex.replace(/^#/, '');
    const r = parseInt(hex.substring(0,2), 16);
    const g = parseInt(hex.substring(2,4), 16);
    const b = parseInt(hex.substring(4,6), 16);
    // Perceived brightness formula
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 150 ? '#000' : '#fff';
  }

  // Only fetch from backend/localStorage on first mount
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const storedTheme = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    const storedAccent = typeof window !== 'undefined' ? localStorage.getItem('accentColor') : null;
    if (storedTheme === 'dark' || storedTheme === 'light') {
      setThemeState(storedTheme);
    }
    if (storedAccent) {
      setAccentColorState(storedAccent);
    }
    // Fetch from /api/users/profile for user-specific settings
    fetch('/api/users/profile')
      .then(res => res.json())
      .then(data => {
        if (data.theme && (data.theme === 'dark' || data.theme === 'light')) {
          setThemeState(data.theme);
        }
        if (data.accentColor) {
          setAccentColorState(data.accentColor);
        }
      });
  }, []);

  // Sync theme to <html> class and localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  // Sync accent color to CSS variable, contrast, hover, and localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.style.setProperty('--color-accent', accentColor);
      localStorage.setItem('accentColor', accentColor);
      // Set hover and contrast colors globally
      const hoverColor = darkenColor(accentColor, 0.2);
      const contrastColor = getContrastColor(accentColor);
      document.body.style.setProperty('--color-accent-hover', hoverColor);
      document.documentElement.style.setProperty('--color-accent-hover', hoverColor);
      document.body.style.setProperty('--color-accent-contrast', contrastColor);
      document.documentElement.style.setProperty('--color-accent-contrast', contrastColor);
    }
  }, [accentColor]);

  // Update state, localStorage, CSS, and PATCH to /api/users/profile
  const setTheme = (t: string) => {
    setThemeState(t);
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', t === 'dark');
      localStorage.setItem('theme', t);
    }
    fetch('/api/users/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: t }),
    });
  };

  const setAccentColor = (color: string) => {
    setAccentColorState(color);
    if (typeof window !== 'undefined') {
      document.documentElement.style.setProperty('--color-accent', color);
      localStorage.setItem('accentColor', color);
    }
    fetch('/api/users/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accentColor: color }),
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}; 