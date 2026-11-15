let currentUser = null;
let currentRole = null;
let selectedSubject = null;


// ============================================================
// INITIALIZE
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

    try {

        const response = await fetch(
            `/api/profile/${encodeURIComponent(CURRENT_USER_ID)}`
        );

        if (!response.ok) {
            throw new Error("Unable to load your profile.");
        }

        currentUser = await response.json();

        currentRole = currentUser.role;

        setupNavigation();

        if (currentRole === "tutee") {
            setupTutee();
        }

        if (currentRole === "tutor") {
            setupTutor();
        }

    } catch (error) {

        console.error("Dashboard initialization error:", error);

        showAlert(
            error.message || "Unable to load dashboard.",
            "error"
        );

    }

});


// ============================================================
// NAVIGATION
// ============================================================

function setupNavigation() {

    const navLinks =
        document.querySelectorAll(".nav-link");

    const tabButtons =
        document.querySelectorAll("[data-tab]");


    tabButtons.forEach(button => {

        button.addEventListener("click", () => {

            const tabId =
                button.dataset.tab;

            if (!tabId) return;

            switchTab(tabId);

        });

    });


    navLinks.forEach(link => {

        link.addEventListener("click", () => {

            const tabId =
                link.dataset.tab;

            switchTab(tabId);

        });

    });

}


function switchTab(tabId) {

    document
        .querySelectorAll(".dashboard-tab")
        .forEach(tab => {

            tab.classList.remove("active");

        });


    const target =
        document.getElementById(tabId);

    if (target) {
        target.classList.add("active");
    }


    document
        .querySelectorAll(".nav-link")
        .forEach(link => {

            link.classList.toggle(
                "active",
                link.dataset.tab === tabId
            );

        });


    if (tabId === "requests-tab") {
        loadRequestsPage();
    }


    if (tabId === "upcoming-tab") {
        loadUpcomingSessions();
    }


    if (tabId === "past-tab") {
        loadPastSessions();
    }

}


// ============================================================
// TUTEE SETUP
// ============================================================

function setupTutee() {

    const subjectSelect =
        document.getElementById("subjectSelect");

    const findTutorsButton =
        document.getElementById("findTutorsBtn");

    const spinButton =
        document.getElementById("spinForMeBtn");

    const findTutorPageButton =
        document.getElementById("findTutorPageBtn");


    if (subjectSelect) {

        subjectSelect.addEventListener(
            "change",
            () => {

                selectedSubject =
                    subjectSelect.value;

            }
        );

    }


    if (findTutorsButton) {

        findTutorsButton.addEventListener(
            "click",
            () => {

                const subject =
                    subjectSelect?.value;

                if (!subject) {

                    showAlert(
                        "Please choose a subject first.",
                        "error"
                    );

                    return;
                }

                selectedSubject = subject;

                loadTutors(
                    subject,
                    "tutorResults"
                );

            }
        );

    }


    if (spinButton) {

        spinButton.addEventListener(
            "click",
            spinForMe
        );

    }


    if (findTutorPageButton) {

        findTutorPageButton.addEventListener(
            "click",
            () => {

                const subject =
                    document.getElementById(
                        "findTutorSubject"
                    )?.value;

                if (!subject) {

                    showAlert(
                        "Please choose a subject first.",
                        "error"
                    );

                    return;
                }

                loadTutors(
                    subject,
                    "findTutorResults"
                );

            }
        );

    }


    loadTuteeRequests();

}


// ============================================================
// TUTOR SETUP
// ============================================================

function setupTutor() {

    loadTutorRequests();

}


// ============================================================
// LOAD TUTORS
// ============================================================

