// backend/src/services/notificationService.js
const AfricasTalking = require('africastalking');

// ─── Initialise Africa's Talking client ──────────────────────────────────────
const AT = AfricasTalking({
  apiKey:   process.env.AFRICAS_TALKING_API_KEY,
  username: process.env.AFRICAS_TALKING_USERNAME, // 'sandbox' for dev, your username for prod
});

const sms = AT.SMS;

// ─── Country calling codes for TZ / ZM ───────────────────────────────────────
const COUNTRY_CODE = {
  TZ: '+255',
  ZM: '+260',
};

// ─── Helper: normalise phone number ──────────────────────────────────────────
// Ensures numbers are in E.164 format for Africa's Talking
const normalisePhone = (phone, country) => {
  if (!phone) return null;
  const stripped = phone.replace(/\s+/g, '').replace(/^0/, '');
  if (stripped.startsWith('+')) return stripped;
  const code = COUNTRY_CODE[country] || '';
  return `${code}${stripped}`;
};

// ─── Helper: send SMS ─────────────────────────────────────────────────────────
const sendSMS = async (to, message) => {
  if (!to) {
    console.warn('[notificationService] Skipped SMS — no phone number provided.');
    return null;
  }

  try {
    const result = await sms.send({
      to: Array.isArray(to) ? to : [to],
      message,
      from: 'TradeLens', // sender ID (must be registered in prod)
    });
    console.log('[notificationService] SMS sent:', JSON.stringify(result));
    return result;
  } catch (err) {
    // Non-fatal — log and continue; do not crash the main request
    console.error('[notificationService] SMS failed:', err.message);
    return null;
  }
};

// ─── NOTIFICATION EVENTS ──────────────────────────────────────────────────────

// 1. Trader: document uploaded successfully — awaiting review
const notifyDocumentUploaded = async ({ trader, document_type, destination_country }) => {
  const phone = normalisePhone(trader.phone, trader.country);
  const dest  = destination_country === 'TZ' ? 'Tanzania' : 'Zambia';
  const message =
    `TradeLens: Your ${document_type.replace(/_/g, ' ')} for ${dest} ` +
    `has been received and is awaiting review by a Standards Officer. ` +
    `You will be notified once a decision is made.`;
  return sendSMS(phone, message);
};

// 2. Trader: document approved by Standards Officer
const notifyDocumentApproved = async ({ trader, document_type, destination_country }) => {
  const phone = normalisePhone(trader.phone, trader.country);
  const dest  = destination_country === 'TZ' ? 'Tanzania' : 'Zambia';
  const message =
    `TradeLens: Your ${document_type.replace(/_/g, ' ')} for ${dest} ` +
    `has been APPROVED. Log in to download your certificate. ` +
    `tradelens.app`;
  return sendSMS(phone, message);
};

// 3. Trader: document rejected by Standards Officer
const notifyDocumentRejected = async ({ trader, document_type, destination_country, reviewer_notes }) => {
  const phone = normalisePhone(trader.phone, trader.country);
  const dest  = destination_country === 'TZ' ? 'Tanzania' : 'Zambia';
  const message =
    `TradeLens: Your ${document_type.replace(/_/g, ' ')} for ${dest} ` +
    `was REJECTED. Reason: ${reviewer_notes || 'See portal for details'}. ` +
    `Please re-upload a corrected document at tradelens.app`;
  return sendSMS(phone, message);
};

// 4. Trader: certificate issued — ready to download (US-03)
const notifyCertificateIssued = async ({ trader, certificate_number, certificate_type, valid_until }) => {
  const phone   = normalisePhone(trader.phone, trader.country);
  const expiry  = new Date(valid_until).toDateString();
  const message =
    `TradeLens: Certificate ${certificate_number} (${certificate_type}) has been issued. ` +
    `Valid until: ${expiry}. Download your PDF at tradelens.app`;
  return sendSMS(phone, message);
};

// 5. Trader: certificate revoked — action required
const notifyCertificateRevoked = async ({ trader, certificate_number, reason }) => {
  const phone = normalisePhone(trader.phone, trader.country);
  const message =
    `TradeLens ALERT: Certificate ${certificate_number} has been REVOKED. ` +
    `Reason: ${reason || 'Contact your Standards Officer'}. ` +
    `Log in at tradelens.app for details.`;
  return sendSMS(phone, message);
};

// 6. Customs Officer: certificate verified at border (US-05) — confirmation receipt
const notifyVerificationComplete = async ({ officer, certificate_number, verification_status }) => {
  const phone  = normalisePhone(officer.phone, officer.country);
  const status = verification_status.toUpperCase();
  const message =
    `TradeLens: Border verification for certificate ${certificate_number} ` +
    `completed. Result: ${status}. Audit log updated.`;
  return sendSMS(phone, message);
};

// 7. Customs Officer / Admin: tamper detected during QR scan (BR-03, BR-06)
const notifyTamperDetected = async ({ officer, certificate_number }) => {
  const phone = normalisePhone(officer.phone, officer.country);
  const message =
    `TradeLens SECURITY ALERT: Tamper detected on certificate ${certificate_number} ` +
    `during border scan. SHA-256 hash mismatch. Do not clear this shipment. ` +
    `Report to your supervisor immediately.`;
  return sendSMS(phone, message);
};

// 8. Trader: certificate expiring soon — 7-day warning
const notifyCertificateExpiringSoon = async ({ trader, certificate_number, valid_until }) => {
  const phone  = normalisePhone(trader.phone, trader.country);
  const expiry = new Date(valid_until).toDateString();
  const message =
    `TradeLens REMINDER: Certificate ${certificate_number} expires on ${expiry} (7 days). ` +
    `Contact your Standards Officer to renew before crossing the border.`;
  return sendSMS(phone, message);
};

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  notifyDocumentUploaded,
  notifyDocumentApproved,
  notifyDocumentRejected,
  notifyCertificateIssued,
  notifyCertificateRevoked,
  notifyVerificationComplete,
  notifyTamperDetected,
  notifyCertificateExpiringSoon,
};
