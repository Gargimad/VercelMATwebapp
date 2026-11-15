require("dotenv").config();
const crypto = require("crypto");

const express = require("express");
const path = require("path");
const cors = require("cors");
const { Resend } = require("resend");

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const {
    createClient
} = require("@supabase/supabase-js");


const app = express();

const PORT =
    process.env.PORT || 3000;


const SUPABASE_URL =
    process.env.SUPABASE_URL;


const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;


if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
) {

    console.error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );

}


const supabaseAdmin =
    createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );


// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());

app.use(
    express.json()
);

app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);

app.set(
    "view engine",
    "ejs"
);

app.set(
    "views",
    path.join(
        __dirname,
        "views"
    )
);


// ============================================================
// BASIC ROUTES
// ============================================================

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );

    }
);


app.get(
    "/login",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "login.html"
            )
        );

    }
);


app.get(
    "/signup",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "signup.html"
            )
        );

    }
);
app.get("/api/test-email", async (req, res) => {
    try {
        if (!resend) {
            return res.status(500).json({
                error: "RESEND_API_KEY is not configured."
            });
        }

        const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_FROM || "JCHS Math Tutoring <onboarding@resend.dev>",
            to: ["gargimadala10@gmail.com"],
            subject: "JCHS Math Tutoring — Resend Test",
            html: `
                <h2>Email test successful! 🎉</h2>
                <p>Your JCHS Math Tutoring app can now send emails through Resend.</p>
            `
        });

        if (error) {
            console.error("Resend error:", error);

            return res.status(500).json({
                error: error.message || "Failed to send email."
            });
        }

        res.json({
            success: true,
            message: "Test email sent!",
            id: data?.id
        });

    } catch (error) {
        console.error("Test email error:", error);

        res.status(500).json({
            error: "Unexpected error while sending test email."
        });
    }
});


// ============================================================
// PROFILE HELPER
// ============================================================

async function getProfile(
    profileId
) {

    const {
        data,
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
        .eq(
            "id",
            profileId
        )
        .maybeSingle();


    if (error) {

        console.error(
            "getProfile error:",
            error
        );

        return null;

    }


    return data;

}


// ============================================================
// DASHBOARD
// ============================================================

app.get(
    "/dashboard",
    async (req, res) => {

        try {

            const profileId =
                req.query.id;


            if (!profileId) {

                return res.redirect(
                    "/login"
                );

            }


            const profile =
                await getProfile(
                    profileId
                );


            if (!profile) {

                return res.redirect(
                    "/login"
                );

            }


            const user = {
                id: profile.id,
                username: `${profile.first_name} ${profile.last_name}`,
                first_name: profile.first_name,
                last_name: profile.last_name,
                student_id: profile.student_id,
                role: profile.role
            };

            res.render("dashboard", {
                profile: profile,
                user: profile
            });


        } catch (error) {

            console.error(
                "Dashboard error:",
                error
            );


            res.status(500).send(
                "Unable to load dashboard."
            );

        }

    }
);


// ============================================================
// SIGNUP
// ============================================================

app.post(
    "/api/signup",
    async (req, res) => {

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


            if (
                !firstName ||
                !lastName ||
                !studentId ||
                !role
            ) {

                return res.status(400).json({
                    error:
                        "Please complete all required fields."
                });

            }


            if (
                role !== "tutor" &&
                role !== "tutee"
            ) {

                return res.status(400).json({
                    error:
                        "Invalid role."
                });

            }


            // ------------------------------------------------
            // CHECK EXISTING STUDENT ID
            // ------------------------------------------------

            const {
                data: existingProfile,
                error: existingError
            } = await supabaseAdmin
                .from("profiles")
                .select("id")
                .eq(
                    "student_id",
                    studentId.trim()
                )
                .maybeSingle();


            if (existingError) {

                console.error(
                    "Existing profile lookup error:",
                    existingError
                );


                return res.status(500).json({
                    error:
                        "Unable to check existing account."
                });

            }


            if (existingProfile) {

                return res.status(409).json({
                    error:
                        "An account with this Student ID already exists."
                });

            }


            // ------------------------------------------------
            // CREATE AUTH USER
            // ------------------------------------------------

            const internalEmail =
                `${studentId.trim()}@jchs-math.local`;


            const temporaryPassword =
                `${studentId.trim()}-JCHS-TutorConnect!`;


            const {
                data: authData,
                error: authError
            } =
                await supabaseAdmin
                    .auth
                    .admin
                    .createUser({

                        email:
                            internalEmail,

                        password:
                            temporaryPassword,

                        email_confirm:
                            true,

                        user_metadata: {

                            first_name:
                                firstName.trim(),

                            last_name:
                                lastName.trim(),

                            student_id:
                                studentId.trim(),

                            role

                        }

                    });


            if (authError) {

                console.error(
                    "Auth creation error:",
                    authError
                );


                return res.status(500).json({
                    error:
                        authError.message ||
                        "Unable to create account."
                });

            }


            const userId =
                authData.user.id;


            // ------------------------------------------------
            // CREATE PROFILE
            // ------------------------------------------------

            const {
                data: profile,
                error: profileError
            } =
                await supabaseAdmin
                    .from("profiles")
                    .insert({

                        id:
                            userId,

                        first_name:
                            firstName.trim(),

                        last_name:
                            lastName.trim(),

                        student_id:
                            studentId.trim(),

                        role

                    })
                    .select()
                    .single();


            if (profileError) {

                console.error(
                    "Profile creation error:",
                    profileError
                );


                await supabaseAdmin
                    .auth
                    .admin
                    .deleteUser(
                        userId
                    );


                return res.status(500).json({
                    error:
                        "Unable to create profile."
                });

            }


            // =================================================
            // TUTEE PROFILE
            // =================================================

            if (role === "tutee") {

                const {
                    data: tuteeProfile,
                    error: tuteeError
                } =
                    await supabaseAdmin
                        .from("tutee_profiles")
                        .insert({

                            profile_id:
                                userId

                        })
                        .select()
                        .single();


                if (tuteeError) {

                    console.error(
                        "Tutee profile error:",
                        tuteeError
                    );


                    return res.status(500).json({
                        error:
                            "Account created, but tutee profile could not be created."
                    });

                }


                if (tuteeSubject) {

                    const {
                        data: subject,
                        error: subjectError
                    } =
                        await supabaseAdmin
                            .from("subjects")
                            .select("id")
                            .eq(
                                "slug",
                                tuteeSubject
                            )
                            .maybeSingle();


                    if (subjectError) {

                        console.error(
                            "Tutee subject lookup error:",
                            subjectError
                        );

                    } else if (subject) {

                        const {
                            error:
                                tuteeSubjectError
                        } =
                            await supabaseAdmin
                                .from("tutee_subjects")
                                .insert({

                                    tutee_id:
                                        tuteeProfile.profile_id,

                                    subject_id:
                                        subject.id

                                });


                        if (
                            tuteeSubjectError
                        ) {

                            console.error(
                                "Tutee subject creation error:",
                                tuteeSubjectError
                            );

                        }

                    }

                }

            }


            // =================================================
            // TUTOR PROFILE
            // =================================================

            if (role === "tutor") {

                const {
                    data: tutorProfile,
                    error: tutorError
                } =
                    await supabaseAdmin
                        .from("tutor_profiles")
                        .insert({

                            profile_id:
                                userId

                        })
                        .select()
                        .single();


                if (tutorError) {

                    console.error(
                        "Tutor profile error:",
                        tutorError
                    );


                    return res.status(500).json({
                        error:
                            "Account created, but tutor profile could not be created."
                    });

                }


                // ------------------------------------------------
                // TUTOR SUBJECTS
                // ------------------------------------------------

                if (
                    Array.isArray(
                        tutorSubjects
                    ) &&
                    tutorSubjects.length > 0
                ) {

                    const {
                        data: subjects,
                        error: subjectsError
                    } =
                        await supabaseAdmin
                            .from("subjects")
                            .select(
                                "id, slug"
                            )
                            .in(
                                "slug",
                                tutorSubjects
                            );


                    if (subjectsError) {

                        console.error(
                            "Tutor subjects lookup error:",
                            subjectsError
                        );

                    } else {

                        const rows =
                            subjects.map(
                                subject => ({

                                    tutor_id:
                                        tutorProfile.profile_id,

                                    subject_id:
                                        subject.id

                                })
                            );


                        if (
                            rows.length > 0
                        ) {

                            const {
                                error:
                                    tutorSubjectsError
                            } =
                                await supabaseAdmin
                                    .from("tutor_subjects")
                                    .insert(
                                        rows
                                    );


                            if (
                                tutorSubjectsError
                            ) {

                                console.error(
                                    "Tutor subject insertion error:",
                                    tutorSubjectsError
                                );

                            }

                        }

                    }

                }


                // ------------------------------------------------
                // AVAILABILITY
                // ------------------------------------------------

                if (
                    Array.isArray(
                        availability
                    ) &&
                    availability.length > 0
                ) {

                    const availabilityRows =
                        availability
                            .map(slot => {

                                const parts =
                                    slot.split("-");


                                const day =
                                    parts[0];


                                const hour =
                                    parts[1];


                                const dayMap = {

                                    mon: 1,
                                    tue: 2,
                                    wed: 3,
                                    thu: 4,
                                    fri: 5

                                };


                                const dayOfWeek =
                                    dayMap[day];


                                const startHour =
                                    parseInt(
                                        hour,
                                        10
                                    );


                                return {

                                    tutor_id:
                                        tutorProfile.profile_id,

                                    day_of_week:
                                        dayOfWeek,

                                    start_time:
                                        `${String(startHour).padStart(2, "0")}:00:00`,

                                    end_time:
                                        `${String(startHour + 1).padStart(2, "0")}:00:00`

                                };

                            })
                            .filter(
                                row =>
                                    row.day_of_week
                            );


                    if (
                        availabilityRows.length > 0
                    ) {

                        const {
                            error:
                                availabilityError
                        } =
                            await supabaseAdmin
                                .from("availability")
                                .insert(
                                    availabilityRows
                                );


                        if (
                            availabilityError
                        ) {

                            console.error(
                                "Availability error:",
                                availabilityError
                            );

                        }

                    }

                }

            }


            res.status(201).json({

                message:
                    "Account created successfully.",

                profile

            });


        } catch (error) {

            console.error(
                "Signup error:",
                error
            );


            res.status(500).json({
                error:
                    "Something went wrong while creating your account."
            });

        }

    }
);


