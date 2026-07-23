const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

let users = [];

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'onboarding.html'));
});

app.post('/submit-onboarding', (req, res) => {
    const newUser = {
        id: Date.now().toString(),
        username: req.body.username,
        role: req.body.role
    };
    
    users.push(newUser);
    res.redirect(`/dashboard?id=${newUser.id}`);
});

app.get('/dashboard', (req, res) => {
    const userId = req.query.id;
    const user = users.find(u => u.id === userId);
    
    if (!user) {
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
                .navbar h1 {
                    margin: 0;
                    font-size: 20px;
                }
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
                    .container {
                        grid-template-columns: 1fr;
                    }
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
                .session-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 10px 0;
                    border-bottom: 1px solid #f4f7f6;
                }
                .session-item:last-child {
                    border-bottom: none;
                }
                .btn {
                    display: inline-block;
                    padding: 10px 15px;
                    background-color: #007BFF;
                    color: white;
                    text-decoration: none;
                    border-radius: 4px;
                    font-size: 14px;
                    font-weight: bold;
                    margin-top: 10px;
                }
                .btn:hover {
                    background-color: #0056b3;
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
                        <h3>Upcoming Tutoring Sessions</h3>
                        <div class="session-item">
                            <div>
                                <strong>Algebra II Help</strong><br>
                                <span style="font-size: 12px; color: #666;">Tutee: Sarah Jenkins</span>
                            </div>
                            <div style="text-align: right;">
                                <span>Tomorrow, 3:30 PM</span><br>
                                <span style="font-size: 12px; color: #666;">Room 214</span>
                            </div>
                        </div>
                        <div class="session-item">
                            <div>
                                <strong>AP Calculus BC Prep</strong><br>
                                <span style="font-size: 12px; color: #666;">Tutee: Alex Rivera</span>
                            </div>
                            <div style="text-align: right;">
                                <span>Friday, 4:00 PM</span><br>
                                <span style="font-size: 12px; color: #666;">School Library</span>
                            </div>
                        </div>
                        <a href="#" class="btn">Schedule a New Session</a>
                    </div>
                    <div class="dashboard-card">
                        <h3>Your Performance Analytics</h3>
                        <p>Total Tutoring Hours Completed: <strong>12.5 Hours</strong></p>
                        <p>Feedback Rating: <strong>4.9 / 5.0 Stars</strong></p>
                    </div>
                </div>
                <div>
                    <div class="dashboard-card">
                        <h3>Platform Announcements</h3>
                        <p style="font-size: 14px; line-height: 1.5;">
                            <strong>Next Club Meeting:</strong> Tuesday after school in Room 312. Attendance is mandatory for all active tutors.
                        </p>
                        <p style="font-size: 14px; line-height: 1.5;">
                            <strong>Tutee Registration:</strong> New sign-ups are open for the semester. Share the onboarding link with peers who need math help.
                        </p>
                    </div>
                    <div class="dashboard-card">
                        <h3>Helpful Resources</h3>
                        <p style="font-size: 14px;"><a href="#" style="color: #007BFF; text-decoration: none;">Mu Alpha Theta Tutor Handbook</a></p>
                        <p style="font-size: 14px;"><a href="#" style="color: #007BFF; text-decoration: none;">JCHS Math Department Syllabus Archive</a></p>
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