async function loadTutors(
    subject,
    containerId = "tutorResults"
) {

    const container =
        document.getElementById(containerId);

    if (!container) return;


    container.innerHTML = `
        <div class="loading-state">
            <p>Finding tutors...</p>
        </div>
    `;


    try {

        const response =
            await fetch(
                `/api/tutors?subject=${encodeURIComponent(subject)}`
            );


        const result =
            await response.json();


        if (!response.ok) {
            throw new Error(
                result.error ||
                "Unable to find tutors."
            );
        }


        renderTutors(
            result,
            containerId
        );


    } catch (error) {

        console.error(
            "Load tutors error:",
            error
        );

        container.innerHTML = `
            <div class="empty-state">
                <p>
                    ${escapeHTML(error.message)}
                </p>
            </div>
        `;

    }

}


// ============================================================
// RENDER TUTORS
// ============================================================

function renderTutors(
    tutors,
    containerId = "tutorResults"
) {

    const container =
        document.getElementById(containerId);

    if (!container) return;


    if (!tutors || tutors.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <p>
                    No tutors are currently available
                    for this subject.
                </p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        tutors.map(tutor => {

            const fullName =
                `${tutor.first_name} ${tutor.last_name}`;


            return `
                <div class="tutor-card">

                    <div class="tutor-card-info">

                        <div class="tutor-avatar">
                            ${escapeHTML(
                                tutor.first_name
                                    ?.charAt(0)
                                    ?.toUpperCase() || "T"
                            )}
                        </div>

                        <div>

                            <h3>
                                ${escapeHTML(fullName)}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    tutor.subject ||
                                    "Math"
                                )}
                            </p>

                        </div>

                    </div>


                    <button
                        type="button"
                        class="btn-primary"
                        onclick="requestTutor(
                            '${escapeJS(tutor.id)}',
                            '${escapeJS(fullName)}',
                            '${escapeJS(tutor.subject_slug)}'
                        )"
                    >
                        Request Tutor
                    </button>

                </div>
            `;

        }).join("");

}


// ============================================================
// SPIN FOR ME
// ============================================================

async function spinForMe() {

    const subjectSelect =
        document.getElementById("subjectSelect");

    const subject =
        subjectSelect?.value;


    if (!subject) {

        showAlert(
            "Choose a subject first so we can find your match.",
            "error"
        );

        return;
    }


    try {

        const response =
            await fetch(
                `/api/tutors?subject=${encodeURIComponent(subject)}`
            );


        const tutors =
            await response.json();


        if (!response.ok) {

            throw new Error(
                tutors.error ||
                "Unable to find tutors."
            );

        }


        if (!tutors.length) {

            showAlert(
                "There aren't any tutors available for that subject yet.",
                "error"
            );

            return;
        }


        const randomIndex =
            Math.floor(
                Math.random() * tutors.length
            );


        const tutor =
            tutors[randomIndex];


        renderTutors(
            [tutor],
            "tutorResults"
        );


        showAlert(
            `🎲 We picked ${tutor.first_name} for you!`,
            "success"
        );


    } catch (error) {

        console.error(
            "Spin for me error:",
            error
        );

        showAlert(
            error.message,
            "error"
        );

    }

}


// ============================================================
// REQUEST TUTOR
// ============================================================

async function requestTutor(
    tutorId,
    tutorName,
    subjectSlug
) {

    try {

        const response =
            await fetch(
                `/api/subject/${encodeURIComponent(subjectSlug)}`
            );


        const subject =
            await response.json();


        if (!response.ok) {

            throw new Error(
                subject.error ||
                "Subject not found."
            );

        }


        openRequestModal(
            tutorId,
            tutorName,
            subject.id,
            subject.name
        );


    } catch (error) {

        console.error(
            "Request tutor error:",
            error
        );

        showAlert(
            error.message,
            "error"
        );

    }

}


// ============================================================
// REQUEST MODAL
// ============================================================

function openRequestModal(
    tutorId,
    tutorName,
    subjectId,
    subjectName
) {

    const modal =
        document.getElementById(
            "requestModal"
        );


    if (!modal) {

        console.error(
            "Request modal not found."
        );

        return;
    }


    const tutorNameElement =
        document.getElementById(
            "requestTutorName"
        );


    const subjectNameElement =
        document.getElementById(
            "requestSubjectName"
        );


    const note =
        document.getElementById(
            "requestNote"
        );


    if (tutorNameElement) {
        tutorNameElement.textContent =
            tutorName;
    }


    if (subjectNameElement) {
        subjectNameElement.textContent =
            subjectName;
    }


    if (note) {
        note.value = "";
    }


    modal.dataset.tutorId =
        tutorId;

    modal.dataset.subjectId =
        subjectId;


    modal.classList.add("active");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    setTimeout(() => {

        note?.focus();

    }, 100);

}


function closeRequestModal() {

    const modal =
        document.getElementById(
            "requestModal"
        );


    if (!modal) return;


    modal.classList.remove(
        "active"
    );


    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    delete modal.dataset.tutorId;
    delete modal.dataset.subjectId;

}


// Close modal when clicking outside

document.addEventListener(
    "click",
    event => {

        const modal =
            document.getElementById(
                "requestModal"
            );


        if (
            modal &&
            event.target === modal
        ) {

            closeRequestModal();

        }

    }
);


// Close modal with Escape

document.addEventListener(
    "keydown",
    event => {

        if (event.key !== "Escape") {
            return;
        }


        const modal =
            document.getElementById(
                "requestModal"
            );


        if (
            modal &&
            modal.classList.contains("active")
        ) {

            closeRequestModal();

        }

    }
);


// ============================================================
// SUBMIT TUTOR REQUEST
// ============================================================

async function submitTutorRequest() {

    const modal =
        document.getElementById(
            "requestModal"
        );


    if (!modal) return;


    const tutorId =
        modal.dataset.tutorId;


    const subjectId =
        modal.dataset.subjectId;


    const noteElement =
        document.getElementById(
            "requestNote"
        );


    const sendButton =
        document.getElementById(
            "sendRequestBtn"
        );


    if (!tutorId || !subjectId) {

        showAlert(
            "Something went wrong. Please try again.",
            "error"
        );

        return;
    }


    const message =
        noteElement?.value.trim() || null;


    if (sendButton) {

        sendButton.disabled = true;
        sendButton.textContent = "Sending...";

    }


    try {

        const response =
            await fetch(
                "/api/tutoring-requests",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        tutorId,

                        tuteeId:
                            CURRENT_USER_ID,

                        subjectId,

                        message

                    })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.error ||
                "Unable to send tutoring request."
            );

        }


        closeRequestModal();


        showAlert(
            "Your tutoring request was sent!",
            "success"
        );


        loadTuteeRequests();


    } catch (error) {

        console.error(
            "Submit request error:",
            error
        );


        showAlert(
            error.message,
            "error"
        );


    } finally {

        if (sendButton) {

            sendButton.disabled = false;
            sendButton.textContent =
                "Send Request";

        }

    }

}


