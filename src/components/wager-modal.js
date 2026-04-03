import { getState } from '../lib/store.js';

let currentBetId = null;
let currentSide = null;
let onSuccessCallback = null;

export function openWagerModal(betId, side, betTitle, callback = null) {
  currentBetId = betId;
  currentSide = side;
  onSuccessCallback = callback;

  const modal = document.getElementById('wagerModal');
  if (modal) {
    modal.classList.add('active');
    const { profile } = getState();
    populateWagerModal(betTitle, side, profile?.points || 0);
    setTimeout(() => {
      const input = document.getElementById('wagerAmount');
      if (input) {
        input.focus();
        input.select();
      }
    }, 100);
  }
}

export function closeWagerModal() {
  const modal = document.getElementById('wagerModal');
  if (modal) {
    modal.classList.remove('active');
  }
  currentBetId = null;
  currentSide = null;
  onSuccessCallback = null;
}

function populateWagerModal(betTitle, side, balance) {
  const titleEl = document.getElementById('wagerBetTitle');
  const sideEl = document.getElementById('wagerSide');
  const balanceEl = document.getElementById('wagerBalance');
  const inputEl = document.getElementById('wagerAmount');
  const errorEl = document.getElementById('wagerError');
  const submitBtn = document.getElementById('wagerSubmitBtn');

  if (titleEl) titleEl.textContent = betTitle || 'Unknown bet';
  if (sideEl) {
    sideEl.textContent = side === 'for' ? 'For' : 'Against';
    sideEl.className = side === 'for' ? 'wager-side for' : 'wager-side against';
  }
  if (balanceEl) balanceEl.textContent = balance.toLocaleString();
  if (inputEl) inputEl.value = '';
  if (errorEl) errorEl.textContent = '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Place Bet';
  }

  const quickBtns = document.querySelectorAll('.quick-amount-btn');
  quickBtns.forEach(btn => {
    const val = btn.dataset.amount;
    if (val === 'all') {
      btn.textContent = `All (${balance.toLocaleString()})`;
    }
  });
}

function validateWager(amount, balance) {
  const num = parseInt(amount, 10);
  if (!amount || amount.trim() === '') return 'Enter an amount';
  if (isNaN(num) || num <= 0) return 'Enter a valid number';
  if (num > balance) return 'Insufficient balance';
  return null;
}

function setupWagerListeners() {
  const modal = document.getElementById('wagerModal');
  if (!modal) return;

  document.getElementById('closeWagerModal').onclick = closeWagerModal;

  const cancelBtn = document.getElementById('wagerCancelBtn');
  if (cancelBtn) cancelBtn.onclick = closeWagerModal;

  modal.onclick = (e) => {
    if (e.target === modal) closeWagerModal();
  };

  const input = document.getElementById('wagerAmount');
  const errorEl = document.getElementById('wagerError');
  const submitBtn = document.getElementById('wagerSubmitBtn');

  if (input) {
    input.oninput = () => {
      const { profile } = getState();
      const balance = profile?.points || 0;
      const error = validateWager(input.value, balance);
      if (errorEl) errorEl.textContent = '';
      if (submitBtn) submitBtn.disabled = !!error;
    };

    input.onkeydown = (e) => {
      if (e.key === 'Enter' && !submitBtn.disabled) {
        submitBtn.click();
      }
    };
  }

  document.querySelectorAll('.quick-amount-btn').forEach(btn => {
    btn.onclick = () => {
      const { profile } = getState();
      const balance = profile?.points || 0;
      let amount;
      if (btn.dataset.amount === 'all') {
        amount = balance;
      } else {
        amount = parseInt(btn.dataset.amount, 10);
        if (amount > balance) amount = balance;
      }
      if (input) {
        input.value = amount;
        input.focus();
      }
      if (errorEl) errorEl.textContent = '';
      if (submitBtn) submitBtn.disabled = false;
    };
  });

  if (submitBtn) {
    submitBtn.onclick = async () => {
      const { user, profile } = getState();
      if (!user || !currentBetId) return;

      const amount = parseInt(input.value, 10);
      const error = validateWager(input.value, profile?.points || 0);
      if (error) {
        if (errorEl) errorEl.textContent = error;
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="spinner-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
        Placing...
      `;

      try {
        const { placeWager } = await import('../services/bets.js');
        const { loadProfile } = await import('../services/auth.js');
        await placeWager(currentBetId, user.id, currentSide, amount);
        const newProfile = await loadProfile(user);
        const { updateUser } = await import('../lib/store.js');
        updateUser(user, newProfile);
        closeWagerModal();
        if (onSuccessCallback) onSuccessCallback();
      } catch (error) {
        if (errorEl) errorEl.textContent = error.message || 'Failed to place bet';
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Place Bet';
      }
    };
  }
}

export function renderWagerModal() {
  return `
    <div class="modal-overlay" id="wagerModal">
      <div class="modal-content wager-modal-content">
        <div class="modal-header">
          <h2>Place Wager</h2>
          <button class="close-btn" id="closeWagerModal" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="wager-info">
          <div class="wager-bet-title" id="wagerBetTitle"></div>
          <div class="wager-side-label">
            Betting: <span id="wagerSide"></span>
          </div>
        </div>
        <div class="wager-balance">
          <span>Your Balance</span>
          <span id="wagerBalance">0</span>
        </div>
        <div class="wager-input-group">
          <label for="wagerAmount">Stake Amount</label>
          <div class="wager-input-wrapper">
            <span class="wager-currency">Pts</span>
            <input
              type="text"
              id="wagerAmount"
              inputmode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              autocomplete="off"
            />
          </div>
          <div class="quick-amounts">
            <button class="quick-amount-btn" type="button" data-amount="10">10</button>
            <button class="quick-amount-btn" type="button" data-amount="25">25</button>
            <button class="quick-amount-btn" type="button" data-amount="50">50</button>
            <button class="quick-amount-btn" type="button" data-amount="all">All</button>
          </div>
          <div class="wager-error" id="wagerError" role="alert" aria-live="polite"></div>
        </div>
        <div class="wager-actions">
          <button class="btn btn-secondary btn-block" id="wagerCancelBtn">Cancel</button>
          <button class="btn btn-primary btn-block" id="wagerSubmitBtn" disabled>Place Bet</button>
        </div>
      </div>
    </div>
  `;
}

export function attachWagerModalListeners() {
  setupWagerListeners();
}
