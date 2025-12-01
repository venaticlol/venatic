// Firebase configuration - User needs to add their own config
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, serverTimestamp, updateDoc, limit } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Simple password hashing utility
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

async function verifyPassword(password, hash) {
    const passwordHash = await hashPassword(password);
    return passwordHash === hash;
}

function calculateAge(dob) {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

function validateAge(dob) {
    const age = calculateAge(dob);
    return age >= 14;
}

// TODO: Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBt5WYfJpf9b3OdfiDohtcjqiPTo62iNfo",
  authDomain: "recon-cord.firebaseapp.com",
  projectId: "recon-cord",
  storageBucket: "recon-cord.firebasestorage.app",
  messagingSenderId: "1038436863040",
  appId: "1:1038436863040:web:628b7494ebdabf9bf563a5"
};

// Initialize Firebase
let app, auth, db, storage;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
} catch (error) {
    console.error('Firebase initialization error:', error);
    // Initialize with null to prevent crashes, errors will be handled in functions
    auth = null;
    db = null;
    storage = null;
}

// State management
let currentUser = null;
let currentServer = null;
let currentChannel = null;
let servers = [];
let channels = {};
let messages = {};
let members = {};
let unsubscribeFunctions = [];
let directMessages = [];
let currentDM = null;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const tabButtons = document.querySelectorAll('.tab-btn');
const messageInput = document.getElementById('message-input');
const messagesList = document.getElementById('messages-list');
const serverList = document.getElementById('server-list');
const textChannelList = document.getElementById('text-channel-list');
const voiceChannelList = document.getElementById('voice-channel-list');
const channelNameDisplay = document.getElementById('channel-name-display');
const serverNameDisplay = document.getElementById('server-name');
const membersList = document.getElementById('members-list');
const memberCount = document.getElementById('member-count');

// Modal elements
const createServerModal = document.getElementById('create-server-modal');
const createChannelModal = document.getElementById('create-channel-modal');
const settingsModal = document.getElementById('settings-modal');
const addServerBtn = document.getElementById('add-server-btn');

// Initialize app
init();

async function init() {
    setupEventListeners();
    
    // Add global error handler for blocked requests
    window.addEventListener('error', (event) => {
        if (event.message && (
            event.message.includes('ERR_BLOCKED_BY_CLIENT') ||
            event.message.includes('firestore.googleapis.com')
        )) {
            console.warn('Detected blocked request - likely ad blocker interference');
            // Error will be shown in specific handlers
        }
    }, true);
    
    // Check if Firebase is properly initialized
    if (!auth || !db) {
        console.error('Firebase not initialized. Please check Firebase setup.');
        setTimeout(() => {
            if (document.getElementById('login-screen')) {
                const loginScreen = document.getElementById('login-screen');
                const setupLink = loginScreen.querySelector('a[href="setup-firebase.html"]');
                if (!setupLink) {
                    const loginBox = loginScreen.querySelector('.login-box');
                    if (loginBox) {
                        const setupDiv = document.createElement('div');
                        setupDiv.style.cssText = 'text-align: center; margin-top: 20px; padding: 20px; background: rgba(255, 107, 107, 0.1); border-radius: 4px; border: 1px solid #ff6b6b;';
                        setupDiv.innerHTML = `
                            <p style="color: #ff6b6b; margin-bottom: 10px; font-weight: 600;">⚠️ Firebase Setup Required</p>
                            <p style="color: #72767d; font-size: 14px; margin-bottom: 15px;">Please enable Firebase services to use Recon-Cord.</p>
                            <a href="setup-firebase.html" style="background: #5865f2; color: white; padding: 10px 20px; border-radius: 4px; text-decoration: none; display: inline-block;">
                                Open Setup Guide →
                            </a>
                        `;
                        loginBox.appendChild(setupDiv);
                    }
                }
            }
        }, 100);
        return;
    }
    
    // Check if user is logged in via sessionStorage
    const savedUserId = sessionStorage.getItem('reconCordUserId');
    if (savedUserId) {
        try {
            // Verify user still exists
            const userDoc = await getDoc(doc(db, 'users', savedUserId));
            if (userDoc.exists()) {
                // Sign in anonymously to maintain Firebase auth session
                await signInAnonymously(auth);
                currentUser = { uid: savedUserId, ...userDoc.data() };
                await loadUserData();
                showApp();
                return;
            } else {
                // User doc doesn't exist, clear session
                sessionStorage.removeItem('reconCordUserId');
                sessionStorage.removeItem('reconCordUsername');
            }
        } catch (error) {
            console.error('Error checking session:', error);
            sessionStorage.removeItem('reconCordUserId');
            sessionStorage.removeItem('reconCordUsername');
        }
    }
    
    // Listen for auth state changes
    onAuthStateChanged(auth, async (user) => {
        if (user && sessionStorage.getItem('reconCordUserId')) {
            // User is authenticated and has session
            const userId = sessionStorage.getItem('reconCordUserId');
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                currentUser = { uid: userId, ...userDoc.data() };
                await loadUserData();
                showApp();
            } else {
                showLogin();
            }
        } else {
            showLogin();
        }
    }, (error) => {
        console.error('Auth state change error:', error);
    });
}

