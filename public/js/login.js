let supabaseClient = null;

// ============================================================
// SUPABASE INITIALIZATION
// ============================================================

async function initializeSupabase() {
    try {
        const response = await fetch("/api/config");

        if (!response.ok) {
            throw new Error("Could not load server configuration.");
        }

        const config = await response.json();

        supabaseClient = window.supabase.createClient(
            config.supabaseUrl,
            config.supabasePublishableKey
        );

        return true;

    } catch (error) {
        console.error("Supabase initialization error:", error);

        showAlert(
            "Unable to connect to the server.",
            "error"
        );

        return false;
    }
}

// ============================================================
// ALERTS
// ============================================================

function showAlert(message, type = "error") {
    const container = document.getElementById("alert-container");

    if (!container) return;

    container.innerHTML = `
        <div class="alert ${type}">
            ${message}
        </div>
    `;
}

// ============================================================
// PAGE INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

    console.log("login.js loaded");

    const form = document.getElementById("auth-form");

    if (!form) {
        console.error("Could not find #auth-form");
        return;
    }

    await initializeSupabase();

    // ========================================================
    // ROLE TOGGLE
    // ========================================================

    const tutorBtn = document.getElementById("tutor-btn");
    const tuteeBtn = document.getElementById("tutee-btn");

    const tutorSection = document.getElementById("tutor-section");
    const tuteeSection = document.getElementById("tutee-section");

    const roleInput = document.getElementById("role");

    function selectRole(role) {

        if (!roleInput) return;

        roleInput.value = role;

        if (tutorBtn) {
            tutorBtn.classList.toggle(
                "active",
                role === "tutor"
            );
        }

        if (tuteeBtn) {
            tuteeBtn.classList.toggle(
                "active",
                role === "tutee"
            );
        }

        if (tutorSection) {
            tutorSection.classList.toggle(
                "active",
                role === "tutor"
            );
        }

        if (tuteeSection) {
            tuteeSection.classList.toggle(
                "active",
                role === "tutee"
            );
        }

        const tuteeSubject =
            document.getElementById("tutee-subject");

        if (tuteeSubject) {
            tuteeSubject.required =
                role === "tutee";
        }
    }

    if (tutorBtn) {
        tutorBtn.addEventListener(
            "click",
            () => selectRole("tutor")
        );
    }

    if (tuteeBtn) {
        tuteeBtn.addEventListener(
            "click",
            () => selectRole("tutee")
        );
    }

    // ========================================================
    // FORM SUBMISSION
    // ========================================================

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        console.log("Form submitted");

        // ====================================================
        // LOGIN PAGE
        // ====================================================

        const firstNameElement =
            document.getElementById("first-name");

        const lastNameElement =
            document.getElementById("last-name");

        const studentIdElement =
            document.getElementById("student-id");

        const firstName =
            firstNameElement?.value.trim();

        const lastName =
            lastNameElement?.value.trim();

        const studentId =
            studentIdElement?.value.trim();

        // ====================================================
        // DETERMINE WHETHER THIS IS LOGIN OR SIGNUP
        // ====================================================

        const isSignup =
            !!firstNameElement &&
            !!lastNameElement &&
            !!roleInput;

        // ====================================================
        // LOGIN
        // ====================================================

        if (!isSignup) {

            if (!studentId) {
                showAlert(
                    "Please enter your Student ID.",
                    "error"
                );

                return;
            }

            const submitButton =
                document.getElementById("submit-btn");

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Logging In...";
            }

            try {

                const response = await fetch(
                    "/api/login",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            studentId
                        })
                    }
                );

                const result =
                    await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.error ||
                        "Unable to log in."
                    );
                }

                showAlert(
                    "Login successful! Redirecting...",
                    "success"
                );

                setTimeout(() => {

                    window.location.href =
                        result.redirect ||
                        `/dashboard?id=${result.profile.id}`;

                }, 500);

            } catch (error) {

                console.error(
                    "Login error:",
                    error
                );

                showAlert(
                    error.message ||
                    "Something went wrong while logging in.",
                    "error"
                );

                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = "Log In";
                }
            }

            return;
        }

        // ====================================================
        // SIGNUP
        // ====================================================

        console.log("Create Account clicked");

        const role = roleInput?.value;

        if (!firstName || !lastName || !studentId) {

            showAlert(
                "Please fill out all required fields.",
                "error"
            );

            return;
        }

        if (!role) {

            showAlert(
                "Please select whether you are a Tutor or Tutee.",
                "error"
            );

            return;
        }

        if (!supabaseClient) {

            showAlert(
                "Unable to connect to the server.",
                "error"
            );

            return;
        }

        const submitButton =
            document.getElementById("submit-btn");

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent =
                "Creating Account...";
        }

        try {

            // =================================================
            // TUTEE DATA
            // =================================================

            let tuteeSubject = null;

            if (role === "tutee") {

                tuteeSubject =
                    document.getElementById(
                        "tutee-subject"
                    )?.value;

                if (!tuteeSubject) {
                    throw new Error(
                        "Please choose a subject."
                    );
                }
            }

            // =================================================
            // TUTOR DATA
            // =================================================

            let tutorSubjects = [];
            let availability = [];

            if (role === "tutor") {

                tutorSubjects = [
                    ...document.querySelectorAll(
                        'input[name="tutor-subject"]:checked'
                    )
                ].map(input => input.value);

                if (tutorSubjects.length === 0) {
                    throw new Error(
                        "Please select at least one subject you can tutor."
                    );
                }

                availability = [
                    ...document.querySelectorAll(
                        'input[name="availability"]:checked'
                    )
                ].map(input => input.value);

                if (availability.length === 0) {
                    throw new Error(
                        "Please select at least one availability time."
                    );
                }
            }

            // =================================================
            // SEND SIGNUP REQUEST
            // =================================================

            const response = await fetch(
                "/api/signup",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        firstName,
                        lastName,
                        studentId,
                        role,
                        tuteeSubject,
                        tutorSubjects,
                        availability
                    })
                }
            );

            const result =
                await response.json();

            // =================================================
            // ACCOUNT ALREADY EXISTS
            // =================================================

            if (
                response.status === 409 &&
                result.accountExists
            ) {

                showAlert(
                    `${result.error}
                    <a
                        href="/login"
                        style="
                            color: inherit;
                            font-weight: 700;
                            text-decoration: underline;
                            margin-left: 4px;
                        "
                    >
                        Log In
                    </a>`,
                    "error"
                );

                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent =
                        "Create Account";
                }

                return;
            }

            // =================================================
            // OTHER SERVER ERRORS
            // =================================================

            if (!response.ok) {

                throw new Error(
                    result.error ||
                    "Unable to create your account."
                );
            }

            // =================================================
            // SUCCESS
            // =================================================

            showAlert(
                "Account created successfully! Redirecting...",
                "success"
            );

            setTimeout(() => {

                window.location.href =
                    "/onboarding";

            }, 1000);

        } catch (error) {

            console.error(
                "Signup error:",
                error
            );

            showAlert(
                error.message ||
                "Something went wrong.",
                "error"
            );

            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent =
                    "Create Account";
            }
        }
    });
});