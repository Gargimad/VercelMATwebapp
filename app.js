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
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(path.join(__dirname, 'public', 'pending.html'));
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
        return res.status(400).send('Missing required onboarding fields.');
    }

    const accountStatus = (role === 'admin') ? 'active' : 'pending';

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
        return res.redirect('/');
    }

    if (user.status === 'pending') {
        return res.redirect('/pending');
    } else if (user.status === 'rejected') {
        return res.status(403).send('Your account access has been restricted.');
    }

    let sessions = [];
    const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .or(`tutor_id.eq.${userId},tutee_id.eq.${userId}`);

    if (!sessionError && sessionData) {
        sessions = sessionData;
    }

    let tutors = [];
    const { data: tutorData } = await supabase
        .from('users')
        .select('id, username, subject, grade')
        .eq('role', 'tutor')
        .eq('status', 'active');

    if (tutorData) tutors = tutorData;

    let tutees = [];
    const { data: tuteeData } = await supabase
        .from('users')
        .select('id, username, subject, grade')
        .eq('role', 'tutee')
        .eq('status', 'active');

    if (tuteeData) tutees = tuteeData;

    res.render('dashboard', { 
        user: user,
        sessions: sessions,
        tutees: tutees,
        tutors: tutors
    });
});

// Dynamic Available Peers Search Endpoint
app.get('/available-peers', async (req, res) => {
    try {
        const { subject, role } = req.query;

        if (!subject || !role) {
            return res.status(400).json({ error: 'Missing subject or role parameters.' });
        }

        const { data: peers, error } = await supabase
            .from('users')
            .select('id, username, subject, grade, role')
            .eq('status', 'active')
            .ilike('role', role)
            .ilike('subject', `%${subject}%`);

        if (error) {
            console.error('Supabase query error:', error.message);
            return res.status(500).json({ error: error.message });
        }

        res.json(peers || []);
    } catch (err) {
        console.error('Server error fetching peers:', err.message);
        res.status(500).json({ error: 'Failed to retrieve available peers' });
    }
});

// Propose / Schedule Session Endpoint
app.post('/api/schedule-session', async (req, res) => {
    const { requesterId, targetId, requesterRole, subject, durationHours, location, proposedTimes } = req.body;

    if (!requesterId || !targetId) {
        return res.status(400).json({ error: "Missing user IDs." });
    }

    const tutorId = (requesterRole === 'tutor') ? requesterId : targetId;
    const tuteeId = (requesterRole === 'tutee') ? requesterId : targetId;

    const { error } = await supabaseAdmin
        .from('sessions')
        .insert([{ 
            tutor_id: tutorId,
            tutee_id: tuteeId,
            requester_id: requesterId,
            subject: subject,
            duration_hours: durationHours || 1.0,
            location: location || 'TBD',
            status: 'proposed',
            proposed_times: proposedTimes || []
        }]);

    if (error) {
        console.error("Error scheduling session:", error.message);
        return res.status(500).json({ error: error.message });
    }

    res.status(200).json({ success: true });
});