function showSetupPrompt() {
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
        loginScreen.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                <div style="background: #2f3136; border-radius: 8px; padding: 40px; max-width: 600px; text-align: center; color: white;">
                    <h1 style="color: #ff6b6b; margin-bottom: 20px; font-size: 32px;">🔧 Firebase Setup Required</h1>
                    <p style="color: #dcddde; margin-bottom: 20px; line-height: 1.6; font-size: 16px;">
                        Recon-Cord needs Firebase services to be enabled. Follow our easy setup guide to configure everything automatically.
                    </p>
                    <div style="margin: 30px 0;">
                        <a href="setup-firebase.html" style="background: #5865f2; color: white; padding: 14px 28px; border-radius: 4px; text-decoration: none; display: inline-block; margin-right: 10px; font-weight: 600;">
                            📋 Open Setup Guide
                        </a>
                    </div>
                    <div style="margin-top: 20px;">
                        <a href="https://console.firebase.google.com/project/recon-265bc" target="_blank" style="color: #5865f2; text-decoration: none; font-size: 14px;">
                            Or open Firebase Console directly →
                        </a>
                    </div>
                </div>
            </div>
        `;
    }
}

function setupEventListeners() {
    // Login/Register tabs
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.form-content').forEach(f => f.classList.remove('active'));
            if (tab === 'login') {
                loginForm.classList.add('active');
            } else {
                registerForm.classList.add('active');
            }
        });
    });

    // Authentication
    loginBtn.addEventListener('click', handleLogin);
    registerBtn.addEventListener('click', handleRegister);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Server management
    addServerBtn.addEventListener('click', () => {
        createServerModal.classList.remove('hidden');
    });
    document.getElementById('close-create-server').addEventListener('click', () => {
        createServerModal.classList.add('hidden');
    });
    document.getElementById('create-server-submit').addEventListener('click', createServer);

    // Channel management
    document.getElementById('close-create-channel').addEventListener('click', () => {
        createChannelModal.classList.add('hidden');
    });
    document.getElementById('create-channel-submit').addEventListener('click', createChannel);

    // Settings
    document.getElementById('settings-btn').addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });
    document.getElementById('close-settings').addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    // Settings tabs
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tabName}-settings`).classList.add('active');
        });
    });

    // Channel type selector
    document.querySelectorAll('.channel-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.channel-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Home server click
    document.querySelector('[data-server-id="home"]').addEventListener('click', () => {
        switchToServer('home');
    });

    // DM functionality
    document.getElementById('new-dm-btn').addEventListener('click', () => {
        document.getElementById('new-dm-modal').classList.remove('hidden');
    });
    document.getElementById('close-new-dm').addEventListener('click', () => {
        document.getElementById('new-dm-modal').classList.add('hidden');
    });

    // DM search
    document.getElementById('dm-search-input').addEventListener('input', debounce(searchUsers, 300));
}

