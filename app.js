// ============================================
// CONFIGURATION
// ============================================
// SECURITY NOTE: For production, implement server-side download verification
// Store download URL securely and verify license before allowing access
const DOWNLOAD_URL_BASE = 'https://files.catbox.moe/'; // Base URL (obfuscated)
const DOWNLOAD_FILE_ID = btoa('61xbpj').split('').reverse().join(''); // Obfuscated file ID
const DOWNLOAD_EXT = '.rar';
const DOWNLOAD_FILENAME = 'Venatic-Slotted-Triggerbot.rar';

// Verification state keys
const VERIFY_TOKEN_KEY = 'v_verify_token';
const VERIFY_TIMESTAMP_KEY = 'v_verify_ts';
const VERIFY_LICENSE_KEY = 'v_license_key';
const TOKEN_EXPIRY_TIME = 3600000; // 1 hour in milliseconds

// HWID Reset Feature Configuration
// Set to true if HWID reset is enabled in your KeyAuth dashboard
// Set to false to hide the feature if not available
const HWID_RESET_ENABLED = false; // Change to true once enabled in KeyAuth dashboard

// Initialize KeyAuth
const KeyAuthApp = new KeyAuth({
    name: "Venatic 1v1.lol Loader",
    ownerid: "3Fgwv9rfYE",
    version: "1.0"
});

// Initialize KeyAuth on load
(async () => {
    try {
        await KeyAuthApp.init();
    } catch (error) {
        console.error('KeyAuth initialization error:', error);
    }
})();

