import React, { useEffect, useState } from 'react';

const emptyForm = {
  label: '',
  host: '',
  port: 587,
  secure: false,
  username: '',
  password: '',
  senderName: '',
  replyTo: ''
};

export default function SmtpPage() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [aiKey, setAiKey] = useState('');
  const [hasAiKey, setHasAiKey] = useState(false);

  const refresh = async () => setConfigs(await window.mailmerge.smtp.list());

  useEffect(() => {
    refresh();
    window.mailmerge.ai.hasKey().then(setHasAiKey);
  }, []);

  const handleSave = async () => {
    if (!form.host || !form.username || !form.password) return;
    setSaving(true);
    try {
      await window.mailmerge.smtp.save(form);
      setForm({ ...emptyForm });
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (id: string) => {
    setTestResults((r) => ({ ...r, [id]: 'Testing...' }));
    const res = await window.mailmerge.smtp.test(id);
    setTestResults((r) => ({ ...r, [id]: res.ok ? '✅ ' + res.message : '❌ ' + res.message }));
  };

  const handleDelete = async (id: string) => {
    await window.mailmerge.smtp.delete(id);
    refresh();
  };

  const handleSaveAiKey = async () => {
    if (!aiKey.trim()) return;
    await window.mailmerge.ai.saveKey(aiKey.trim());
    setAiKey('');
    setHasAiKey(true);
  };

  return (
    <div>
      <div className="topbar">
        <div className="page-title">SMTP Accounts</div>
      </div>

      <div className="two-col" style={{ marginBottom: 24 }}>
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Connected accounts</div>
          {configs.length === 0 && <div className="muted">No SMTP accounts yet. Add one on the right — works with Gmail, Outlook, college webmail, or any standard SMTP server.</div>}
          <table>
            <thead>
              <tr><th>Label</th><th>Host</th><th>Username</th><th></th></tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.id}>
                  <td>{c.label}</td>
                  <td className="muted">{c.host}:{c.port}</td>
                  <td>{c.username}</td>
                  <td className="flex gap-8">
                    <button className="btn btn-secondary" onClick={() => handleTest(c.id)}>Test</button>
                    <button className="btn btn-secondary" onClick={() => handleDelete(c.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {Object.entries(testResults).map(([id, msg]) => (
            <div key={id} className="muted" style={{ marginTop: 6, fontSize: 12 }}>{msg}</div>
          ))}
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Add SMTP account</div>
          <div className="form-row">
            <label>Label</label>
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="My College Webmail" />
          </div>
          <div className="grid-2 form-row">
            <div>
              <label>SMTP Host</label>
              <input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="smtp.gmail.com" />
            </div>
            <div>
              <label>Port</label>
              <input type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} />
            </div>
          </div>
          <div className="form-row flex items-center gap-8">
            <input type="checkbox" style={{ width: 'auto' }} checked={form.secure} onChange={(e) => setForm({ ...form, secure: e.target.checked })} />
            <label style={{ margin: 0 }}>Use SSL/TLS (port 465)</label>
          </div>
          <div className="form-row">
            <label>Username</label>
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="you@college.edu" />
          </div>
          <div className="form-row">
            <label>Password / App Password</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Sender Name</label>
            <input value={form.senderName} onChange={(e) => setForm({ ...form, senderName: e.target.value })} placeholder="John Doe" />
          </div>
          <div className="form-row">
            <label>Reply-To (optional)</label>
            <input value={form.replyTo} onChange={(e) => setForm({ ...form, replyTo: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Account'}
          </button>
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            Passwords are stored in your OS's secure keychain, never as plain text.
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>AI Writing Assistant</div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
          {hasAiKey ? 'An Anthropic API key is configured.' : 'Add your own Anthropic API key to enable the AI writing assistant in the Templates editor.'}
        </div>
        <div className="flex gap-8">
          <input type="password" placeholder="sk-ant-..." value={aiKey} onChange={(e) => setAiKey(e.target.value)} />
          <button className="btn btn-primary" onClick={handleSaveAiKey}>Save</button>
        </div>
      </div>
    </div>
  );
}