// ============================================================
// LOGIN
// ============================================================

app.post(
    "/api/login",
    async (req, res) => {

        try {

            const {
                studentId
            } = req.body;


            if (!studentId) {

                return res.status(400).json({
                    error:
                        "Student ID is required."
                });

            }


            const {
                data: profile,
                error
            } =
                await supabaseAdmin
                    .from("profiles")
                    .select(`
                        id,
                        first_name,
                        last_name,
                        student_id,
                        role
                    `)
                    .eq(
                        "student_id",
                        studentId.trim()
                    )
                    .maybeSingle();


            if (error) {

                console.error(
                    "Login profile error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "Unable to log in."
                });

            }


            if (!profile) {

                return res.status(401).json({
                    error:
                        "No account was found with that Student ID."
                });

            }


            res.json({
                profile
            });


        } catch (error) {

            console.error(
                "Login error:",
                error
            );


            res.status(500).json({
                error:
                    "Unable to log in."
            });

        }

    }
);


// ============================================================
// GET PROFILE
// ============================================================

app.get(
    "/api/profile/:id",
    async (req, res) => {

        try {

            const profile =
                await getProfile(
                    req.params.id
                );


            if (!profile) {

                return res.status(404).json({
                    error:
                        "Profile not found."
                });

            }


            res.json(profile);


        } catch (error) {

            console.error(
                "Profile route error:",
                error
            );


            res.status(500).json({
                error:
                    "Unable to load profile."
            });

        }

    }
);


// ============================================================
// GET SUBJECT
// ============================================================

app.get(
    "/api/subject/:slug",
    async (req, res) => {

        try {

            const {
                data,
                error
            } =
                await supabaseAdmin
                    .from("subjects")
                    .select(`
                        id,
                        name,
                        slug
                    `)
                    .eq(
                        "slug",
                        req.params.slug
                    )
                    .maybeSingle();


            if (error) {

                console.error(
                    "Subject lookup error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "Unable to find subject."
                });

            }


            if (!data) {

                return res.status(404).json({
                    error:
                        "Subject not found."
                });

            }


            res.json(data);


        } catch (error) {

            console.error(
                "Subject route error:",
                error
            );


            res.status(500).json({
                error:
                    "Unable to find subject."
            });

        }

    }
);


// ============================================================
// FIND TUTORS
// ============================================================

app.get(
    "/api/tutors",
    async (req, res) => {

        try {

            const {
                subject
            } = req.query;


            if (!subject) {

                return res.status(400).json({
                    error:
                        "Subject is required."
                });

            }


            const {
                data: subjectRow,
                error: subjectError
            } =
                await supabaseAdmin
                    .from("subjects")
                    .select(`
                        id,
                        name,
                        slug
                    `)
                    .eq(
                        "slug",
                        subject
                    )
                    .maybeSingle();


            if (subjectError) {

                console.error(
                    "Subject error:",
                    subjectError
                );


                return res.status(500).json({
                    error:
                        "Unable to find subject."
                });

            }


            if (!subjectRow) {

                return res.json([]);

            }


            const {
                data: tutorRows,
                error: tutorRowsError
            } =
                await supabaseAdmin
                    .from("tutor_subjects")
                    .select("tutor_id")
                    .eq(
                        "subject_id",
                        subjectRow.id
                    );


            if (tutorRowsError) {

                console.error(
                    "Tutor subjects error:",
                    tutorRowsError
                );


                return res.status(500).json({
                    error:
                        "Unable to find tutors."
                });

            }


            if (
                !tutorRows ||
                tutorRows.length === 0
            ) {

                return res.json([]);

            }


            const tutorIds =
                tutorRows.map(
                    row =>
                        row.tutor_id
                );


            const {
                data: tutors,
                error: tutorsError
            } =
                await supabaseAdmin
                    .from("profiles")
                    .select(`
                        id,
                        first_name,
                        last_name,
                        student_id,
                        role
                    `)
                    .in(
                        "id",
                        tutorIds
                    )
                    .eq(
                        "role",
                        "tutor"
                    );


            if (tutorsError) {

                console.error(
                    "Tutor profiles error:",
                    tutorsError
                );


                return res.status(500).json({
                    error:
                        "Unable to load tutors."
                });

            }


            const result =
                (tutors || []).map(
                    tutor => ({

                        id:
                            tutor.id,

                        first_name:
                            tutor.first_name,

                        last_name:
                            tutor.last_name,

                        student_id:
                            tutor.student_id,

                        role:
                            tutor.role,

                        subject:
                            subjectRow.name,

                        subject_slug:
                            subjectRow.slug

                    })
                );


            res.json(result);


        } catch (error) {

            console.error(
                "Find tutors error:",
                error
            );


            res.status(500).json({
                error:
                    "Unable to find tutors."
            });

        }

    }
);


// ============================================================
// CREATE TUTORING REQUEST
// ============================================================

