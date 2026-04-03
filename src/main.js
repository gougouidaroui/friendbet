import './index.css';
import { initApp } from './app.js';
import { getCurrentUser, loadProfile } from './services/auth.js';
import { updateUser, setLoading } from './lib/store.js';

const app = document.getElementById('app');

function setLoadingStatus(text) {
  const el = document.getElementById('appLoadingStatus');
  if (el) el.textContent = text;
}

function setProgress(pct) {
  const el = document.getElementById('appLoadingBarFill');
  if (el) el.style.width = pct + '%';
}

function removeOverlay() {
  const el = document.getElementById('appLoadingOverlay');
  if (el) {
    setProgress(100);
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }
}

async function start() {
  setLoadingStatus('Connecting...');
  setProgress(10);
  setLoading(true);
  
  const { data: { session } } = await getCurrentUser();
  
  if (session?.user) {
    setLoadingStatus('Signing in...');
    setProgress(30);
    try {
      const profile = await loadProfile(session.user);
      updateUser(session.user, profile);
      setProgress(50);
    } catch (error) {
      console.error('Failed to load profile:', error);
      updateUser(session.user, null);
    }
  }
  
  setLoading(false);
  setLoadingStatus('Loading your bets...');
  setProgress(60);
  initApp(app);
}

start();
