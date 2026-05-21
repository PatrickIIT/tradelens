// backend/middleware/auth.js
const { createClient } = require('@supabase/supabase-js');

// ─── Supabase Admin Client ───────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // service role key for server-side auth
);

// ─── Verify JWT Token (Supabase Auth) ───────────────────────────────────────
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Authorization denied.',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token with Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Token is invalid or expired.',
      });
    }

    // Fetch user profile with role from your users table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, full_name, email, role, country, is_active')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({
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

    // Attach user + role to request
    req.user = {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,           // trader | standards_officer | customs_officer | admin
      country: profile.country,     // TZ | ZM
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.',
    });
  }
};

// ─── Role Guard Middleware ───────────────────────────────────────────────────
/**
 * Usage: requireRole('admin')
 *        requireRole('standards_officer', 'admin')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthenticated. Please log in.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(', ')}.`,
      });
    }

    next();
  };
};

// ─── Country Guard Middleware ─────────────────────────────────────────────────
/**
 * Restrict access to officers operating in a specific country (TZ or ZM)
 * Usage: requireCountry('TZ')
 */
const requireCountry = (...countries) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthenticated. Please log in.',
      });
    }

    if (!countries.includes(req.user.country)) {
      return res.status(403).json({
        success: false,
        message: `Access restricted to corridor countries: ${countries.join(', ')}.`,
      });
    }

    next();
  };
};

// ─── Convenience Role Shorthands ─────────────────────────────────────────────
const isTrader          = requireRole('trader');
const isStandardsOfficer = requireRole('standards_officer');
const isCustomsOfficer  = requireRole('customs_officer');
const isAdmin           = requireRole('admin');
const isOfficer         = requireRole('standards_officer', 'customs_officer', 'admin');

// ─── Exports ─────────────────────────────────────────────────────────────────
module.exports = {
  auth,
  requireRole,
  requireCountry,
  isTrader,
  isStandardsOfficer,
  isCustomsOfficer,
  isAdmin,
  isOfficer,
};