app.post(
    "/api/tutoring-requests",
    async (req, res) => {

        try {

            const {
                tutorId,
                tuteeId,
                subjectId,
                message
            } = req.body;


            if (
                !tutorId ||
                !tuteeId ||
                !subjectId
            ) {

                return res.status(400).json({
                    error:
                        "Missing required request information."
                });

            }


            // ------------------------------------------------
            // Verify tutor exists
            // ------------------------------------------------

            const {
                data: tutor,
                error: tutorError
            } =
                await supabaseAdmin
                    .from("profiles")
                    .select("id, role")
                    .eq(
                        "id",
                        tutorId
                    )
                    .eq(
                        "role",
                        "tutor"
                    )
                    .maybeSingle();


            if (
                tutorError ||
                !tutor
            ) {

                return res.status(400).json({
                    error:
                        "That tutor could not be found."
                });

            }


            // ------------------------------------------------
            // Verify tutee exists
            // ------------------------------------------------

            const {
                data: tutee,
                error: tuteeError
            } =
                await supabaseAdmin
                    .from("profiles")
                    .select("id, role")
                    .eq(
                        "id",
                        tuteeId
                    )
                    .eq(
                        "role",
                        "tutee"
                    )
                    .maybeSingle();


            if (
                tuteeError ||
                !tutee
            ) {

                return res.status(400).json({
                    error:
                        "The tutee account could not be found."
                });

            }


            // ------------------------------------------------
            // Prevent duplicate pending request
            // ------------------------------------------------

            const {
                data: existing,
                error: existingError
            } =
                await supabaseAdmin
                    .from("tutoring_requests")
                    .select("id")
                    .eq(
                        "tutor_id",
                        tutorId
                    )
                    .eq(
                        "tutee_id",
                        tuteeId
                    )
                    .eq(
                        "subject_id",
                        subjectId
                    )
                    .eq(
                        "status",
                        "pending"
                    )
                    .limit(1);


            if (existingError) {

                console.error(
                    "Existing request error:",
                    existingError
                );


                return res.status(500).json({
                    error:
                        "Unable to check existing requests."
                });

            }


            if (
                existing &&
                existing.length > 0
            ) {

                return res.status(409).json({
                    error:
                        "You already have a pending request with this tutor."
                });

            }


            // ------------------------------------------------
            // Create request
            // ------------------------------------------------

            const cleanMessage =
                typeof message === "string"
                    ? message.trim().slice(0, 500)
                    : null;


            const {
                data,
                error
            } =
                await supabaseAdmin
                    .from("tutoring_requests")
                    .insert({

                        tutor_id:
                            tutorId,

                        tutee_id:
                            tuteeId,

                        subject_id:
                            subjectId,

                        message:
                            cleanMessage || null,

                        status:
                            "pending"

                    })
                    .select()
                    .single();


            if (error) {

                console.error(
                    "Create request error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "Unable to send tutoring request."
                });

            }


            res.status(201).json(
                data
            );


        } catch (error) {

            console.error(
                "Request creation error:",
                error
            );


            res.status(500).json({
                error:
                    "Unable to send tutoring request."
            });

        }

    }
);


// ============================================================
// GET TUTORING REQUESTS
// ============================================================

app.get(
    "/api/tutoring-requests",
    async (req, res) => {

        try {

            const {
                userId,
                role
            } = req.query;


            if (
                !userId ||
                !role
            ) {

                return res.status(400).json({
                    error:
                        "User ID and role are required."
                });

            }


            if (
                role !== "tutor" &&
                role !== "tutee"
            ) {

                return res.status(400).json({
                    error:
                        "Invalid role."
                });

            }


            // ------------------------------------------------
            // Get requests
            // ------------------------------------------------

            let requestQuery =
                supabaseAdmin
                    .from("tutoring_requests")
                    .select(`
                        id,
                        tutor_id,
                        tutee_id,
                        subject_id,
                        message,
                        status,
                        created_at,
                        updated_at
                    `)
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );


            if (role === "tutor") {

                requestQuery =
                    requestQuery.eq(
                        "tutor_id",
                        userId
                    );

            } else {

                requestQuery =
                    requestQuery.eq(
                        "tutee_id",
                        userId
                    );

            }


            const {
                data: requests,
                error: requestError
            } =
                await requestQuery;


            if (requestError) {

                console.error(
                    "Get requests error:",
                    requestError
                );


                return res.status(500).json({
                    error:
                        "Unable to load tutoring requests."
                });

            }


            if (
                !requests ||
                requests.length === 0
            ) {

                return res.json([]);

            }


            // ------------------------------------------------
            // Collect IDs
            // ------------------------------------------------

            const profileIds =
                [
                    ...new Set(
                        requests.flatMap(
                            request => [
                                request.tutor_id,
                                request.tutee_id
                            ]
                        )
                    )
                ];


            const subjectIds =
                [
                    ...new Set(
                        requests.map(
                            request =>
                                request.subject_id
                        )
                    )
                ];


            // ------------------------------------------------
            // Get profiles
            // ------------------------------------------------

            const {
                data: profiles,
                error: profilesError
            } =
                await supabaseAdmin
                    .from("profiles")
                    .select(`
                        id,
                        first_name,
                        last_name,
                        role
                    `)
                    .in(
                        "id",
                        profileIds
                    );


            if (profilesError) {

                console.error(
                    "Request profiles error:",
                    profilesError
                );


                return res.status(500).json({
                    error:
                        "Unable to load request users."
                });

            }


            // ------------------------------------------------
            // Get subjects
            // ------------------------------------------------

            const {
                data: subjects,
                error: subjectsError
            } =
                await supabaseAdmin
                    .from("subjects")
                    .select(`
                        id,
                        name,
                        slug
                    `)
                    .in(
                        "id",
                        subjectIds
                    );


            if (subjectsError) {

                console.error(
                    "Request subjects error:",
                    subjectsError
                );


                return res.status(500).json({
                    error:
                        "Unable to load request subjects."
                });

            }


            // ------------------------------------------------
            // Create lookup maps
            // ------------------------------------------------

            const profileMap =
                new Map(
                    (profiles || []).map(
                        profile => [
                            profile.id,
                            profile
                        ]
                    )
                );


            const subjectMap =
                new Map(
                    (subjects || []).map(
                        subject => [
                            String(subject.id),
                            subject
                        ]
                    )
                );


            // ------------------------------------------------
            // Enrich requests
            // ------------------------------------------------

            const enrichedRequests =
                requests.map(
                    request => {

                        const tutor =
                            profileMap.get(
                                request.tutor_id
                            );


                        const tutee =
                            profileMap.get(
                                request.tutee_id
                            );


                        const subject =
                            subjectMap.get(
                                String(
                                    request.subject_id
                                )
                            );


                        return {

                            ...request,

                            tutor_first_name:
                                tutor?.first_name ||
                                "",

                            tutor_last_name:
                                tutor?.last_name ||
                                "",

                            tutee_first_name:
                                tutee?.first_name ||
                                "",

                            tutee_last_name:
                                tutee?.last_name ||
                                "",

                            subject_name:
                                subject?.name ||
                                "Math",

                            subject_slug:
                                subject?.slug ||
                                ""

                        };

                    }
                );


            res.json(
                enrichedRequests
            );


        } catch (error) {

            console.error(
                "Tutoring requests GET error:",
                error
            );


            res.status(500).json({
                error:
                    "Unable to load tutoring requests."
            });

        }

    }
);


// ============================================================
// UPDATE TUTORING REQUEST
// ============================================================

