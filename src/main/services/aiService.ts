import keytar from 'keytar';
import { AiRequest } from '../../shared/types';

const KEYTAR_SERVICE = 'MailMergeDesktop';
const KEYTAR_AI_ACCOUNT = 'anthropic-api-key';

export async function saveAiApiKey(apiKey: string): Promise<void> {
  await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_AI_ACCOUNT, apiKey);
}

export async function hasAiApiKey(): Promise<boolean> {
  const key = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_AI_ACCOUNT);
  return !!key;
}

function buildPrompt(req: AiRequest): string {
  switch (req.action) {
    case 'improve':
      return `Improve the clarity and quality of this email while preserving all {{placeholder}} tokens exactly as written:\n\n${req.text}`;
    case 'professional':
      return `Rewrite this email in a more professional tone. Preserve every {{placeholder}} token exactly:\n\n${req.text}`;
    case 'friendlier':
      return `Rewrite this email to sound warmer and friendlier. Preserve every {{placeholder}} token exactly:\n\n${req.text}`;
    case 'shorten':
      return `Shorten this email while keeping its key message. Preserve every {{placeholder}} token exactly:\n\n${req.text}`;
    case 'expand':
      return `Expand this email with more helpful detail. Preserve every {{placeholder}} token exactly:\n\n${req.text}`;
    case 'grammar':
      return `Fix grammar and spelling in this email only, no other changes. Preserve every {{placeholder}} token exactly:\n\n${req.text}`;
    case 'subjectLines':
      return `Suggest 5 concise subject line options for this email body. Return them as a plain numbered list:\n\n${req.text}`;
    case 'translate':
      return `Translate this email into ${req.targetLanguage || 'Spanish'}. Preserve every {{placeholder}} token exactly untranslated:\n\n${req.text}`;
    case 'followUp':
      return `Write a polite follow-up email referencing the original email below. Preserve any {{placeholder}} tokens exactly:\n\n${req.text}`;
    case 'tone':
      return `Rewrite this email in a ${req.targetTone || 'neutral'} tone. Preserve every {{placeholder}} token exactly:\n\n${req.text}`;
    default:
      return req.text;
  }
}

/**
 * Calls the Anthropic Messages API using the user's own API key (stored locally via the OS
 * keychain, never bundled with the app). Requires network access to api.anthropic.com.
 */
export async function runAiAction(req: AiRequest): Promise<string> {
  const apiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_AI_ACCOUNT);
  if (!apiKey) {
    throw new Error('No Anthropic API key configured. Add one in Settings → AI Assistant.');
  }

  const prompt = buildPrompt(req);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI request failed (${response.status}): ${errText}`);
  }

  const data: any = await response.json();
  const textBlocks = (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text);
  return textBlocks.join('\n').trim();
}
