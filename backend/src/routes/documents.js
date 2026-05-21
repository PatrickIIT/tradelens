// backend/src/routes/documents.js
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
  validateDocumentUpload,
  validateDocumentStatus,
} = require('../middleware/validate');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─── Allowed MIME types for document uploads ──────────────────────────────────
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ─── POST /api/documents/upload ───────────────────────────────────────────────
// Trader only — Upload once, reuse across both countries (BR-02)
router.post('/upload', auth, isTrader, validateDocumentUpload, async (req, res) => {
  try {
    const {
      product_id,
      document_type,
      destination_country, // TZ | ZM
      description,
    } = req.body;

    // 1. Verify product belongs to this trader
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, category')
      .eq('id', product_id)
      .eq('trader_id', req.user.id)
      .single();

    if (productError || !product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or does not belong to you.',
      });
    }

    // 2. Check for duplicate document type for same product + destination
    const { data: existing } = await supabase
      .from('documents')
      .select('id, status')
      .eq('trader_id', req.user.id)
      .eq('product_id', product_id)
      .eq('document_type', document_type)
      .eq('destination_country', destination_country)
      .in('status', ['pending', 'approved'])
      .single();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A ${document_type} for this product and destination is already ${existing.status}. No need to re-upload.`,
      });
    }

    // 3. Handle file upload to Supabase Storage
    const contentType = req.headers['content-type'];
    const fileBuffer = req.body.file; // base64 or raw buffer depending on your parser

    if (!fileBuffer) {
      return res.status(400).json({
        success: false,
        message: 'No file provided. Please attach a document.',
      });
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      return res.status(415).json({
        success: false,
        message: `Unsupported file type. Allowed: PDF, JPEG, PNG, WEBP.`,
      });
    }

    // Validate file size
    const fileSizeBytes = Buffer.byteLength(fileBuffer, 'base64');
    if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      return res.status(413).json({
        success: false,
        message: `File too large. Maximum allowed size is ${MAX_FILE_SIZE_MB}MB.`,
      });
    }

    // Build storage path: trader_id/product_id/document_type/timestamp.ext
    const ext = contentType.split('/')[1];
    const timestamp = Date.now();
    const storagePath = `${req.user.id}/${product_id}/${document_type}/${timestamp}.${ext}`;

    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(storagePath, Buffer.from(fileBuffer, 'base64'), {
        contentType,
        upsert: false,
      });

    if (storageError) {
      return res.status(500).json({
        success: false,
        message: 'File upload to storage failed.',
        detail: storageError.message,
      });
    }

    // 4. Get public/signed URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(storagePath);

    // 5. Insert document record
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert([
        {
          trader_id: req.user.id,
          product_id,
          document_type,
          destination_country,
          description: description || null,
          file_url: urlData.publicUrl,
          storage_path: storagePath,
          status: 'pending',
          uploaded_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (docError) {
      // Rollback: remove uploaded file if DB insert fails
      await supabase.storage.from('documents').remove([storagePath]);
      return res.status(500).json({
        success: false,
        message: 'Failed to save document record.',
      });
    }

    // 6. Log to audit trail
    await supabase.from('verification_log').insert([
      {
        action: 'document_uploaded',
        performed_by: req.user.id,
        role: req.user.role,
        country: req.user.country,
        metadata: {
          document_id: document.id,
          document_type,
          product_id,
          destination_country,
        },
      },
    ]);

    return res.status(201).json({
      success: true,
      message: 'Document uploaded successfully. Awaiting review.',
      data: document,
    });
  } catch (err) {
    console.error('Upload document error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── GET /api/documents ───────────────────────────────────────────────────────
// Trader — own documents only
// Officer/Admin — all documents (filterable)
router.get('/', auth, async (req, res) => {
  try {
    const {
      status,
      document_type,
      destination_country,
      product_id,
      page = 1,
      limit = 10,
    } = req.query;

    const offset = (page - 1) * limit;

    let query = supabase
      .from('documents')
      .select(
        `id, document_type, destination_country, status,
         description, file_url, uploaded_at, updated_at,
         trader:trader_id (id, full_name, email, country),
         product:product_id (id, name, category)`,
        { count: 'exact' }
      )
      .order('uploaded_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    // Traders only see their own documents
    if (req.user.role === 'trader') {
      query = query.eq('trader_id', req.user.id);
    }

    // Optional filters
    if (status) query = query.eq('status', status);
    if (document_type) query = query.eq('document_type', document_type);
    if (destination_country) query = query.eq('destination_country', destination_country);
    if (product_id) query = query.eq('product_id', product_id);

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
    console.error('List documents error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── GET /api/documents/checklist ────────────────────────────────────────────
// Trader only — compliance checklist: what's submitted, missing, approved (US-02)
router.get('/checklist', auth, isTrader, async (req, res) => {
  try {
    const { product_id, destination_country } = req.query;

    if (!product_id || !destination_country) {
      return res.status(400).json({
        success: false,
        message: 'product_id and destination_country are required.',
      });
    }

    // Required documents for Tanzania–Zambia agricultural corridor
    const REQUIRED_DOCS = [
      'phytosanitary_certificate',
      'certificate_of_origin',
      'packing_list',
      'commercial_invoice',
      'import_permit',
      'quality_inspection_report',
    ];

    const { data: submitted, error } = await supabase
      .from('documents')
      .select('id, document_type, status, uploaded_at, file_url')
      .eq('trader_id', req.user.id)
      .eq('product_id', product_id)
      .eq('destination_country', destination_country);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Map each required doc to its submission status
    const checklist = REQUIRED_DOCS.map((docType) => {
      const found = submitted.find((d) => d.document_type === docType);
      return {
        document_type: docType,
        status: found ? found.status : 'missing',        // pending | approved | rejected | missing
        document_id: found ? found.id : null,
        uploaded_at: found ? found.uploaded_at : null,
        file_url: found ? found.file_url : null,
      };
    });

    // Overall compliance colour: green | amber | red
    const approved = checklist.filter((d) => d.status === 'approved').length;
    const missing = checklist.filter((d) => d.status === 'missing').length;
    const rejected = checklist.filter((d) => d.status === 'rejected').length;

    let compliance_status = 'green';
    if (rejected > 0 || missing > 0) compliance_status = 'amber';
    if (missing >= REQUIRED_DOCS.length / 2 || rejected > 2) compliance_status = 'red';

    return res.status(200).json({
      success: true,
      data: {
        product_id,
        destination_country,
        compliance_status,        // green | amber | red (US-02)
        summary: {
          total_required: REQUIRED_DOCS.length,
          approved,
          pending: checklist.filter((d) => d.status === 'pending').length,
          rejected,
          missing,
        },
        checklist,
      },
    });
  } catch (err) {
    console.error('Checklist error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── GET /api/documents/:id ───────────────────────────────────────────────────
// Trader — own document only | Officer/Admin — any document
router.get('/:id', auth, validateDocumentStatus, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: document, error } = await supabase
      .from('documents')
      .select(
        `*, 
         trader:trader_id (id, full_name, email, country, phone),
         product:product_id (id, name, category)`
      )
      .eq('id', id)
      .single();

    if (error || !document) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    // Traders can only view their own documents
    if (req.user.role === 'trader' && document.trader_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This document does not belong to you.',
      });
    }

    return res.status(200).json({ success: true, data: document });
  } catch (err) {
    console.error('Get document error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── GET /api/documents/:id/status ───────────────────────────────────────────
// Trader — check own document review status (US-02)
router.get('/:id/status', auth, isTrader, validateDocumentStatus, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: document, error } = await supabase
      .from('documents')
      .select('id, document_type, status, destination_country, uploaded_at, updated_at, reviewer_notes')
      .eq('id', id)
      .eq('trader_id', req.user.id)
      .single();

    if (error || !document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or does not belong to you.',
      });
    }

    return res.status(200).json({ success: true, data: document });
  } catch (err) {
    console.error('Document status error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── PATCH /api/documents/:id/review ─────────────────────────────────────────
// Standards Officer only — approve or reject a document (US-04)
router.patch('/:id/review', auth, isStandardsOfficer, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewer_notes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "approved" or "rejected".',
      });
    }

    if (status === 'rejected' && (!reviewer_notes || reviewer_notes.trim().length < 10)) {
      return res.status(400).json({
        success: false,
        message: 'Reviewer notes (min 10 characters) are required when rejecting a document.',
      });
    }

    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('id, status, trader_id, document_type, destination_country')
      .eq('id', id)
      .single();

    if (fetchError || !document) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    if (document.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Document is already ${document.status}. Only pending documents can be reviewed.`,
      });
    }

    // Officer must belong to the same corridor country as the destination
    if (
      req.user.country !== document.destination_country &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: `You can only review documents destined for your country (${req.user.country}).`,
      });
    }

    const { data: updated, error: updateError } = await supabase
      .from('documents')
      .update({
        status,
        reviewer_notes: reviewer_notes || null,
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ success: false, message: 'Failed to update document status.' });
    }

    // Log to audit trail (BR-06)
    await supabase.from('verification_log').insert([
      {
        action: `document_${status}`,
        performed_by: req.user.id,
        role: req.user.role,
        country: req.user.country,
        metadata: {
          document_id: id,
          document_type: document.document_type,
          trader_id: document.trader_id,
          reviewer_notes: reviewer_notes || null,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      message: `Document ${status} successfully.`,
      data: updated,
    });
  } catch (err) {
    console.error('Review document error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── DELETE /api/documents/:id ────────────────────────────────────────────────
// Trader only — delete own pending document (cannot delete approved/rejected)
router.delete('/:id', auth, isTrader, validateDocumentStatus, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('id, status, trader_id, storage_path, document_type')
      .eq('id', id)
      .eq('trader_id', req.user.id)
      .single();

    if (fetchError || !document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or does not belong to you.',
      });
    }

    if (document.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot delete a document that is already ${document.status}.`,
      });
    }

    // Remove file from Supabase Storage
    if (document.storage_path) {
      await supabase.storage.from('documents').remove([document.storage_path]);
    }

    // Delete document record
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return res.status(500).json({ success: false, message: 'Failed to delete document.' });
    }

    // Log to audit trail
    await supabase.from('verification_log').insert([
      {
        action: 'document_deleted',
        performed_by: req.user.id,
        role: req.user.role,
        country: req.user.country,
        metadata: {
          document_id: id,
          document_type: document.document_type,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      message: 'Document deleted successfully.',
    });
  } catch (err) {
    console.error('Delete document error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

module.exports = router;
