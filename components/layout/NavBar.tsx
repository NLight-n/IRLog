import React, { useState, forwardRef, Ref } from 'react';
import { useRouter } from 'next/router';
import { signOut } from 'next-auth/react';
import { FiUser, FiSun, FiMoon, FiSettings, FiLogOut, FiHome, FiBarChart2 } from 'react-icons/fi';
import { TbLayoutKanban } from 'react-icons/tb';
import UserProfileSidebar from '../modals/UserProfileSidebar';

const NavBar = forwardRef(function NavBar({ user, onToggleTheme, theme, appHeading = 'Interventional Radiology Register', appSubheading = '', appLogo = '' }: any, ref: Ref<HTMLElement>) {
  const router = useRouter();
  const username = user?.username || user?.name || 'User';
  const role = user?.role || '';
  const displayName = role === 'Doctor' ? `Dr. ${username}` : username;
  const handleLogout = () => signOut({ callbackUrl: '/login' });
  const handleSettings = () => router.push('/settings');
  const handleHome = () => {
    if (router.pathname === '/') {
      window.location.reload();
    } else {
      router.push('/');
    }
  };
  const handleAnalytics = () => router.push('/analytics');
  const handleWorklist = () => router.push('/worklist');
  const [showProfile, setShowProfile] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(true);

  // Reset logoLoaded when appLogo changes
  React.useEffect(() => {
    if (appLogo) {
      setLogoLoaded(true);
    }
  }, [appLogo]);

  return (
    <nav ref={ref} className="navbar fixed-navbar">
      <div className="container flex items-center justify-between py-4">
        {/* Main heading with optional logo, clickable */}
        <div
          className="flex items-center select-none"
          onClick={handleHome}
          style={{ cursor: 'pointer', minHeight: '3.5rem', gap: '0.75rem' }}
        >
          {/* Logo - only show if loaded successfully */}
          {appLogo && logoLoaded && (
            <img
              src={appLogo}
              alt=""
              onError={() => setLogoLoaded(false)}
              onLoad={() => setLogoLoaded(true)}
              style={{
                height: '48px',
                width: 'auto',
                maxWidth: '120px',
                objectFit: 'contain',
                borderRadius: '4px',
              }}
            />
          )}
          {/* Heading and subheading */}
          <div className="flex flex-col justify-center">
            <span
              className="navbar-brand text-2xl font-extrabold"
              style={{
                fontFamily: `'Segoe UI', 'Inter', 'Roboto', 'Helvetica Neue', Arial, sans-serif`,
                letterSpacing: '0.04em',
                color: 'var(--color-accent)',
                textShadow: 'none',
                background: 'none',
                WebkitBackgroundClip: 'unset',
                WebkitTextFillColor: 'unset',
                backgroundClip: 'unset',
                transition: 'color 0.3s',
              }}
            >
              {appHeading}
            </span>
            {appSubheading && (
              <span
                className="navbar-subheading text-sm font-normal mt-1"
                style={{
                  color: 'var(--color-accent)',
                  opacity: 0.8,
                  fontSize: '1rem',
                  fontWeight: 400,
                  letterSpacing: '0.01em',
                }}
              >
                {appSubheading}
              </span>
            )}
          </div>
        </div>
        {/* Right icons */}
        <div className="navbar-icons flex items-center gap-4">
          <span className="text-gray-700 text-sm mr-2">Welcome, <span className="font-medium text-black">{displayName}</span></span>
          <button title="Profile" className="navbar-icon-btn" onClick={() => setShowProfile(true)}>
            <FiUser />
          </button>
          <button onClick={handleHome} title="Home" className="navbar-icon-btn"><FiHome /></button>
          <button onClick={handleAnalytics} title="Analytics" className="navbar-icon-btn"><FiBarChart2 /></button>
          <button onClick={handleWorklist} title="Worklist" className="navbar-icon-btn"><TbLayoutKanban /></button>
          <button onClick={handleSettings} title="Settings" className="navbar-icon-btn"><FiSettings /></button>
          <button onClick={() => onToggleTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle Theme" className="navbar-icon-btn">
            {theme === 'dark' ? <FiSun /> : <FiMoon />}
          </button>
          <button onClick={handleLogout} title="Logout" className="navbar-icon-btn"><FiLogOut /></button>
        </div>
      </div>
      <UserProfileSidebar open={showProfile} onClose={() => setShowProfile(false)} />
    </nav>
  );
});

export default NavBar; 