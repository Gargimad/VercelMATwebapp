// Load environment variables from .env file (for local development)
require('dotenv').config();

const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------------------------------------------------
// Initialize Supabase Client with Environment Safeguards
// -------------------------------------------------------------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("CRITICAL ERROR: Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in environment variables.");
}

// Fallback values prevent process crashes during startup if env vars are missing
const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseKey || 'placeholder-key'
);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// Config API endpoint to share public keys with frontend
// -------------------------------------------------------------
app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY
    });
});

// 1. Root route: Serves the Login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 2. Onboarding Page
app.get('/onboarding', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'onboarding.html'));
});

// 3. Auth Verification Route (Checks if logged-in user needs onboarding)
app.get('/auth/verify', async (req, res) => {
    const token = req.query.token;
    if (!token) return res.redirect('/');

    // Get user identity from token using Supabase client
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
        console.error("Auth verification error:", error ? error.message : "No user found");
        return res.redirect('/');
    }

    // Check if user already exists in custom "users" table
    const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

    if (profile) {
        // Already completed onboarding -> Send straight to dashboard!
        return res.redirect(`/dashboard?id=${user.id}`);
    } else {
        // First-time user -> Send to onboarding form with their Auth ID
        return res.redirect(`/onboarding?userId=${user.id}`);
    }
});

// 4. Save Onboarding Details
app.post('/submit-onboarding', async (req, res) => {
    const { userId, username, role, subject } = req.body;

    if (!userId || !username || !role || !subject) {
        return res.status(400).send('Missing required onboarding fields.');
    }

    const { error } = await supabase
        .from('users')
        .insert([{ id: userId, username, role, subject }]);

    if (error) {
        console.error('Supabase Insert Error:', error.message);
        return res.status(500).send('Could not save profile. Please try again.');
    }

    res.redirect(`/dashboard?id=${userId}`);
});

// 5. User Dashboard
app.get('/dashboard', async (req, res) => {
    const userId = req.query.id;

    if (!userId) {
        return res.redirect('/');
    }

    // Fetch user profile from Supabase
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (error || !user) {
        console.error('Supabase Fetch Error:', error ? error.message : 'User ID not found');
        return res.redirect('/');
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Dashboard - JCHS Mu Alpha Theta</title>
            <style>
                body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; color: #333; }
                .navbar { background-color: #007BFF; color: white; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; }
                .navbar h1 { margin: 0; font-size: 20px; }
                .user-badge { background-color: rgba(255, 255, 255, 0.2); padding: 5px 15px; border-radius: 20px; font-size: 14px; }
                .container { max-width: 1200px; margin: 30px auto; padding: 0 20px; display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
                .dashboard-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05); margin-bottom: 20px; }
                .dashboard-card h3 { margin-top: 0; color: #007BFF; border-bottom: 2px solid #f4f7f6; padding-bottom: 10px; }
                .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; background-color: #e3f2fd; color: #0d47a1; }
            </style>
        </head>
        <body>
            <div class="navbar">
                <h1>JCHS Mu Alpha Theta</h1>
                <div class="user-badge">${user.username} | <span class="badge">${user.role}</span></div>
            </div>
            <div class="container">
                <div>
                    <div class="dashboard-card">
                        <h3>Welcome, ${user.username}!</h3>
                        <p><strong>Registered Role:</strong> <span class="badge">${user.role}</span></p>
                        <p><strong>Selected Subject:</strong> ${user.subject}</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

module.exports = app;