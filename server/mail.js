// Outgoing email for sign-in links.
// With RESEND_API_KEY set, mail goes through Resend (https://resend.com).
// Without it, and only when LOG_SIGNIN_LINKS is on, the link is written to the server log so the
// team can demonstrate the flow with synthetic accounts. Turn that off once a real provider is set.
import { config } from './config.js';

export const mailEnabled = () => Boolean(config.resendApiKey) || config.logSigninLinks;

export async function sendSignInLink({ to, name, url, minutes }) {
  const subject = 'Your CampusGear sign-in link';
  const text = [
    `Hello ${name},`,
    '',
    'Use this link to sign in to the CampusGear equipment loan service:',
    url,
    '',
    `The link works once and expires in ${minutes} minutes.`,
    'If you did not ask to sign in, you can ignore this message.',
  ].join('\n');

  if (config.resendApiKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.mailFrom, to: [to], subject, text }),
    });
    if (!res.ok) throw new Error(`Email provider responded with HTTP ${res.status}`);
    return 'email';
  }
  if (config.logSigninLinks && !config.isTest) {
    console.log(`[mail] sign-in link for ${to} (valid ${minutes} min): ${url}`);
  }
  return 'log';
}
