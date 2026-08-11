// Login Page Script
var supabase = supabase || null;
var currentMode = 'signin';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        
        supabase = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
        const submitBtn = document.getElementById("submit-btn");
        if (submitBtn) submitBtn.disabled = false;
    } catch (err) {
        console.error("Failed to load environment credentials:", err);
    }
});

function setMode(mode) {
    currentMode = mode;
    const title = document.getElementById('title');
    const submitBtn = document.getElementById('submit-btn');
    const passwordGroup = document.getElementById('password-group');
    const otpInput = document.getElementById('otp-token');
    const oauthGroup = document.getElementById('oauth-group');
    const toggleAuth = document.getElementById('toggle-auth');
    const passwordInput = document.getElementById('password');

    passwordGroup.classList.remove('hidden');
    otpInput.classList.add('hidden');
    oauthGroup.classList.remove('hidden');
    passwordInput.required = true;

    if (mode === 'signin') {
        title.innerText = 'Sign In';
        submitBtn.innerText = 'Log In';
        toggleAuth.innerText = 'Need an account? Sign Up';
    } else if (mode === 'signup') {
        title.innerText = 'Sign Up';
        submitBtn.innerText = 'Register';
        toggleAuth.innerText = 'Already have an account? Log In';
    } else if (mode === 'reset') {
        title.innerText = 'Reset Password';
        submitBtn.innerText = 'Send Reset Email';
        passwordGroup.classList.add('hidden');
        oauthGroup.classList.add('hidden');
        passwordInput.required = false;
        toggleAuth.innerText = '← Back to Log In';
    } else if (mode === 'otp') {
        title.innerText = 'OTP Verification';
        submitBtn.innerText = 'Send OTP Passcode';
        passwordGroup.classList.add('hidden');
        oauthGroup.classList.add('hidden');
        passwordInput.required = false;
        toggleAuth.innerText = '← Back to Log In';
    } else if (mode === 'verify-otp') {
        title.innerText = 'Enter OTP Code';
        submitBtn.innerText = 'Verify & Log In';
        passwordGroup.classList.add('hidden');
        otpInput.classList.remove('hidden');
        oauthGroup.classList.add('hidden');
        passwordInput.required = false;
        toggleAuth.innerText = '← Back to Log In';
    }
}

function toggleAuthMode() {
    if (currentMode === 'signin') {
        setMode('signup');
    } else {
        setMode('signin');
    }
}

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabase) return alert("System initializing, please wait a moment...");

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const token = document.getElementById('otp-token').value;

    if (currentMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return alert(error.message);
        
        if (data.session) {
            handleAuthSuccess(data.session.access_token);
        } else {
            alert("Check your email for the confirmation link!");
        }
    } else if (currentMode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return alert(error.message);
        handleAuthSuccess(data.session.access_token);
    } else if (currentMode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/auth/verify'
        });
        if (error) return alert(error.message);
        alert("Password reset email sent! Check your inbox.");
        setMode('signin');
    } else if (currentMode === 'otp') {
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) return alert(error.message);
        alert("A one-time passcode has been sent to your email!");
        setMode('verify-otp');
    } else if (currentMode === 'verify-otp') {
        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'email'
        });
        if (error) return alert(error.message);
        handleAuthSuccess(data.session.access_token);
    }
});

async function loginWithOAuth(provider) {
    if (!supabase) return alert("System initializing, please wait a moment...");
    const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: { redirectTo: window.location.origin + '/auth/verify' }
    });
    if (error) alert(error.message);
}

function handleAuthSuccess(accessToken) {
    window.location.href = `/auth/verify?token=${accessToken}`;
}