async function handleLogin() {
    const username = document.getElementById('login-username').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');

    if (!auth || !db) {
        errorEl.textContent = 'Firebase services are not initialized. Please check your Firebase setup.';
        errorEl.classList.add('show');
        return;
    }

    if (!username || !password) {
        errorEl.textContent = 'Please enter both username and password.';
        errorEl.classList.add('show');
        return;
    }

    try {
        // Look up user by username
        const usernameQuery = query(
            collection(db, 'usernames'),
            where('username', '==', username),
            limit(1)
        );
        const usernameSnapshot = await getDocs(usernameQuery);

        if (usernameSnapshot.empty) {
            errorEl.textContent = 'Username or password is incorrect.';
            errorEl.classList.add('show');
            return;
        }

        const usernameDoc = usernameSnapshot.docs[0];
        const usernameData = usernameDoc.data();
        const userId = usernameData.userId;

        // Get user document to verify password
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
            errorEl.textContent = 'User not found. Please register first.';
            errorEl.classList.add('show');
            return;
        }

        const userData = userDoc.data();
        
        // Verify password
        const passwordValid = await verifyPassword(password, userData.passwordHash);
        if (!passwordValid) {
            errorEl.textContent = 'Username or password is incorrect.';
            errorEl.classList.add('show');
            return;
        }

        // Sign in anonymously and store userId in session
        const userCredential = await signInAnonymously(auth);
        
        // Store user info in sessionStorage
        sessionStorage.setItem('reconCordUserId', userId);
        sessionStorage.setItem('reconCordUsername', username);
        
        // Manually trigger auth state (since we're using anonymous auth)
        currentUser = { uid: userId, ...userData };
        await loadUserData();
        showApp();

        errorEl.textContent = '';
        errorEl.classList.remove('show');
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'An error occurred. Please try again.';
        
        // Check for Firestore API not enabled
        if (error.code === 'permission-denied' && error.message && error.message.includes('Firestore API')) {
            errorMessage = '❌ Firestore API is not enabled. ';
            errorEl.textContent = errorMessage;
            errorEl.classList.add('show');
            
            // Add setup link
            setTimeout(() => {
                if (!errorEl.nextElementSibling || !errorEl.nextElementSibling.classList.contains('firestore-api-link')) {
                    const apiDiv = document.createElement('div');
                    apiDiv.className = 'firestore-api-link';
                    apiDiv.style.cssText = 'margin-top: 10px; padding: 10px; background: rgba(255, 193, 7, 0.1); border-radius: 4px; border-left: 3px solid #ffc107;';
                    apiDiv.innerHTML = `
                        <p style="color: #dcddde; font-size: 13px; margin-bottom: 8px;">
                            <strong>Quick Fix:</strong> Enable the Firestore API in Google Cloud Console.
                        </p>
                        <a href="https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=recon-cord" target="_blank" style="color: #5865f2; text-decoration: none; font-weight: 600; font-size: 13px; display: inline-block; margin-right: 10px;">
                            → Enable Firestore API
                        </a>
                        <a href="setup-firebase.html" target="_blank" style="color: #5865f2; text-decoration: none; font-weight: 600; font-size: 13px;">
                            → View full setup guide
                        </a>
                    `;
                    errorEl.parentElement.appendChild(apiDiv);
                }
            }, 100);
            return;
        }
        
        // Check for Firestore API not enabled
        if (error.code === 'permission-denied' && error.message && error.message.includes('Firestore API')) {
            errorMessage = '❌ Firestore API is not enabled. ';
            errorEl.textContent = errorMessage;
            errorEl.classList.add('show');
            
            // Add setup link
            setTimeout(() => {
                if (!errorEl.nextElementSibling || !errorEl.nextElementSibling.classList.contains('firestore-api-link')) {
                    const apiDiv = document.createElement('div');
                    apiDiv.className = 'firestore-api-link';
                    apiDiv.style.cssText = 'margin-top: 10px; padding: 10px; background: rgba(255, 193, 7, 0.1); border-radius: 4px; border-left: 3px solid #ffc107;';
                    apiDiv.innerHTML = `
                        <p style="color: #dcddde; font-size: 13px; margin-bottom: 8px;">
                            <strong>Quick Fix:</strong> Enable the Firestore API in Google Cloud Console.
                        </p>
                        <a href="https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=recon-cord" target="_blank" style="color: #5865f2; text-decoration: none; font-weight: 600; font-size: 13px; display: inline-block; margin-right: 10px;">
                            → Enable Firestore API
                        </a>
                        <a href="setup-firebase.html" target="_blank" style="color: #5865f2; text-decoration: none; font-weight: 600; font-size: 13px;">
                            → View full setup guide
                        </a>
                    `;
                    errorEl.parentElement.appendChild(apiDiv);
                }
            }, 100);
            return;
        }
        
        // Check for blocked requests (ad blocker issue)
        if (error.message && (
            error.message.includes('ERR_BLOCKED_BY_CLIENT') || 
            error.message.includes('blocked') ||
            error.message.includes('Failed to fetch') ||
            error.code === 'unavailable' ||
            error.message.includes('network')
        )) {
            errorMessage = '❌ Firestore requests are being blocked. This is usually caused by an ad blocker. ';
            errorEl.textContent = errorMessage;
            errorEl.classList.add('show');
            
            // Add troubleshooting link
            setTimeout(() => {
                if (!errorEl.nextElementSibling || !errorEl.nextElementSibling.classList.contains('troubleshoot-link')) {
                    const troubleshootDiv = document.createElement('div');
                    troubleshootDiv.className = 'troubleshoot-link';
                    troubleshootDiv.style.cssText = 'margin-top: 10px; padding: 10px; background: rgba(255, 193, 7, 0.1); border-radius: 4px; border-left: 3px solid #ffc107;';
                    troubleshootDiv.innerHTML = `
                        <p style="color: #dcddde; font-size: 13px; margin-bottom: 8px;">
                            <strong>Quick Fix:</strong> Disable your ad blocker for this site, then refresh the page.
                        </p>
                        <a href="TROUBLESHOOTING.md" target="_blank" style="color: #5865f2; text-decoration: none; font-weight: 600; font-size: 13px;">
                            → View detailed troubleshooting guide
                        </a>
                    `;
                    errorEl.parentElement.appendChild(troubleshootDiv);
                }
            }, 100);
            return;
        }
        
        if (error.code === 'auth/configuration-not-found' || error.message.includes('Anonymous')) {
            errorMessage = 'Anonymous Authentication is not enabled. ';
            errorEl.textContent = errorMessage;
            errorEl.classList.add('show');
            
            // Add setup link
            setTimeout(() => {
                if (!errorEl.nextElementSibling || !errorEl.nextElementSibling.classList.contains('setup-link')) {
                    const setupLink = document.createElement('a');
                    setupLink.className = 'setup-link';
                    setupLink.href = 'setup-firebase.html';
                    setupLink.target = '_blank';
                    setupLink.textContent = 'Click here to enable Anonymous Authentication';
                    setupLink.style.cssText = 'display: block; margin-top: 8px; color: #5865f2; text-decoration: none; font-weight: 600; font-size: 14px;';
                    errorEl.parentElement.appendChild(setupLink);
                }
            }, 100);
            return;
        }
        
        errorEl.textContent = errorMessage;
        errorEl.classList.add('show');
    }
}

