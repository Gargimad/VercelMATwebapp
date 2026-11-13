require("dotenv").config();

const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// SUPABASE CONFIGURATION
// ============================================================

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabasePublishableKey || !supabaseServiceKey) {
    throw new Error(
        "Missing SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, or SUPABASE_SERVICE_ROLE_KEY in .env"
    );
}

// Normal client
const supabase = createClient(
    supabaseUrl,
    supabasePublishableKey
);

// SERVER-ONLY admin client
// This must use the service-role key.
const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseServiceKey
);

console.log("Supabase admin client initialized:", !!supabaseServiceKey);

// ============================================================
// EXPRESS CONFIGURATION
// ============================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function normalizeStudentId(studentId) {
    return String(studentId || "")
        .trim()
        .toUpperCase();
}

function parseAvailability(value) {
    if (!value) return null;

    const parts = String(value).split("-");

    if (parts.length !== 2) {
        return null;
    }

    const day = parts[0];
    const hour = Number(parts[1]);

    const dayMap = {
        mon: 1,
        tue: 2,
        wed: 3,
        thu: 4,
        fri: 5
    };

    if (!dayMap[day] || !Number.isInteger(hour)) {
        return null;
    }

    return {
        day_of_week: dayMap[day],
        start_time: `${String(hour).padStart(2, "0")}:00:00`,
        end_time: `${String(hour + 1).padStart(2, "0")}:00:00`
    };
}

async function getProfile(profileId) {
    const { data, error } = await supabaseAdmin
        .from("profiles")
        .select(`
            id,
            first_name,
            last_name,
            student_id,
            role,
            created_at
        `)
        .eq("id", profileId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}

// ============================================================
// BASIC PAGES
// ============================================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/signup", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "signup.html"));
});

app.get("/onboarding", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "onboarding.html"));
});

app.get("/pending", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "onboarding.html"));
});

// ============================================================
// SUPABASE CONFIG FOR FRONTEND
// ============================================================

app.get("/api/config", (req, res) => {
    res.json({
        supabaseUrl,
        supabasePublishableKey
    });
});

// ============================================================
// SIGNUP
// ============================================================