// Fetch Proposed Sessions Endpoint
app.get('/api/proposed-sessions', async (req, res) => {
    const { userId } = req.query;
    const { data, error } = await supabase
        .from('sessions')
        .select(`
            *,
            tutor:tutor_id (username),
            tutee:tutee_id (username)
        `)
        .or(`tutor_id.eq.${userId},tutee_id.eq.${userId}`)
        .eq('status', 'proposed');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// =========================================================================
// SESSION MANAGEMENT ENDPOINTS (Frontend matching routes)
// =========================================================================

// Accept Proposed Session Endpoint
app.post('/api/accept-proposal/:proposalId', async (req, res) => {
    const { proposalId } = req.params;
    const { acceptedTime } = req.body;

    if (!proposalId || !acceptedTime) {
        return res.status(400).json({ error: 'Missing proposal ID or accepted time.' });
    }

    const { error } = await supabaseAdmin
        .from('sessions')
        .update({ 
            status: 'accepted',
            scheduled_time: acceptedTime
        })
        .eq('id', proposalId);

    if (error) {
        console.error('Error accepting session:', error.message);
        return res.status(500).json({ error: 'Failed to accept session.' });
    }

    res.json({ success: true });
});

// Reject Proposed Session Endpoint
app.delete('/api/reject-proposal/:proposalId', async (req, res) => {
    const { proposalId } = req.params;

    if (!proposalId) {
        return res.status(400).json({ error: 'Missing proposal ID.' });
    }

    const { error } = await supabaseAdmin
        .from('sessions')
        .update({ status: 'rejected' })
        .eq('id', proposalId);

    if (error) {
        console.error('Error rejecting session:', error.message);
        return res.status(500).json({ error: 'Failed to reject session.' });
    }

    res.json({ success: true });
});

// Complete Session Endpoint
app.post('/api/complete-session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    const { error } = await supabaseAdmin
        .from('sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId);

    if (error) {
        console.error('Error completing session:', error.message);
        return res.status(500).json({ error: 'Failed to complete session.' });
    }

    res.json({ success: true });
});

// Cancel Session Endpoint
app.delete('/api/cancel-session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    const { error } = await supabaseAdmin
        .from('sessions')
        .update({ status: 'canceled' })
        .eq('id', sessionId);

    if (error) {
        console.error('Error canceling session:', error.message);
        return res.status(500).json({ error: 'Failed to cancel session.' });
    }

    res.json({ success: true });
});

// Reschedule Session Endpoint
app.post('/api/reschedule-session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { scheduledTime } = req.body;

    if (!sessionId || !scheduledTime) {
        return res.status(400).json({ error: 'Session ID and scheduled time are required.' });
    }

    const { error } = await supabaseAdmin
        .from('sessions')
        .update({ scheduled_time: scheduledTime })
        .eq('id', sessionId);

    if (error) {
        console.error('Error rescheduling session:', error.message);
        return res.status(500).json({ error: 'Failed to reschedule session.' });
    }

    res.json({ success: true });
});

// Fetch Upcoming Accepted Sessions Endpoint
app.get('/api/upcoming-sessions', async (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required.' });
    }

    const { data: upcoming, error } = await supabase
        .from('sessions')
        .select(`
            id,
            subject,
            location,
            duration_hours,
            scheduled_time,
            tutor:users!sessions_tutor_id_fkey(username),
            tutee:users!sessions_tutee_id_fkey(username)
        `)
        .eq('status', 'accepted')
        .or(`tutor_id.eq.${userId},tutee_id.eq.${userId}`);

    if (error) {
        console.error('Error fetching upcoming sessions:', error.message);
        return res.status(500).json({ error: 'Failed to fetch upcoming sessions.' });
    }

    res.json(upcoming || []);
});

// Fetch Past Completed Sessions Endpoint (Both Tutors and Tutees)
app.get('/api/past-sessions', async (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required.' });
    }

    const { data: sessions, error } = await supabase
        .from('sessions')
        .select(`
            id,
            subject,
            location,
            duration_hours,
            scheduled_time,
            created_at,
            tutor:users!sessions_tutor_id_fkey(username),
            tutee:users!sessions_tutee_id_fkey(username)
        `)
        .eq('status', 'completed')
        .or(`tutor_id.eq.${userId},tutee_id.eq.${userId}`);

    if (error) {
        console.error('Error fetching past sessions:', error.message);
        return res.status(500).json({ error: 'Failed to fetch past sessions.' });
    }

    res.json(sessions || []);
});