async function handleRegister() {
    const username = document.getElementById('register-username').value.trim();
    const displayName = document.getElementById('register-display-name').value.trim();
    const dob = document.getElementById('register-dob').value;
    const password = document.getElementById('register-password').value;
    const errorEl = document.getElementById('register-error');

    if (!auth || !db) {
        errorEl.textContent = 'Firebase services are not initialized. Please check your Firebase setup.';
        errorEl.classList.add('show');
        return;
    }

    // Validate inputs
    if (!username || username.length < 3) {
        errorEl.textContent = 'Username must be at least 3 characters long.';
        errorEl.classList.add('show');
        return;
    }

    if (!displayName || displayName.length < 2) {
        errorEl.textContent = 'Display name must be at least 2 characters long.';
        errorEl.classList.add('show');
        return;
    }

    if (!dob) {
        errorEl.textContent = 'Please enter your date of birth.';
        errorEl.classList.add('show');
        return;
    }

    // Validate age (must be 14+)
    if (!validateAge(dob)) {
        errorEl.textContent = 'You must be at least 14 years old to register.';
        errorEl.classList.add('show');
        return;
    }

    if (password.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters long.';
        errorEl.classList.add('show');
        return;
    }

    // Check if username already exists
    const usernameLower = username.toLowerCase();
    try {
        const usernameQuery = query(
            collection(db, 'usernames'),
            where('username', '==', usernameLower),
            limit(1)
        );
        const usernameSnapshot = await getDocs(usernameQuery);

        if (!usernameSnapshot.empty) {
            errorEl.textContent = 'This username is already taken. Please choose another.';
            errorEl.classList.add('show');
            return;
        }
    } catch (checkError) {
        // If blocked, we'll catch it in the main try-catch below
        console.error('Error checking username:', checkError);
        // Continue to registration attempt - will show error below if it's a blocking issue
    }

    try {
        // Sign in anonymously to get a Firebase UID
        const userCredential = await signInAnonymously(auth);
        const user = userCredential.user;

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create user document
        await setDoc(doc(db, 'users', user.uid), {
            username: usernameLower,
            displayName: displayName,
            dob: dob,
            passwordHash: passwordHash,
            avatar: '',
            discriminator: Math.floor(Math.random() * 10000).toString().padStart(4, '0'),
            createdAt: serverTimestamp()
        });

        // Create username index for quick lookup
        await setDoc(doc(db, 'usernames', user.uid), {
            username: usernameLower,
            userId: user.uid,
            createdAt: serverTimestamp()
        });

        // Store in sessionStorage
        sessionStorage.setItem('reconCordUserId', user.uid);
        sessionStorage.setItem('reconCordUsername', usernameLower);

        errorEl.textContent = '';
        errorEl.classList.remove('show');

        // Load user data and show app
        currentUser = { uid: user.uid, username: usernameLower, displayName: displayName };
        await loadUserData();
        showApp();
    } catch (error) {
        console.error('Registration error:', error);
        let errorMessage = 'An error occurred. Please try again.';
        
        // Check for blocked requests (ad blocker issue)
        if (error.message && (
            error.message.includes('ERR_BLOCKED_BY_CLIENT') || 
            error.message.includes('blocked') ||
            error.message.includes('Failed to fetch') ||
            error.code === 'unavailable'
        )) {
            errorMessage = '❌ Firestore requests are being blocked. This is usually caused by an ad blocker. ';
            errorEl.textContent = errorMessage;
            errorEl.classList.add('show');
            
            // Add troubleshooting link
            setTimeout(() => {
                if (!errorEl.nextElementSibling || !errorEl.nextElementSibling.classList.contains('troubleshoot-link')) {
                    const troubleshootDiv = document.createElement('div');
                    troubleshootDiv.className = 'troubleshoot-link';
                    troubleshootDiv.style.cssText = 'margin-top: 10px; padding: 10px; background: rgba(255, 193, 7, 0.1); border-radius: 4px; border-left: 3px solid #ffc107;';
                    troubleshootDiv.innerHTML = `
                        <p style="color: #dcddde; font-size: 13px; margin-bottom: 8px;">
                            <strong>Quick Fix:</strong> Disable your ad blocker for this site, then refresh the page.
                        </p>
                        <a href="TROUBLESHOOTING.md" target="_blank" style="color: #5865f2; text-decoration: none; font-weight: 600; font-size: 13px;">
                            → View detailed troubleshooting guide
                        </a>
                    `;
                    errorEl.parentElement.appendChild(troubleshootDiv);
                }
            }, 100);
            return;
        }
        
        if (error.code === 'auth/configuration-not-found' || error.message.includes('Anonymous')) {
            errorMessage = 'Anonymous Authentication is not enabled. ';
            errorEl.textContent = errorMessage;
            errorEl.classList.add('show');
            
            // Add setup link
            setTimeout(() => {
                if (!errorEl.nextElementSibling || !errorEl.nextElementSibling.classList.contains('setup-link')) {
                    const setupLink = document.createElement('a');
                    setupLink.className = 'setup-link';
                    setupLink.href = 'setup-firebase.html';
                    setupLink.target = '_blank';
                    setupLink.textContent = 'Click here to enable Anonymous Authentication';
                    setupLink.style.cssText = 'display: block; margin-top: 8px; color: #5865f2; text-decoration: none; font-weight: 600; font-size: 14px;';
                    errorEl.parentElement.appendChild(setupLink);
                }
            }, 100);
            return;
        }
        
        errorEl.textContent = errorMessage;
        errorEl.classList.add('show');
    }
}