app.patch(
    "/api/tutoring-requests/:id",
    async (req, res) => {

        try {

            const {
                status
            } = req.body;


            const allowedStatuses = [
                "pending",
                "accepted",
                "declined",
                "cancelled"
            ];


            if (
                !allowedStatuses.includes(
                    status
                )
            ) {

                return res.status(400).json({
                    error:
                        "Invalid request status."
                });

            }


            const {
                data,
                error
            } =
                await supabaseAdmin
                    .from("tutoring_requests")
                    .update({

                        status,

                        updated_at:
                            new Date().toISOString()

                    })
                    .eq(
                        "id",
                        req.params.id
                    )
                    .select()
                    .single();


            if (error) {

                console.error(
                    "Update request error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "Unable to update request."
                });

            }


            res.json(
                data
            );


        } catch (error) {

            console.error(
                "Update request error:",
                error
            );


            res.status(500).json({
                error:
                    "Unable to update request."
            });

        }

    }
);


// ============================================================
// OLD COMPATIBILITY ENDPOINT
// ============================================================

app.get(
    "/available-peers",
    async (req, res) => {

        try {

            const {
                role,
                subject
            } = req.query;


            if (!role) {

                return res.status(400).json({
                    error:
                        "Role is required."
                });

            }


            if (
                role === "tutor" &&
                subject
            ) {

                const response =
                    await fetch(
                        `http://localhost:${PORT}/api/tutors?subject=${encodeURIComponent(subject)}`
                    );


                if (response.ok) {

                    const tutors =
                        await response.json();


                    return res.json(
                        tutors
                    );

                }

            }


            res.json([]);


        } catch (error) {

            console.error(
                "Available peers error:",
                error
            );


            res.status(500).json({
                error:
                    "Unable to load peers."
            });

        }

    }
);

// ============================================================
// SESSION + TEACHER VERIFICATION HELPERS
// ============================================================

function generateVerificationToken() {
    return crypto.randomBytes(32).toString("hex");
}

function getAppUrl() {
    return (
        process.env.APP_URL ||
        `http://localhost:${PORT}`
    ).replace(/\/$/, "");
}

function getSessionHours(session) {
    if (
        session.duration_hours !== null &&
        session.duration_hours !== undefined &&
        !Number.isNaN(Number(session.duration_hours))
    ) {
        return Number(session.duration_hours);
    }

    if (session.scheduled_start && session.scheduled_end) {
        const start = new Date(session.scheduled_start).getTime();
        const end = new Date(session.scheduled_end).getTime();

        if (
            Number.isFinite(start) &&
            Number.isFinite(end) &&
            end > start
        ) {
            return (end - start) / (1000 * 60 * 60);
        }
    }

    return 1;
}