// ============================================================
// LOAD TUTEE REQUESTS
// ============================================================

async function loadTuteeRequests() {

    const container =
        document.getElementById(
            "tuteeRequests"
        );


    if (!container) return;


    try {

        const response =
            await fetch(
                `/api/tutoring-requests?userId=${encodeURIComponent(
                    CURRENT_USER_ID
                )}&role=tutee`
            );


        const requests =
            await response.json();


        if (!response.ok) {

            throw new Error(
                requests.error ||
                "Unable to load requests."
            );

        }


        renderRequests(
            requests,
            false,
            "tuteeRequests"
        );


    } catch (error) {

        console.error(
            "Load tutee requests error:",
            error
        );


        container.innerHTML = `
            <div class="empty-state">
                <p>
                    ${escapeHTML(error.message)}
                </p>
            </div>
        `;

    }

}


// ============================================================
// LOAD TUTOR REQUESTS
// ============================================================

async function loadTutorRequests() {

    const container =
        document.getElementById(
            "tutorRequests"
        );


    if (!container) return;


    try {

        const response =
            await fetch(
                `/api/tutoring-requests?userId=${encodeURIComponent(
                    CURRENT_USER_ID
                )}&role=tutor`
            );


        const requests =
            await response.json();


        if (!response.ok) {

            throw new Error(
                requests.error ||
                "Unable to load requests."
            );

        }


        renderRequests(
            requests,
            true,
            "tutorRequests"
        );


    } catch (error) {

        console.error(
            "Load tutor requests error:",
            error
        );


        container.innerHTML = `
            <div class="empty-state">
                <p>
                    ${escapeHTML(error.message)}
                </p>
            </div>
        `;

    }

}


