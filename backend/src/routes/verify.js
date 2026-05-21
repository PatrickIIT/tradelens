// backend/src/routes/verify.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const {
  auth,
  isCustomsOfficer,
  isOfficer,
  isAdmin,
} = require('../middleware/auth');
const {
  validateQRVerify,
  validateIDVerify,
} = require('../middleware/validate');
const { verifyHash } = require('../utils/hash');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─── Helper: build verification result ───────────────────────────────────────
const buildVerificationResult = (certificate) => {
  const now = new Date();
  const expiry = new Date(certificate.valid_until);
  const isExpired = expiry < now;
  const isRevoked = certificate.status === 'revoked';
  const isActive = certificate.status === 'active' && !isExpired;

  let verification_status = 'valid';
  let status_colour = 'green';
  let status_message = 'Certificate is valid and recognised on the Tanzania–Zambia corridor.';

  if (isRevoked) {
    verification_status = 'revoked';
    status_colour = 'red';
    status_message = `Certificate was revoked. Reason: ${certificate.revocation_reason || 'Not specified'}.`;
  } else if (isExpired) {
    verification_status = 'expired';
    status_colour = 'red';
    status_message = `Certificate expired on ${expiry.toDateString()}.`;
  } else if (!isActive) {
    verification_status = 'invalid';
    status_colour = 'red';
    status_message = 'Certificate is not active.';
  }

  return {
    verification_status,           // valid | expired | revoked | invalid
    status_colour,                 // green | red
    status_message,
    certificate: {
      id: certificate.id,
      certificate_number: certificate.certificate_number,
      product_name: certificate.product_name,
      certificate_type: certificate.certificate_type,   // TBS | ZABS
      issuing_country: certificate.issuing_country,     // TZ | ZM
      destination_country: certificate.destination_country,
      valid_until: certificate.valid_until,
      issued_at: certificate.created_at,
      status: certificate.status,
      trader: certificate.trader,
      issued_by: certificate.officer,
      revocation_reason: certificate.revocation_reason || null,
      revoked_at: certificate.revoked_at || null,
    },
  };
};