document.addEventListener('DOMContentLoaded', async () => {
    // Get DOM elements
    const downloadBtn = document.getElementById('downloadBtn');
    const licenseModal = document.getElementById('licenseModal');
    const closeModalBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const verifyBtn = document.getElementById('verifyBtn');
    const licenseInput = document.getElementById('licenseInput');
    const errorMessage = document.getElementById('errorMessage');
    const successModal = document.getElementById('successModal');
    const downloadLink = document.getElementById('downloadLink');
    
    // HWID Reset elements
    const resetHwidBtn = document.getElementById('resetHwidBtn');
    const resetModal = document.getElementById('resetModal');
    
    // Show/hide HWID Reset button based on configuration
    if (resetHwidBtn) {
        if (HWID_RESET_ENABLED) {
            resetHwidBtn.style.display = 'inline-flex';
        } else {
            resetHwidBtn.style.display = 'none';
        }
    }
    
    // Only initialize HWID reset functionality if enabled
    if (!HWID_RESET_ENABLED) {
        // Hide modal and disable functionality
        if (resetModal) {
            resetModal.style.display = 'none';
        }
    }
    
    const closeResetModalBtn = document.getElementById('closeResetModal');
    const cancelResetBtn = document.getElementById('cancelResetBtn');
    const resetHwidSubmitBtn = document.getElementById('resetHwidSubmitBtn');
    const resetLicenseInput = document.getElementById('resetLicenseInput');
    const resetErrorMessage = document.getElementById('resetErrorMessage');
    const cooldownInfo = document.getElementById('cooldownInfo');
    const cooldownTimer = document.getElementById('cooldownTimer');
    
    // HWID Reset cooldown constants
    const HWID_RESET_COOLDOWN_KEY = 'hwid_reset_timestamp';
    const COOLDOWN_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    // Show license modal when download button is clicked
    downloadBtn.addEventListener('click', () => {
        // Clear any existing verification state
        clearVerificationState();
        licenseModal.classList.add('show');
        licenseInput.focus();
    });

    // Close modal handlers
    closeModalBtn.addEventListener('click', closeLicenseModal);
    cancelBtn.addEventListener('click', closeLicenseModal);
    
    // Click outside modal to close
    licenseModal.addEventListener('click', (e) => {
        if (e.target === licenseModal) {
            closeLicenseModal();
        }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && licenseModal.classList.contains('show')) {
            closeLicenseModal();
        }
    });

    // Verify license key
    verifyBtn.addEventListener('click', async () => {
        const licenseKey = licenseInput.value.trim();
        
        if (!licenseKey) {
            showError('Please enter your license key');
            return;
        }

        // Show loading state
        verifyBtn.classList.add('loading');
        verifyBtn.disabled = true;
        errorMessage.textContent = '';

        try {
            // Verify license
            const result = await KeyAuthApp.license(licenseKey);

            if (result.success) {
                // License is valid - store verification state securely
                const verifyToken = generateSecureToken();
                const timestamp = Date.now();
                
                sessionStorage.setItem(VERIFY_TOKEN_KEY, verifyToken);
                sessionStorage.setItem(VERIFY_TIMESTAMP_KEY, timestamp.toString());
                sessionStorage.setItem(VERIFY_LICENSE_KEY, btoa(licenseKey.substring(0, 10))); // Store partial for verification
                
                // License is valid
                closeLicenseModal();
                showSuccessModal();
            } else {
                // License is invalid - clear any existing verification
                clearVerificationState();
                showError(result.message || 'Invalid license key');
                shakeInput();
            }
        } catch (error) {
            console.error('License verification error:', error);
            showError('Failed to verify license. Please try again.');
        } finally {
            verifyBtn.classList.remove('loading');
            verifyBtn.disabled = false;
        }
    });

    // Enter key in input to verify
    licenseInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            verifyBtn.click();
        }
    });

    function closeLicenseModal() {
        licenseModal.classList.remove('show');
        licenseInput.value = '';
        errorMessage.textContent = '';
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.animation = 'shake 0.5s';
        
        setTimeout(() => {
            errorMessage.style.animation = '';
        }, 500);
    }

    function shakeInput() {
        licenseInput.style.animation = 'shake 0.5s';
        setTimeout(() => {
            licenseInput.style.animation = '';
        }, 500);
    }

    function showSuccessModal() {
        // Verify user has valid verification token before showing modal
        if (!isVerificationValid()) {
            licenseModal.classList.add('show');
            errorMessage.textContent = 'Verification expired. Please verify your license again.';
            return;
        }
        
        successModal.classList.add('show');
        
        // Set up download functionality - don't expose URL directly
        downloadLink.href = '#';
        downloadLink.download = DOWNLOAD_FILENAME;
        downloadLink.onclick = handleDownload;
    }

    function isVerificationValid() {
        const token = sessionStorage.getItem(VERIFY_TOKEN_KEY);
        const timestamp = sessionStorage.getItem(VERIFY_TIMESTAMP_KEY);
        
        if (!token || !timestamp) {
            return false;
        }
        
        const age = Date.now() - parseInt(timestamp);
        if (age > TOKEN_EXPIRY_TIME) {
            clearVerificationState();
            return false;
        }
        
        return true;
    }

    function clearVerificationState() {
        sessionStorage.removeItem(VERIFY_TOKEN_KEY);
        sessionStorage.removeItem(VERIFY_TIMESTAMP_KEY);
        sessionStorage.removeItem(VERIFY_LICENSE_KEY);
    }

    function generateSecureToken() {
        // Generate a secure token based on timestamp and random data
        const data = Date.now().toString() + Math.random().toString(36).substring(2, 15);
        return btoa(data).split('').reverse().join('');
    }

    function getDownloadUrl() {
        // Reconstruct download URL only when needed
        if (!isVerificationValid()) {
            throw new Error('Verification required');
        }
        
        // Decode obfuscated file ID with additional validation
        try {
            const token = sessionStorage.getItem(VERIFY_TOKEN_KEY);
            if (!token) throw new Error('Token missing');
            
            // Decode obfuscated file ID
            const fileId = atob(DOWNLOAD_FILE_ID.split('').reverse().join(''));
            return DOWNLOAD_URL_BASE + fileId + DOWNLOAD_EXT;
        } catch (error) {
            clearVerificationState();
            throw new Error('Verification failed');
        }
    }

    async function handleDownload(e) {
        e.preventDefault();
        
        // CRITICAL: Verify license before allowing download
        if (!isVerificationValid()) {
            successModal.classList.remove('show');
            licenseModal.classList.add('show');
            showError('Verification expired. Please verify your license again.');
            return;
        }
        
        const btn = downloadLink;
        const btnText = btn.querySelector('span');
        const originalText = btnText.textContent;
        
        // Show downloading state
        btnText.innerHTML = '<svg class="downloading-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Downloading...';
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.style.cursor = 'wait';
        
        try {
            // Get download URL securely (only if verified)
            const downloadUrl = getDownloadUrl();
            
            // Start download
            const response = await fetch(downloadUrl);
            
            if (!response.ok) {
                throw new Error('Download failed');
            }
            
            const blob = await response.blob();
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = DOWNLOAD_FILENAME;
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                // Show completed state
                btnText.innerHTML = '<svg class="success-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Downloaded!';
                
                // Reset after 2 seconds
                setTimeout(() => {
                    btnText.textContent = originalText;
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                }, 2000);
            }, 100);
        } catch (error) {
            console.error('Download error:', error);
            
            // If verification failed, reset everything
            if (error.message === 'Verification required' || !isVerificationValid()) {
                clearVerificationState();
                successModal.classList.remove('show');
                licenseModal.classList.add('show');
                showError('Verification expired. Please verify your license again.');
                return;
            }
            
            btnText.textContent = 'Download Failed - Click to Retry';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            
            // Reset after 3 seconds
            setTimeout(() => {
                btnText.textContent = originalText;
            }, 3000);
        }
    }

    // Clear verification on page unload (optional security measure)
    window.addEventListener('beforeunload', () => {
        // Keep session storage but could clear on certain conditions
    });

    // ============================================
    // HWID RESET FUNCTIONALITY
    // ============================================
    
    // HWID Reset functions (only used if enabled)
    function checkCooldown() {
        if (!HWID_RESET_ENABLED) return false;
        const lastReset = localStorage.getItem(HWID_RESET_COOLDOWN_KEY);
        if (!lastReset) return false;
        
        const timeElapsed = Date.now() - parseInt(lastReset);
        return timeElapsed < COOLDOWN_DURATION;
    }
    
    function getCooldownRemaining() {
        if (!HWID_RESET_ENABLED) return 0;
        const lastReset = localStorage.getItem(HWID_RESET_COOLDOWN_KEY);
        if (!lastReset) return 0;
        
        const timeElapsed = Date.now() - parseInt(lastReset);
        const remaining = COOLDOWN_DURATION - timeElapsed;
        return remaining > 0 ? remaining : 0;
    }
    
    function updateCooldownTimer() {
        const remaining = getCooldownRemaining();
        
        if (remaining > 0) {
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
            
            if (cooldownTimer) {
                cooldownTimer.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
            
            if (cooldownInfo) {
                cooldownInfo.style.display = 'block';
            }
            
            if (resetHwidSubmitBtn) {
                resetHwidSubmitBtn.disabled = true;
                const btnText = resetHwidSubmitBtn.querySelector('.btn-text');
                if (btnText) {
                    btnText.textContent = 'On Cooldown';
                }
                resetHwidSubmitBtn.style.opacity = '0.5';
            }
        } else {
            if (cooldownInfo) {
                cooldownInfo.style.display = 'none';
            }
            
            if (resetHwidSubmitBtn) {
                resetHwidSubmitBtn.disabled = false;
                const btnText = resetHwidSubmitBtn.querySelector('.btn-text');
                if (btnText) {
                    btnText.textContent = 'Reset HWID';
                }
                resetHwidSubmitBtn.style.opacity = '1';
            }
        }
    }
    
    // Only set up HWID reset if feature is enabled
    if (HWID_RESET_ENABLED) {
        // Update cooldown timer every second (only if elements exist)
        if (cooldownTimer && resetHwidSubmitBtn) {
            setInterval(updateCooldownTimer, 1000);
            updateCooldownTimer(); // Initial check
        }
        
        // Check cooldown on button click
        if (resetHwidBtn) {
            resetHwidBtn.addEventListener('click', () => {
        updateCooldownTimer();
        
        if (checkCooldown()) {
            resetModal.classList.add('show');
            resetLicenseInput.disabled = true;
            resetLicenseInput.placeholder = 'Currently on cooldown';
        } else {
            resetModal.classList.add('show');
            resetLicenseInput.disabled = false;
            resetLicenseInput.placeholder = 'Enter your license key';
            resetLicenseInput.focus();
            }
        });
        }
    
        // Close reset modal handlers
        if (closeResetModalBtn) {
            closeResetModalBtn.addEventListener('click', () => {
                closeResetModal();
            });
        }
        
        if (cancelResetBtn) {
            cancelResetBtn.addEventListener('click', () => {
                closeResetModal();
            });
        }
        
        if (resetModal) {
            resetModal.addEventListener('click', (e) => {
                if (e.target === resetModal) {
                    closeResetModal();
                }
            });
        }
        
        function closeResetModal() {
            if (resetModal) resetModal.classList.remove('show');
            if (resetLicenseInput) resetLicenseInput.value = '';
            if (resetErrorMessage) resetErrorMessage.textContent = '';
        }
        
        // Reset HWID on submit
        if (resetHwidSubmitBtn) {
            resetHwidSubmitBtn.addEventListener('click', async () => {
        if (checkCooldown()) {
            resetErrorMessage.textContent = 'Please wait 24 hours before resetting HWID again.';
            return;
        }
        
        const licenseKey = resetLicenseInput.value.trim();
        
        if (!licenseKey) {
            resetErrorMessage.textContent = 'Please enter your license key';
            return;
        }
        
        resetHwidSubmitBtn.classList.add('loading');
        resetHwidSubmitBtn.disabled = true;
        resetErrorMessage.textContent = '';
        
        try {
            const result = await KeyAuthApp.resetHWID(licenseKey);
            
            if (result.success) {
                // Store cooldown timestamp
                localStorage.setItem(HWID_RESET_COOLDOWN_KEY, Date.now().toString());
                
                // Clear existing verification
                clearVerificationState();
                
                // Show success message
                alert('HWID reset successfully! You can now use your license on a different device.');
                
                closeResetModal();
                updateCooldownTimer();
            } else {
                resetErrorMessage.textContent = result.message || 'Failed to reset HWID';
            }
        } catch (error) {
            console.error('HWID reset error:', error);
            resetErrorMessage.textContent = 'Failed to reset HWID. Please try again.';
        } finally {
                resetHwidSubmitBtn.classList.remove('loading');
                resetHwidSubmitBtn.disabled = false;
            }
        });
        }
        
        // Enter key to submit
        if (resetLicenseInput && resetHwidSubmitBtn) {
            resetLicenseInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !checkCooldown()) {
                    resetHwidSubmitBtn.click();
                }
            });
        }
    } else {
        console.log('HWID Reset feature is disabled. Set HWID_RESET_ENABLED = true in app.js to enable.');
    }

    // Close success modal when clicking outside
    successModal.addEventListener('click', (e) => {
        if (e.target === successModal) {
            successModal.classList.remove('show');
        }
    });

    // Logout button handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to logout?')) {
                logout();
            }
        });
    }
});

// Add shake animation
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

