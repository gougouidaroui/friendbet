import './index.css';
import { initApp } from './app.js';
import { getCurrentUser, loadProfile } from './services/auth.js';
import { updateUser, setLoading } from './lib/store.js';

const app = document.getElementById('app');

async function start() {
  setLoading(true);
  
  const { data: { session } } = await getCurrentUser();
  
  if (session?.user) {
    const profile = await loadProfile(session.user);
    updateUser(session.user, profile);
  }
  
  setLoading(false);
  initApp(app);
}

start();