// ============================================================
// LOAD REQUESTS PAGE
// ============================================================

async function loadRequestsPage() {

    const container =
        document.getElementById(
            "requestsPage"
        );


    if (!container) return;


    container.innerHTML = `
        <div class="loading-state">
            <p>Loading requests...</p>
        </div>
    `;


    try {

        const role =
            CURRENT_USER_ROLE;


        const response =
            await fetch(
                `/api/tutoring-requests?userId=${encodeURIComponent(
                    CURRENT_USER_ID
                )}&role=${encodeURIComponent(role)}`
            );


        const requests =
            await response.json();


        if (!response.ok) {

            throw new Error(
                requests.error ||
                "Unable to load requests."
            );

        }


        renderRequests(
            requests,
            role === "tutor",
            "requestsPage"
        );


    } catch (error) {

        console.error(
            "Load requests page error:",
            error
        );


        container.innerHTML = `
            <div class="empty-state">
                <p>
                    ${escapeHTML(error.message)}
                </p>
            </div>
        `;

    }

}


// ============================================================
// RENDER REQUESTS
// ============================================================

function renderRequests(
    requests,
    tutorView,
    containerId
) {

    const container =
        document.getElementById(
            containerId
        );


    if (!container) return;


    if (!requests || requests.length === 0) {

        container.innerHTML = `
            <div class="empty-state">

                <p>
                    ${
                        tutorView
                            ? "You don't have any tutoring requests yet."
                            : "You haven't sent any tutoring requests yet."
                    }
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        requests.map(request => {

            const status =
                request.status || "pending";


            let heading;


            if (tutorView) {

                heading =
                    `${request.tutee_first_name || "A student"} requests your help with ${request.subject_name || "Math"}.`;

            } else {

                heading =
                    `Request to ${request.tutor_first_name || "your tutor"}`;

            }


            let noteHTML = "";


            if (request.message) {

                noteHTML = `
                    <div class="request-note-display">

                        <span class="request-note-label-small">
                            Note from ${
                                tutorView
                                    ? "the tutee"
                                    : "you"
                            }
                        </span>

                        <p>
                            ${escapeHTML(
                                request.message
                            )}
                        </p>

                    </div>
                `;

            }


            let actionsHTML = "";


            if (
                tutorView &&
                status === "pending"
            ) {

                actionsHTML = `
                    <div class="request-actions">

                        <button
                            type="button"
                            class="btn-primary"
                            onclick="updateRequest(
                                '${escapeJS(request.id)}',
                                'accepted'
                            )"
                        >
                            Accept
                        </button>

                        <button
                            type="button"
                            class="btn-secondary"
                            onclick="updateRequest(
                                '${escapeJS(request.id)}',
                                'declined'
                            )"
                        >
                            Decline
                        </button>

                    </div>
                `;

            }


            if (
                !tutorView &&
                status === "accepted"
            ) {

                actionsHTML = `
                    <div class="request-actions">

                        <button
                            type="button"
                            class="btn-primary"
                            onclick="openSchedule(
                                '${escapeJS(request.id)}'
                            )"
                        >
                            Schedule Session
                        </button>

                    </div>
                `;

            }


            if (
                !tutorView &&
                status === "pending"
            ) {

                actionsHTML = `
                    <div class="request-actions">

                        <button
                            type="button"
                            class="btn-secondary"
                            onclick="updateRequest(
                                '${escapeJS(request.id)}',
                                'cancelled'
                            )"
                        >
                            Cancel Request
                        </button>

                    </div>
                `;

            }


            return `
                <article class="request-card">

                    <div class="request-top">

                        <div>

                            <strong>
                                ${escapeHTML(heading)}
                            </strong>

                            <p class="request-subject-line">
                                ${escapeHTML(
                                    request.subject_name ||
                                    "Math"
                                )}
                            </p>

                        </div>


                        <span
                            class="status ${escapeHTML(status)}"
                        >
                            ${escapeHTML(status)}
                        </span>

                    </div>


                    ${noteHTML}


                    <div class="request-date">

                        ${formatDate(
                            request.created_at
                        )}

                    </div>


                    ${actionsHTML}

                </article>
            `;

        }).join("");

}


// ============================================================
// UPDATE REQUEST
// ============================================================

async function updateRequest(
    requestId,
    status
) {

    const actionText = {

        accepted: "accept this request",

        declined: "decline this request",

        cancelled: "cancel this request"

    };


    if (
        !confirm(
            `Are you sure you want to ${actionText[status] || "update this request"}?`
        )
    ) {

        return;

    }


    try {

        const response =
            await fetch(
                `/api/tutoring-requests/${encodeURIComponent(
                    requestId
                )}`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        status
                    })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.error ||
                "Unable to update request."
            );

        }


        showAlert(
            `Request ${status}.`,
            "success"
        );


        if (CURRENT_USER_ROLE === "tutor") {

            await loadTutorRequests();

        } else {

            await loadTuteeRequests();

        }


        const requestsTab =
            document.getElementById(
                "requests-tab"
            );


        if (
            requestsTab &&
            requestsTab.classList.contains("active")
        ) {

            await loadRequestsPage();

        }


    } catch (error) {

        console.error(
            "Update request error:",
            error
        );


        showAlert(
            error.message,
            "error"
        );

    }

}


// ============================================================
// SESSIONS PLACEHOLDERS
// ============================================================

async function loadUpcomingSessions() {

    const container =
        document.getElementById(
            "upcomingSessions"
        );


    if (!container) return;


    container.innerHTML = `
        <div class="empty-state">
            <p>
                Session scheduling will appear here
                once a tutoring request is accepted.
            </p>
        </div>
    `;

}


async function loadPastSessions() {

    const container =
        document.getElementById(
            "pastSessions"
        );


    if (!container) return;


    container.innerHTML = `
        <div class="empty-state">
            <p>
                Your completed sessions will appear here.
            </p>
        </div>
    `;

}


function openSchedule(requestId) {

    showAlert(
        "Session scheduling is ready to be connected to your existing scheduling system.",
        "success"
    );


    console.log(
        "Schedule request:",
        requestId
    );

}


// ============================================================
// ALERT
// ============================================================

function showAlert(
    message,
    type = "success"
) {

    const alert =
        document.getElementById(
            "dashboard-alert"
        );


    if (!alert) return;


    alert.textContent =
        message;


    alert.className =
        `dashboard-alert ${type} show`;


    setTimeout(() => {

        alert.classList.remove(
            "show"
        );

    }, 4000);

}


// ============================================================
// DATE FORMATTER
// ============================================================

function formatDate(dateString) {

    if (!dateString) {
        return "";
    }


    const date =
        new Date(dateString);


    if (Number.isNaN(date.getTime())) {
        return "";
    }


    return date.toLocaleDateString(
        undefined,
        {
            month: "short",
            day: "numeric",
            year: "numeric"
        }
    );

}


// ============================================================
// HTML ESCAPING
// ============================================================

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


// ============================================================
// JAVASCRIPT STRING ESCAPING
// ============================================================

function escapeJS(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)
        .replaceAll("\\", "\\\\")
        .replaceAll("'", "\\'")
        .replaceAll("\n", "\\n")
        .replaceAll("\r", "\\r");

}