async function loadUserData() {
    if (!currentUser && !sessionStorage.getItem('reconCordUserId')) return;

    // Get userId from sessionStorage or currentUser
    const userId = currentUser?.uid || sessionStorage.getItem('reconCordUserId');
    if (!userId) return;

    // Load user profile
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
        const userData = userDoc.data();
        currentUser = { uid: userId, ...userData };
        document.getElementById('user-name-display').textContent = userData.displayName || userData.username;
        document.getElementById('user-discriminator').textContent = `#${userData.discriminator || '0000'}`;
        if (userData.avatar) {
            document.getElementById('user-avatar-img').src = userData.avatar;
        } else {
            // Show initials as avatar
            const initials = (userData.displayName || userData.username || 'U').substring(0, 2).toUpperCase();
            const avatarEl = document.getElementById('user-avatar-img');
            if (avatarEl) {
                avatarEl.alt = initials;
                avatarEl.style.display = 'none';
                // Could add a text-based avatar here if needed
            }
        }
    } else {
        // If no user doc, might need to sign out
        console.error('User document not found');
        signOut(auth);
        sessionStorage.removeItem('reconCordUserId');
        sessionStorage.removeItem('reconCordUsername');
        showLogin();
        return;
    }

    // Load servers
    await loadServers();
    
    // Load DMs or default to home
    switchToServer('home');
}

async function loadServers() {
    // Load servers where user is a member
    const serversQuery = query(
        collection(db, 'servers'),
        where('members', 'array-contains', currentUser.uid)
    );
    
    const serversSnapshot = await getDocs(serversQuery);
    servers = [];
    serversSnapshot.forEach(doc => {
        servers.push({ id: doc.id, ...doc.data() });
    });

    renderServers();
}

function renderServers() {
    serverList.innerHTML = '';
    servers.forEach(server => {
        const serverItem = document.createElement('div');
        serverItem.className = 'server-item';
        serverItem.dataset.serverId = server.id;
        serverItem.title = server.name;
        
        if (server.icon) {
            serverItem.innerHTML = `<img src="${server.icon}" class="server-icon" alt="${server.name}">`;
        } else {
            const initials = server.name.substring(0, 2).toUpperCase();
            serverItem.textContent = initials;
        }

        serverItem.addEventListener('click', () => switchToServer(server.id));
        serverList.appendChild(serverItem);
    });
}

async function switchToServer(serverId) {
    // Clear previous subscriptions
    unsubscribeFunctions.forEach(unsub => unsub());
    unsubscribeFunctions = [];

    currentServer = serverId;
    currentChannel = null;
    
    // Update active state
    document.querySelectorAll('.server-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-server-id="${serverId}"]`)?.classList.add('active');

    if (serverId === 'home') {
        showHomeView();
    } else {
        await loadServerData(serverId);
    }
}

async function showHomeView() {
    serverNameDisplay.textContent = 'Home';
    channelNameDisplay.textContent = 'Direct Messages';
    
    // Show DM section, hide server channels
    document.getElementById('direct-messages').style.display = 'block';
    document.getElementById('text-channels').style.display = 'none';
    document.getElementById('voice-channels').style.display = 'none';
    
    // Load direct messages
    await loadDirectMessages();
    
    if (!currentDM) {
        messagesList.innerHTML = `
            <div class="welcome-message">
                <h1>Welcome to Recon-Cord!</h1>
                <p>Select a conversation or start a new direct message.</p>
            </div>
        `;
    }
}

async function loadServerData(serverId) {
    const serverDoc = await getDoc(doc(db, 'servers', serverId));
    if (!serverDoc.exists()) return;

    const serverData = serverDoc.data();
    serverNameDisplay.textContent = serverData.name;

    // Hide DM section, show server channels
    document.getElementById('direct-messages').style.display = 'none';
    document.getElementById('text-channels').style.display = 'block';
    document.getElementById('voice-channels').style.display = 'block';

    // Load channels
    const channelsQuery = query(
        collection(db, 'servers', serverId, 'channels'),
        orderBy('createdAt', 'asc')
    );

    const channelsSnapshot = await getDocs(channelsQuery);
    channels[serverId] = { text: [], voice: [] };
    
    channelsSnapshot.forEach(doc => {
        const channelData = { id: doc.id, ...doc.data() };
        if (channelData.type === 'text') {
            channels[serverId].text.push(channelData);
        } else {
            channels[serverId].voice.push(channelData);
        }
    });

    renderChannels(serverId);

    // Auto-select first text channel
    if (channels[serverId].text.length > 0) {
        switchToChannel(serverId, channels[serverId].text[0].id);
    }

    // Load members
    await loadServerMembers(serverId);
}

function renderChannels(serverId) {
    textChannelList.innerHTML = '';
    voiceChannelList.innerHTML = '';

    if (!channels[serverId]) return;

    // Render text channels
    channels[serverId].text.forEach(channel => {
        const channelItem = document.createElement('div');
        channelItem.className = 'channel-item';
        channelItem.dataset.channelId = channel.id;
        channelItem.innerHTML = `
            <i class="fas fa-hashtag"></i>
            <span>${channel.name}</span>
        `;
        channelItem.addEventListener('click', () => switchToChannel(serverId, channel.id));
        textChannelList.appendChild(channelItem);
    });

    // Add channel button for text channels
    const addTextChannel = document.createElement('div');
    addTextChannel.className = 'channel-add-btn';
    addTextChannel.innerHTML = '<i class="fas fa-plus"></i> Add Text Channel';
    addTextChannel.addEventListener('click', () => openCreateChannelModal('text'));
    textChannelList.appendChild(addTextChannel);

    // Render voice channels
    channels[serverId].voice.forEach(channel => {
        const channelItem = document.createElement('div');
        channelItem.className = 'channel-item';
        channelItem.dataset.channelId = channel.id;
        channelItem.innerHTML = `
            <i class="fas fa-volume-up"></i>
            <span>${channel.name}</span>
        `;
        channelItem.addEventListener('click', () => joinVoiceChannel(serverId, channel.id));
        voiceChannelList.appendChild(channelItem);
    });

    // Add channel button for voice channels
    const addVoiceChannel = document.createElement('div');
    addVoiceChannel.className = 'channel-add-btn';
    addVoiceChannel.innerHTML = '<i class="fas fa-plus"></i> Add Voice Channel';
    addVoiceChannel.addEventListener('click', () => openCreateChannelModal('voice'));
    voiceChannelList.appendChild(addVoiceChannel);
}

function openCreateChannelModal(defaultType) {
    createChannelModal.classList.remove('hidden');
    document.querySelectorAll('.channel-type-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === defaultType) {
            btn.classList.add('active');
        }
    });
}

