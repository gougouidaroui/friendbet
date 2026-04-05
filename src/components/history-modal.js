import { getTransactions } from '../services/transactions.js';
import { getState } from '../lib/store.js';

let onSuccessCallback = null;

export function openHistoryModal(callback = null) {
  onSuccessCallback = callback;
  
  const modal = document.getElementById('historyModal');
  if (modal) {
    modal.classList.add('active');
    loadHistory();
  }
}

export function closeHistoryModal() {
  const modal = document.getElementById('historyModal');
  if (modal) {
    modal.classList.remove('active');
  }
  onSuccessCallback = null;
}

async function loadHistory() {
  const { user } = getState();
  if (!user) return;
  
  const container = document.getElementById('historyList');
  container.innerHTML = '<div class="loader"></div>';
  
  try {
    const transactions = await getTransactions(user.id);
    
    if (transactions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <h3>No transactions yet</h3>
          <p>Your transaction history will appear here.</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = transactions.map(trans => {
      const time = new Date(trans.created_at).toLocaleString();
      let description = '';
      let amountClass = trans.amount > 0 ? 'positive' : 'negative';
      
      switch (trans.type) {
        case 'initial':
          description = 'Welcome bonus';
          break;
        case 'daily_bonus':
          description = `Daily bonus (streak: ${trans.streak || 1})`;
          break;
        case 'bet_created':
          description = `Created: ${trans.bet?.title || 'Unknown bet'}`;
          break;
        case 'wager':
          description = `Wager on: ${trans.bet?.title || 'Unknown bet'}`;
          break;
        case 'win':
          description = `Won: ${trans.bet?.title || 'Unknown bet'}`;
          break;
        case 'loss':
          description = `Lost: ${trans.bet?.title || 'Unknown bet'}`;
          break;
        case 'wager_refund':
          description = `Wager Refund: ${trans.bet?.title || 'Unknown bet'}`;
          break;
        case 'adjustment':
          description = 'Admin adjustment';
          break;
        default:
          description = trans.type;
      }
      
      const sign = trans.amount > 0 ? '+' : '';
      return `
        <div class="transaction-item">
          <div class="trans-info">
            <h4>${description}</h4>
            <div class="trans-time">${time}</div>
          </div>
          <div class="trans-amount ${amountClass}">
            ${sign}${trans.amount.toLocaleString()}
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    container.innerHTML = `
      <div class="error">Failed to load history</div>
    `;
  }
}

export function renderHistoryModal() {
  return `
    <div class="modal-overlay" id="historyModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Transaction History</h2>
          <button class="close-btn" id="closeHistoryModal" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div id="historyList"></div>
      </div>
    </div>
  `;
}

export function attachHistoryModalListeners() {
  const modal = document.getElementById('historyModal');
  if (!modal) return;
  
  document.getElementById('closeHistoryModal').onclick = closeHistoryModal;
  
  modal.onclick = (e) => {
    if (e.target === modal) closeHistoryModal();
  };
}
