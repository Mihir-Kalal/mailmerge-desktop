import React from 'react';
import { useAppStore } from './store/appStore';
import SendWizardPage from './pages/SendWizardPage';
import TemplatesPage from './pages/TemplatesPage';
import ContactsPage from './pages/ContactsPage';
import SmtpPage from './pages/SmtpPage';
import CampaignsPage from './pages/CampaignsPage';

const NAV_ITEMS: { key: any; label: string; icon: string }[] = [
  { key: 'send', label: 'Send Campaign', icon: '✉️' },
  { key: 'templates', label: 'Templates', icon: '📝' },
  { key: 'contacts', label: 'Contacts', icon: '👥' },
  { key: 'smtp', label: 'SMTP Accounts', icon: '⚙️' },
  { key: 'campaigns', label: 'Campaigns', icon: '📊' }
];

export default function App() {
  const { page, setPage, theme, toggleTheme } = useAppStore();

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="sidebar-brand">📬 MailMerge</div>
        {NAV_ITEMS.map((item) => (
          <div
            key={item.key}
            className={`nav-item ${page === item.key ? 'active' : ''}`}
            onClick={() => setPage(item.key)}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div className="nav-item" onClick={toggleTheme}>
          <span>{theme === 'light' ? '🌙' : '☀️'}</span>
          <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
        </div>
      </div>
      <div className="main-content">
        {page === 'send' && <SendWizardPage />}
        {page === 'templates' && <TemplatesPage />}
        {page === 'contacts' && <ContactsPage />}
        {page === 'smtp' && <SmtpPage />}
        {page === 'campaigns' && <CampaignsPage />}
      </div>
    </div>
  );
}
