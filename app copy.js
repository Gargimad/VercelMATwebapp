require("dotenv").config();

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


            res.render(
                "dashboard",
                {
                    profile
                }
            );


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