app.post("/api/signup", async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            studentId,
            role,
            tuteeSubject,
            tutorSubjects,
            availability
        } = req.body;

        // ----------------------------------------------------
        // VALIDATION
        // ----------------------------------------------------

        if (!firstName || !lastName || !studentId || !role) {
            return res.status(400).json({
                error: "Please fill out all required fields."
            });
        }

        if (!["tutor", "tutee"].includes(role)) {
            return res.status(400).json({
                error: "Please select a valid role."
            });
        }

        const normalizedStudentId = normalizeStudentId(studentId);

        if (!normalizedStudentId) {
            return res.status(400).json({
                error: "Please enter a valid Student ID."
            });
        }

        // ----------------------------------------------------
        // CHECK FOR EXISTING PROFILE
        // ----------------------------------------------------

        const {
            data: existingProfile,
            error: existingProfileError
        } = await supabaseAdmin
            .from("profiles")
            .select(`
                id,
                first_name,
                last_name,
                student_id,
                role
            `)
            .eq("student_id", normalizedStudentId)
            .maybeSingle();

        if (existingProfileError) {
            console.error(
                "Existing profile lookup error:",
                existingProfileError
            );

            return res.status(500).json({
                error:
                    "We couldn't check whether this Student ID is already registered."
            });
        }

        // ----------------------------------------------------
        // ACCOUNT ALREADY EXISTS
        // ----------------------------------------------------

        if (existingProfile) {
            return res.status(409).json({
                error:
                    "An account with this Student ID already exists. Please log in instead.",
                accountExists: true
            });
        }

        // ----------------------------------------------------
        // ROLE-SPECIFIC VALIDATION
        // ----------------------------------------------------

        if (role === "tutee") {
            if (!tuteeSubject) {
                return res.status(400).json({
                    error: "Please choose the subject you need help with."
                });
            }
        }

        if (role === "tutor") {
            if (!Array.isArray(tutorSubjects) || tutorSubjects.length === 0) {
                return res.status(400).json({
                    error: "Please select at least one subject you can tutor."
                });
            }

            if (!Array.isArray(availability) || availability.length === 0) {
                return res.status(400).json({
                    error: "Please select at least one availability time."
                });
            }
        }

        // ----------------------------------------------------
        // CREATE SUPABASE AUTH USER
        // ----------------------------------------------------

        // Student ID is NOT the authentication credential.
        // This internal email is used only for the current prototype.
        const internalEmail =
            `${normalizedStudentId.toLowerCase()}@jchs-tutoring.local`;

        const generatedPassword =
            `${normalizedStudentId}!JCHSTutoring`;

        const {
            data: authData,
            error: authError
        } = await supabaseAdmin.auth.admin.createUser({
            email: internalEmail,
            password: generatedPassword,
            email_confirm: true
        });

        if (authError) {
            console.error("Auth user creation error:", authError);

            return res.status(500).json({
                error: "Unable to create your account."
            });
        }

        const authUserId = authData.user.id;

        // ----------------------------------------------------
        // CREATE PROFILE
        // ----------------------------------------------------

        const {
            data: profile,
            error: profileError
        } = await supabaseAdmin
            .from("profiles")
            .insert({
                id: authUserId,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                student_id: normalizedStudentId,
                role
            })
            .select()
            .single();

        if (profileError) {
            console.error("Profile creation error:", profileError);

            // Clean up Auth account if profile creation fails.
            await supabaseAdmin.auth.admin.deleteUser(authUserId);

            if (profileError.code === "23505") {
                return res.status(409).json({
                    error:
                        "An account with this Student ID already exists. Please log in instead.",
                    accountExists: true
                });
            }

            return res.status(500).json({
                error: "Unable to create your profile."
            });
        }

        // ====================================================
        // TUTEE PROFILE
        // ====================================================

        if (role === "tutee") {
            const {
                data: tuteeProfile,
                error: tuteeProfileError
            } = await supabaseAdmin
                .from("tutee_profiles")
                .insert({
                    profile_id: profile.id
                })
                .select()
                .single();

            if (tuteeProfileError) {
                console.error(
                    "Tutee profile creation error:",
                    tuteeProfileError
                );

                return res.status(500).json({
                    error: "Unable to finish creating your tutee profile."
                });
            }

            // Find subject
            const {
                data: subject,
                error: subjectError
            } = await supabaseAdmin
                .from("subjects")
                .select("id")
                .eq("slug", tuteeSubject)
                .maybeSingle();

            if (subjectError || !subject) {
                console.error("Tutee subject lookup error:", subjectError);

                return res.status(400).json({
                    error: "The selected subject could not be found."
                });
            }

            const {
                error: tuteeSubjectError
            } = await supabaseAdmin
                .from("tutee_subjects")
                .insert({
                    tutee_id: tuteeProfile.profile_id,
                    subject_id: subject.id
                });

            if (tuteeSubjectError) {
                console.error(
                    "Tutee subject creation error:",
                    tuteeSubjectError
                );

                return res.status(500).json({
                    error: "Unable to save your subject."
                });
            }
        }

        // ====================================================
        // TUTOR PROFILE
        // ====================================================

        if (role === "tutor") {
            const {
                data: tutorProfile,
                error: tutorProfileError
            } = await supabaseAdmin
                .from("tutor_profiles")
                .insert({
                    profile_id: profile.id
                })
                .select()
                .single();

            if (tutorProfileError) {
                console.error(
                    "Tutor profile creation error:",
                    tutorProfileError
                );

                return res.status(500).json({
                    error: "Unable to finish creating your tutor profile."
                });
            }

            // ------------------------------------------------
            // TUTOR SUBJECTS
            // ------------------------------------------------

            const {
                data: subjects,
                error: subjectsError
            } = await supabaseAdmin
                .from("subjects")
                .select("id, slug")
                .in("slug", tutorSubjects);

            if (subjectsError) {
                console.error(
                    "Tutor subject lookup error:",
                    subjectsError
                );

                return res.status(500).json({
                    error: "Unable to save your tutoring subjects."
                });
            }

            const tutorSubjectRows = subjects.map(subject => ({
                tutor_id: tutorProfile.profile_id,
                subject_id: subject.id
            }));

            if (tutorSubjectRows.length > 0) {
                const {
                    error: tutorSubjectsError
                } = await supabaseAdmin
                    .from("tutor_subjects")
                    .insert(tutorSubjectRows);

                if (tutorSubjectsError) {
                    console.error(
                        "Tutor subjects creation error:",
                        tutorSubjectsError
                    );

                    return res.status(500).json({
                        error: "Unable to save your tutoring subjects."
                    });
                }
            }

            // ------------------------------------------------
            // AVAILABILITY
            // ------------------------------------------------

            const availabilityRows = availability
                .map(parseAvailability)
                .filter(Boolean)
                .map(slot => ({
                    tutor_id: tutorProfile.profile_id,
                    day_of_week: slot.day_of_week,
                    start_time: slot.start_time,
                    end_time: slot.end_time
                }));

            if (availabilityRows.length > 0) {
                const {
                    error: availabilityError
                } = await supabaseAdmin
                    .from("availability")
                    .insert(availabilityRows);

                if (availabilityError) {
                    console.error(
                        "Availability creation error:",
                        availabilityError
                    );

                    return res.status(500).json({
                        error: "Unable to save your availability."
                    });
                }
            }
        }

        // ----------------------------------------------------
        // SUCCESS
        // ----------------------------------------------------

        return res.status(201).json({
            success: true,
            message: "Account created successfully.",
            profile
        });

    } catch (error) {
        console.error("Signup server error:", error);

        return res.status(500).json({
            error: "Something went wrong while creating your account."
        });
    }
});