function formatSessionDateTime(session) {
    const value =
        session.scheduled_start ||
        session.scheduled_time;

    if (!value) {
        return "the scheduled session";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("en-US", {
        dateStyle: "full",
        timeStyle: "short"
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ============================================================
// SEND TEACHER VERIFICATION EMAIL
// ============================================================

async function sendTeacherVerificationEmail(session) {
    if (!resend) {
        throw new Error(
            "RESEND_API_KEY is not configured."
        );
    }

    if (!session.teacher_email) {
        throw new Error(
            "No teacher email was provided for this session."
        );
    }

    if (!session.verification_token) {
        throw new Error(
            "No verification token exists for this session."
        );
    }

    const tutorName =
        `${session.tutor_first_name || ""} ${session.tutor_last_name || ""}`
            .trim() || "The tutor";

    const tuteeName =
        `${session.tutee_first_name || ""} ${session.tutee_last_name || ""}`
            .trim() || "The tutee";

    const hours = getSessionHours(session);

    const timeText =
        formatSessionDateTime(session);

    const appUrl = getAppUrl();

    const verifyBase =
        `${appUrl}/verify-session/${encodeURIComponent(
            session.verification_token
        )}`;

    const approveUrl =
        `${verifyBase}?decision=approved`;

    const denyUrl =
        `${verifyBase}?decision=denied`;

    const fromAddress =
        process.env.EMAIL_FROM ||
        "JCHS Math Tutoring <onboarding@resend.dev>";

    await resend.emails.send({
        from: fromAddress,
        to: session.teacher_email,
        subject: `Tutoring Verification — ${tutorName}`,

        html: `
            <div style="
                font-family: Arial, sans-serif;
                max-width: 650px;
                margin: 0 auto;
                padding: 30px;
                color: #222;
            ">

                <h2 style="
                    color: #153F78;
                    margin-bottom: 24px;
                ">
                    JCHS Math Tutoring — Session Verification
                </h2>

                <p>
                    Hello ${escapeHtml(session.teacher_name || "Teacher")},
                </p>

                <p>
                    A tutoring session has been completed and
                    requires your verification.
                </p>

                <div style="
                    background: #f5f1e8;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 24px 0;
                ">

                    <p>
                        <strong>Tutor:</strong>
                        ${escapeHtml(tutorName)}
                    </p>

                    <p>
                        <strong>Tutee:</strong>
                        ${escapeHtml(tuteeName)}
                    </p>

                    <p>
                        <strong>Subject:</strong>
                        ${escapeHtml(session.subject || "Math")}
                    </p>

                    <p>
                        <strong>Hours:</strong>
                        ${escapeHtml(hours)}
                    </p>

                    <p>
                        <strong>Time:</strong>
                        ${escapeHtml(timeText)}
                    </p>

                </div>

                <p>
                    Did
                    <strong>${escapeHtml(tutorName)}</strong>
                    tutor
                    <strong>${escapeHtml(tuteeName)}</strong>
                    under your supervision for
                    <strong>${escapeHtml(hours)} hour(s)</strong>
                    at
                    <strong>${escapeHtml(timeText)}</strong>?
                </p>

                <div style="
                    margin: 30px 0;
                    text-align: center;
                ">

                    <a href="${approveUrl}"
                       style="
                           display: inline-block;
                           background: #2071A7;
                           color: white;
                           padding: 14px 24px;
                           border-radius: 6px;
                           text-decoration: none;
                           font-weight: bold;
                           margin-right: 10px;
                       ">
                        Approve
                    </a>

                    <a href="${denyUrl}"
                       style="
                           display: inline-block;
                           background: #777;
                           color: white;
                           padding: 14px 24px;
                           border-radius: 6px;
                           text-decoration: none;
                           font-weight: bold;
                       ">
                        Deny
                    </a>

                </div>

                <p style="
                    color: #666;
                    font-size: 13px;
                ">
                    If you did not supervise this session,
                    please select Deny.
                </p>

            </div>
        `
    });
}
// ============================================================
// 404
// ============================================================

app.use(
    (req, res) => {

        res.status(404).send(
            "Page not found."
        );

    }
);


// ============================================================
// START SERVER
// ============================================================

if (
    process.env.NODE_ENV !== "production"
) {

    app.listen(
        PORT,
        () => {

            console.log(
                `Server running at http://localhost:${PORT}`
            );

        }
    );

}


module.exports = app;
// ============================================================
// CREATE SESSION PROPOSAL
// ============================================================

app.post(
    "/api/sessions",
    async (req, res) => {

        try {

            const {
                proposerId,
                tutorId,
                tuteeId,
                subject,
                meetingType,
                meetingLabel,
                scheduledStart,
                scheduledEnd,
                durationHours,
                location,
                notes
            } = req.body;


            if (
                !proposerId ||
                !tutorId ||
                !tuteeId ||
                !subject ||
                !meetingType ||
                !scheduledStart
            ) {

                return res.status(400).json({
                    error:
                        "Missing required session information."
                });

            }


            // ------------------------------------------------
            // Verify proposer is one of the two people
            // ------------------------------------------------

            if (
                proposerId !== tutorId &&
                proposerId !== tuteeId
            ) {

                return res.status(403).json({
                    error:
                        "You are not part of this tutoring relationship."
                });

            }


            // ------------------------------------------------
            // Verify current relationship
            // ------------------------------------------------

            const {
                data: relationship
            } =
                await supabaseAdmin
                    .from("tutee_tutors")
                    .select(`
                        tutee_id,
                        tutor_id,
                        subject_id
                    `)
                    .eq(
                        "tutee_id",
                        tuteeId
                    )
                    .eq(
                        "tutor_id",
                        tutorId
                    )
                    .eq(
                        "active",
                        true
                    )
                    .maybeSingle();


            if (!relationship) {

                return res.status(403).json({
                    error:
                        "You are not currently matched with this tutor."
                });

            }


            const start =
                new Date(
                    scheduledStart
                );


            if (
                Number.isNaN(
                    start.getTime()
                )
            ) {

                return res.status(400).json({
                    error:
                        "Invalid session date or time."
                });

            }


            let end = null;

            if (scheduledEnd) {

                end =
                    new Date(
                        scheduledEnd
                    );

            }


            let hours =
                durationHours
                    ? Number(durationHours)
                    : null;


            if (
                !hours &&
                end &&
                end > start
            ) {

                hours =
                    (
                        end.getTime() -
                        start.getTime()
                    ) /
                    (
                        1000 *
                        60 *
                        60
                    );

            }


            if (
                !hours ||
                hours <= 0
            ) {

                hours = 1;

            }


            // ------------------------------------------------
            // Create proposal
            // ------------------------------------------------

            const {
                data: session,
                error
            } =
                await supabaseAdmin
                    .from("sessions")
                    .insert({

                        tutor_id:
                            tutorId,

                        tutee_id:
                            tuteeId,

                        requester_id:
                            proposerId,

                        proposed_by:
                            proposerId,

                        subject,

                        status:
                            "proposed",

                        response_status:
                            "pending",

                        meeting_type:
                            meetingType,

                        meeting_label:
                            meetingLabel || null,

                        scheduled_time:
                            start.toISOString(),

                        scheduled_start:
                            start.toISOString(),

                        scheduled_end:
                            end
                                ? end.toISOString()
                                : null,

                        duration_hours:
                            hours,

                        location:
                            location || null,

                        notes:
                            notes || null,

                        updated_at:
                            new Date()
                                .toISOString()

                    })
                    .select()
                    .single();


            if (error) {

                console.error(
                    "Create session error:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message ||
                        "Unable to create session proposal."
                });

            }


            res.status(201).json({
                success: true,
                session
            });


        } catch (error) {

            console.error(
                "POST /api/sessions error:",
                error
            );

            res.status(500).json({
                error:
                    "Unable to create session."
            });

        }

    }
);// ============================================================
// BROADCAST MATCHING
// ============================================================


// ------------------------------------------------------------
// TUTEE: MATCH ME WITH AN AVAILABLE TUTOR
// ------------------------------------------------------------

app.post(
    "/api/match-requests",
    async (req, res) => {

        try {

            const {
                tuteeId,
                subjectId,
                message
            } = req.body;


            if (
                !tuteeId ||
                !subjectId
            ) {

                return res.status(400).json({
                    error:
                        "Tutee and subject are required."
                });

            }


            // Verify tutee
            const {
                data: tutee,
                error: tuteeError
            } =
                await supabaseAdmin
                    .from("profiles")
                    .select("id, role")
                    .eq("id", tuteeId)
                    .eq("role", "tutee")
                    .maybeSingle();


            if (
                tuteeError ||
                !tutee
            ) {

                return res.status(400).json({
                    error:
                        "Tutee account could not be found."
                });

            }


            // Make sure they don't already have
            // an active tutor
            const {
                data: currentTutor
            } =
                await supabaseAdmin
                    .from("tutee_tutors")
                    .select("tutor_id")
                    .eq(
                        "tutee_id",
                        tuteeId
                    )
                    .eq(
                        "active",
                        true
                    )
                    .maybeSingle();


            if (currentTutor) {

                return res.status(409).json({
                    error:
                        "You already have a current tutor."
                });

            }


            // Prevent multiple open broadcasts
            const {
                data: existing
            } =
                await supabaseAdmin
                    .from("match_requests")
                    .select("id")
                    .eq(
                        "tutee_id",
                        tuteeId
                    )
                    .eq(
                        "status",
                        "open"
                    )
                    .limit(1);


            if (
                existing &&
                existing.length > 0
            ) {

                return res.status(409).json({
                    error:
                        "You already have an open tutor match request."
                });

            }


            const cleanMessage =
                typeof message === "string"
                    ? message
                        .trim()
                        .slice(0, 500)
                    : null;


            const {
                data,
                error
            } =
                await supabaseAdmin
                    .from("match_requests")
                    .insert({

                        tutee_id:
                            tuteeId,

                        subject_id:
                            subjectId,

                        message:
                            cleanMessage,

                        status:
                            "open"

                    })
                    .select()
                    .single();


            if (error) {

                console.error(
                    "Create match request error:",
                    error
                );

                return res.status(500).json({
                    error:
                        "Unable to create tutor match request."
                });

            }


            res.status(201).json({
                success: true,
                request: data
            });


        } catch (error) {

            console.error(
                "POST /api/match-requests error:",
                error
            );

            res.status(500).json({
                error:
                    "Unable to create tutor match request."
            });

        }

    }
);
// ------------------------------------------------------------
// TUTOR: SEE OPEN STUDENTS NEEDING HELP
// ------------------------------------------------------------

app.get(
    "/api/match-requests",
    async (req, res) => {

        try {

            const {
                tutorId,
                subject
            } = req.query;


            if (!tutorId) {

                return res.status(400).json({
                    error:
                        "Tutor ID is required."
                });

            }


            // Verify tutor
            const {
                data: tutor
            } =
                await supabaseAdmin
                    .from("profiles")
                    .select("id, role")
                    .eq(
                        "id",
                        tutorId
                    )
                    .eq(
                        "role",
                        "tutor"
                    )
                    .maybeSingle();


            if (!tutor) {

                return res.status(403).json({
                    error:
                        "Only tutors can view available matches."
                });

            }


            // Get subjects this tutor teaches
            const {
                data: tutorSubjects,
                error: tutorSubjectsError
            } =
                await supabaseAdmin
                    .from("tutor_subjects")
                    .select("subject_id")
                    .eq(
                        "tutor_id",
                        tutorId
                    );


            if (tutorSubjectsError) {

                console.error(
                    tutorSubjectsError
                );

                return res.status(500).json({
                    error:
                        "Unable to determine tutor subjects."
                });

            }


            const subjectIds =
                (tutorSubjects || [])
                    .map(
                        row =>
                            row.subject_id
                    );


            if (
                subjectIds.length === 0
            ) {

                return res.json([]);

            }


            let query =
                supabaseAdmin
                    .from("match_requests")
                    .select(`
                        id,
                        tutee_id,
                        subject_id,
                        message,
                        status,
                        created_at
                    `)
                    .eq(
                        "status",
                        "open"
                    )
                    .in(
                        "subject_id",
                        subjectIds
                    )
                    .order(
                        "created_at",
                        {
                            ascending: true
                        }
                    );


            if (subject) {

                const {
                    data: subjectRow
                } =
                    await supabaseAdmin
                        .from("subjects")
                        .select("id")
                        .eq(
                            "slug",
                            subject
                        )
                        .maybeSingle();


                if (subjectRow) {

                    query =
                        query.eq(
                            "subject_id",
                            subjectRow.id
                        );

                }

            }


            const {
                data: requests,
                error
            } = await query;


            if (error) {

                console.error(
                    "Get match requests error:",
                    error
                );

                return res.status(500).json({
                    error:
                        "Unable to load available students."
                });

            }


            if (
                !requests ||
                requests.length === 0
            ) {

                return res.json([]);

            }


            const tuteeIds =
                [
                    ...new Set(
                        requests.map(
                            request =>
                                request.tutee_id
                        )
                    )
                ];


            const subjectIdList =
                [
                    ...new Set(
                        requests.map(
                            request =>
                                request.subject_id
                        )
                    )
                ];


            const {
                data: tutees
            } =
                await supabaseAdmin
                    .from("profiles")
                    .select(`
                        id,
                        first_name,
                        last_name,
                        student_id
                    `)
                    .in(
                        "id",
                        tuteeIds
                    );


            const {
                data: subjects
            } =
                await supabaseAdmin
                    .from("subjects")
                    .select(`
                        id,
                        name,
                        slug
                    `)
                    .in(
                        "id",
                        subjectIdList
                    );


            const tuteeMap =
                new Map(
                    (tutees || [])
                        .map(
                            tutee => [
                                tutee.id,
                                tutee
                            ]
                        )
                );


            const subjectMap =
                new Map(
                    (subjects || [])
                        .map(
                            subject => [
                                String(
                                    subject.id
                                ),
                                subject
                            ]
                        )
                );


            const result =
                requests.map(
                    request => {

                        const tutee =
                            tuteeMap.get(
                                request.tutee_id
                            );

                        const subject =
                            subjectMap.get(
                                String(
                                    request.subject_id
                                )
                            );


                        return {

                            ...request,

                            tutee_first_name:
                                tutee?.first_name ||
                                "",

                            tutee_last_name:
                                tutee?.last_name ||
                                "",

                            tutee_student_id:
                                tutee?.student_id ||
                                "",

                            subject_name:
                                subject?.name ||
                                "Math",

                            subject_slug:
                                subject?.slug ||
                                ""

                        };

                    }
                );


            res.json(result);


        } catch (error) {

            console.error(
                "GET /api/match-requests error:",
                error
            );

            res.status(500).json({
                error:
                    "Unable to load available students."
            });

        }

    }
);
// ------------------------------------------------------------
// TUTOR: ACCEPT OPEN MATCH
// ------------------------------------------------------------

app.post(
    "/api/match-requests/:id/accept",
    async (req, res) => {

        try {

            const {
                tutorId
            } = req.body;

            const requestId =
                req.params.id;


            if (!tutorId) {

                return res.status(400).json({
                    error:
                        "Tutor ID is required."
                });

            }


            // ------------------------------------------------
            // Verify tutor
            // ------------------------------------------------

            const {
                data: tutor
            } =
                await supabaseAdmin
                    .from("profiles")
                    .select("id, role")
                    .eq(
                        "id",
                        tutorId
                    )
                    .eq(
                        "role",
                        "tutor"
                    )
                    .maybeSingle();


            if (!tutor) {

                return res.status(403).json({
                    error:
                        "Only tutors can accept matches."
                });

            }


            // ------------------------------------------------
            // ATOMIC CLAIM
            //
            // Only one tutor can change open → accepted.
            // ------------------------------------------------

            const {
                data: claimedRequest,
                error: claimError
            } =
                await supabaseAdmin
                    .from("match_requests")
                    .update({

                        status:
                            "accepted",

                        matched_tutor_id:
                            tutorId,

                        updated_at:
                            new Date()
                                .toISOString()

                    })
                    .eq(
                        "id",
                        requestId
                    )
                    .eq(
                        "status",
                        "open"
                    )
                    .select()
                    .maybeSingle();


            if (claimError) {

                console.error(
                    "Claim match error:",
                    claimError
                );

                return res.status(500).json({
                    error:
                        "Unable to claim this student."
                });

            }


            // Someone else got there first.
            if (!claimedRequest) {

                return res.status(409).json({
                    error:
                        "This student has already been matched with another tutor."
                });

            }


            // ------------------------------------------------
            // Save current tutor
            // ------------------------------------------------

            // Deactivate any old relationship
            await supabaseAdmin
                .from("tutee_tutors")
                .update({
                    active: false
                })
                .eq(
                    "tutee_id",
                    claimedRequest.tutee_id
                );


            const {
                error: relationshipError
            } =
                await supabaseAdmin
                    .from("tutee_tutors")
                    .upsert({

                        tutee_id:
                            claimedRequest.tutee_id,

                        tutor_id:
                            tutorId,

                        subject_id:
                            claimedRequest.subject_id,

                        started_at:
                            new Date()
                                .toISOString(),

                        active:
                            true

                    }, {
                        onConflict:
                            "tutee_id"
                    });


            if (relationshipError) {

                console.error(
                    "Relationship creation error:",
                    relationshipError
                );

                return res.status(500).json({
                    error:
                        "The match was claimed, but the tutor relationship could not be saved."
                });

            }


            res.json({
                success: true,
                request: claimedRequest
            });


        } catch (error) {

            console.error(
                "POST /api/match-requests/:id/accept error:",
                error
            );

            res.status(500).json({
                error:
                    "Unable to accept this match."
            });

        }

    }
);
// ------------------------------------------------------------
// GET CURRENT TUTOR
// ------------------------------------------------------------

app.get(
    "/api/current-tutor/:tuteeId",
    async (req, res) => {

        try {

            const {
                tuteeId
            } = req.params;


            const {
                data: relationship,
                error
            } =
                await supabaseAdmin
                    .from("tutee_tutors")
                    .select(`
                        tutee_id,
                        tutor_id,
                        subject_id,
                        started_at,
                        active
                    `)
                    .eq(
                        "tutee_id",
                        tuteeId
                    )
                    .eq(
                        "active",
                        true
                    )
                    .maybeSingle();


            if (error) {

                return res.status(500).json({
                    error:
                        "Unable to load current tutor."
                });

            }


            if (!relationship) {

                return res.json({
                    tutor: null
                });

            }


            const {
                data: tutor
            } =
                await supabaseAdmin
                    .from("profiles")
                    .select(`
                        id,
                        first_name,
                        last_name,
                        student_id
                    `)
                    .eq(
                        "id",
                        relationship.tutor_id
                    )
                    .maybeSingle();


            res.json({
                tutor,
                subjectId:
                    relationship.subject_id,
                startedAt:
                    relationship.started_at
            });


        } catch (error) {

            console.error(
                "Current tutor error:",
                error
            );

            res.status(500).json({
                error:
                    "Unable to load current tutor."
            });

        }

    }
);
// ============================================================
// GET USER SESSIONS
// ============================================================

app.get("/api/sessions/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const { data: sessions, error } =
            await supabaseAdmin
                .from("sessions")
                .select("*")
                .or(
                    `tutor_id.eq.${userId},tutee_id.eq.${userId}`
                )
                .order(
                    "scheduled_start",
                    { ascending: true }
                );

        if (error) {
            console.error(
                "Get sessions error:",
                error
            );

            return res.status(500).json({
                error: error.message
            });
        }

        if (!sessions || sessions.length === 0) {
            return res.json([]);
        }

        const userIds = [
            ...new Set(
                sessions.flatMap(session => [
                    session.tutor_id,
                    session.tutee_id
                ])
            )
        ];

        const { data: profiles } =
            await supabaseAdmin
                .from("profiles")
                .select(
                    "id, first_name, last_name"
                )
                .in("id", userIds);

        const profileMap = {};

        (profiles || []).forEach(profile => {
            profileMap[profile.id] =
                profile;
        });

        const enrichedSessions =
            sessions.map(session => {
                const tutor =
                    profileMap[session.tutor_id];

                const tutee =
                    profileMap[session.tutee_id];

                return {
                    ...session,

                    tutor_first_name:
                        tutor?.first_name || "",

                    tutor_last_name:
                        tutor?.last_name || "",

                    tutee_first_name:
                        tutee?.first_name || "",

                    tutee_last_name:
                        tutee?.last_name || ""
                };
            });

        res.json(enrichedSessions);

    } catch (error) {
        console.error(
            "GET /api/sessions error:",
            error
        );

        res.status(500).json({
            error: "Failed to load sessions."
        });
    }
});
// ============================================================
// TUTOR MARKS SESSION COMPLETE
// ============================================================

app.patch(
    "/api/sessions/:id/complete",
    async (req, res) => {
        try {
            const { id } = req.params;
            const { tutorId } = req.body;

            const { data: session, error: findError } =
                await supabaseAdmin
                    .from("sessions")
                    .select("*")
                    .eq("id", id)
                    .single();

            if (findError || !session) {
                return res.status(404).json({
                    error: "Session not found."
                });
            }

            if (
                tutorId &&
                session.tutor_id !== tutorId
            ) {
                return res.status(403).json({
                    error:
                        "Only the assigned tutor can complete this session."
                });
            }

            if (session.tutor_completed_at) {
                return res.json({
                    success: true,
                    session
                });
            }

            const { data: updatedSession, error } =
                await supabaseAdmin
                    .from("sessions")
                    .update({
                        tutor_completed_at:
                            new Date().toISOString(),

                        status:
                            "tutor_completed",

                        updated_at:
                            new Date().toISOString()
                    })
                    .eq("id", id)
                    .select("*")
                    .single();

            if (error) {
                console.error(
                    "Complete session error:",
                    error
                );

                return res.status(500).json({
                    error: error.message
                });
            }

            res.json({
                success: true,
                session: updatedSession
            });

        } catch (error) {
            console.error(
                "PATCH /sessions/:id/complete error:",
                error
            );

            res.status(500).json({
                error:
                    "Failed to mark session complete."
            });
        }
    }
);
// ============================================================
// TUTEE CONFIRMS SESSION
// THEN EMAILS TEACHER
// ============================================================

app.patch(
    "/api/sessions/:id/confirm",
    async (req, res) => {
        try {
            const { id } = req.params;
            const { tuteeId } = req.body;

            const { data: session, error: findError } =
                await supabaseAdmin
                    .from("sessions")
                    .select("*")
                    .eq("id", id)
                    .single();

            if (findError || !session) {
                return res.status(404).json({
                    error: "Session not found."
                });
            }

            if (
                tuteeId &&
                session.tutee_id !== tuteeId
            ) {
                return res.status(403).json({
                    error:
                        "Only the assigned tutee can confirm this session."
                });
            }

            if (!session.tutor_completed_at) {
                return res.status(400).json({
                    error:
                        "The tutor must mark the session complete first."
                });
            }

            if (
                session.tutee_confirmed_at &&
                session.verification_sent_at
            ) {
                return res.json({
                    success: true,
                    alreadyConfirmed: true,
                    session
                });
            }

            // Get tutor and tutee names
            const { data: tutor } =
                await supabaseAdmin
                    .from("profiles")
                    .select(
                        "first_name, last_name"
                    )
                    .eq("id", session.tutor_id)
                    .single();

            const { data: tutee } =
                await supabaseAdmin
                    .from("profiles")
                    .select(
                        "first_name, last_name"
                    )
                    .eq("id", session.tutee_id)
                    .single();

            let token =
                session.verification_token;

            let tokenExpires =
                session.verification_token_expires_at;

            if (!token) {
                token =
                    generateVerificationToken();

                tokenExpires =
                    new Date(
                        Date.now() +
                        30 * 24 * 60 * 60 * 1000
                    ).toISOString();
            }

            const emailSession = {
                ...session,

                tutor_first_name:
                    tutor?.first_name || "",

                tutor_last_name:
                    tutor?.last_name || "",

                tutee_first_name:
                    tutee?.first_name || "",

                tutee_last_name:
                    tutee?.last_name || "",

                verification_token:
                    token
            };

            // Send the email first.
            // This prevents us from claiming it was sent
            // if Resend fails.
            await sendTeacherVerificationEmail(
                emailSession
            );

            const { data: updatedSession, error } =
                await supabaseAdmin
                    .from("sessions")
                    .update({
                        tutee_confirmed_at:
                            new Date().toISOString(),

                        verification_token:
                            token,

                        verification_token_expires_at:
                            tokenExpires,

                        verification_status:
                            "pending",

                        verification_sent_at:
                            new Date().toISOString(),

                        status:
                            "awaiting_teacher_verification",

                        updated_at:
                            new Date().toISOString()
                    })
                    .eq("id", id)
                    .select("*")
                    .single();

            if (error) {
                console.error(
                    "Confirm session update error:",
                    error
                );

                return res.status(500).json({
                    error: error.message
                });
            }

            res.json({
                success: true,
                session: updatedSession
            });

        } catch (error) {
            console.error(
                "PATCH /sessions/:id/confirm error:",
                error
            );

            res.status(500).json({
                error:
                    error.message ||
                    "Failed to confirm session."
            });
        }
    }
);
// ============================================================
// TEACHER VERIFICATION LINK
// ============================================================

app.get(
    "/verify-session/:token",
    async (req, res) => {
        try {
            const { token } = req.params;
            const decision = req.query.decision;

            if (
                decision !== "approved" &&
                decision !== "denied"
            ) {
                return res.status(400).send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Invalid Verification</title>
                    </head>
                    <body style="
                        font-family: Arial;
                        text-align: center;
                        padding: 60px;
                    ">
                        <h2>Invalid verification link.</h2>
                    </body>
                    </html>
                `);
            }

            const { data: session, error } =
                await supabaseAdmin
                    .from("sessions")
                    .select("*")
                    .eq("verification_token", token)
                    .maybeSingle();

            if (error) {
                console.error(
                    "Verification lookup error:",
                    error
                );

                return res.status(500).send(
                    "Something went wrong."
                );
            }

            if (!session) {
                return res.status(404).send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Session Not Found</title>
                    </head>
                    <body style="
                        font-family: Arial;
                        text-align: center;
                        padding: 60px;
                    ">
                        <h2>Session not found.</h2>
                        <p>
                            This verification link may be invalid.
                        </p>
                    </body>
                    </html>
                `);
            }

            if (
                session.verification_token_expires_at &&
                new Date(
                    session.verification_token_expires_at
                ) < new Date()
            ) {
                return res.status(410).send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Link Expired</title>
                    </head>
                    <body style="
                        font-family: Arial;
                        text-align: center;
                        padding: 60px;
                    ">
                        <h2>This verification link has expired.</h2>
                        <p>
                            Please contact JCHS Math Tutoring
                            if you need a new verification link.
                        </p>
                    </body>
                    </html>
                `);
            }

            if (
                session.verification_status === "approved" ||
                session.verification_status === "denied"
            ) {
                return res.send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Already Verified</title>
                    </head>
                    <body style="
                        font-family: Arial;
                        text-align: center;
                        padding: 60px;
                    ">
                        <h2>
                            This session has already been reviewed.
                        </h2>

                        <p>
                            Status:
                            <strong>
                                ${escapeHtml(
                                    session.verification_status
                                )}
                            </strong>
                        </p>
                    </body>
                    </html>
                `);
            }

            const newStatus =
                decision === "approved"
                    ? "approved"
                    : "denied";

            const sessionStatus =
                decision === "approved"
                    ? "verified"
                    : "verification_denied";

            const { error: updateError } =
                await supabaseAdmin
                    .from("sessions")
                    .update({
                        verification_status:
                            newStatus,

                        status:
                            sessionStatus,

                        verified_at:
                            decision === "approved"
                                ? new Date().toISOString()
                                : null,

                        verification_notes:
                            decision === "approved"
                                ? "Approved by teacher."
                                : "Denied by teacher.",

                        updated_at:
                            new Date().toISOString()
                    })
                    .eq("id", session.id);

            if (updateError) {
                console.error(
                    "Verification update error:",
                    updateError
                );

                return res.status(500).send(
                    "Could not update the session."
                );
            }

            const title =
                decision === "approved"
                    ? "Session Approved ✓"
                    : "Session Denied";

            const message =
                decision === "approved"
                    ? "The tutoring session has been verified. The tutor's volunteer hours will now count."
                    : "The tutoring session has been marked as denied. The volunteer hours will not count.";

            res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">

                    <meta
                        name="viewport"
                        content="width=device-width, initial-scale=1.0"
                    >

                    <title>
                        ${title}
                    </title>

                    <style>
                        body {
                            margin: 0;
                            min-height: 100vh;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            background: #f5f1e8;
                            font-family: Arial, sans-serif;
                        }

                        .card {
                            width: min(90%, 600px);
                            background: white;
                            padding: 40px;
                            border-radius: 12px;
                            text-align: center;
                            box-shadow:
                                0 10px 35px
                                rgba(0,0,0,0.12);
                        }

                        h1 {
                            color: #153F78;
                        }

                        p {
                            color: #444;
                            line-height: 1.6;
                        }
                    </style>
                </head>

                <body>

                    <div class="card">

                        <h1>
                            ${title}
                        </h1>

                        <p>
                            ${message}
                        </p>

                    </div>

                </body>
                </html>
            `);

        } catch (error) {
            console.error(
                "GET /verify-session error:",
                error
            );

            res.status(500).send(
                "Something went wrong."
            );
        }
    }
);
// ============================================================
// TUTOR VOLUNTEER HOURS
// ============================================================

app.get(
    "/api/volunteer-hours/:tutorId",
    async (req, res) => {
        try {
            const { tutorId } = req.params;

            const { data: sessions, error } =
                await supabaseAdmin
                    .from("sessions")
                    .select(`
                        id,
                        tutor_id,
                        tutee_id,
                        subject,
                        scheduled_start,
                        scheduled_end,
                        scheduled_time,
                        duration_hours,
                        status,
                        verification_status,
                        verified_at
                    `)
                    .eq("tutor_id", tutorId)
                    .eq(
                        "verification_status",
                        "approved"
                    )
                    .order(
                        "scheduled_start",
                        { ascending: false }
                    );

            if (error) {
                console.error(
                    "Volunteer hours error:",
                    error
                );

                return res.status(500).json({
                    error: error.message
                });
            }

            const approvedSessions =
                sessions || [];

            const totalHours =
                approvedSessions.reduce(
                    (total, session) =>
                        total +
                        getSessionHours(session),
                    0
                );

            res.json({
                totalHours,
                sessions:
                    approvedSessions
            });

        } catch (error) {
            console.error(
                "GET /volunteer-hours error:",
                error
            );

            res.status(500).json({
                error:
                    "Failed to load volunteer hours."
            });
        }
    }
);
// ============================================================
// ACCEPT SESSION
// ============================================================

app.patch(
    "/api/sessions/:id/accept",
    async (req, res) => {

        try {

            const {
                userId
            } = req.body;


            const {
                data: session,
                error: findError
            } =
                await supabaseAdmin
                    .from("sessions")
                    .select("*")
                    .eq(
                        "id",
                        req.params.id
                    )
                    .single();


            if (
                findError ||
                !session
            ) {

                return res.status(404).json({
                    error:
                        "Session not found."
                });

            }


            if (
                session.tutor_id !== userId &&
                session.tutee_id !== userId
            ) {

                return res.status(403).json({
                    error:
                        "You are not part of this session."
                });

            }


            // You cannot accept your own proposal.
            if (
                session.proposed_by === userId
            ) {

                return res.status(400).json({
                    error:
                        "You cannot accept your own session proposal."
                });

            }


            if (
                session.status !== "proposed"
            ) {

                return res.status(400).json({
                    error:
                        "This session is no longer awaiting a response."
                });

            }


            const {
                data: updated,
                error
            } =
                await supabaseAdmin
                    .from("sessions")
                    .update({

                        status:
                            "scheduled",

                        response_status:
                            "accepted",

                        updated_at:
                            new Date()
                                .toISOString()

                    })
                    .eq(
                        "id",
                        req.params.id
                    )
                    .eq(
                        "status",
                        "proposed"
                    )
                    .select()
                    .single();


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.json({
                success: true,
                session: updated
            });


        } catch (error) {

            console.error(
                "Accept session error:",
                error
            );

            res.status(500).json({
                error:
                    "Unable to accept session."
            });

        }

    }
);
// ============================================================
// DECLINE SESSION
// ============================================================

app.patch(
    "/api/sessions/:id/decline",
    async (req, res) => {

        try {

            const {
                userId
            } = req.body;


            const {
                data: session
            } =
                await supabaseAdmin
                    .from("sessions")
                    .select("*")
                    .eq(
                        "id",
                        req.params.id
                    )
                    .single();


            if (!session) {

                return res.status(404).json({
                    error:
                        "Session not found."
                });

            }


            if (
                session.tutor_id !== userId &&
                session.tutee_id !== userId
            ) {

                return res.status(403).json({
                    error:
                        "You are not part of this session."
                });

            }


            const {
                data: updated,
                error
            } =
                await supabaseAdmin
                    .from("sessions")
                    .update({

                        status:
                            "cancelled",

                        response_status:
                            "declined",

                        updated_at:
                            new Date()
                                .toISOString()

                    })
                    .eq(
                        "id",
                        session.id
                    )
                    .select()
                    .single();


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.json({
                success: true,
                session: updated
            });


        } catch (error) {

            console.error(
                "Decline session error:",
                error
            );

            res.status(500).json({
                error:
                    "Unable to decline session."
            });

        }

    }
);
// ============================================================
// RESCHEDULE SESSION
// ============================================================

app.patch(
    "/api/sessions/:id/reschedule",
    async (req, res) => {

        try {

            const {
                userId,
                meetingType,
                meetingLabel,
                scheduledStart,
                scheduledEnd,
                durationHours,
                location,
                notes
            } = req.body;


            const {
                data: session
            } =
                await supabaseAdmin
                    .from("sessions")
                    .select("*")
                    .eq(
                        "id",
                        req.params.id
                    )
                    .single();


            if (!session) {

                return res.status(404).json({
                    error:
                        "Session not found."
                });

            }


            if (
                session.tutor_id !== userId &&
                session.tutee_id !== userId
            ) {

                return res.status(403).json({
                    error:
                        "You are not part of this session."
                });

            }


            const start =
                new Date(
                    scheduledStart
                );


            if (
                Number.isNaN(
                    start.getTime()
                )
            ) {

                return res.status(400).json({
                    error:
                        "Invalid new date or time."
                });

            }


            let end = null;

            if (scheduledEnd) {

                end =
                    new Date(
                        scheduledEnd
                    );

            }


            const {
                data: updated,
                error
            } =
                await supabaseAdmin
                    .from("sessions")
                    .update({

                        proposed_by:
                            userId,

                        status:
                            "proposed",

                        response_status:
                            "pending",

                        meeting_type:
                            meetingType,

                        meeting_label:
                            meetingLabel || null,

                        scheduled_time:
                            start.toISOString(),

                        scheduled_start:
                            start.toISOString(),

                        scheduled_end:
                            end
                                ? end.toISOString()
                                : null,

                        duration_hours:
                            durationHours
                                ? Number(
                                    durationHours
                                )
                                : session.duration_hours,

                        location:
                            location || null,

                        notes:
                            notes || null,

                        reschedule_requested_by:
                            userId,

                        updated_at:
                            new Date()
                                .toISOString()

                    })
                    .eq(
                        "id",
                        session.id
                    )
                    .select()
                    .single();


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.json({
                success: true,
                session: updated
            });


        } catch (error) {

            console.error(
                "Reschedule session error:",
                error
            );

            res.status(500).json({
                error:
                    "Unable to reschedule session."
            });

        }

    }
);