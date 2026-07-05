export {};

declare global {
  interface Window {
    mailmerge: {
      templates: {
        list: () => Promise<any[]>;
        save: (input: any) => Promise<any>;
        delete: (id: string) => Promise<void>;
        duplicate: (id: string) => Promise<any>;
      };
      smtp: {
        list: () => Promise<any[]>;
        save: (input: any) => Promise<any>;
        delete: (id: string) => Promise<void>;
        test: (id: string) => Promise<{ ok: boolean; message: string }>;
      };
      contacts: {
        list: () => Promise<any[]>;
        import: (filePath: string, name?: string) => Promise<any>;
        delete: (id: string) => Promise<void>;
        setEmailColumn: (id: string, col: string) => Promise<void>;
      };
      campaigns: {
        list: () => Promise<any[]>;
        create: (name: string, templateId: string, smtpConfigId: string, contactListId: string, limits: any) => Promise<any>;
        run: (id: string) => Promise<boolean>;
        pause: (id: string) => Promise<void>;
        resume: (id: string) => Promise<void>;
        cancel: (id: string) => Promise<void>;
        delete: (id: string) => Promise<void>;
        duplicate: (id: string) => Promise<any>;
        exportLogs: (id: string) => Promise<string | null>;
        onProgress: (cb: (update: any) => void) => () => void;
        onError: (cb: (err: any) => void) => () => void;
      };
      ai: {
        saveKey: (key: string) => Promise<void>;
        hasKey: () => Promise<boolean>;
        run: (req: any) => Promise<string>;
      };
      drafts: {
        save: (id: string, data: unknown) => Promise<boolean>;
        load: (id: string) => Promise<any>;
      };
      dialogs: {
        openSpreadsheet: () => Promise<string | null>;
        openAttachment: () => Promise<string[]>;
        saveCsv: (defaultName: string) => Promise<string | null>;
      };
      attachments: {
        describe: (filePath: string) => Promise<{ fileName: string; filePath: string }>;
      };
    };
  }
}
