// backend/src/routes/certificates.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const {
  auth,
  isTrader,
  isStandardsOfficer,
  isOfficer,
  isAdmin,
} = require('../middleware/auth');
const {
  validateCertificateIssue,
  validateCertificateId,
} = require('../middleware/validate');
const certificateService = require('../services/certificateService');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─── POST /api/certificates/issue ────────────────────────────────────────────
// Standards Officer only — Issue a digital certificate for a verified document
router.post('/issue', auth, isStandardsOfficer, validateCertificateIssue, async (req, res) => {
  try {
    const {
      document_id,
      trader_id,
      product_name,
      certificate_type, // TBS | ZABS
      valid_until,
      issuing_country,  // TZ | ZM
    } = req.body;

    // 1. Check document exists and is pending review
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, status, trader_id, product_id, destination_country')
      .eq('id', document_id)
      .single();

    if (docError || !document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found.',
      });
    }

    if (document.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Document is already ${document.status}. Only pending documents can be certified.`,
      });
    }

    // 2. Confirm officer is issuing for the correct corridor country
    if (req.user.country !== issuing_country) {
      return res.status(403).json({
        success: false,
        message: `You can only issue certificates for your country (${req.user.country}).`,
      });
    }

    // 3. Generate SHA-256 hash + QR payload via certificateService
    const { qr_code_url, sha256_hash, certificate_number } =
      await certificateService.generateCertificate({
        document_id,
        trader_id,
        product_name,
        certificate_type,
        issuing_country,
        valid_until,
        issued_by: req.user.id,
      });

    // 4. Insert certificate record
    const { data: certificate, error: certError } = await supabase
      .from('certificates')
      .insert([
        {
          certificate_number,
          document_id,
          trader_id,
          issued_by: req.user.id,
          product_name,
          certificate_type,
          issuing_country,
          destination_country: document.destination_country,
          valid_until,
          qr_code_url,
          sha256_hash,
          status: 'active',
        },
      ])
      .select()
      .single();

    if (certError) {
      return res.status(500).json({
        success: false,
        message: 'Failed to save certificate.',
      });
    }

    // 5. Update document status to approved
    await supabase
      .from('documents')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', document_id);

    // 6. Log to audit trail
    await supabase.from('verification_log').insert([
      {
        certificate_id: certificate.id,
        action: 'certificate_issued',
        performed_by: req.user.id,
        role: req.user.role,
        country: req.user.country,
        metadata: { certificate_number, certificate_type },
      },
    ]);

    return res.status(201).json({
      success: true,
      message: 'Certificate issued successfully.',
      data: certificate,
    });
  } catch (err) {
    console.error('Issue certificate error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── GET /api/certificates ────────────────────────────────────────────────────
// Trader — own certificates only
// Officer/Admin — all certificates (filterable)
router.get('/', auth, async (req, res) => {
  try {
    const { status, certificate_type, country, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('certificates')
      .select(
        `id, certificate_number, product_name, certificate_type,
         issuing_country, destination_country, status, valid_until,
         qr_code_url, created_at,
         trader:trader_id (id, full_name, email),
         officer:issued_by (id, full_name)`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Traders only see their own certificates
    if (req.user.role === 'trader') {
      query = query.eq('trader_id', req.user.id);
    }

    // Optional filters
    if (status) query = query.eq('status', status);
    if (certificate_type) query = query.eq('certificate_type', certificate_type);
    if (country) query = query.eq('issuing_country', country);

    const { data, error, count } = await query;

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error('List certificates error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── GET /api/certificates/:id ────────────────────────────────────────────────
// Trader — own certificate only
// Officer/Admin — any certificate
router.get('/:id', auth, validateCertificateId, async (req, res) => {
  try {
    const { id } = req.params;

    let query = supabase
      .from('certificates')
      .select(
        `*, 
         trader:trader_id (id, full_name, email, country),
         officer:issued_by (id, full_name, role),
         document:document_id (id, document_type, status)`
      )
      .eq('id', id)
      .single();

    const { data: certificate, error } = await query;

    if (error || !certificate) {
      return res.status(404).json({ success: false, message: 'Certificate not found.' });
    }

    // Traders can only access their own certificates
    if (req.user.role === 'trader' && certificate.trader_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This certificate does not belong to you.',
      });
    }

    return res.status(200).json({ success: true, data: certificate });
  } catch (err) {
    console.error('Get certificate error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── GET /api/certificates/:id/download ──────────────────────────────────────
// Trader — download own certificate PDF
// Officer/Admin — download any certificate PDF
router.get('/:id/download', auth, validateCertificateId, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: certificate, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !certificate) {
      return res.status(404).json({ success: false, message: 'Certificate not found.' });
    }

    // Traders can only download their own
    if (req.user.role === 'trader' && certificate.trader_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This certificate does not belong to you.',
      });
    }

    // Generate PDF buffer via certificateService
    const pdfBuffer = await certificateService.generatePDF(certificate);

    // Log download to audit trail
    await supabase.from('verification_log').insert([
      {
        certificate_id: certificate.id,
        action: 'certificate_downloaded',
        performed_by: req.user.id,
        role: req.user.role,
        country: req.user.country,
        metadata: { certificate_number: certificate.certificate_number },
      },
    ]);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="TradeLens_${certificate.certificate_number}.pdf"`
    );

    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Download certificate error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── PATCH /api/certificates/:id/revoke ──────────────────────────────────────
// Standards Officer or Admin — revoke an active certificate
router.patch('/:id/revoke', auth, isOfficer, validateCertificateId, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'A revocation reason (min 5 characters) is required.',
      });
    }

    const { data: certificate, error: fetchError } = await supabase
      .from('certificates')
      .select('id, status, certificate_number, trader_id')
      .eq('id', id)
      .single();

    if (fetchError || !certificate) {
      return res.status(404).json({ success: false, message: 'Certificate not found.' });
    }

    if (certificate.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `Certificate is already ${certificate.status}.`,
      });
    }

    const { data: revoked, error: revokeError } = await supabase
      .from('certificates')
      .update({
        status: 'revoked',
        revocation_reason: reason,
        revoked_by: req.user.id,
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (revokeError) {
      return res.status(500).json({ success: false, message: 'Failed to revoke certificate.' });
    }

    // Log to audit trail
    await supabase.from('verification_log').insert([
      {
        certificate_id: id,
        action: 'certificate_revoked',
        performed_by: req.user.id,
        role: req.user.role,
        country: req.user.country,
        metadata: { reason, certificate_number: certificate.certificate_number },
      },
    ]);

    return res.status(200).json({
      success: true,
      message: 'Certificate revoked successfully.',
      data: revoked,
    });
  } catch (err) {
    console.error('Revoke certificate error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── GET /api/certificates/:id/audit ─────────────────────────────────────────
// Officer/Admin only — full audit trail for a certificate
router.get('/:id/audit', auth, isOfficer, validateCertificateId, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: logs, error } = await supabase
      .from('verification_log')
      .select(
        `id, action, role, country, metadata, created_at,
         performed_by_user:performed_by (id, full_name, email)`
      )
      .eq('certificate_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (err) {
    console.error('Audit trail error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

module.exports = router;