// ─── POST /api/verify/qr ──────────────────────────────────────────────────────
// Customs Officer only — scan QR code, verify in under 30 seconds (BR-03, US-05)
router.post('/qr', auth, isCustomsOfficer, validateQRVerify, async (req, res) => {
  const startTime = Date.now();

  try {
    const { qr_payload } = req.body;

    // 1. Decode QR payload (base64 encoded JSON from certificateService)
    let decoded;
    try {
      decoded = JSON.parse(Buffer.from(qr_payload, 'base64').toString('utf8'));
    } catch {
      return res.status(400).json({
        success: false,
        message: 'QR code is malformed or unreadable.',
      });
    }

    const { certificate_id, certificate_number, sha256_hash } = decoded;

    if (!certificate_id || !certificate_number || !sha256_hash) {
      return res.status(400).json({
        success: false,
        message: 'QR payload is missing required fields.',
      });
    }

    // 2. Fetch certificate from DB
    const { data: certificate, error } = await supabase
      .from('certificates')
      .select(
        `*, 
         trader:trader_id (id, full_name, email, country, phone),
         officer:issued_by (id, full_name, role)`
      )
      .eq('id', certificate_id)
      .eq('certificate_number', certificate_number)
      .single();

    if (error || !certificate) {
      // Log failed attempt
      await supabase.from('verification_log').insert([
        {
          action: 'verification_failed_qr',
          performed_by: req.user.id,
          role: req.user.role,
          country: req.user.country,
          metadata: {
            qr_certificate_id: certificate_id,
            reason: 'Certificate not found in registry',
          },
        },
      ]);

      return res.status(404).json({
        success: false,
        verification_status: 'not_found',
        status_colour: 'red',
        message: 'Certificate not found in the TradeLens registry.',
      });
    }

    // 3. SHA-256 tamper check — verify QR hash matches stored hash
    const hashValid = verifyHash(
      {
        certificate_id: certificate.id,
        certificate_number: certificate.certificate_number,
        trader_id: certificate.trader_id,
        product_name: certificate.product_name,
        valid_until: certificate.valid_until,
      },
      sha256_hash
    );

    if (!hashValid) {
      // Log tamper attempt
      await supabase.from('verification_log').insert([
        {
          certificate_id: certificate.id,
          action: 'verification_tamper_detected',
          performed_by: req.user.id,
          role: req.user.role,
          country: req.user.country,
          metadata: {
            certificate_number,
            reason: 'SHA-256 hash mismatch — possible document tampering',
          },
        },
      ]);

      return res.status(200).json({
        success: true,
        verification_status: 'tampered',
        status_colour: 'red',
        status_message: 'Certificate hash mismatch. This document may have been tampered with.',
        certificate: { certificate_number, id: certificate.id },
      });
    }

    // 4. Build result (valid | expired | revoked | invalid)
    const result = buildVerificationResult(certificate);

    // 5. Log successful verification to audit trail (BR-06)
    await supabase.from('verification_log').insert([
      {
        certificate_id: certificate.id,
        action: 'verification_qr_success',
        performed_by: req.user.id,
        role: req.user.role,
        country: req.user.country,
        metadata: {
          certificate_number,
          verification_status: result.verification_status,
          response_ms: Date.now() - startTime,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      response_ms: Date.now() - startTime,  // target < 30,000ms (BR-03)
      ...result,
    });
  } catch (err) {
    console.error('QR verify error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── GET /api/verify/search ───────────────────────────────────────────────────
// Customs Officer only — search by certificate ID or trader ID (US-05, US-06)
router.get('/search', auth, isCustomsOfficer, validateIDVerify, async (req, res) => {
  const startTime = Date.now();

  try {
    const { certificate_id, trader_id, certificate_number } = req.query;

    if (!certificate_id && !trader_id && !certificate_number) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one search param: certificate_id, trader_id, or certificate_number.',
      });
    }

    let query = supabase
      .from('certificates')
      .select(
        `*, 
         trader:trader_id (id, full_name, email, country, phone),
         officer:issued_by (id, full_name, role),
         document:document_id (id, document_type, status)`
      );

    if (certificate_id) query = query.eq('id', certificate_id);
    if (trader_id) query = query.eq('trader_id', trader_id);
    if (certificate_number) query = query.ilike('certificate_number', `%${certificate_number}%`);

    const { data: certificates, error } = await query;

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    if (!certificates || certificates.length === 0) {
      return res.status(404).json({
        success: false,
        verification_status: 'not_found',
        status_colour: 'red',
        message: 'No certificates found matching your search.',
      });
    }

    // Build verification result for each certificate found
    const results = certificates.map((cert) => buildVerificationResult(cert));

    // Log search to audit trail
    await supabase.from('verification_log').insert([
      {
        action: 'verification_search',
        performed_by: req.user.id,
        role: req.user.role,
        country: req.user.country,
        metadata: {
          search_params: { certificate_id, trader_id, certificate_number },
          results_count: results.length,
          response_ms: Date.now() - startTime,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      response_ms: Date.now() - startTime,
      total: results.length,
      data: results,
    });
  } catch (err) {
    console.error('Search verify error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── GET /api/verify/trader/:trader_id ───────────────────────────────────────
// Customs Officer only — view all certificates for a trader at border (US-06)
router.get('/trader/:trader_id', auth, isCustomsOfficer, async (req, res) => {
  try {
    const { trader_id } = req.params;

    // Fetch trader profile
    const { data: trader, error: traderError } = await supabase
      .from('users')
      .select('id, full_name, email, country, phone, is_active')
      .eq('id', trader_id)
      .eq('role', 'trader')
      .single();

    if (traderError || !trader) {
      return res.status(404).json({
        success: false,
        message: 'Trader not found in the TradeLens registry.',
      });
    }

    // Fetch all certificates for this trader
    const { data: certificates, error: certError } = await supabase
      .from('certificates')
      .select(
        `id, certificate_number, product_name, certificate_type,
         issuing_country, destination_country, status,
         valid_until, created_at, qr_code_url,
         officer:issued_by (id, full_name)`
      )
      .eq('trader_id', trader_id)
      .order('created_at', { ascending: false });

    if (certError) {
      return res.status(500).json({ success: false, message: certError.message });
    }

    // Summarise compliance across all certificates
    const active = certificates.filter((c) => c.status === 'active').length;
    const expired = certificates.filter(
      (c) => c.status === 'active' && new Date(c.valid_until) < new Date()
    ).length;
    const revoked = certificates.filter((c) => c.status === 'revoked').length;

    // Log trader lookup
    await supabase.from('verification_log').insert([
      {
        action: 'verification_trader_lookup',
        performed_by: req.user.id,
        role: req.user.role,
        country: req.user.country,
        metadata: {
          trader_id,
          certificates_found: certificates.length,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        trader,
        summary: {
          total_certificates: certificates.length,
          active,
          expired,
          revoked,
        },
        certificates,
      },
    });
  } catch (err) {
    console.error('Trader lookup error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── GET /api/verify/certificate/:id/audit ───────────────────────────────────
// Customs Officer / Admin — view full audit trail at border checkpoint (US-06)
router.get('/certificate/:id/audit', auth, isOfficer, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: certificate, error: certError } = await supabase
      .from('certificates')
      .select('id, certificate_number, product_name, status')
      .eq('id', id)
      .single();

    if (certError || !certificate) {
      return res.status(404).json({ success: false, message: 'Certificate not found.' });
    }

    const { data: logs, error: logError } = await supabase
      .from('verification_log')
      .select(
        `id, action, role, country, metadata, created_at,
         performed_by_user:performed_by (id, full_name, email)`
      )
      .eq('certificate_id', id)
      .order('created_at', { ascending: true });

    if (logError) {
      return res.status(500).json({ success: false, message: logError.message });
    }

    return res.status(200).json({
      success: true,
      data: {
        certificate: {
          id: certificate.id,
          certificate_number: certificate.certificate_number,
          product_name: certificate.product_name,
          status: certificate.status,
        },
        audit_trail: logs,
        total_events: logs.length,
      },
    });
  } catch (err) {
    console.error('Audit trail error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── GET /api/verify/stats ────────────────────────────────────────────────────
// Officer / Admin only — verification stats for admin panel (US-07)
router.get('/stats', auth, isOfficer, async (req, res) => {
  try {
    const { country, from_date, to_date } = req.query;

    let query = supabase
      .from('verification_log')
      .select('action, country, created_at', { count: 'exact' });

    if (country) query = query.eq('country', country);
    if (from_date) query = query.gte('created_at', from_date);
    if (to_date) query = query.lte('created_at', to_date);

    const { data: logs, error } = await query;

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Aggregate by action type
    const stats = logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {});

    // By country breakdown
    const byCountry = logs.reduce((acc, log) => {
      if (!acc[log.country]) acc[log.country] = 0;
      acc[log.country]++;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: {
        total_verifications: logs.length,
        by_action: stats,
        by_country: byCountry,
        filters_applied: { country, from_date, to_date },
      },
    });
  } catch (err) {
    console.error('Verify stats error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

module.exports = router;
