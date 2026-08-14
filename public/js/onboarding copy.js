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

// Replace your submitOnboarding function with this:
function submitOnboarding() {
    const role = document.getElementById('roleInput').value;
    const username = document.getElementById('username').value;
    
    // Validate
    if (!username.trim()) {
        alert("Please go back and enter your name!");
        return;
    }
    
    // Prevent double submission
    const submitBtn = document.querySelector('#step4 .btn-primary');
    if (submitBtn.disabled) {
        return; // Already submitting
    }
    
    // Show loading state
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;
    
    // Build form data manually
    const formData = {
        userId: document.getElementById('userId').value,
        username: username,
        role: role,
        grade: document.getElementById('gradeSelect')?.value || '',
        subject: document.getElementById('subjectSelect')?.value || '',
        status: (role === 'admin') ? 'active' : 'pending'
    };
    
    // Determine endpoint
    const endpoint = (role === 'tutor' || role === 'tutee') 
        ? '/submit-onboarding-pending' 
        : '/submit-onboarding';
    
    console.log('Submitting form data:', formData);
    
    // Submit directly
    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Submission successful:', data);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
        if (role === 'tutor' || role === 'tutee') {
            showPendingStep();
        } else if (role === 'admin') {
            window.location.href = '/admin?id=' + formData.userId;
        } else {
            window.location.href = '/dashboard';
        }
    })
    .catch(error => {
        console.error('Submission error:', error);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        alert('Could not save profile. Please try again.\n\nError: ' + error.message);
    });
}

// Update submitFormData to handle errors better
async function submitFormData(endpoint) {
    const form = document.getElementById('onboardingForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    console.log('Submitting to:', endpoint);
    console.log('Data being sent:', data);
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest' // Add this header
            },
            body: JSON.stringify(data)
        });
        
        console.log('Response status:', response.status);
        
        // Get the response text
        const responseText = await response.text();
        console.log('Response text:', responseText);
        
        // Try to parse as JSON
        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse JSON:', e);
            throw new Error('Server returned invalid response format');
        }
        
        if (!response.ok || !responseData.success) {
            throw new Error(responseData.error || responseData.message || `Server error: ${response.status}`);
        }
        
        return responseData;
        
    } catch (error) {
        console.error('Fetch error:', error);
        
        // Check if it's a network error
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            throw new Error('Network error - please check your connection and try again.');
        }
        
        throw error;
    }
}
// Remove or comment out the submitWithFallback function (it's no longer needed)
// async function submitWithFallback(primaryEndpoint, fallbackEndpoint) { ... }// Try primary endpoint first, fallback to secondary if it fails
async function submitWithFallback(primaryEndpoint, fallbackEndpoint) {
    try {
        // First try the pending endpoint
        console.log('Attempting to submit to:', primaryEndpoint);
        const result = await submitFormData(primaryEndpoint);
        console.log('Success with primary endpoint');
        return result;
    } catch (primaryError) {
        console.warn('Primary endpoint failed:', primaryError.message);
        console.log('Falling back to:', fallbackEndpoint);
        
        try {
            // Fallback to regular endpoint with pending status
            const result = await submitFormData(fallbackEndpoint);
            console.log('Success with fallback endpoint');
            return result;
        } catch (fallbackError) {
            console.error('Both endpoints failed');
            throw new Error('Could not save profile. Server may be unavailable.');
        }
    }
}

function showPendingStep() {
    console.log('Showing pending step');
    
    const currentCard = document.getElementById('step4');
    const pendingCard = document.getElementById('step5');
    
    // Check if elements exist
    if (!currentCard) {
        console.error('Step 4 card not found');
        return;
    }
    if (!pendingCard) {
        console.error('Step 5 (pending) card not found');
        return;
    }
    
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
        if (progressFill) {
            progressFill.style.width = '100%';
        }
    }, 300);
}