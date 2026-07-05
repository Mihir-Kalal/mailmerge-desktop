import { contextBridge, ipcRenderer } from 'electron';

const api = {
  templates: {
    list: () => ipcRenderer.invoke('templates:list'),
    save: (input: any) => ipcRenderer.invoke('templates:save', input),
    delete: (id: string) => ipcRenderer.invoke('templates:delete', id),
    duplicate: (id: string) => ipcRenderer.invoke('templates:duplicate', id)
  },
  smtp: {
    list: () => ipcRenderer.invoke('smtp:list'),
    save: (input: any) => ipcRenderer.invoke('smtp:save', input),
    delete: (id: string) => ipcRenderer.invoke('smtp:delete', id),
    test: (id: string) => ipcRenderer.invoke('smtp:test', id)
  },
  contacts: {
    list: () => ipcRenderer.invoke('contacts:list'),
    import: (filePath: string, name?: string) => ipcRenderer.invoke('contacts:import', filePath, name),
    delete: (id: string) => ipcRenderer.invoke('contacts:delete', id),
    setEmailColumn: (id: string, col: string) => ipcRenderer.invoke('contacts:setEmailColumn', id, col)
  },
  campaigns: {
    list: () => ipcRenderer.invoke('campaigns:list'),
    create: (name: string, templateId: string, smtpConfigId: string, contactListId: string, limits: any) =>
      ipcRenderer.invoke('campaigns:create', name, templateId, smtpConfigId, contactListId, limits),
    run: (id: string) => ipcRenderer.invoke('campaigns:run', id),
    pause: (id: string) => ipcRenderer.invoke('campaigns:pause', id),
    resume: (id: string) => ipcRenderer.invoke('campaigns:resume', id),
    cancel: (id: string) => ipcRenderer.invoke('campaigns:cancel', id),
    delete: (id: string) => ipcRenderer.invoke('campaigns:delete', id),
    duplicate: (id: string) => ipcRenderer.invoke('campaigns:duplicate', id),
    exportLogs: (id: string) => ipcRenderer.invoke('campaigns:exportLogs', id),
    onProgress: (cb: (update: any) => void) => {
      const listener = (_e: any, update: any) => cb(update);
      ipcRenderer.on('campaign:progress', listener);
      return () => ipcRenderer.removeListener('campaign:progress', listener);
    },
    onError: (cb: (err: any) => void) => {
      const listener = (_e: any, err: any) => cb(err);
      ipcRenderer.on('campaign:error', listener);
      return () => ipcRenderer.removeListener('campaign:error', listener);
    }
  },
  ai: {
    saveKey: (key: string) => ipcRenderer.invoke('ai:saveKey', key),
    hasKey: () => ipcRenderer.invoke('ai:hasKey'),
    run: (req: any) => ipcRenderer.invoke('ai:run', req)
  },
  drafts: {
    save: (id: string, data: unknown) => ipcRenderer.invoke('drafts:save', id, data),
    load: (id: string) => ipcRenderer.invoke('drafts:load', id)
  },
  dialogs: {
    openSpreadsheet: () => ipcRenderer.invoke('dialog:openSpreadsheet'),
    openAttachment: () => ipcRenderer.invoke('dialog:openAttachment'),
    saveCsv: (defaultName: string) => ipcRenderer.invoke('dialog:saveCsv', defaultName)
  },
  attachments: {
    describe: (filePath: string) => ipcRenderer.invoke('attachments:describe', filePath)
  }
};

contextBridge.exposeInMainWorld('mailmerge', api);

export type MailMergeApi = typeof api;
