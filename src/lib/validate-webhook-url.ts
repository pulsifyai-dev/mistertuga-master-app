/**
 * Webhook URL validation with SSRF protection.
 * Validates format, enforces HTTPS, and blocks internal/private addresses.
 */

const PRIVATE_IP_PATTERNS = [
  /^127\./,          // Loopback
  /^10\./,           // Class A private
  /^192\.168\./,     // Class C private
  /^172\.(1[6-9]|2\d|3[01])\./, // Class B private (172.16-31.x.x)
  /^169\.254\./,     // Link-local
  /^0\./,            // Current network
  /^::1$/,           // IPv6 loopback
  /^fc/i,            // IPv6 unique local
  /^fd/i,            // IPv6 unique local
  /^fe80/i,          // IPv6 link-local
];

const BLOCKED_HOSTNAMES = [
  'localhost',
  '0.0.0.0',
  '[::1]',
  'metadata.google.internal',
  'metadata.google',
  '169.254.169.254',
];

export function validateWebhookUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required.' };
  }

  const trimmed = url.trim();

  // Parse URL
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }

  // HTTPS only
  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTPS URLs are allowed.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block known internal hostnames
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, error: 'Internal URLs are not allowed.' };
  }

  // Block .local and .internal TLDs
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { valid: false, error: 'Internal URLs are not allowed.' };
  }

  // Block private IP ranges
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, error: 'Private/internal IP addresses are not allowed.' };
    }
  }

  return { valid: true };
}
