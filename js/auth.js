/**
 * NIS Alumni — Auth JavaScript
 * Login & registration form handlers with fetch API.
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

// ── Login form ──────────────────────────────────────────────
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = loginForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Signing in…';

        const data = {
            email: loginForm.email.value.trim(),
            password: loginForm.password.value,
        };

        try {
            const res = await fetch('api/login.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await res.json();

            if (result.success) {
                showToast('Welcome back!', 'success');
                setTimeout(() => window.location.href = 'dashboard.html', 800);
            } else {
                showToast(result.message || 'Login failed.', 'error');
            }
        } catch (err) {
            showToast('Network error. Please try again.', 'error');
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
                const res = await fetch(`api/check-username.php?username=${encodeURIComponent(val)}`);
                const data = await res.json();
                usernameStatus.classList.remove('hidden');
                if (data.available) {
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

        const data = {
            email: registerForm.email.value.trim(),
            password: registerForm.password.value,
            confirm_password: registerForm.confirm_password.value,
            full_name: registerForm.full_name.value.trim(),
            username: registerForm.username.value.trim().toLowerCase(),
            nis_branch: registerForm.nis_branch.value,
            graduation_year: registerForm.graduation_year.value,
        };

        // Client-side validation
        if (data.password.length < 6) {
            showToast('Password must be at least 6 characters.', 'error');
            btn.disabled = false;
            btn.textContent = 'Create Account';
            return;
        }
        if (data.password !== data.confirm_password) {
            showToast('Passwords do not match.', 'error');
            btn.disabled = false;
            btn.textContent = 'Create Account';
            return;
        }
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(data.username)) {
            showToast('Username must be 3-30 characters (letters, numbers, underscores).', 'error');
            btn.disabled = false;
            btn.textContent = 'Create Account';
            return;
        }

        try {
            const res = await fetch('api/register.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await res.json();

            if (result.success) {
                showToast('Account created! Redirecting…', 'success');
                setTimeout(() => window.location.href = 'dashboard.html', 800);
            } else {
                const msg = result.errors ? result.errors.join(' ') : (result.message || 'Registration failed.');
                showToast(msg, 'error');
            }
        } catch (err) {
            showToast('Network error. Please try again.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create Account';
        }
    });
}
