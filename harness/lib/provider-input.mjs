import { createRequire } from 'node:module';
const INVITE = createRequire(import.meta.url)('../../app/lib/invite-language.js');

// Preserve prompt-only pipeline calls. Conversation calls keep every role and
// supported attachment rather than falling back to an undefined prompt.
export function openAIInput(system, prompt, messages) {
  if (!messages) return system ? `${system}\n\n${prompt}` : prompt;
  const input = system ? [{ role: 'system', content: system }] : [];
  for (const message of messages) {
    if (!['user', 'assistant'].includes(message.role)) throw new Error('Unsupported conversation role');
    const content = typeof message.content === 'string' ? message.content : message.content.map(part => {
      if (part.type === 'text') return { type: 'input_text', text: part.text };
      const source = part.source;
      if (source?.type !== 'base64') throw new Error('Unsupported attachment source');
      const data = `data:${source.media_type};base64,${source.data}`;
      if (part.type === 'image') return { type: 'input_image', image_url: data };
      if (part.type === 'document' && source.media_type === 'application/pdf') return { type: 'input_file', filename: 'attachment.pdf', file_data: data };
      throw new Error('Unsupported conversation content');
    });
    input.push({ role: message.role, content });
  }
  return input;
}

export function providerSystem(system, policy) {
  if (policy !== 'communication-continuity') return INVITE.apply(system);
  // Current module brief supersedes historical mandatory multi-step output
  // and no-referral rules. Other tools still receive their original policies.
  return [system, INVITE.rule, INVITE.nonjudging, INVITE.plain].filter(Boolean).join('\n\n');
}
