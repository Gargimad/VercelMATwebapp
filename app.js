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

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("CRITICAL ERROR: Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY.");
}

const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co', 
    supabaseKey || 'placeholder-key'
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
        <body style="display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: sans-serif; background-color: #f4f6f8;">
            <div class="card" style="text-align: center; max-width: 400px; padding: 30px; background: white; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                <h2>⏳ Approval Pending</h2>
                <p>Your account has been submitted for review! An officer needs to approve your registration before you can access the dashboard.</p>
                <p>Please check back later.</p>
                <a href="/logout" style="display: inline-block; margin-top: 15px; text-decoration: none; color: #007bff; font-weight: bold;">Return to Login</a>
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
        .select('id, status')
        .eq('id', user.id)
        .maybeSingle();

    if (profile) {
        if (profile.status === 'pending') {
            return res.redirect('/pending');
        } else if (profile.status === 'rejected') {
            return res.status(403).send('Your registration request was not approved.');
        }
        return res.redirect(`/dashboard?id=${user.id}`);
    } else {
        return res.redirect(`/onboarding?userId=${user.id}`);
    }
});

// Submit Onboarding Form Route
// Submit Onboarding Form Route
app.post('/submit-onboarding', async (req, res) => {
    const { userId, username, role, grade, subject } = req.body;

    if (!userId || !username || !role || !grade || !subject) {
        console.error("Missing onboarding values:", { userId, username, role, grade, subject });
        return res.status(400).send('Missing required onboarding fields.');
    }

    // Admins are auto-approved; tutors and tutees start as 'pending'
    const accountStatus = (role === 'admin') ? 'active' : 'pending';

    // Insert user profile into Supabase
    const { error } = await supabase
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

    // Redirect admins directly to the admin portal, others to pending screen
    if (role === 'admin') {
        res.redirect(`/admin?id=${userId}`);
    } else {
        res.redirect('/pending');
    }
});

// =========================================================================
// DASHBOARD & STUDENT ROUTES
// =========================================================================

// Student Dashboard Route
app.get('/dashboard', async (req, res) => {
    const userId = req.query.id;

    if (!userId) {
        return res.redirect('/');
    }

    // Fetch User Profile
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

    // Fetch User Sessions
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

// Create Tutoring Session Route
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
// ADMIN ROUTES
// =========================================================================

// Admin Dashboard View Route
app.get('/admin', async (req, res) => {
    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching users for admin:', error.message);
        return res.status(500).send('Error loading admin portal.');
    }

    res.render('admin', { users });
});

// Admin Update User Status API Endpoint (Approve / Reject)
app.post('/api/users/update-status', async (req, res) => {
    const { userId, status } = req.body;

    if (!userId || !['active', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'Invalid user or status value.' });
    }

    const { error } = await supabase
        .from('users')
        .update({ status })
        .eq('id', userId);

    if (error) {
        console.error('Failed to update user status:', error.message);
        return res.status(500).json({ error: 'Failed to update user status.' });
    }

    res.json({ success: true, message: `User status successfully updated to ${status}` });
});

// Logout Route
app.get('/logout', (req, res) => {
    res.redirect('/');
});

// Server Start
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

module.exports = app;