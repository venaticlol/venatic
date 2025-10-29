// ============================================
// AUTHENTICATION SYSTEM
// ============================================
// Storage keys
const AUTH_TOKEN_KEY = 'venatic_auth_token';
const AUTH_USER_KEY = 'venatic_auth_user';
const USERS_STORAGE_KEY = 'venatic_users';

// Session duration (24 hours)
const SESSION_DURATION = 24 * 60 * 60 * 1000;
// Remember me duration (30 days)
const REMEMBER_ME_DURATION = 30 * 24 * 60 * 60 * 1000;
const REMEMBER_ME_STORAGE_KEY = 'venatic_remember_me';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // If on login page, set up auth UI
    if (document.getElementById('loginForm')) {
        initAuthPage();
    }
    
    // If on main page, check authentication
    if (document.getElementById('downloadBtn')) {
        checkAuthentication();
    }
});

function initAuthPage() {
    const loginTab = document.getElementById('loginTab');
    const signupTab = document.getElementById('signupTab');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const switchToSignup = document.getElementById('switchToSignup');
    const switchToLogin = document.getElementById('switchToLogin');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');
    const signupSubmitBtn = document.getElementById('signupSubmitBtn');
    const loginError = document.getElementById('loginError');
    const signupError = document.getElementById('signupError');
    const loginSuccess = document.getElementById('loginSuccess');
    const signupSuccess = document.getElementById('signupSuccess');
    const rememberMeCheckbox = document.getElementById('rememberMe');

    // Restore remember me checkbox state
    if (rememberMeCheckbox) {
        const rememberMeState = localStorage.getItem(REMEMBER_ME_STORAGE_KEY);
        if (rememberMeState === 'true') {
            rememberMeCheckbox.checked = true;
        }
    }

    // Tab switching
    loginTab.addEventListener('click', () => switchTab('login'));
    signupTab.addEventListener('click', () => switchTab('signup'));
    switchToSignup.addEventListener('click', () => switchTab('signup'));
    switchToLogin.addEventListener('click', () => switchTab('login'));

    function switchTab(tab) {
        if (tab === 'login') {
            loginTab.classList.add('active');
            signupTab.classList.remove('active');
            loginForm.classList.add('active');
            signupForm.classList.remove('active');
            clearMessages();
        } else {
            signupTab.classList.add('active');
            loginTab.classList.remove('active');
            signupForm.classList.add('active');
            loginForm.classList.remove('active');
            clearMessages();
        }
    }

    function clearMessages() {
        loginError.textContent = '';
        signupError.textContent = '';
        loginSuccess.textContent = '';
        signupSuccess.textContent = '';
    }

    // Login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessages();
        
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            loginError.textContent = 'Please fill in all fields';
            return;
        }

        loginSubmitBtn.disabled = true;
        loginSubmitBtn.querySelector('span').textContent = 'Logging in...';

        // Get remember me checkbox value
        const rememberMe = document.getElementById('rememberMe').checked;

        // Simulate delay for UX
        await new Promise(resolve => setTimeout(resolve, 500));

        const result = loginUser(username, password, rememberMe);

        if (result.success) {
            loginSuccess.textContent = 'Login successful! Redirecting...';
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            loginError.textContent = result.message;
            loginSubmitBtn.disabled = false;
            loginSubmitBtn.querySelector('span').textContent = 'Login';
            shakeInput(document.getElementById('loginUsername'));
            shakeInput(document.getElementById('loginPassword'));
        }
    });

    // Signup form submission
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessages();

        const username = document.getElementById('signupUsername').value.trim();
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;

        // Validation
        if (!username || !password || !confirmPassword) {
            signupError.textContent = 'Please fill in all fields';
            return;
        }

        if (password.length < 6) {
            signupError.textContent = 'Password must be at least 6 characters';
            return;
        }

        if (password !== confirmPassword) {
            signupError.textContent = 'Passwords do not match';
            shakeInput(document.getElementById('signupConfirmPassword'));
            return;
        }

        signupSubmitBtn.disabled = true;
        signupSubmitBtn.querySelector('span').textContent = 'Creating account...';

        // Simulate delay for UX
        await new Promise(resolve => setTimeout(resolve, 500));

        const result = registerUser(username, password);

        if (result.success) {
            signupSuccess.textContent = 'Account created! Redirecting to login...';
            setTimeout(() => {
                switchTab('login');
                document.getElementById('loginUsername').value = username;
                document.getElementById('loginPassword').focus();
            }, 1500);
        } else {
            signupError.textContent = result.message;
            shakeInput(document.getElementById('signupUsername'));
        }

        signupSubmitBtn.disabled = false;
        signupSubmitBtn.querySelector('span').textContent = 'Sign Up';
    });

    // Enter key handlers
    document.getElementById('loginPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loginForm.dispatchEvent(new Event('submit'));
        }
    });

    document.getElementById('signupConfirmPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            signupForm.dispatchEvent(new Event('submit'));
        }
    });
}

// User registration
function registerUser(username, password) {
    try {
        // Get existing users
        const users = getUsers();

        // Check if username already exists
        if (users[username]) {
            return {
                success: false,
                message: 'Username already exists. Please choose another.'
            };
        }

        // Validate username
        if (username.length < 3) {
            return {
                success: false,
                message: 'Username must be at least 3 characters'
            };
        }

        // Hash password (simple hash - for production use proper bcrypt)
        const hashedPassword = hashPassword(password);

        // Store user
        users[username] = {
            password: hashedPassword,
            createdAt: Date.now()
        };

        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

        return {
            success: true,
            message: 'Account created successfully'
        };
    } catch (error) {
        console.error('Registration error:', error);
        return {
            success: false,
            message: 'Failed to create account. Please try again.'
        };
    }
}

