// Load environment variables
require('dotenv').config();

const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Set up EJS Templating Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Initialize Standard & Admin Supabase Clients
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("CRITICAL ERROR: Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY.");
}

// Standard client for public operations
const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co', 
    supabaseKey || 'placeholder-key'
);

// Admin client using Service Role Key to bypass RLS policies
const supabaseAdmin = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseServiceKey || supabaseKey || 'placeholder-key'
);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Config API endpoint
app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY
    });
});

// =========================================================================
// PUBLIC & AUTHENTICATION ROUTES
// =========================================================================

// Login Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Onboarding Page
app.get('/onboarding', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'onboarding.html'));
});

// Pending Approval Waiting Screen
app.get('/pending', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Account Pending Approval</title>
            <link rel="stylesheet" href="/style.css">
        </head>
        <body style="display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: sans-serif; background-color: #f4f6f8; margin: 0;">
            <div class="card" style="text-align: center; max-width: 450px; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
                <div style="font-size: 48px; margin-bottom: 15px;">⏳</div>
                <h2 style="margin-top: 0; color: #1a202c;">Account Pending</h2>
                <p style="color: #4a5568; font-size: 16px; line-height: 1.5; margin: 20px 0;">
                    Please hold on while an administrator approves your account. Come back within 24 hours to view your dashboard!
                </p>
                <a href="/logout" style="display: inline-block; margin-top: 10px; text-decoration: none; color: #3182ce; font-weight: 600; font-size: 14px;">Return to Login</a>
            </div>
        </body>
        </html>
    `);
});

// Auth Verification Route
app.get('/auth/verify', async (req, res) => {
    const token = req.query.token;
    if (!token) return res.redirect('/');

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.redirect('/');

    const { data: profile } = await supabase
        .from('users')
        .select('id, role, status')
        .eq('id', user.id)
        .maybeSingle();

    if (profile) {
        if (profile.status === 'pending') {
            return res.redirect('/pending');
        } else if (profile.status === 'rejected') {
            return res.status(403).send('Your registration request was not approved.');
        }

        // Route admins to admin portal, students to dashboard
        if (profile.role === 'admin') {
            return res.redirect(`/admin?id=${user.id}`);
        } else {
            return res.redirect(`/dashboard?id=${user.id}`);
        }
    } else {
        return res.redirect(`/onboarding?userId=${user.id}`);
    }
});

// Submit Onboarding Form Route
app.post('/submit-onboarding', async (req, res) => {
    const { userId, username, role, grade, subject } = req.body;

    if (!userId || !username || !role || !grade || !subject) {
        console.error("Missing onboarding values:", { userId, username, role, grade, subject });
        return res.status(400).send('Missing required onboarding fields.');
    }

    // Admins are auto-approved; tutors and tutees start as 'pending'
    const accountStatus = (role === 'admin') ? 'active' : 'pending';

    // Insert user record using supabaseAdmin to bypass RLS restrictions
    const { error } = await supabaseAdmin
        .from('users')
        .insert([{ 
            id: userId, 
            username, 
            role, 
            grade, 
            subject, 
            status: accountStatus 
        }]);

    if (error) {
        console.error('Supabase Insert Error:', error.message);
        return res.status(500).send('Could not save profile. Please try again.');
    }

    if (role === 'admin') {
        res.redirect(`/admin?id=${userId}`);
    } else {
        res.redirect('/pending');
    }
});

// =========================================================================
// STUDENT / TUTOR ROUTES
// =========================================================================

// Student Dashboard Route
app.get('/dashboard', async (req, res) => {
    const userId = req.query.id;

    if (!userId) {
        return res.redirect('/');
    }

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (userError || !user) {
        console.error('User Fetch Error:', userError ? userError.message : 'User not found');
        return res.redirect('/');
    }

    // Block non-active users
    if (user.status === 'pending') {
        return res.redirect('/pending');
    } else if (user.status === 'rejected') {
        return res.status(403).send('Your account access has been restricted.');
    }

    let sessions = [];
    const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId);

    if (!sessionError && sessionData) {
        sessions = sessionData;
    }

    res.render('dashboard', { user, sessions });
});

// Create Tutoring Session Endpoint
app.post('/api/sessions', async (req, res) => {
    const { title, peer_name, datetime, location, userId } = req.body;

    const { error } = await supabase
        .from('sessions')
        .insert([{ title, peer_name, datetime, location, user_id: userId }]);

    if (error) {
        console.error("Error creating session:", error.message);
        return res.status(500).json({ error: "Failed to create session" });
    }

    res.status(200).json({ success: true });
});

// =========================================================================
// PROTECTED ADMIN ROUTES
// =========================================================================

// Helper function to check if a user is an active admin
// DEBUG HELPER: Checks admin status with detailed terminal logs
async function verifyIsActiveAdmin(adminId) {
    console.log('\n--- DEBUG: VERIFY ADMIN ---');
    console.log('Received adminId from request:', adminId);

    if (!adminId) {
        console.error('❌ FAIL: adminId is null or undefined!');
        return false;
    }

    const { data: adminUser, error } = await supabaseAdmin
        .from('users')
        .select('id, role, status')
        .eq('id', adminId)
        .maybeSingle();

    if (error) {
        console.error('❌ FAIL: Supabase query error while verifying admin:', error.message);
        return false;
    }

    if (!adminUser) {
        console.error(`❌ FAIL: No user row found in Supabase matching id: "${adminId}"`);
        return false;
    }

    console.log('Found user record in database:', adminUser);

    if (adminUser.role !== 'admin') {
        console.error(`❌ FAIL: User role is "${adminUser.role}", expected "admin"`);
        return false;
    }

    if (adminUser.status !== 'active') {
        console.error(`❌ FAIL: User status is "${adminUser.status}", expected "active"`);
        return false;
    }

    console.log('✅ SUCCESS: Admin identity verified!');
    return true;
}

// DEBUG ENDPOINT: Update User Status
app.post('/api/users/update-status', async (req, res) => {
    console.log('\n======================================');
    console.log('RECEIVED STATUS UPDATE REQUEST');
    console.log('Payload:', req.body);

    const { userId, status, adminId } = req.body;

    // 1. Verify Admin Permissions
    const isAdmin = await verifyIsActiveAdmin(adminId);
    if (!isAdmin) {
        console.error('❌ Request rejected: verifyIsActiveAdmin returned false');
        return res.status(403).json({ error: 'Permission denied. Active admin rights required.' });
    }

    // 2. Validate Input Parameters
    if (!userId || !['active', 'rejected', 'pending'].includes(status)) {
        console.error('❌ Request rejected: Invalid userId or status value');
        return res.status(400).json({ error: 'Invalid user or status value.' });
    }

    // 3. Update Status in Supabase
    console.log(`Attempting database update: Setting user "${userId}" status to "${status}"...`);
    const { data, error } = await supabaseAdmin
        .from('users')
        .update({ status })
        .eq('id', userId)
        .select();

    if (error) {
        console.error('❌ FAIL: Supabase update query error:', error.message);
        return res.status(500).json({ error: 'Failed to update user status in database: ' + error.message });
    }

    console.log('✅ SUCCESS: Database updated successfully!', data);
    res.json({ success: true, message: `User status updated to ${status}` });
});

// Protected API Endpoint to Completely Delete User (Auth & DB)
app.post('/api/users/delete', async (req, res) => {
    const { userId, adminId } = req.body;

    const isAdmin = await verifyIsActiveAdmin(adminId);
    if (!isAdmin) {
        return res.status(403).json({ error: 'Permission denied. Active admin rights required.' });
    }

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required.' });
    }

    try {
        // 1. Delete user from Supabase Auth
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authError) console.warn('Auth deletion note:', authError.message);

        // 2. Delete user from public.users table
        const { error: dbError } = await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', userId);

        if (dbError) throw dbError;

        res.json({ success: true, message: 'User deleted successfully.' });
    } catch (err) {
        console.error('Delete User Error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to delete user.' });
    }
});

// Logout Route
app.get('/logout', (req, res) => {
    res.redirect('/');
});

// Start Server
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

module.exports = app;