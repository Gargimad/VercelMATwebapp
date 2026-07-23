// Load environment variables locally (ignored automatically in production)
require('dotenv').config();

const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Route: Onboarding Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'onboarding.html'));
});

// Route: Submit Onboarding & Save or Fetch Existing User
// Route: Submit Onboarding & Save or Fetch Existing User
app.post('/submit-onboarding', async (req, res) => {
    const { username, role, subject } = req.body;

    if (!username || !role || !subject) {
        return res.status(400).send('Missing required onboarding fields.');
    }

    // 1. Try inserting the new user directly
    const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{ username, role, subject }])
        .select()
        .single();

    // 2. If there's no error, redirect the newly created user!
    if (!insertError && newUser) {
        return res.redirect(`/dashboard?id=${newUser.id}`);
    }

    // 3. If insertion failed because the username ALREADY exists (Error code 23505)
    if (insertError && insertError.code === '23505') {
        // Fetch the existing user's ID
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .single();

        if (existingUser) {
            return res.redirect(`/dashboard?id=${existingUser.id}`);
        }
    }

    // 4. Handle any other genuine database errors
    console.error('Supabase Error:', insertError?.message);
    return res.status(500).send('Failed to save profile. Please try again.');
});
// Route: User Dashboard (Retrieves user from Supabase)
app.get('/dashboard', async (req, res) => {
    const userId = req.query.id;

    if (!userId) {
        return res.redirect('/');
    }

    // Fetch user profile from Supabase by ID
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (error || !user) {
        console.error('Supabase Fetch Error:', error ? error.message : 'User ID not found');
        return res.redirect('/');
    }

    // Dynamic HTML Dashboard response
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Dashboard - JCHS Mu Alpha Theta</title>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background-color: #f4f7f6;
                    color: #333;
                }
                .navbar {
                    background-color: #007BFF;
                    color: white;
                    padding: 15px 30px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .navbar h1 { margin: 0; font-size: 20px; }
                .user-badge {
                    background-color: rgba(255, 255, 255, 0.2);
                    padding: 5px 15px;
                    border-radius: 20px;
                    font-size: 14px;
                }
                .container {
                    max-width: 1200px;
                    margin: 30px auto;
                    padding: 0 20px;
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 20px;
                }
                @media (max-width: 768px) {
                    .container { grid-template-columns: 1fr; }
                }
                .dashboard-card {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
                    margin-bottom: 20px;
                }
                .dashboard-card h3 {
                    margin-top: 0;
                    color: #007BFF;
                    border-bottom: 2px solid #f4f7f6;
                    padding-bottom: 10px;
                }
                .badge {
                    display: inline-block;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                    text-transform: uppercase;
                }
                .badge-tutor { background-color: #e3f2fd; color: #0d47a1; }
                .badge-tutee { background-color: #e8f5e9; color: #1b5e20; }
                .badge-both { background-color: #f3e5f5; color: #4a148c; }
                .badge-admin { background-color: #ffebee; color: #b71c1c; }
            </style>
        </head>
        <body>
            <div class="navbar">
                <h1>JCHS Mu Alpha Theta</h1>
                <div class="user-badge">
                    ${user.username} | <span class="badge badge-${user.role}">${user.role}</span>
                </div>
            </div>
            <div class="container">
                <div>
                    <div class="dashboard-card">
                        <h3>Welcome back, ${user.username}!</h3>
                        <p><strong>Registered Role:</strong> <span class="badge badge-${user.role}">${user.role}</span></p>
                        <p><strong>Selected Subject:</strong> ${user.subject}</p>
                    </div>

                    <div class="dashboard-card">
                        <h3>Upcoming Tutoring Sessions</h3>
                        <p style="color: #666; font-size: 14px;">No upcoming sessions scheduled yet for ${user.subject}.</p>
                    </div>
                </div>

                <div>
                    <div class="dashboard-card">
                        <h3>Platform Announcements</h3>
                        <p style="font-size: 14px; line-height: 1.5;">
                            <strong>Next Club Meeting:</strong> Tuesday after school in Room 312.
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

module.exports = app;