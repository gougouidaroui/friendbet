import { resolveBet } from '../services/bets.js';
import { getState } from '../lib/store.js';

let currentBetId = null;
let onSuccessCallback = null;

export function openWinnerModal(betId, callback = null) {
  currentBetId = betId;
  onSuccessCallback = callback;
  
  const modal = document.getElementById('winnerModal');
  if (modal) {
    modal.classList.add('active');
  }
}

export function closeWinnerModal() {
  const modal = document.getElementById('winnerModal');
  if (modal) {
    modal.classList.remove('active');
  }
  currentBetId = null;
  onSuccessCallback = null;
}

export function renderWinnerModal() {
  return `
    <div class="modal-overlay" id="winnerModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Select Winner</h2>
          <button class="close-btn" id="closeWinnerModal" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <p style="margin-bottom: var(--spacing-6); color: var(--foreground-muted);">Who won this bet?</p>
        <button class="btn btn-success btn-block" id="selectForWinner" style="margin-bottom: var(--spacing-3);">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          The "For" Side Won
        </button>
        <button class="btn btn-danger btn-block" id="selectAgainstWinner">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          The "Against" Side Won
        </button>
        <p style="margin-top: var(--spacing-5); font-size: 13px; color: var(--foreground-subtle); text-align: center;">If no selection is made, the "Against" side wins by default.</p>
      </div>
    </div>
  `;
}

export function attachWinnerModalListeners() {
  const modal = document.getElementById('winnerModal');
  if (!modal) return;
  
  document.getElementById('closeWinnerModal').onclick = closeWinnerModal;
  
  modal.onclick = (e) => {
    if (e.target === modal) closeWinnerModal();
  };
  
  document.getElementById('selectForWinner').onclick = async () => {
    const { user } = getState();
    try {
      await resolveBet(currentBetId, 'for', user.id);
      closeWinnerModal();
      if (onSuccessCallback) onSuccessCallback();
    } catch (error) {
      alert(error.message || 'Failed to resolve bet');
    }
  };
  
  document.getElementById('selectAgainstWinner').onclick = async () => {
    const { user } = getState();
    try {
      await resolveBet(currentBetId, 'against', user.id);
      closeWinnerModal();
      if (onSuccessCallback) onSuccessCallback();
    } catch (error) {
      alert(error.message || 'Failed to resolve bet');
    }
  };
}

export function getCurrentWinnerBetId() {
  return currentBetId;
}