async function switchToChannel(serverId, channelId) {
    currentChannel = channelId;
    currentServer = serverId;

    // Update active state
    document.querySelectorAll('.channel-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-channel-id="${channelId}"]`)?.classList.add('active');

    // Update channel name display
    const channel = channels[serverId].text.find(c => c.id === channelId);
    if (channel) {
        channelNameDisplay.textContent = channel.name;
    }

    // Load messages
    await loadMessages(serverId, channelId);
}

async function loadMessages(serverId, channelId) {
    messagesList.innerHTML = '';

    const messagesRef = collection(db, 'servers', serverId, 'channels', channelId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));

    // Real-time listener
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        messagesList.innerHTML = '';
        let currentAuthor = null;

        snapshot.forEach((doc) => {
            const messageData = { id: doc.id, ...doc.data() };
            const isNewAuthor = currentAuthor !== messageData.authorId;

            if (isNewAuthor || currentAuthor === null) {
                currentAuthor = messageData.authorId;
                const messageGroup = document.createElement('div');
                messageGroup.className = 'message-group';

                // Get author info
                const authorInfo = members[serverId]?.find(m => m.id === messageData.authorId);
                const authorName = authorInfo?.displayName || authorInfo?.username || 'Unknown User';
                const authorAvatar = authorInfo?.avatar || '';

                const timestamp = messageData.createdAt?.toDate() || new Date();
                const timeString = timestamp.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit'
                });

                const messageEl = document.createElement('div');
                messageEl.className = 'message';

                let avatarContent = '';
                if (authorAvatar) {
                    avatarContent = `<img src="${authorAvatar}" alt="${authorName}">`;
                } else {
                    avatarContent = authorName.substring(0, 2).toUpperCase();
                }

                messageEl.innerHTML = `
                    <div class="message-avatar">${avatarContent}</div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-author">${authorName}</span>
                            <span class="message-timestamp">${timeString}</span>
                        </div>
                        <div class="message-text">${escapeHtml(messageData.text)}</div>
                    </div>
                `;

                messageGroup.appendChild(messageEl);
                messagesList.appendChild(messageGroup);
            } else {
                // Same author, just append message
                const lastGroup = messagesList.lastElementChild;
                const messageEl = document.createElement('div');
                messageEl.className = 'message';
                messageEl.style.paddingTop = '2px';
                messageEl.innerHTML = `
                    <div class="message-content" style="margin-left: 56px;">
                        <div class="message-text">${escapeHtml(messageData.text)}</div>
                    </div>
                `;
                lastGroup.appendChild(messageEl);
            }
        });

        // Scroll to bottom
        messagesList.scrollTop = messagesList.scrollHeight;
    });

    unsubscribeFunctions.push(unsubscribe);
}


async function createServer() {
    const name = document.getElementById('server-name-input').value.trim();
    const iconFile = document.getElementById('server-icon-input').files[0];

    if (!name) {
        alert('Please enter a server name');
        return;
    }

    try {
        let iconUrl = '';

        if (iconFile) {
            const iconRef = ref(storage, `server-icons/${Date.now()}_${iconFile.name}`);
            await uploadBytes(iconRef, iconFile);
            iconUrl = await getDownloadURL(iconRef);
        }

        const serverRef = doc(collection(db, 'servers'));
        await setDoc(serverRef, {
            name: name,
            icon: iconUrl,
            ownerId: currentUser.uid,
            members: [currentUser.uid],
            createdAt: serverTimestamp()
        });

        // Create default channel
        await addDoc(collection(db, 'servers', serverRef.id, 'channels'), {
            name: 'general',
            type: 'text',
            createdAt: serverTimestamp()
        });

        // Reset form
        document.getElementById('server-name-input').value = '';
        document.getElementById('server-icon-input').value = '';
        createServerModal.classList.add('hidden');

        // Reload servers
        await loadServers();
        switchToServer(serverRef.id);
    } catch (error) {
        console.error('Error creating server:', error);
        alert('Failed to create server');
    }
}