// ============================================================
// LOGIN
// ============================================================

app.post("/api/login", async (req, res) => {
    try {
        const { studentId } = req.body;

        if (!studentId) {
            return res.status(400).json({
                error: "Please enter your Student ID."
            });
        }

        const normalizedStudentId = normalizeStudentId(studentId);

        const {
            data: profile,
            error
        } = await supabaseAdmin
            .from("profiles")
            .select(`
                id,
                first_name,
                last_name,
                student_id,
                role,
                created_at
            `)
            .eq("student_id", normalizedStudentId)
            .maybeSingle();

        if (error) {
            console.error("Login profile lookup error:", error);

            return res.status(500).json({
                error: "Unable to look up your account."
            });
        }

        if (!profile) {
            return res.status(404).json({
                error:
                    "No account was found with that Student ID. Please sign up first."
            });
        }

        return res.json({
            success: true,
            profile,
            redirect: `/dashboard?id=${profile.id}`
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            error: "Something went wrong while logging in."
        });
    }
});

// ============================================================
// PROFILE
// ============================================================

app.get("/api/profile/:id", async (req, res) => {
    try {
        const profile = await getProfile(req.params.id);

        if (!profile) {
            return res.status(404).json({
                error: "Profile not found."
            });
        }

        res.json(profile);

    } catch (error) {
        console.error("Profile lookup error:", error);

        res.status(500).json({
            error: "Unable to load profile."
        });
    }
});

// ============================================================
// DASHBOARD
// ============================================================

app.get("/dashboard", async (req, res) => {
    try {
        const profileId = req.query.id;

        if (!profileId) {
            return res.redirect("/login");
        }

        const profile = await getProfile(profileId);

        if (!profile) {
            return res.redirect("/login");
        }

        res.render("dashboard", {
            profile
        });

    } catch (error) {
        console.error("Dashboard error:", error);

        res.status(500).send("Unable to load dashboard.");
    }
});

// ============================================================
// AVAILABLE TUTORS
// ============================================================

app.get("/available-peers", async (req, res) => {
    try {
        const { subject, role } = req.query;

        if (!subject) {
            return res.status(400).json({
                error: "Subject is required."
            });
        }

        // ----------------------------------------------------
        // TUTEE LOOKING FOR TUTOR
        // ----------------------------------------------------

        if (!role || role === "tutor") {
            const {
                data: subjectRow,
                error: subjectError
            } = await supabaseAdmin
                .from("subjects")
                .select("id")
                .eq("slug", subject)
                .maybeSingle();

            if (subjectError || !subjectRow) {
                return res.json([]);
            }

            const {
                data: tutorSubjects,
                error: tutorSubjectsError
            } = await supabaseAdmin
                .from("tutor_subjects")
                .select(`
                    tutor_id,
                    subject_id
                `)
                .eq("subject_id", subjectRow.id);

            if (tutorSubjectsError) {
                console.error(
                    "Tutor subject lookup error:",
                    tutorSubjectsError
                );

                return res.status(500).json({
                    error: "Unable to find tutors."
                });
            }

            if (!tutorSubjects || tutorSubjects.length === 0) {
                return res.json([]);
            }

            const tutorIds = tutorSubjects.map(row => row.tutor_id);

            const {
                data: profiles,
                error: profilesError
            } = await supabaseAdmin
                .from("profiles")
                .select(`
                    id,
                    first_name,
                    last_name,
                    student_id,
                    role
                `)
                .in("id", tutorIds)
                .eq("role", "tutor");

            if (profilesError) {
                console.error(
                    "Tutor profile lookup error:",
                    profilesError
                );

                return res.status(500).json({
                    error: "Unable to load tutors."
                });
            }

            return res.json(profiles || []);
        }

        return res.json([]);

    } catch (error) {
        console.error("Available peers error:", error);

        res.status(500).json({
            error: "Unable to find available tutors."
        });
    }
});

