import React, { useState, forwardRef, Ref } from 'react';
import { useRouter } from 'next/router';
import { signOut } from 'next-auth/react';
import { FiUser, FiSun, FiMoon, FiSettings, FiLogOut, FiHome, FiBarChart2, FiCalendar } from 'react-icons/fi';
import UserProfileSidebar from '../modals/UserProfileSidebar';

const NavBar = forwardRef(function NavBar({ user, onToggleTheme, theme, appHeading = 'Interventional Radiology Register', appSubheading = '', appLogo = '' }: any, ref: Ref<HTMLElement>) {
  const router = useRouter();
  const username = user?.username || user?.name || 'User';
  const role = user?.role || '';
  const displayName = role === 'Doctor' ? `Dr. ${username}` : username;
  const handleLogout = () => signOut({ callbackUrl: `${router.basePath || ''}/login` });
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

  const currentPath = router.pathname;

  return (
    <>
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
                  height: '44px',
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
                className="navbar-brand text-xl md:text-2xl font-extrabold"
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
                  className="navbar-subheading text-xs md:text-sm font-normal mt-0.5"
                  style={{
                    color: 'var(--color-accent)',
                    opacity: 0.8,
                    fontSize: '0.9rem',
                    fontWeight: 400,
                    letterSpacing: '0.01em',
                  }}
                >
                  {appSubheading}
                </span>
              )}
            </div>
          </div>

          {/* Desktop Right Icons */}
          <div className="navbar-icons desktop-nav-icons flex items-center gap-4">
            <span className="text-gray-700 text-sm mr-2">Welcome, <span className="font-medium text-black">{displayName}</span></span>
            <button title="Profile" className="navbar-icon-btn" onClick={() => setShowProfile(true)}>
              <FiUser />
            </button>
            <button onClick={handleHome} title="Home" className={`navbar-icon-btn ${currentPath === '/' ? 'active-nav' : ''}`}><FiHome /></button>
            <button onClick={handleAnalytics} title="Analytics" className={`navbar-icon-btn ${currentPath === '/analytics' ? 'active-nav' : ''}`}><FiBarChart2 /></button>
            <button onClick={handleWorklist} title="Appointments" className={`navbar-icon-btn ${currentPath === '/worklist' ? 'active-nav' : ''}`}><FiCalendar /></button>
            <button onClick={handleSettings} title="Settings" className={`navbar-icon-btn ${currentPath === '/settings' ? 'active-nav' : ''}`}><FiSettings /></button>
            <button onClick={() => onToggleTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle Theme" className="navbar-icon-btn">
              {theme === 'dark' ? <FiSun /> : <FiMoon />}
            </button>
            <button onClick={handleLogout} title="Logout" className="navbar-icon-btn"><FiLogOut /></button>
          </div>

          {/* Mobile Top Right Actions */}
          <div className="mobile-top-actions flex items-center gap-2">
            <button title="Profile" className="navbar-icon-btn" onClick={() => setShowProfile(true)}>
              <FiUser />
            </button>
            <button onClick={() => onToggleTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle Theme" className="navbar-icon-btn">
              {theme === 'dark' ? <FiSun /> : <FiMoon />}
            </button>
            <button onClick={handleLogout} title="Logout" className="navbar-icon-btn">
              <FiLogOut />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar */}
      <div className="mobile-bottom-bar">
        <div className="mobile-bottom-bar-inner">
          <button
            onClick={handleHome}
            className={`mobile-nav-btn ${currentPath === '/' ? 'active' : ''}`}
            title="Home"
          >
            <FiHome size={20} />
            <span>Home</span>
          </button>

          <button
            onClick={handleAnalytics}
            className={`mobile-nav-btn ${currentPath === '/analytics' ? 'active' : ''}`}
            title="Analytics"
          >
            <FiBarChart2 size={20} />
            <span>Analytics</span>
          </button>

          <button
            onClick={handleWorklist}
            className={`mobile-nav-btn ${currentPath === '/worklist' ? 'active' : ''}`}
            title="Appointments"
          >
            <FiCalendar size={20} />
            <span>Appts</span>
          </button>

          <button
            onClick={handleSettings}
            className={`mobile-nav-btn ${currentPath === '/settings' ? 'active' : ''}`}
            title="Settings"
          >
            <FiSettings size={20} />
            <span>Settings</span>
          </button>
        </div>
      </div>

      <UserProfileSidebar open={showProfile} onClose={() => setShowProfile(false)} />
    </>
  );
});

export default NavBar; 