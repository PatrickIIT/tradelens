// backend/src/routes/auth.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { validateRegister, validateLogin } = require('../middleware/validate');
const { auth, isAdmin } = require('../middleware/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─── POST /api/auth/register ─────────────────────────────────────────────────
// Public — Trader self-registration
router.post('/register', validateRegister, async (req, res) => {
  try {
    const { email, password, full_name, role, country, phone } = req.body;

    // Only traders can self-register; officers/admins are created by admin
    if (role !== 'trader') {
      return res.status(403).json({
        success: false,
        message: 'Only traders can self-register. Contact your administrator.',
      });
    }

    // 1. Create auth user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm for MVP
    });

    if (authError) {
      return res.status(400).json({
        success: false,
        message: authError.message,
      });
    }

    // 2. Insert profile into users table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .insert([
        {
          id: authData.user.id, // match Supabase Auth UUID
          email,
          full_name,
          role,
          country,
          phone: phone || null,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (profileError) {
      // Rollback: delete auth user if profile insert fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({
        success: false,
        message: 'Failed to create user profile.',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Registration successful. You can now log in.',
      data: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        country: profile.country,
      },
    });
  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
// Public — All roles
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Sign in via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Fetch profile with role and country
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, full_name, email, role, country, phone, is_active')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    // Block deactivated accounts
    if (!profile.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Contact your administrator.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
        user: {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          role: profile.role,       // trader | standards_officer | customs_officer | admin
          country: profile.country, // TZ | ZM
        },
      },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
// Protected — All roles
router.post('/logout', auth, async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];

    const { error } = await supabase.auth.admin.signOut(token);

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    console.error('Logout error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── POST /api/auth/refresh ──────────────────────────────────────────────────
// Public — Refresh expired access token
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required.',
      });
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token });

    if (error) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is invalid or expired. Please log in again.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (err) {
    console.error('Refresh error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
// Protected — All roles — return current user profile
router.get('/me', auth, async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('users')
      .select('id, full_name, email, role, country, phone, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !profile) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }

    return res.status(200).json({ success: true, data: profile });
  } catch (err) {
    console.error('Me error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── PATCH /api/auth/me ──────────────────────────────────────────────────────
// Protected — All roles — update own profile
router.patch('/me', auth, async (req, res) => {
  try {
    const { full_name, phone } = req.body;

    const { data: updated, error } = await supabase
      .from('users')
      .update({ full_name, phone, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated.',
      data: updated,
    });
  } catch (err) {
    console.error('Update profile error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── POST /api/auth/users ────────────────────────────────────────────────────
// Admin only — Create standards_officer or customs_officer accounts
router.post('/users', auth, isAdmin, async (req, res) => {
  try {
    const { email, password, full_name, role, country, phone } = req.body;

    if (!['standards_officer', 'customs_officer', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Admin can only create: standards_officer, customs_officer, or admin accounts.',
      });
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return res.status(400).json({ success: false, message: authError.message });
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email,
          full_name,
          role,
          country,
          phone: phone || null,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (profileError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ success: false, message: 'Failed to create officer profile.' });
    }

    return res.status(201).json({
      success: true,
      message: `${role} account created successfully.`,
      data: profile,
    });
  } catch (err) {
    console.error('Create user error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ─── PATCH /api/auth/users/:id/deactivate ───────────────────────────────────
// Admin only — Deactivate any user account
router.patch('/users/:id/deactivate', auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('users')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(200).json({
      success: true,
      message: 'User account deactivated.',
      data,
    });
  } catch (err) {
    console.error('Deactivate error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

module.exports = router;
