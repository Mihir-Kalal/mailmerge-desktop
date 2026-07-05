import { Contact } from './types';

const PLACEHOLDER_REGEX = /{{\s*([a-zA-Z0-9_ .\-]+?)\s*}}/g;

/** Extracts the set of unique placeholder names referenced in a string, e.g. "{{Name}}" -> "Name". */
export function extractPlaceholders(text: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_REGEX);
  while ((match = re.exec(text)) !== null) {
    found.add(match[1]);
  }
  return Array.from(found);
}

/** Case-insensitive lookup of a contact's value for a given column/placeholder name. */
function lookupValue(contact: Contact, key: string): string | undefined {
  if (key in contact) return contact[key];
  const lowerKey = key.toLowerCase().trim();
  const foundKey = Object.keys(contact).find((k) => k.toLowerCase().trim() === lowerKey);
  return foundKey ? contact[foundKey] : undefined;
}

export interface RenderResult {
  text: string;
  missingPlaceholders: string[];
}

/**
 * Replaces every {{Placeholder}} occurrence in `text` with the matching value from `contact`.
 * Placeholders with no matching column are left as an empty string, and their names are
 * returned in `missingPlaceholders` so the UI can warn the user.
 */
export function renderTemplate(text: string, contact: Contact): RenderResult {
  const missing: string[] = [];
  const rendered = text.replace(PLACEHOLDER_REGEX, (_full, key: string) => {
    const value = lookupValue(contact, key);
    if (value === undefined) {
      missing.push(key);
      return '';
    }
    return value;
  });
  return { text: rendered, missingPlaceholders: Array.from(new Set(missing)) };
}

/** Convenience helper to render subject + body + signature + dynamic attachment filenames at once. */
export function renderEmailForContact(
  subject: string,
  bodyHtml: string,
  signatureHtml: string,
  contact: Contact
) {
  const renderedSubject = renderTemplate(subject, contact);
  const renderedBody = renderTemplate(bodyHtml, contact);
  const renderedSignature = renderTemplate(signatureHtml, contact);
  return {
    subject: renderedSubject.text,
    bodyHtml: renderedBody.text + (renderedSignature.text ? `<br/>${renderedSignature.text}` : ''),
    missingPlaceholders: Array.from(
      new Set([
        ...renderedSubject.missingPlaceholders,
        ...renderedBody.missingPlaceholders,
        ...renderedSignature.missingPlaceholders
      ])
    )
  };
}

/** Renders a dynamic attachment file name/path, e.g. "Invoice_{{InvoiceNumber}}.pdf". */
export function renderAttachmentPath(pathTemplate: string, contact: Contact): RenderResult {
  return renderTemplate(pathTemplate, contact);
}
