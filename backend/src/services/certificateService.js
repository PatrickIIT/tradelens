// backend/src/services/certificateService.js
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const { generateHash } = require('../utils/hash');

// ─── Generate Certificate Number ─────────────────────────────────────────────
// Format: TL-{COUNTRY}-{TYPE}-{TIMESTAMP}
const generateCertificateNumber = (issuing_country, certificate_type) => {
  const timestamp = Date.now().toString(36).toUpperCase();
  return `TL-${issuing_country}-${certificate_type}-${timestamp}`;
};

// ─── generateCertificate ─────────────────────────────────────────────────────
// Called by POST /api/certificates/issue (Standards Officer)
// Returns: { certificate_number, qr_code_url, sha256_hash }
const generateCertificate = async ({
  document_id,
  trader_id,
  product_name,
  certificate_type,   // TBS | ZABS
  issuing_country,    // TZ | ZM
  valid_until,
  issued_by,
}) => {
  // 1. Generate unique certificate number
  const certificate_number = generateCertificateNumber(issuing_country, certificate_type);

  // 2. Build the payload that will be embedded in the QR code
  const payload = {
    certificate_number,
    document_id,
    trader_id,
    product_name,
    certificate_type,
    issuing_country,
    valid_until,
    issued_by,
    issued_at: new Date().toISOString(),
  };

  // 3. Generate SHA-256 hash of the payload for tamper detection
  const sha256_hash = generateHash(JSON.stringify(payload));

  // 4. Embed hash into payload so QR scan can verify integrity
  const signedPayload = { ...payload, sha256_hash };

  // 5. Encode payload as base64 JSON string
  const base64Payload = Buffer.from(JSON.stringify(signedPayload)).toString('base64');

  // 6. Generate QR code as a data URL (PNG)
  const qr_code_url = await QRCode.toDataURL(base64Payload, {
    errorCorrectionLevel: 'H',
    width: 300,
    margin: 2,
  });

  return {
    certificate_number,
    qr_code_url,    // stored in Supabase, embedded in PDF
    sha256_hash,    // stored in certificates table for tamper check at border
  };
};

// ─── generatePDF ─────────────────────────────────────────────────────────────
// Called by GET /api/certificates/:id/download
// Returns: Buffer (PDF)
const generatePDF = (certificate) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // ── Header ──────────────────────────────────────────────────────────────
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('TradeLens', { align: 'center' })
      .fontSize(12)
      .font('Helvetica')
      .text('Tanzania–Zambia Trade Compliance Certificate', { align: 'center' })
      .moveDown(0.5);

    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor('#cccccc')
      .stroke()
      .moveDown(1);

    // ── Certificate Details ──────────────────────────────────────────────────
    const field = (label, value) => {
      doc
        .font('Helvetica-Bold').fontSize(10).text(`${label}:`, { continued: true })
        .font('Helvetica').fontSize(10).text(`  ${value || 'N/A'}`)
        .moveDown(0.4);
    };

    field('Certificate Number', certificate.certificate_number);
    field('Certificate Type', certificate.certificate_type);           // TBS | ZABS
    field('Product Name', certificate.product_name);
    field('Trader', certificate.trader?.full_name || certificate.trader_id);
    field('Issuing Country', certificate.issuing_country === 'TZ' ? 'Tanzania' : 'Zambia');
    field('Destination Country', certificate.destination_country === 'TZ' ? 'Tanzania' : 'Zambia');
    field('Issued By', certificate.officer?.full_name || certificate.issued_by);
    field('Issue Date', new Date(certificate.created_at).toDateString());
    field('Valid Until', new Date(certificate.valid_until).toDateString());
    field('Status', certificate.status.toUpperCase());
    field('SHA-256 Integrity Hash', certificate.sha256_hash);

    doc.moveDown(1);

    // ── QR Code ─────────────────────────────────────────────────────────────
    if (certificate.qr_code_url) {
      // qr_code_url is a base64 data URL — strip the prefix to get raw base64
      const base64Data = certificate.qr_code_url.replace(/^data:image\/png;base64,/, '');
      const qrBuffer = Buffer.from(base64Data, 'base64');

      doc
        .font('Helvetica-Bold').fontSize(10)
        .text('Scan to Verify at Border Checkpoint:', { align: 'center' })
        .moveDown(0.5);

      doc.image(qrBuffer, {
        fit: [150, 150],
        align: 'center',
      });

      doc.moveDown(0.5)
        .font('Helvetica').fontSize(8)
        .fillColor('#888888')
        .text('This QR code contains a cryptographically signed payload.', { align: 'center' })
        .text('Verify using the TradeLens Customs Portal.', { align: 'center' });
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.moveDown(2)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor('#cccccc')
      .stroke()
      .moveDown(0.5)
      .fillColor('#aaaaaa')
      .fontSize(8)
      .text(
        'This is a digitally issued certificate from TradeLens. '
        + 'Any alteration invalidates the SHA-256 hash and will be detected at border verification.',
        { align: 'center' }
      );

    doc.end();
  });
};

module.exports = {
  generateCertificate,
  generatePDF,
};
