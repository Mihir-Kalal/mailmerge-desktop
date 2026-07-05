import React, { useEffect, useRef, useState } from 'react';
import { extractPlaceholders } from '../../../shared/placeholderEngine';

const AI_ACTIONS: { key: string; label: string }[] = [
  { key: 'improve', label: 'Improve' },
  { key: 'professional', label: 'Professional' },
  { key: 'friendlier', label: 'Friendlier' },
  { key: 'shorten', label: 'Shorten' },
  { key: 'expand', label: 'Expand' },
  { key: 'grammar', label: 'Fix Grammar' },
  { key: 'subjectLines', label: 'Subject Ideas' },
  { key: 'followUp', label: 'Follow-up' }
];

function blankTemplate() {
  return { id: undefined, name: 'Untitled Template', subject: '', bodyHtml: '', signatureHtml: '', attachments: [], isHtml: true };
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(blankTemplate());
  const [contactColumns, setContactColumns] = useState<string[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiOutput, setAiOutput] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  const refresh = async () => setTemplates(await window.mailmerge.templates.list());

  useEffect(() => {
    refresh();
    window.mailmerge.contacts.list().then((lists) => {
      const cols = new Set<string>();
      lists.forEach((l: any) => l.columns.forEach((c: string) => cols.add(c)));
      setContactColumns(Array.from(cols));
    });
  }, []);

  useEffect(() => {
    if (bodyRef.current && bodyRef.current.innerHTML !== current.bodyHtml) {
      bodyRef.current.innerHTML = current.bodyHtml || '';
    }
  }, [current.id]);

  // Autosave draft every few seconds
  useEffect(() => {
    const t = setTimeout(() => {
      window.mailmerge.drafts.save('template-editor', current);
    }, 1500);
    return () => clearTimeout(t);
  }, [current]);

  const insertPlaceholder = (name: string) => {
    const el = bodyRef.current;
    if (!el) return;
    el.focus();
    document.execCommand('insertText', false, `{{${name}}}`);
    setCurrent({ ...current, bodyHtml: el.innerHTML });
  };

  const exec = (cmd: string, value?: string) => {
    bodyRef.current?.focus();
    document.execCommand(cmd, false, value);
    if (bodyRef.current) setCurrent({ ...current, bodyHtml: bodyRef.current.innerHTML });
  };

  const handleSave = async () => {
    const saved = await window.mailmerge.templates.save({
      ...current,
      bodyHtml: bodyRef.current?.innerHTML || current.bodyHtml
    });
    setCurrent(saved);
    refresh();
  };

  const handleAddAttachment = async () => {
    const paths = await window.mailmerge.dialogs.openAttachment();
    if (!paths.length) return;
    const described = await Promise.all(paths.map((p) => window.mailmerge.attachments.describe(p)));
    const isDynamicName = (name: string) => /{{.*?}}/.test(name);
    setCurrent({
      ...current,
      attachments: [
        ...current.attachments,
        ...described.map((d: any) => ({ id: crypto.randomUUID(), fileName: d.fileName, filePath: d.filePath, isDynamic: isDynamicName(d.fileName) }))
      ]
    });
  };

  const removeAttachment = (id: string) => {
    setCurrent({ ...current, attachments: current.attachments.filter((a: any) => a.id !== id) });
  };

  const runAi = async (action: string) => {
    setAiBusy(true);
    setAiOutput('');
    try {
      const bodyText = bodyRef.current?.innerText || '';
      const result = await window.mailmerge.ai.run({ action, text: bodyText });
      setAiOutput(result);
    } catch (err: any) {
      setAiOutput('Error: ' + (err?.message || 'AI request failed. Add an API key in SMTP Accounts → AI Writing Assistant.'));
    } finally {
      setAiBusy(false);
    }
  };

  const applyAiOutput = () => {
    if (bodyRef.current) {
      bodyRef.current.innerText = aiOutput;
      setCurrent({ ...current, bodyHtml: bodyRef.current.innerHTML });
      setAiOutput('');
    }
  };

  const usedPlaceholders = extractPlaceholders((current.subject || '') + ' ' + (bodyRef.current?.innerHTML || current.bodyHtml || ''));

  return (
    <div>
      <div className="topbar">
        <div className="page-title">Templates</div>
        <div className="flex gap-8">
          <button className="btn btn-secondary" onClick={() => setCurrent(blankTemplate())}>+ New</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Template</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 260px', gap: 20 }}>
        {/* Template list */}
        <div className="card" style={{ padding: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, padding: '0 6px' }}>SAVED TEMPLATES</div>
          {templates.map((t) => (
            <div
              key={t.id}
              className={`nav-item ${current.id === t.id ? 'active' : ''}`}
              onClick={() => setCurrent(t)}
              style={{ fontSize: 13 }}
            >
              {t.name}
            </div>
          ))}
          {templates.length === 0 && <div className="muted" style={{ fontSize: 12, padding: 6 }}>No templates yet</div>}
        </div>

        {/* Editor */}
        <div className="card">
          <div className="form-row">
            <label>Template Name</label>
            <input value={current.name} onChange={(e) => setCurrent({ ...current, name: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Subject</label>
            <input value={current.subject} onChange={(e) => setCurrent({ ...current, subject: e.target.value })} placeholder="Application for {{Position}} at {{Company}}" />
          </div>
          <div className="form-row">
            <label>Body</label>
            <div className="editor-toolbar">
              <button onClick={() => exec('bold')}><b>B</b></button>
              <button onClick={() => exec('italic')}><i>I</i></button>
              <button onClick={() => exec('insertUnorderedList')}>• List</button>
              <button onClick={() => { const url = prompt('Link URL:'); if (url) exec('createLink', url); }}>Link</button>
            </div>
            <div
              ref={bodyRef}
              contentEditable
              onInput={() => setCurrent({ ...current, bodyHtml: bodyRef.current?.innerHTML || '' })}
              suppressContentEditableWarning
            />
          </div>
          <div className="form-row">
            <label>Signature</label>
            <textarea
              rows={3}
              value={current.signatureHtml}
              onChange={(e) => setCurrent({ ...current, signatureHtml: e.target.value })}
              placeholder="Best regards,&#10;{{Name}}"
            />
          </div>
          <div className="form-row">
            <label>Attachments</label>
            <div className="flex gap-8" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
              {current.attachments.map((a: any) => (
                <span key={a.id} className="placeholder-chip">
                  📎 {a.fileName} <span onClick={() => removeAttachment(a.id)} style={{ color: 'var(--danger)', marginLeft: 6 }}>✕</span>
                </span>
              ))}
            </div>
            <button className="btn btn-secondary" onClick={handleAddAttachment}>+ Add Attachment</button>
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              Tip: name a file like <code>Invoice_&#123;&#123;InvoiceNumber&#125;&#125;.pdf</code> for a per-recipient attachment.
            </div>
          </div>

          <div className="card" style={{ background: 'var(--bg)', marginTop: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>✨ AI WRITING ASSISTANT</div>
            <div className="flex gap-8" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
              {AI_ACTIONS.map((a) => (
                <button key={a.key} className="btn btn-secondary" disabled={aiBusy} onClick={() => runAi(a.key)}>
                  {a.label}
                </button>
              ))}
            </div>
            {aiBusy && <div className="muted">Thinking...</div>}
            {aiOutput && (
              <div>
                <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, whiteSpace: 'pre-wrap', fontSize: 13, marginBottom: 8 }}>
                  {aiOutput}
                </div>
                <button className="btn btn-primary" onClick={applyAiOutput}>Apply to Body</button>
              </div>
            )}
          </div>
        </div>

        {/* Placeholder sidebar */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>PLACEHOLDERS</div>
          {contactColumns.length === 0 && <div className="muted" style={{ fontSize: 12 }}>Import a contact list to see available placeholders.</div>}
          <div>
            {contactColumns.map((c) => (
              <span key={c} className="placeholder-chip" onClick={() => insertPlaceholder(c)}>{`{{${c}}}`}</span>
            ))}
          </div>
          <div style={{ fontWeight: 700, fontSize: 12, marginTop: 18, marginBottom: 8 }}>USED IN THIS TEMPLATE</div>
          <div>
            {usedPlaceholders.length === 0 && <div className="muted" style={{ fontSize: 12 }}>None yet</div>}
            {usedPlaceholders.map((p) => (
              <span key={p} className="placeholder-chip">{`{{${p}}}`}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
