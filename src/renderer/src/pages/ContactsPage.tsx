import React, { useEffect, useState } from 'react';

export default function ContactsPage() {
  const [lists, setLists] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);

  const refresh = async () => setLists(await window.mailmerge.contacts.list());

  useEffect(() => {
    refresh();
  }, []);

  const handleImport = async () => {
    setError('');
    const filePath = await window.mailmerge.dialogs.openSpreadsheet();
    if (!filePath) return;
    setImporting(true);
    try {
      await window.mailmerge.contacts.import(filePath);
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await window.mailmerge.contacts.delete(id);
    if (selected?.id === id) setSelected(null);
    refresh();
  };

  return (
    <div>
      <div className="topbar">
        <div className="page-title">Contacts</div>
        <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
          {importing ? 'Importing...' : '+ Import CSV / XLSX'}
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: 16, color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div className="two-col">
        <div className="card">
          {lists.length === 0 && <div className="muted">No contact lists yet. Import a spreadsheet to get started.</div>}
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Recipients</th>
                <th>Columns</th>
                <th>Email column</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lists.map((l) => (
                <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(l)}>
                  <td>{l.name}</td>
                  <td>{l.contacts.length}</td>
                  <td className="muted">{l.columns.join(', ')}</td>
                  <td>{l.emailColumn}</td>
                  <td>
                    <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); handleDelete(l.id); }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Preview</div>
          {!selected && <div className="muted">Select a list to preview its columns and first rows.</div>}
          {selected && (
            <div>
              <div className="form-row">
                <label>Email column</label>
                <select
                  value={selected.emailColumn}
                  onChange={async (e) => {
                    await window.mailmerge.contacts.setEmailColumn(selected.id, e.target.value);
                    refresh();
                    setSelected({ ...selected, emailColumn: e.target.value });
                  }}
                >
                  {selected.columns.map((c: string) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 6 }}>Available placeholders</div>
              <div>
                {selected.columns.map((c: string) => (
                  <span key={c} className="placeholder-chip">{`{{${c}}}`}</span>
                ))}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 14, marginBottom: 6 }}>First rows</div>
              <div style={{ maxHeight: 260, overflowY: 'auto', fontSize: 12 }}>
                {selected.contacts.slice(0, 5).map((c: any, idx: number) => (
                  <pre key={idx} style={{ background: 'var(--bg)', padding: 8, borderRadius: 6, marginBottom: 6, whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(c, null, 2)}
                  </pre>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
