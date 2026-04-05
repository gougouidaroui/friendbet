import { getAllTransactions } from '../services/admin.js';

let allTransactions = [];
let filteredTransactions = [];

export async function loadLogs() {
  const container = document.getElementById('adminContent');
  if (!container) return;

  container.innerHTML = `
    <div class="admin-toolbar">
      <input type="text" class="admin-search-input" id="adminLogSearch" placeholder="Search by reason or user ID...">
      <select class="admin-filter-select" id="adminLogType">
        <option value="all">All Types</option>
        <option value="daily_bonus">Daily Bonus</option>
        <option value="bet_created">Bet Created</option>
        <option value="wager">Wager</option>
        <option value="win">Win</option>
        <option value="loss">Loss</option>
        <option value="wager_refund">Wager Refund</option>
        <option value="adjustment">Admin Adjustment</option>
        <option value="admin_bet_delete">Admin Bet Delete</option>
        <option value="admin_resolve">Admin Resolve</option>
        <option value="court_stake">Court Stake</option>
        <option value="court_win">Court Win</option>
        <option value="court_loss">Court Loss</option>
        <option value="resolution_proposal">Resolution Proposal</option>
        <option value="win_streak_bonus">Win Streak Bonus</option>
        <option value="initial">Initial</option>
      </select>
    </div>
    <div id="adminLogsList" class="admin-table-container">
      <div class="loader"></div>
    </div>
  `;

  try {
    allTransactions = await getAllTransactions();
    filteredTransactions = [...allTransactions];
    renderLogsTable();
    attachLogFilters();
  } catch (error) {
    container.innerHTML = `<div class="error">Failed to load logs: ${error.message}</div>`;
  }
}

function renderLogsTable() {
  const list = document.getElementById('adminLogsList');
  if (!list) return;

  if (filteredTransactions.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No transactions found</p></div>';
    return;
  }

  list.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>User</th>
          <th>Amount</th>
          <th>Bet</th>
          <th>Reason</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${filteredTransactions.map(t => {
          const amountClass = t.amount > 0 ? 'positive' : t.amount < 0 ? 'negative' : '';
          const sign = t.amount > 0 ? '+' : '';
          return `
            <tr>
              <td><span class="admin-badge type-${t.type}">${t.type}</span></td>
              <td><span class="admin-user-id">${t.user_id?.slice(0, 8) || ''}</span></td>
              <td class="${amountClass}">${sign}${(t.amount || 0).toLocaleString()}</td>
              <td><span class="admin-user-id">${t.bet_id?.slice(0, 8) || '-'}</span></td>
              <td class="admin-log-reason">${t.reason || '-'}</td>
              <td>${t.created_at ? new Date(t.created_at).toLocaleString() : '-'}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function attachLogFilters() {
  const search = document.getElementById('adminLogSearch');
  const type = document.getElementById('adminLogType');
  if (!search || !type) return;

  const applyFilters = () => {
    const q = search.value.toLowerCase().trim();
    const t = type.value;
    filteredTransactions = allTransactions.filter(tx => {
      const matchQ = !q || (tx.reason || '').toLowerCase().includes(q) || (tx.user_id || '').toLowerCase().includes(q);
      const matchT = t === 'all' || tx.type === t;
      return matchQ && matchT;
    });
    renderLogsTable();
  };

  search.addEventListener('input', applyFilters);
  type.addEventListener('change', applyFilters);
}
