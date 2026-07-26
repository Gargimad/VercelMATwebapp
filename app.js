require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Root route now serves LOGIN page first
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 2. Serve onboarding page
app.get('/onboarding', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'onboarding.html'));
});

// 3. Auth Verification Route (Checks if user completed onboarding)
app.get('/auth/verify', async (req, res) => {
    const token = req.query.token;
    if (!token) return res.redirect('/');

    // Get user identity from token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.redirect('/');

    // Check if user exists in the custom `users` table
    const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

    if (profile) {
        // Already completed onboarding -> Go straight to dashboard!
        return res.redirect(`/dashboard?id=${user.id}`);
    } else {
        // Needs onboarding -> Send to onboarding form with their Auth ID attached
        return res.redirect(`/onboarding?userId=${user.id}`);
    }
});

// 4. Save Onboarding Details
app.post('/submit-onboarding', async (req, res) => {
    const { userId, username, role, subject } = req.body;

    if (!userId || !username || !role || !subject) {
        return res.status(400).send('Missing required fields.');
    }

    const { error } = await supabase
        .from('users')
        .insert([{ id: userId, username, role, subject }]);

    if (error) {
        console.error('Insert Error:', error.message);
        return res.status(500).send('Could not save onboarding profile.');
    }

    res.redirect(`/dashboard?id=${userId}`);
});

// 5. Dashboard Page
app.get('/dashboard', async (req, res) => {
    const userId = req.query.id;
    if (!userId) return res.redirect('/');

    const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (!user) return res.redirect('/');

    res.send(`<h1>Welcome to your Dashboard, ${user.username}!</h1><p>Role: ${user.role} | Subject: ${user.subject}</p>`);
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

module.exports = app;