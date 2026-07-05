import React, { useEffect, useState } from 'react';
import { renderEmailForContact } from '../../../shared/placeholderEngine';

const defaultLimits = { delayMs: 1000, randomDelayMs: 500, emailsPerMinute: 20, emailsPerHour: 300, retryCount: 2 };

export default function SendWizardPage() {
  const [contactLists, setContactLists] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [smtpConfigs, setSmtpConfigs] = useState<any[]>([]);

  const [contactListId, setContactListId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [smtpConfigId, setSmtpConfigId] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [limits, setLimits] = useState({ ...defaultLimits });
  const [previewIndex, setPreviewIndex] = useState(0);

  const [campaign, setCampaign] = useState<any | null>(null);
  const [progress, setProgress] = useState<any | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    window.mailmerge.contacts.list().then(setContactLists);
    window.mailmerge.templates.list().then(setTemplates);
    window.mailmerge.smtp.list().then(setSmtpConfigs);

    const unsubProgress = window.mailmerge.campaigns.onProgress((update) => setProgress(update));
    const unsubError = window.mailmerge.campaigns.onError((err) => setError(err.message));
    return () => { unsubProgress(); unsubError(); };
  }, []);

  const selectedList = contactLists.find((l) => l.id === contactListId);
  const selectedTemplate = templates.find((t) => t.id === templateId);

  const preview = selectedTemplate && selectedList && selectedList.contacts[previewIndex]
    ? renderEmailForContact(selectedTemplate.subject, selectedTemplate.bodyHtml, selectedTemplate.signatureHtml, selectedList.contacts[previewIndex])
    : null;

  const canSend = contactListId && templateId && smtpConfigId && campaignName.trim() && !campaign;

  const handleCreateAndSend = async () => {
    setError('');
    try {
      const created = await window.mailmerge.campaigns.create(campaignName, templateId, smtpConfigId, contactListId, limits);
      setCampaign(created);
      setConfirmOpen(false);
      await window.mailmerge.campaigns.run(created.id);
    } catch (err: any) {
      setError(err?.message || 'Failed to start campaign');
    }
  };

  const handlePause = () => campaign && window.mailmerge.campaigns.pause(campaign.id);
  const handleResume = () => campaign && window.mailmerge.campaigns.resume(campaign.id);
  const handleCancel = () => campaign && window.mailmerge.campaigns.cancel(campaign.id);
  const handleNewCampaign = () => { setCampaign(null); setProgress(null); setCampaignName(''); };

  const total = progress?.total ?? selectedList?.contacts.length ?? 0;
  const sent = progress?.sent ?? 0;
  const failed = progress?.failed ?? 0;
  const done = sent + failed;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div>
      <div className="topbar">
        <div className="page-title">Send Campaign</div>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', marginBottom: 16 }}>{error}</div>
      )}

      {!campaign && (
        <div className="two-col">
          <div className="card">
            <div className="form-row">
              <label>Campaign Name</label>
              <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="e.g. Fall Internship Outreach" />
            </div>
            <div className="grid-2 form-row">
              <div>
                <label>1. Contact List</label>
                <select value={contactListId} onChange={(e) => { setContactListId(e.target.value); setPreviewIndex(0); }}>
                  <option value="">Select...</option>
                  {contactLists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.contacts.length})</option>)}
                </select>
              </div>
              <div>
                <label>2. Email Template</label>
                <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  <option value="">Select...</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <label>3. SMTP Account</label>
              <select value={smtpConfigId} onChange={(e) => setSmtpConfigId(e.target.value)}>
                <option value="">Select...</option>
                {smtpConfigs.map((s) => <option key={s.id} value={s.id}>{s.label} ({s.username})</option>)}
              </select>
            </div>

            <div style={{ fontWeight: 700, fontSize: 12, margin: '18px 0 8px' }}>SENDING LIMITS</div>
            <div className="grid-2 form-row">
              <div>
                <label>Delay between emails (ms)</label>
                <input type="number" value={limits.delayMs} onChange={(e) => setLimits({ ...limits, delayMs: Number(e.target.value) })} />
              </div>
              <div>
                <label>Random extra delay (ms)</label>
                <input type="number" value={limits.randomDelayMs} onChange={(e) => setLimits({ ...limits, randomDelayMs: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid-2 form-row">
              <div>
                <label>Emails per minute</label>
                <input type="number" value={limits.emailsPerMinute} onChange={(e) => setLimits({ ...limits, emailsPerMinute: Number(e.target.value) })} />
              </div>
              <div>
                <label>Emails per hour</label>
                <input type="number" value={limits.emailsPerHour} onChange={(e) => setLimits({ ...limits, emailsPerHour: Number(e.target.value) })} />
              </div>
            </div>
            <div className="form-row">
              <label>Retry count on failure</label>
              <input type="number" value={limits.retryCount} onChange={(e) => setLimits({ ...limits, retryCount: Number(e.target.value) })} />
            </div>

            <button className="btn btn-primary" disabled={!canSend} onClick={() => setConfirmOpen(true)} style={{ width: '100%', marginTop: 8 }}>
              Preview & Send {selectedList ? `(${selectedList.contacts.length} recipients)` : ''}
            </button>
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Live Preview</div>
            {!preview && <div className="muted">Choose a contact list and template to preview the personalized email.</div>}
            {preview && selectedList && (
              <div>
                <div className="form-row">
                  <label>Previewing recipient</label>
                  <select value={previewIndex} onChange={(e) => setPreviewIndex(Number(e.target.value))}>
                    {selectedList.contacts.slice(0, 50).map((c: any, idx: number) => (
                      <option key={idx} value={idx}>{c[selectedList.emailColumn] || `Row ${idx + 1}`}</option>
                    ))}
                  </select>
                </div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Subject</div>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>{preview.subject}</div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Body</div>
                <div
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, maxHeight: 320, overflowY: 'auto' }}
                  dangerouslySetInnerHTML={{ __html: preview.bodyHtml }}
                />
                {preview.missingPlaceholders.length > 0 && (
                  <div className="badge badge-warning" style={{ marginTop: 10 }}>
                    ⚠ Missing values for: {preview.missingPlaceholders.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {campaign && (
        <div className="card">
          <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{campaign.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>Status: {progress?.status || 'starting'}</div>
            </div>
            <div className="flex gap-8">
              {progress?.status === 'running' && <button className="btn btn-secondary" onClick={handlePause}>⏸ Pause</button>}
              {progress?.status === 'paused' && <button className="btn btn-secondary" onClick={handleResume}>▶ Resume</button>}
              {(progress?.status === 'running' || progress?.status === 'paused') && (
                <button className="btn btn-danger" onClick={handleCancel}>✕ Cancel</button>
              )}
              {(progress?.status === 'completed' || progress?.status === 'cancelled') && (
                <button className="btn btn-primary" onClick={handleNewCampaign}>+ New Campaign</button>
              )}
            </div>
          </div>

          <div className="progress-bar-track" style={{ marginBottom: 10 }}>
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex gap-12" style={{ marginBottom: 16, fontSize: 13 }}>
            <span>{done} / {total} processed</span>
            <span className="badge badge-success">{sent} sent</span>
            <span className="badge badge-danger">{failed} failed</span>
            <span className="muted">{total - done} remaining</span>
            {progress?.estimatedRemainingMs != null && progress.estimatedRemainingMs > 0 && (
              <span className="muted">~{Math.ceil(progress.estimatedRemainingMs / 1000)}s remaining</span>
            )}
          </div>

          {progress?.currentRecipientEmail && progress.status === 'running' && (
            <div className="card" style={{ background: 'var(--bg)' }}>
              <div className="muted" style={{ fontSize: 12 }}>Currently sending to</div>
              <div style={{ fontWeight: 600 }}>{progress.currentRecipientEmail}</div>
            </div>
          )}

          {(progress?.status === 'completed' || progress?.status === 'cancelled') && (
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => window.mailmerge.campaigns.exportLogs(campaign.id)}>
                Export Logs to CSV
              </button>
            </div>
          )}
        </div>
      )}

      {confirmOpen && (
        <div className="modal-backdrop" onClick={() => setConfirmOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Confirm send</div>
            <p>
              You're about to send <strong>{selectedList?.contacts.length}</strong> personalized emails using
              template <strong>{selectedTemplate?.name}</strong> from <strong>{smtpConfigs.find((s) => s.id === smtpConfigId)?.username}</strong>.
            </p>
            <p className="muted">This cannot be undone once sending begins, though you can pause or cancel mid-send.</p>
            <div className="flex gap-8" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateAndSend}>Confirm & Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