// Fetch Volunteer Hours Endpoint (Tutors Only)
app.get('/api/volunteer-hours', async (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required.' });
    }

    const { data: userProfile } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

    if (!userProfile || userProfile.role !== 'tutor') {
        return res.status(403).json({ error: 'Volunteer hours page is reserved for tutors only.' });
    }

    const { data: completedSessions, error } = await supabase
        .from('sessions')
        .select(`
            id,
            subject,
            duration_hours,
            scheduled_time,
            created_at,
            tutee:users!sessions_tutee_id_fkey(username)
        `)
        .eq('tutor_id', userId)
        .eq('status', 'completed');

    if (error) {
        console.error('Error fetching volunteer hours:', error.message);
        return res.status(500).json({ error: 'Failed to compute volunteer hours.' });
    }

    const totalHours = (completedSessions || []).reduce((sum, s) => {
        return sum + (parseFloat(s.duration_hours) || 1.0);
    }, 0);

    res.json({
        totalHours: totalHours.toFixed(1),
        sessions: completedSessions || []
    });
});

// =========================================================================
// PROTECTED ADMIN ROUTES & HELPER FUNCTIONS
// =========================================================================

async function verifyIsActiveAdmin(adminId) {
    if (!adminId) return false;

    const { data: adminUser, error } = await supabaseAdmin
        .from('users')
        .select('id, role, status')
        .eq('id', adminId)
        .maybeSingle();

    if (error || !adminUser) return false;

    return adminUser.role === 'admin' && adminUser.status === 'active';
}

app.get('/admin', async (req, res) => {
    const adminId = req.query.id;

    const isAdmin = await verifyIsActiveAdmin(adminId);
    if (!isAdmin) {
        return res.status(403).send('Access Denied: You do not have permission to view the Admin Portal.');
    }

    const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (usersError) {
        console.error('Error fetching users for admin:', usersError.message);
        return res.status(500).send('Error loading admin portal data.');
    }

    res.render('admin', { users });
});

app.post('/api/users/update-status', async (req, res) => {
    const { userId, status, adminId } = req.body;

    const isAdmin = await verifyIsActiveAdmin(adminId);
    if (!isAdmin) {
        return res.status(403).json({ error: 'Permission denied. Active admin rights required.' });
    }

    if (!userId || !['active', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'Invalid user or status value.' });
    }

    const { error } = await supabaseAdmin
        .from('users')
        .update({ status })
        .eq('id', userId);

    if (error) {
        console.error('Supabase update query error:', error.message);
        return res.status(500).json({ error: 'Failed to update user status.' });
    }

    res.json({ success: true, message: `User status updated to ${status}` });
});

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
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authError) console.warn('Auth deletion note:', authError.message);

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

app.get('/logout', (req, res) => {
    res.redirect('/');
});
// Get user stats
app.get('/api/user-stats', async (req, res) => {
    try {
        const userId = req.query.userId;
        
        // Get counts from your database
        const totalSessions = await db.query(
            'SELECT COUNT(*) as count FROM sessions WHERE tutor_id = $1 OR tutee_id = $1',
            [userId]
        );
        
        const upcomingSessions = await db.query(
            'SELECT COUNT(*) as count FROM sessions WHERE (tutor_id = $1 OR tutee_id = $1) AND status = $2 AND proposed_times > NOW()',
            [userId, 'accepted']
        );
        
        const pendingSessions = await db.query(
            'SELECT COUNT(*) as count FROM sessions WHERE (tutor_id = $1 OR tutee_id = $1) AND status = $2',
            [userId, 'proposed']
        );
        
        const volunteerHours = await db.query(
            'SELECT SUM(duration_hours) as hours FROM sessions WHERE tutor_id = $1 AND status = $2',
            [userId, 'completed']
        );
        
        res.json({
            total: parseInt(totalSessions.rows[0]?.count || 0),
            upcoming: parseInt(upcomingSessions.rows[0]?.count || 0),
            pending: parseInt(pendingSessions.rows[0]?.count || 0),
            hours: parseFloat(volunteerHours.rows[0]?.hours || 0)
        });
    } catch (err) {
        console.error('Error getting stats:', err);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

module.exports = app;