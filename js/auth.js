/**
 * NIS Connect — Auth JavaScript (Supabase)
 * Login & registration form handlers using Supabase Auth.
 */

// ── Toast helper ────────────────────────────────────────────
function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = '0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ── Check if already logged in (redirect to dashboard) ──────
(async () => {
    const session = await sbGetSession();
    if (session) {
        window.location.href = 'dashboard.html';
    }
})();

// ── Login form ──────────────────────────────────────────────
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = loginForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Signing in…';

        const email = loginForm.email.value.trim();
        const password = loginForm.password.value;

        try {
            await sbSignIn(email, password);
            showToast('Welcome back!', 'success');
            setTimeout(() => window.location.href = 'dashboard.html', 800);
        } catch (err) {
            showToast(err.message || 'Login failed.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Sign In';
        }
    });
}

// ── Registration form ───────────────────────────────────────
const registerForm = document.getElementById('register-form');
if (registerForm) {
    // Live username availability check
    const usernameInput = document.getElementById('username');
    const usernameStatus = document.getElementById('username-status');
    let usernameTimer;

    usernameInput?.addEventListener('input', () => {
        clearTimeout(usernameTimer);
        const val = usernameInput.value.trim().toLowerCase();

        if (val.length < 3) {
            usernameStatus.classList.add('hidden');
            return;
        }

        usernameStatus.classList.remove('hidden');
        usernameStatus.textContent = '...';
        usernameStatus.className = 'absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400';

        usernameTimer = setTimeout(async () => {
            try {
                const result = await sbCheckUsername(val);
                usernameStatus.classList.remove('hidden');
                if (result.available) {
                    usernameStatus.textContent = '✓ Available';
                    usernameStatus.className = 'absolute right-4 top-1/2 -translate-y-1/2 text-sm text-green-500 font-semibold';
                } else {
                    usernameStatus.textContent = '✗ Taken';
                    usernameStatus.className = 'absolute right-4 top-1/2 -translate-y-1/2 text-sm text-red-500 font-semibold';
                }
            } catch { }
        }, 400);
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = registerForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Creating account…';

        const email = registerForm.email.value.trim();
        const password = registerForm.password.value;
        const confirmPassword = registerForm.confirm_password.value;
        const fullName = registerForm.full_name.value.trim();
        const username = registerForm.username.value.trim().toLowerCase();
        const nisBranch = registerForm.nis_branch.value;
        const gradYear = registerForm.graduation_year.value;

        // Client-side validation
        if (password.length < 6) {
            showToast('Password must be at least 6 characters.', 'error');
            btn.disabled = false;
            btn.textContent = 'Create Account';
            return;
        }
        if (password !== confirmPassword) {
            showToast('Passwords do not match.', 'error');
            btn.disabled = false;
            btn.textContent = 'Create Account';
            return;
        }
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
            showToast('Username must be 3-30 characters (letters, numbers, underscores).', 'error');
            btn.disabled = false;
            btn.textContent = 'Create Account';
            return;
        }

        // Check username
        try {
            const check = await sbCheckUsername(username);
            if (!check.available) {
                showToast('Username is already taken.', 'error');
                btn.disabled = false;
                btn.textContent = 'Create Account';
                return;
            }
        } catch { }

        try {
            const data = await sbSignUp(email, password, fullName, username);

            // Update profile with extra fields
            if (data.user) {
                await sbUpdateProfile(data.user.id, {
                    nis_branch: nisBranch || null,
                    graduation_year: gradYear ? parseInt(gradYear) : null,
                    full_name: fullName,
                    username,
                });
            }

            showToast('Account created! Redirecting…', 'success');
            setTimeout(() => window.location.href = 'dashboard.html', 800);
        } catch (err) {
            showToast(err.message || 'Registration failed.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create Account';
        }
    });
}
