// Admin Dashboard - Authentication

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');

  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';
  loginError.style.display = 'none';

  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Login failed');
    }

    JWT_TOKEN = data.token;
    currentUser = data.user;
    localStorage.setItem('admin_jwt', JWT_TOKEN);

    // Verify admin access
    const adminCheck = await fetch(`${API_URL}/api/admin/users`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });

    if (!adminCheck.ok) {
      throw new Error('Access denied. Admin privileges required.');
    }

    // Show dashboard
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('dashboard').classList.add('active');
    document.getElementById('userInfo').textContent = currentUser.displayName || currentUser.email;

    // Restore last active tab (or load default data)
    restoreActiveTab();

  } catch (error) {
    loginError.textContent = error.message;
    loginError.style.display = 'block';
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }
});

// Forgot password toggle
document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('forgotPasswordSection').style.display = 'none';
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('forgotPasswordForm').style.display = 'block';
  document.getElementById('forgotEmail').focus();
});

document.getElementById('backToLoginLink')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('forgotPasswordSection').style.display = 'block';
  document.getElementById('forgotPasswordForm').style.display = 'none';
  document.getElementById('forgotPasswordMessage').style.display = 'none';
});

async function handleForgotPassword() {
  const email = document.getElementById('forgotEmail').value;
  const btn = document.getElementById('forgotPasswordBtn');
  const msg = document.getElementById('forgotPasswordMessage');

  if (!email) return;

  btn.disabled = true;
  btn.textContent = 'Sending...';
  msg.style.display = 'none';

  try {
    const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    msg.style.background = '#d4edda';
    msg.style.color = '#155724';
    msg.textContent = 'If an account exists with that email, a password reset link has been sent.';
    msg.style.display = 'block';
  } catch (error) {
    msg.style.background = '#f8d7da';
    msg.style.color = '#721c24';
    msg.textContent = 'Something went wrong. Please try again.';
    msg.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Reset Link';
  }
}

function logout() {
  localStorage.removeItem('admin_jwt');
  JWT_TOKEN = null;
  currentUser = null;
  window.location.reload();
}

// Check if already logged in
if (JWT_TOKEN) {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('dashboard').classList.add('active');
  restoreActiveTab();
}