// ============================================================
// TUTOR AVAILABILITY
// ============================================================

app.get("/api/tutor-availability/:tutorId", async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("availability")
            .select(`
                id,
                tutor_id,
                day_of_week,
                start_time,
                end_time
            `)
            .eq("tutor_id", req.params.tutorId)
            .order("day_of_week")
            .order("start_time");

        if (error) {
            console.error("Availability lookup error:", error);

            return res.status(500).json({
                error: "Unable to load tutor availability."
            });
        }

        res.json(data || []);

    } catch (error) {
        console.error("Availability error:", error);

        res.status(500).json({
            error: "Unable to load availability."
        });
    }
});

// ============================================================
// TUTORING REQUESTS
// ============================================================

app.post("/api/tutoring-requests", async (req, res) => {
    try {
        const {
            tutorId,
            tuteeId,
            subjectId,
            message
        } = req.body;

        if (!tutorId || !tuteeId || !subjectId) {
            return res.status(400).json({
                error: "Tutor, tutee, and subject are required."
            });
        }

        const {
            data,
            error
        } = await supabaseAdmin
            .from("tutoring_requests")
            .insert({
                tutor_id: tutorId,
                tutee_id: tuteeId,
                subject_id: subjectId,
                message: message || null,
                status: "pending"
            })
            .select()
            .single();

        if (error) {
            console.error(
                "Tutoring request creation error:",
                error
            );

            return res.status(500).json({
                error: "Unable to send tutoring request."
            });
        }

        res.status(201).json(data);

    } catch (error) {
        console.error("Tutoring request error:", error);

        res.status(500).json({
            error: "Unable to create tutoring request."
        });
    }
});

app.get("/api/tutoring-requests", async (req, res) => {
    try {
        const { userId, role } = req.query;

        if (!userId || !role) {
            return res.status(400).json({
                error: "User ID and role are required."
            });
        }

        let query = supabaseAdmin
            .from("tutoring_requests")
            .select("*");

        if (role === "tutor") {
            query = query.eq("tutor_id", userId);
        } else if (role === "tutee") {
            query = query.eq("tutee_id", userId);
        } else {
            return res.status(400).json({
                error: "Invalid role."
            });
        }

        const { data, error } = await query.order(
            "created_at",
            { ascending: false }
        );

        if (error) {
            console.error(
                "Tutoring request lookup error:",
                error
            );

            return res.status(500).json({
                error: "Unable to load tutoring requests."
            });
        }

        res.json(data || []);

    } catch (error) {
        console.error("Tutoring request error:", error);

        res.status(500).json({
            error: "Unable to load tutoring requests."
        });
    }
});

app.patch("/api/tutoring-requests/:id", async (req, res) => {
    try {
        const { status } = req.body;

        if (!["pending", "accepted", "declined", "cancelled"].includes(status)) {
            return res.status(400).json({
                error: "Invalid request status."
            });
        }

        const {
            data,
            error
        } = await supabaseAdmin
            .from("tutoring_requests")
            .update({
                status
            })
            .eq("id", req.params.id)
            .select()
            .single();

        if (error) {
            console.error(
                "Tutoring request update error:",
                error
            );

            return res.status(500).json({
                error: "Unable to update tutoring request."
            });
        }

        res.json(data);

    } catch (error) {
        console.error("Tutoring request update error:", error);

        res.status(500).json({
            error: "Unable to update tutoring request."
        });
    }
});

// ============================================================
// LOGOUT
// ============================================================

app.post("/api/logout", async (req, res) => {
    res.json({
        success: true
    });
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {
    console.error("Unhandled server error:", err);

    res.status(500).json({
        error: "An unexpected server error occurred."
    });
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
    console.log(`JCHS Math Tutoring server running at http://localhost:${PORT}`);
});