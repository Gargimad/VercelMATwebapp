// Onboarding Page Script
let currentStep = 1;
const totalSteps = 4;

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');
    
    if (userId) {
        document.getElementById('userId').value = userId;
    } else {
        alert("Missing User ID parameter. Redirecting to login...");
        window.location.href = '/';
        return;
    }
    
    updateRoleText();
    updateProgress(1);
});

function selectRole(role, element) {
    document.getElementById('roleInput').value = role;
    document.querySelectorAll('.role-card').forEach(card => {
        card.classList.remove('selected');
    });
    element.classList.add('selected');
    element.querySelector('input[type="radio"]').checked = true;
    updateRoleText();
}

function updateRoleText() {
    const role = document.getElementById('roleInput').value;
    const heading = document.getElementById('subjectHeading');
    
    if (role === 'tutor') {
        heading.innerText = "What class would you like to tutor in?";
    } else if (role === 'tutee') {
        heading.innerText = "What class do you need tutoring help in?";
    } else {
        heading.innerText = "Set Up Your Profile";
    }
}

function updateProgress(step) {
    currentStep = step;
    document.querySelectorAll('.progress-step').forEach((stepEl, index) => {
        const stepNum = index + 1;
        stepEl.classList.remove('active', 'completed');
        
        if (stepNum < step) {
            stepEl.classList.add('completed');
            stepEl.textContent = '✓';
        } else if (stepNum === step) {
            stepEl.classList.add('active');
            stepEl.textContent = stepNum;
        } else {
            stepEl.textContent = stepNum;
        }
    });
    
    const progressFill = document.querySelector('.progress-fill');
    const progressPercent = ((step - 1) / (totalSteps - 1)) * 100;
    progressFill.style.width = progressPercent + '%';
}

function nextStep(currentId, nextId) {
    // Validation for step 1
    if (currentId === 1) {
        const nameInput = document.getElementById('username');
        if (!nameInput.value.trim()) {
            alert("Please enter your name to proceed!");
            return;
        }
    }
    
    const currentCard = document.getElementById('step' + currentId);
    const nextCard = document.getElementById('step' + nextId);
    
    // Remove any existing animations
    nextCard.style.animation = 'none';
    
    // Start slide out animation
    currentCard.classList.add('slide-out');
    
    setTimeout(() => {
        // Hide current card
        currentCard.classList.remove('active', 'slide-out');
        currentCard.style.display = 'none';
        
        // Show next card with animation
        nextCard.style.display = 'block';
        nextCard.classList.add('active');
        
        // Trigger reflow for animation to work
        nextCard.offsetHeight;
        
        // Apply slide in animation
        nextCard.style.animation = 'cardSlideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        
        // Update progress
        updateProgress(nextId > 2 ? nextId - 1 : nextId);
    }, 300);
}

function prevStep(currentId, prevId) {
    const currentCardId = typeof currentId === 'string' ? 'step' + currentId : 'step' + currentId;
    const prevCardId = typeof prevId === 'string' ? 'step' + prevId : 'step' + prevId;
    
    const currentCard = document.getElementById(currentCardId);
    const prevCard = document.getElementById(prevCardId);
    
    // Remove any existing animations
    prevCard.style.animation = 'none';
    
    // Start slide out animation
    currentCard.classList.add('slide-out');
    
    setTimeout(() => {
        // Hide current card
        currentCard.classList.remove('active', 'slide-out');
        currentCard.style.display = 'none';
        
        // Show previous card with animation
        prevCard.style.display = 'block';
        prevCard.classList.add('active');
        
        // Trigger reflow for animation to work
        prevCard.offsetHeight;
        
        // Apply slide in animation
        prevCard.style.animation = 'cardSlideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        
        // Update progress
        let progressStep = typeof prevId === 'string' ? 2 : prevId;
        updateProgress(progressStep);
    }, 300);
}