// User login
function loginUser(username, password, rememberMe = false) {
    try {
        const users = getUsers();

        // Check if user exists
        if (!users[username]) {
            return {
                success: false,
                message: 'Invalid username or password'
            };
        }

        // Verify password
        const hashedPassword = hashPassword(password);
        if (users[username].password !== hashedPassword) {
            return {
                success: false,
                message: 'Invalid username or password'
            };
        }

        // Determine session duration based on remember me
        const sessionDuration = rememberMe ? REMEMBER_ME_DURATION : SESSION_DURATION;

        // Create session
        const authToken = generateAuthToken();
        const sessionData = {
            username: username,
            token: authToken,
            expires: Date.now() + sessionDuration,
            rememberMe: rememberMe
        };

        // Store remember me preference
        if (rememberMe) {
            localStorage.setItem(REMEMBER_ME_STORAGE_KEY, 'true');
            // Store in localStorage for persistence
            localStorage.setItem(AUTH_TOKEN_KEY, authToken);
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(sessionData));
            // Also store in sessionStorage for current session
            sessionStorage.setItem(AUTH_TOKEN_KEY, authToken);
            sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(sessionData));
        } else {
            localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
            // Store primarily in sessionStorage (clears on browser close)
            sessionStorage.setItem(AUTH_TOKEN_KEY, authToken);
            sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(sessionData));
            // Also store in localStorage but it will be cleared when session expires
            localStorage.setItem(AUTH_TOKEN_KEY, authToken);
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(sessionData));
        }

        return {
            success: true,
            message: 'Login successful'
        };
    } catch (error) {
        console.error('Login error:', error);
        return {
            success: false,
            message: 'Failed to login. Please try again.'
        };
    }
}

// Check if user is authenticated
function isAuthenticated() {
    try {
        // Check if remember me was used (prioritize localStorage for remember me sessions)
        const rememberMeActive = localStorage.getItem(REMEMBER_ME_STORAGE_KEY) === 'true';
        
        let token, userData;
        
        if (rememberMeActive) {
            // For remember me sessions, check localStorage first
            token = localStorage.getItem(AUTH_TOKEN_KEY);
            userData = localStorage.getItem(AUTH_USER_KEY);
            
            // Also sync to sessionStorage for current session
            if (token && userData) {
                sessionStorage.setItem(AUTH_TOKEN_KEY, token);
                sessionStorage.setItem(AUTH_USER_KEY, userData);
            }
        } else {
            // For regular sessions, check sessionStorage first
            token = sessionStorage.getItem(AUTH_TOKEN_KEY);
            userData = sessionStorage.getItem(AUTH_USER_KEY);
            
            // Fallback to localStorage
            if (!token || !userData) {
                token = localStorage.getItem(AUTH_TOKEN_KEY);
                userData = localStorage.getItem(AUTH_USER_KEY);
            }
        }

        if (!token || !userData) {
            return false;
        }

        const session = JSON.parse(userData);

        // Check if session expired
        if (session.expires < Date.now()) {
            clearAuth();
            return false;
        }

        // Verify token matches
        if (session.token !== token) {
            clearAuth();
            return false;
        }

        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        return false;
    }
}

// Get authenticated user
function getAuthenticatedUser() {
    try {
        let userData = sessionStorage.getItem(AUTH_USER_KEY);
        
        if (!userData) {
            userData = localStorage.getItem(AUTH_USER_KEY);
        }

        if (!userData) {
            return null;
        }

        const session = JSON.parse(userData);

        // Check if expired
        if (session.expires < Date.now()) {
            clearAuth();
            return null;
        }

        return session.username;
    } catch (error) {
        return null;
    }
}

// Logout user
function logout() {
    clearAuth();
    window.location.href = 'login.html';
}

// Clear authentication
function clearAuth() {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
}

// Get all users
function getUsers() {
    try {
        const usersData = localStorage.getItem(USERS_STORAGE_KEY);
        return usersData ? JSON.parse(usersData) : {};
    } catch (error) {
        return {};
    }
}

// Simple password hash (for production, use proper bcrypt)
function hashPassword(password) {
    // Simple hash function - for production use proper hashing
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    // Add salt
    return btoa(hash.toString() + 'venatic_salt_' + password.length);
}

// Generate auth token
function generateAuthToken() {
    const data = Date.now().toString() + Math.random().toString(36).substring(2, 15) + 
                 Math.random().toString(36).substring(2, 15);
    return btoa(data).split('').reverse().join('');
}

// Check authentication on main page
function checkAuthentication() {
    if (!isAuthenticated()) {
        // Redirect to login page
        window.location.href = 'login.html';
    }
}

// Shake animation for inputs
function shakeInput(input) {
    input.style.animation = 'shake 0.5s';
    setTimeout(() => {
        input.style.animation = '';
    }, 500);
}

// Add shake animation if not exists
if (!document.getElementById('shake-animation-style')) {
    const style = document.createElement('style');
    style.id = 'shake-animation-style';
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
    `;
    document.head.appendChild(style);
}
