const form =
    document.getElementById(
        "auth-form"
    );

const alertContainer =
    document.getElementById(
        "alert-container"
    );

const submitButton =
    document.getElementById(
        "submit-btn"
    );


// ============================================================
// SIGNUP ROLE UI
// ============================================================

const tutorButton =
    document.getElementById(
        "tutor-btn"
    );

const tuteeButton =
    document.getElementById(
        "tutee-btn"
    );

const roleInput =
    document.getElementById(
        "role"
    );

const tutorSection =
    document.getElementById(
        "tutor-section"
    );

const tuteeSection =
    document.getElementById(
        "tutee-section"
    );


function selectRole(
    role
) {

    if (!roleInput) {
        return;
    }


    roleInput.value =
        role;


    if (tutorButton) {

        tutorButton.classList.toggle(
            "active",
            role === "tutor"
        );

    }


    if (tuteeButton) {

        tuteeButton.classList.toggle(
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

}


if (tutorButton) {

    tutorButton.addEventListener(
        "click",
        () => {

            selectRole(
                "tutor"
            );

        }
    );

}


if (tuteeButton) {

    tuteeButton.addEventListener(
        "click",
        () => {

            selectRole(
                "tutee"
            );

        }
    );

}


// ============================================================
// FORM SUBMISSION
// ============================================================

if (form) {

    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            clearAlert();


            const isSignup =
                Boolean(
                    document.getElementById(
                        "first-name"
                    )
                );


            submitButton.disabled =
                true;


            submitButton.textContent =
                isSignup
                    ? "Creating Account..."
                    : "Logging In...";


            try {

                if (isSignup) {

                    await signup();

                } else {

                    await login();

                }

            } catch (error) {

                console.error(
                    error
                );

                showAlert(
                    error.message ||
                    "Something went wrong.",
                    "error"
                );

            } finally {

                submitButton.disabled =
                    false;

                submitButton.textContent =
                    isSignup
                        ? "Create Account"
                        : "Log In";

            }

        }
    );

}


// ============================================================
// SIGNUP
// ============================================================

async function signup() {

    const firstName =
        document.getElementById(
            "first-name"
        ).value.trim();


    const lastName =
        document.getElementById(
            "last-name"
        ).value.trim();


    const studentId =
        document.getElementById(
            "student-id"
        ).value.trim();


    const role =
        document.getElementById(
            "role"
        ).value;


    if (!role) {

        throw new Error(
            "Please choose whether you are signing up as a tutor or tutee."
        );

    }


    let tuteeSubject =
        null;


    let tutorSubjects = [];


    let availability = [];


    if (role === "tutee") {

        tuteeSubject =
            document.getElementById(
                "tutee-subject"
            )?.value;


        if (!tuteeSubject) {

            throw new Error(
                "Please choose the subject you need help with."
            );

        }

    }


    if (role === "tutor") {

        tutorSubjects =
            Array.from(
                document.querySelectorAll(
                    'input[name="tutor-subject"]:checked'
                )
            ).map(
                checkbox =>
                    checkbox.value
            );


        availability =
            Array.from(
                document.querySelectorAll(
                    'input[name="availability"]:checked'
                )
            ).map(
                checkbox =>
                    checkbox.value
            );


        if (
            tutorSubjects.length === 0
        ) {

            throw new Error(
                "Please choose at least one subject you can tutor."
            );

        }


        if (
            availability.length === 0
        ) {

            throw new Error(
                "Please choose at least one availability time."
            );

        }

    }


    const response =
        await fetch(
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


    if (!response.ok) {

        throw new Error(
            result.error ||
            "Unable to create account."
        );

    }


    showAlert(
        "Account created! Redirecting...",
        "success"
    );


    setTimeout(
        () => {

            window.location.href =
                `/dashboard?id=${result.profile.id}`;

        },
        700
    );

}


// ============================================================
// LOGIN
// ============================================================

async function login() {

    const studentId =
        document.getElementById(
            "student-id"
        ).value.trim();


    if (!studentId) {

        throw new Error(
            "Please enter your Student ID."
        );

    }


    const response =
        await fetch(
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


    setTimeout(
        () => {

            window.location.href =
                `/dashboard?id=${result.profile.id}`;

        },
        500
    );

}


// ============================================================
// ALERT
// ============================================================

function showAlert(
    message,
    type
) {

    if (!alertContainer) {
        return;
    }


    alertContainer.innerHTML = "";


    const alert =
        document.createElement(
            "div"
        );


    alert.className =
        `alert ${type}`;


    alert.textContent =
        message;


    alertContainer.appendChild(
        alert
    );

}


function clearAlert() {

    if (alertContainer) {

        alertContainer.innerHTML =
            "";

    }

}