function handleRoleNext() {
    const role = document.getElementById('roleInput').value;
    const currentCard = document.getElementById('step2');
    
    currentCard.classList.add('slide-out');
    
    setTimeout(() => {
        currentCard.classList.remove('active', 'slide-out');
        currentCard.style.display = 'none';
        
        if (role === 'admin') {
            const adminCard = document.getElementById('stepAdmin');
            adminCard.style.display = 'block';
            adminCard.classList.add('active');
            adminCard.offsetHeight;
            adminCard.style.animation = 'cardSlideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
            updateProgress(2);
        } else {
            const step3Card = document.getElementById('step3');
            step3Card.style.display = 'block';
            step3Card.classList.add('active');
            step3Card.offsetHeight;
            step3Card.style.animation = 'cardSlideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
            updateProgress(3);
        }
    }, 300);
}

function verifyAndSubmitAdmin() {
    const pass = document.getElementById('adminPassword').value;
    const errorMsg = document.getElementById('adminError');

    if (pass === 'iLoveMath') {
        errorMsg.classList.remove('show');
        const gradeSelect = document.getElementById('gradeSelect');
        const subjectSelect = document.getElementById('subjectSelect');
        gradeSelect.innerHTML = '<option value="Admin" selected>Administrator</option>';
        subjectSelect.innerHTML = '<option value="Admin" selected>All Subjects (Admin)</option>';
        
        // Set status to active for admins
        document.getElementById('statusInput').value = 'active';
        
        // Submit the form for admin
        submitFormData('/submit-onboarding');
    } else {
        errorMsg.classList.add('show');
        setTimeout(() => {
            errorMsg.classList.remove('show');
        }, 3000);
    }
}

function submitOnboarding() {
    const role = document.getElementById('roleInput').value;
    const username = document.getElementById('username').value;
    
    // Validate
    if (!username.trim()) {
        alert("Please go back and enter your name!");
        return;
    }
    
    // Show loading state
    const submitBtn = document.querySelector('#step4 .btn-primary');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;
    
    if (role === 'tutor') {
        // For tutors, set status to pending
        document.getElementById('statusInput').value = 'pending';
        
        // Submit to pending endpoint
        submitFormData('/submit-onboarding')
            .then(() => {
                // Show pending approval step
                showPendingStep();
            })
            .catch((error) => {
                console.error('Submission error:', error);
                alert('Could not save profile. Please try again.');
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            });
            
    } else if (role === 'tutee') {
        // For tutees, set status to pending
        document.getElementById('statusInput').value = 'pending';
        
        // Submit to pending endpoint
        submitFormData('/submit-onboarding-pending')
            .then(() => {
                // Show pending approval step
                showPendingStep();
            })
            .catch((error) => {
                console.error('Submission error:', error);
                alert('Could not save profile. Please try again.');
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            });
            
    } else {
        // For other roles, submit directly
        document.getElementById('statusInput').value = 'active';
        submitFormData('/submit-onboarding')
            .then(() => {
                window.location.href = '/dashboard';
            })
            .catch((error) => {
                console.error('Submission error:', error);
                alert('Could not save profile. Please try again.');
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            });
    }
}

async function submitFormData(endpoint) {
    const form = document.getElementById('onboardingForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to submit profile');
    }
    
    return response.json();
}

function showPendingStep() {
    const currentCard = document.getElementById('step4');
    const pendingCard = document.getElementById('step5');
    
    // Remove any existing animations
    pendingCard.style.animation = 'none';
    
    // Start slide out animation
    currentCard.classList.add('slide-out');
    
    setTimeout(() => {
        // Hide current card
        currentCard.classList.remove('active', 'slide-out');
        currentCard.style.display = 'none';
        
        // Show pending card with animation
        pendingCard.style.display = 'block';
        pendingCard.classList.add('active');
        
        // Trigger reflow for animation to work
        pendingCard.offsetHeight;
        
        // Apply slide in animation
        pendingCard.style.animation = 'cardSlideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        
        // Update progress to complete
        updateProgress(4);
        
        // Fill progress bar completely
        const progressFill = document.querySelector('.progress-fill');
        progressFill.style.width = '100%';
    }, 300);
}