async function createChannel() {
    if (!currentServer) {
        alert('Please select a server first');
        return;
    }

    const name = document.getElementById('channel-name-input').value.trim();
    const activeType = document.querySelector('.channel-type-btn.active').dataset.type;

    if (!name) {
        alert('Please enter a channel name');
        return;
    }

    try {
        await addDoc(collection(db, 'servers', currentServer, 'channels'), {
            name: name.toLowerCase().replace(/\s+/g, '-'),
            type: activeType,
            createdAt: serverTimestamp()
        });

        document.getElementById('channel-name-input').value = '';
        createChannelModal.classList.add('hidden');

        // Reload channels
        await loadServerData(currentServer);
    } catch (error) {
        console.error('Error creating channel:', error);
        alert('Failed to create channel');
    }
}

async function loadServerMembers(serverId) {
    const serverDoc = await getDoc(doc(db, 'servers', serverId));
    if (!serverDoc.exists()) return;

    const serverData = serverDoc.data();
    members[serverId] = [];

    for (const memberId of serverData.members || []) {
        const userDoc = await getDoc(doc(db, 'users', memberId));
        if (userDoc.exists()) {
            members[serverId].push({ id: memberId, ...userDoc.data() });
        }
    }

    renderMembers(serverId);
}

function renderMembers(serverId) {
    membersList.innerHTML = '';
    const serverMembers = members[serverId] || [];

    memberCount.textContent = serverMembers.length;

    serverMembers.forEach(member => {
        const memberItem = document.createElement('div');
        memberItem.className = 'member-item';

        let avatarContent = '';
        if (member.avatar) {
            avatarContent = `<img src="${member.avatar}" alt="${member.displayName || member.username}">`;
        } else {
            avatarContent = (member.displayName || member.username || 'U').substring(0, 2).toUpperCase();
        }

        memberItem.innerHTML = `
            <div class="member-avatar">${avatarContent}</div>
            <div class="member-name">${member.displayName || member.username}</div>
        `;

        membersList.appendChild(memberItem);
    });
}

async function joinVoiceChannel(serverId, channelId) {
    // TODO: Implement WebRTC voice channel
    alert('Voice channels coming soon! This will use WebRTC for real-time audio communication.');
}

function showLogin() {
    loginScreen.classList.remove('hidden');
    appContainer.classList.add('hidden');
}

function showApp() {
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Direct Messaging Functions
async function loadDirectMessages() {
    if (!currentUser) return;

    // Load DMs where user is a participant
    const dmsQuery = query(
        collection(db, 'directMessages'),
        where('participants', 'array-contains', currentUser.uid)
    );

    const dmsSnapshot = await getDocs(dmsQuery);
    directMessages = [];
    
    for (const dmDoc of dmsSnapshot.docs) {
        const dmData = { id: dmDoc.id, ...dmDoc.data() };
        // Get the other participant's info
        const otherUserId = dmData.participants.find(id => id !== currentUser.uid);
        if (otherUserId) {
            const userDoc = await getDoc(doc(db, 'users', otherUserId));
            if (userDoc.exists()) {
                dmData.otherUser = { id: otherUserId, ...userDoc.data() };
                directMessages.push(dmData);
            }
        }
    }

    renderDirectMessages();
}

function renderDirectMessages() {
    const dmList = document.getElementById('dm-list');
    dmList.innerHTML = '';

    directMessages.forEach(dm => {
        const dmItem = document.createElement('div');
        dmItem.className = 'channel-item';
        if (currentDM === dm.id) {
            dmItem.classList.add('active');
        }

        const otherUser = dm.otherUser;
        let avatarContent = '';
        if (otherUser.avatar) {
            avatarContent = `<img src="${otherUser.avatar}" alt="${otherUser.username}">`;
        } else {
            avatarContent = (otherUser.displayName || otherUser.username || 'U').substring(0, 2).toUpperCase();
        }

        dmItem.innerHTML = `
            <div class="user-avatar-small" style="width: 20px; height: 20px; margin-right: 4px;">
                ${avatarContent}
            </div>
            <span>${otherUser.displayName || otherUser.username}</span>
        `;

        dmItem.addEventListener('click', () => openDM(dm.id));
        dmList.appendChild(dmItem);
    });
}

async function openDM(dmId) {
    currentDM = dmId;
    currentServer = null;
    currentChannel = null;

    // Clear previous subscriptions
    unsubscribeFunctions.forEach(unsub => unsub());
    unsubscribeFunctions = [];

    const dm = directMessages.find(d => d.id === dmId);
    if (!dm) return;

    channelNameDisplay.textContent = dm.otherUser.username;
    renderDirectMessages();

    // Load DM messages
    await loadDMMessages(dmId);
}

async function loadDMMessages(dmId) {
    messagesList.innerHTML = '';

    // Get DM info and user info
    const dm = directMessages.find(d => d.id === dmId);
    let currentUserInfo = null;
    
    const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
    if (currentUserDoc.exists()) {
        currentUserInfo = { id: currentUser.uid, ...currentUserDoc.data() };
    }

    const messagesRef = collection(db, 'directMessages', dmId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        messagesList.innerHTML = '';
        let currentAuthor = null;

        snapshot.forEach((doc) => {
            const messageData = { id: doc.id, ...doc.data() };
            const isNewAuthor = currentAuthor !== messageData.authorId;

            if (isNewAuthor || currentAuthor === null) {
                currentAuthor = messageData.authorId;
                const messageGroup = document.createElement('div');
                messageGroup.className = 'message-group';

                // Get author info
                let authorInfo = null;
                if (messageData.authorId === currentUser.uid) {
                    authorInfo = currentUserInfo;
                } else {
                    authorInfo = dm?.otherUser || null;
                }

                const authorName = authorInfo?.displayName || authorInfo?.username || 'Unknown User';
                const authorAvatar = authorInfo?.avatar || '';

                const timestamp = messageData.createdAt?.toDate() || new Date();
                const timeString = timestamp.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit'
                });

                const messageEl = document.createElement('div');
                messageEl.className = 'message';

                let avatarContent = '';
                if (authorAvatar) {
                    avatarContent = `<img src="${authorAvatar}" alt="${authorName}">`;
                } else {
                    avatarContent = authorName.substring(0, 2).toUpperCase();
                }

                messageEl.innerHTML = `
                    <div class="message-avatar">${avatarContent}</div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-author">${authorName}</span>
                            <span class="message-timestamp">${timeString}</span>
                        </div>
                        <div class="message-text">${escapeHtml(messageData.text)}</div>
                    </div>
                `;

                messageGroup.appendChild(messageEl);
                messagesList.appendChild(messageGroup);
            } else {
                const lastGroup = messagesList.lastElementChild;
                const messageEl = document.createElement('div');
                messageEl.className = 'message';
                messageEl.style.paddingTop = '2px';
                messageEl.innerHTML = `
                    <div class="message-content" style="margin-left: 56px;">
                        <div class="message-text">${escapeHtml(messageData.text)}</div>
                    </div>
                `;
                lastGroup.appendChild(messageEl);
            }
        });

        messagesList.scrollTop = messagesList.scrollHeight;
    });

    unsubscribeFunctions.push(unsubscribe);
}

