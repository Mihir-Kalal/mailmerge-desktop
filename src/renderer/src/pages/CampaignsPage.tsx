import React, { useEffect, useState } from 'react';

const statusColor: Record<string, string> = {
  draft: 'badge-muted',
  running: 'badge-warning',
  paused: 'badge-warning',
  completed: 'badge-success',
  cancelled: 'badge-muted',
  failed: 'badge-danger'
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<any | null>(null);

  const refresh = async () => setCampaigns(await window.mailmerge.campaigns.list());

  useEffect(() => {
    refresh();
    const unsub = window.mailmerge.campaigns.onProgress(() => refresh());
    return unsub;
  }, []);

  const filtered = campaigns.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (id: string) => {
    await window.mailmerge.campaigns.delete(id);
    if (selected?.id === id) setSelected(null);
    refresh();
  };

  const handleDuplicate = async (id: string) => {
    await window.mailmerge.campaigns.duplicate(id);
    refresh();
  };

  return (
    <div>
      <div className="topbar">
        <div className="page-title">Campaigns</div>
      </div>

      <div className="flex gap-12" style={{ marginBottom: 16 }}>
        <input placeholder="Search campaigns..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="running">Running</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="two-col">
        <div className="card">
          <table>
            <thead>
              <tr><th>Name</th><th>Date</th><th>Total</th><th>Sent</th><th>Failed</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(c)}>
                  <td>{c.name}</td>
                  <td className="muted">{new Date(c.createdAt).toLocaleString()}</td>
                  <td>{c.total}</td>
                  <td>{c.sent}</td>
                  <td>{c.failed}</td>
                  <td><span className={`badge ${statusColor[c.status] || 'badge-muted'}`}>{c.status}</span></td>
                  <td className="flex gap-8">
                    <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); handleDuplicate(c.id); }}>Duplicate</button>
                    <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}>Delete</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="muted">No campaigns match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Campaign Logs</div>
          {!selected && <div className="muted">Select a campaign to view per-recipient logs.</div>}
          {selected && (
            <div>
              <button className="btn btn-secondary" style={{ marginBottom: 10 }} onClick={() => window.mailmerge.campaigns.exportLogs(selected.id)}>
                Export Logs to CSV
              </button>
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                <table>
                  <thead><tr><th>Recipient</th><th>Status</th><th>Error</th></tr></thead>
                  <tbody>
                    {selected.logs.map((l: any, idx: number) => (
                      <tr key={idx}>
                        <td>{l.contactEmail}</td>
                        <td><span className={`badge ${statusColor[l.status] || 'badge-muted'}`}>{l.status}</span></td>
                        <td className="muted" style={{ fontSize: 11 }}>{l.errorMessage || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
