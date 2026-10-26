/**
 * Admin Notification Service for NOIR
 * Sends an email notification to the administrator whenever a user signs in or creates an account.
 */

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_NOTIFICATION_EMAIL || '';
const NOTIFICATION_KEY = import.meta.env.VITE_NOTIFICATION_ACCESS_KEY || '';

// In-session deduplication so admin doesn't get spammed if user refreshes page
const notifiedSessions = new Set();

export async function notifyAdminOnAuth(user, eventType = 'LOGIN') {
  if (!user || !user.email) return;

  const sessionKey = `${user.id}-${new Date().toDateString()}`;
  if (notifiedSessions.has(sessionKey)) {
    return;
  }

  const provider = user.app_metadata?.provider || 'Email / Password';
  const displayName = user.user_metadata?.display_name || user.user_metadata?.full_name || 'Music Fan';
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  // 1. Log to console for development verification
  console.log(`[Admin Notification] New Auth Event: ${eventType} | User: ${user.email} (${displayName}) via ${provider}`);

  // 2. If an access key or admin email is provided via Web3Forms (free instant transactional API)
  if (NOTIFICATION_KEY || ADMIN_EMAIL) {
    try {
      await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          access_key: NOTIFICATION_KEY || 'default',
          to_email: ADMIN_EMAIL,
          subject: `🎵 [NOIR Music] User ${eventType}: ${user.email}`,
          from_name: 'NOIR Music Player',
          message: `Hello Admin,\n\nA user just authenticated on your NOIR Music Player!\n\n• Email: ${user.email}\n• Name: ${displayName}\n• Auth Provider: ${provider}\n• Time: ${timestamp}\n• User ID: ${user.id}\n\nKeep rocking!\nNOIR Music Engine`
        })
      });
      notifiedSessions.add(sessionKey);
    } catch (err) {
      console.warn('[Admin Notification] Failed to dispatch email notification:', err);
    }
  }
}