async function searchUsers() {
    const searchTerm = document.getElementById('dm-search-input').value.trim().toLowerCase();
    const resultsContainer = document.getElementById('dm-search-results');
    
    if (searchTerm.length < 2) {
        resultsContainer.innerHTML = '';
        return;
    }

    try {
        // Search users by username or email
        const usersQuery = query(collection(db, 'users'));
        const usersSnapshot = await getDocs(usersQuery);
        
        resultsContainer.innerHTML = '';
        let foundUsers = [];

        usersSnapshot.forEach(doc => {
            const userData = { id: doc.id, ...doc.data() };
            if (userData.id === currentUser.uid) return; // Don't show self
            
            const username = (userData.username || '').toLowerCase();
            const email = (userData.email || '').toLowerCase();
            
            if (username.includes(searchTerm) || email.includes(searchTerm)) {
                foundUsers.push(userData);
            }
        });

        if (foundUsers.length === 0) {
            resultsContainer.innerHTML = '<p style="padding: 16px; color: var(--discord-text-secondary);">No users found</p>';
            return;
        }

        foundUsers.forEach(user => {
            const resultItem = document.createElement('div');
            resultItem.className = 'user-search-result';
            
            let avatarContent = '';
            if (user.avatar) {
                avatarContent = `<img src="${user.avatar}" alt="${user.username}">`;
            } else {
                avatarContent = user.username.substring(0, 2).toUpperCase();
            }

            resultItem.innerHTML = `
                <div class="user-search-result-avatar">${avatarContent}</div>
                <div class="user-search-result-info">
                    <div class="user-search-result-name">${user.username}</div>
                    <div class="user-search-result-email">${user.email}</div>
                </div>
            `;

            resultItem.addEventListener('click', () => createOrOpenDM(user.id));
            resultsContainer.appendChild(resultItem);
        });
    } catch (error) {
        console.error('Error searching users:', error);
    }
}

async function createOrOpenDM(otherUserId) {
    // Check if DM already exists
    const existingDM = directMessages.find(dm => 
        dm.participants.includes(otherUserId) && dm.participants.includes(currentUser.uid)
    );

    if (existingDM) {
        openDM(existingDM.id);
        document.getElementById('new-dm-modal').classList.add('hidden');
        return;
    }

    // Create new DM
    try {
        const dmRef = doc(collection(db, 'directMessages'));
        await setDoc(dmRef, {
            participants: [currentUser.uid, otherUserId],
            createdAt: serverTimestamp()
        });

        document.getElementById('new-dm-modal').classList.add('hidden');
        document.getElementById('dm-search-input').value = '';
        document.getElementById('dm-search-results').innerHTML = '';

        // Reload DMs and open the new one
        await loadDirectMessages();
        openDM(dmRef.id);
    } catch (error) {
        console.error('Error creating DM:', error);
        alert('Failed to create direct message');
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Send message function (handles both DMs and server channels)
async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    // Handle DM messages
    if (currentDM) {
        try {
            await addDoc(collection(db, 'directMessages', currentDM, 'messages'), {
                text: text,
                authorId: currentUser.uid,
                createdAt: serverTimestamp()
            });
            messageInput.value = '';
            return;
        } catch (error) {
            console.error('Error sending DM:', error);
            return;
        }
    }

    // Handle server channel messages
    if (!currentServer || !currentChannel) return;

    try {
        await addDoc(collection(db, 'servers', currentServer, 'channels', currentChannel, 'messages'), {
            text: text,
            authorId: currentUser.uid,
            createdAt: serverTimestamp()
        });
        messageInput.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Export for use in other modules if needed
window.ReconCord = {
    auth,
    db,
    storage,
    currentUser,
    currentServer,
    currentChannel
};

