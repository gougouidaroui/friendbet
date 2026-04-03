import { signUp, signIn } from '../services/auth.js';

export function renderAuth() {
  return `
    <div class="auth-screen">
      <div class="auth-layout">
        <div class="auth-brand">
          <div class="auth-brand-content">
            <div class="logo">Friend<span class="logo-accent">Bet</span></div>
            <p class="auth-tagline">Challenge your friends. Win points. Have fun.</p>
            <div class="auth-features">
              <div class="auth-feature">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span>Bet with friends, not strangers</span>
              </div>
              <div class="auth-feature">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>Set your own time limits and stakes</span>
              </div>
              <div class="auth-feature">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                <span>Winner takes all, no house cut</span>
              </div>
            </div>
          </div>
        </div>
        <div class="auth-form-side">
          <div class="auth-box">
            <div id="loginForm">
              <div class="auth-form-header">
                <h2>Welcome back</h2>
                <p>Sign in to your account</p>
              </div>
              <div class="input-group">
                <label for="loginEmail">Email</label>
                <input type="email" id="loginEmail" placeholder="you@example.com" autocomplete="email">
              </div>
              <div class="input-group">
                <label for="loginPassword">Password</label>
                <input type="password" id="loginPassword" placeholder="Enter your password" autocomplete="current-password">
              </div>
              <button class="btn btn-primary btn-block" id="loginBtn">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                Sign In
              </button>
              <button class="btn btn-ghost btn-block" id="showRegisterBtn">Create an account</button>
              <div class="error" id="loginError" style="display: none;"></div>
            </div>
            <div id="registerForm" style="display: none;">
              <div class="auth-form-header">
                <h2>Create account</h2>
                <p>Join your friends on FriendBet</p>
              </div>
              <div class="input-group">
                <label for="regEmail">Email</label>
                <input type="email" id="regEmail" placeholder="you@example.com" autocomplete="email">
              </div>
              <div class="input-group">
                <label for="regUsername">Username</label>
                <input type="text" id="regUsername" placeholder="Choose a username" autocomplete="username">
              </div>
              <div class="input-group">
                <label for="regPassword">Password</label>
                <input type="password" id="regPassword" placeholder="At least 6 characters" autocomplete="new-password">
              </div>
              <div class="input-group">
                <label for="regPasswordConfirm">Confirm Password</label>
                <input type="password" id="regPasswordConfirm" placeholder="Repeat your password" autocomplete="new-password">
              </div>
              <button class="btn btn-primary btn-block" id="registerBtn">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                Create Account
              </button>
              <button class="btn btn-ghost btn-block" id="showLoginBtn">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                Back to Sign In
              </button>
              <div class="error" id="regError" style="display: none;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function attachAuthListeners(app) {
  const loginForm = app.querySelector('#loginForm');
  const registerForm = app.querySelector('#registerForm');
  const loginError = app.querySelector('#loginError');
  const regError = app.querySelector('#regError');
  
  app.querySelector('#showRegisterBtn').onclick = () => {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
  };
  
  app.querySelector('#showLoginBtn').onclick = () => {
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
  };
  
  app.querySelector('#loginBtn').onclick = async () => {
    const email = app.querySelector('#loginEmail').value.trim();
    const password = app.querySelector('#loginPassword').value;
    
    loginError.style.display = 'none';
    
    if (!email || !password) {
      loginError.textContent = 'Please fill in all fields';
      loginError.style.display = 'block';
      return;
    }
    
    try {
      await signIn(email, password);
    } catch (error) {
      loginError.textContent = error.message || 'Login failed';
      loginError.style.display = 'block';
    }
  };
  
  app.querySelector('#registerBtn').onclick = async () => {
    const email = app.querySelector('#regEmail').value.trim();
    const username = app.querySelector('#regUsername').value.trim();
    const password = app.querySelector('#regPassword').value;
    const passwordConfirm = app.querySelector('#regPasswordConfirm').value;
    
    regError.style.display = 'none';
    
    if (!email || !username || !password || !passwordConfirm) {
      regError.textContent = 'Please fill in all fields';
      regError.style.display = 'block';
      return;
    }
    
    if (password !== passwordConfirm) {
      regError.textContent = 'Passwords do not match';
      regError.style.display = 'block';
      return;
    }
    
    if (password.length < 6) {
      regError.textContent = 'Password must be at least 6 characters';
      regError.style.display = 'block';
      return;
    }
    
    try {
      await signUp(email, password, username);
      regError.textContent = 'Check your email to confirm your account!';
      regError.className = 'success';
      regError.style.display = 'block';
    } catch (error) {
      regError.textContent = error.message || 'Registration failed';
      regError.style.display = 'block';
    }
  };
  
  app.querySelector('#loginEmail').onkeypress = (e) => {
    if (e.key === 'Enter') app.querySelector('#loginBtn').click();
  };
  
  app.querySelector('#loginPassword').onkeypress = (e) => {
    if (e.key === 'Enter') app.querySelector('#loginBtn').click();
  };
}
