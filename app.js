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

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/onboarding', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'onboarding.html'));
});

app.get('/auth/verify', async (req, res) => {
    const token = req.query.token;
    if (!token) return res.redirect('/');

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.redirect('/');

    const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

    if (profile) {
        return res.redirect(`/dashboard?id=${user.id}`);
    } else {
        return res.redirect(`/onboarding?userId=${user.id}`);
    }
});

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

// -------------------------------------------------------------
// UPDATED DASHBOARD ROUTE (Renders dashboard.ejs)
// -------------------------------------------------------------
app.get('/dashboard', async (req, res) => {
    const userId = req.query.id;

    if (!userId) {
        return res.redirect('/');
    }

    // 1. Fetch User Profile
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (userError || !user) {
        console.error('User Fetch Error:', userError ? userError.message : 'User not found');
        return res.redirect('/');
    }

    // 2. Fetch User Sessions (or default to empty array if table doesn't exist yet)
    let sessions = [];
    const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId);

    if (!sessionError && sessionData) {
        sessions = sessionData;
    }

    // 3. Render dashboard.ejs and pass user & sessions variables to template
    res.render('dashboard', { user, sessions });
});

// Endpoint to handle new session creation from modal
app.post('/api/sessions', async (req, res) => {
    const { title, peer_name, datetime, location, userId } = req.body;

    const { data, error } = await supabase
        .from('sessions')
        .insert([{ title, peer_name, datetime, location, user_id: userId }]);

    if (error) {
        console.error("Error creating session:", error.message);
        return res.status(500).json({ error: "Failed to create session" });
    }

    res.status(200).json({ success: true });
});

app.get('/logout', (req, res) => {
    res.redirect('/');
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

module.exports = app;