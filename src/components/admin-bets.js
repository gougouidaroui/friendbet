import { getAllBets, deleteBet, forceResolve } from '../services/admin.js';

let allBets = [];
let filteredBets = [];

export async function loadBets() {
  const container = document.getElementById('adminContent');
  if (!container) return;

  container.innerHTML = `
    <div class="admin-toolbar">
      <input type="text" class="admin-search-input" id="adminBetSearch" placeholder="Search bets...">
      <select class="admin-filter-select" id="adminBetStatus">
        <option value="all">All Status</option>
        <option value="published">Published</option>
        <option value="in_resolution">In Resolution</option>
        <option value="resolved">Resolved</option>
        <option value="refunded">Refunded</option>
        <option value="draft">Draft</option>
      </select>
    </div>
    <div id="adminBetsList" class="admin-table-container">
      <div class="loader"></div>
    </div>
  `;

  try {
    allBets = await getAllBets();
    filteredBets = [...allBets];
    renderBetsTable();
    attachBetFilters();
  } catch (error) {
    container.innerHTML = `<div class="error">Failed to load bets: ${error.message}</div>`;
  }
}

function renderBetsTable() {
  const list = document.getElementById('adminBetsList');
  if (!list) return;

  if (filteredBets.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No bets found</p></div>';
    return;
  }

  list.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Bet</th>
          <th>Creator</th>
          <th>Status</th>
          <th>Wagers</th>
          <th>Stake</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${filteredBets.map(b => {
          const wagerCount = b.wagers ? b.wagers.length : 0;
          const wagerTotal = b.wagers ? b.wagers.reduce((s, w) => s + w.amount, 0) : 0;
          const statusClass = `status-${b.status}`;
          return `
            <tr>
              <td>
                <div class="admin-bet-title">${b.title || 'Untitled'}</div>
                <div class="admin-bet-id">${b.id?.slice(0, 8) || ''}</div>
              </td>
              <td>${b.creator?.username || 'Unknown'}</td>
              <td><span class="admin-badge ${statusClass}">${b.status}</span></td>
              <td>${wagerCount} (${wagerTotal.toLocaleString()} pts)</td>
              <td>${(b.stake || 0).toLocaleString()}</td>
              <td>${b.created_at ? new Date(b.created_at).toLocaleDateString() : '-'}</td>
              <td>
                <div class="admin-user-actions">
                  ${b.status !== 'resolved' && b.status !== 'refunded' ? `
                    <button class="admin-btn-sm admin-btn-resolve" data-bet-id="${b.id}" data-action="resolve">
                      Resolve
                    </button>
                  ` : ''}
                  <button class="admin-btn-sm admin-btn-delete" data-bet-id="${b.id}" data-action="delete">
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  document.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this bet? All wagers will be refunded.')) return;
      try {
        await deleteBet(btn.dataset.betId);
        loadBets();
      } catch (e) {
        alert('Failed: ' + e.message);
      }
    });
  });

  document.querySelectorAll('[data-action="resolve"]').forEach(btn => {
    btn.addEventListener('click', () => showResolveDialog(btn.dataset.betId));
  });
}

function attachBetFilters() {
  const search = document.getElementById('adminBetSearch');
  const status = document.getElementById('adminBetStatus');
  if (!search || !status) return;

  const applyFilters = () => {
    const q = search.value.toLowerCase().trim();
    const s = status.value;
    filteredBets = allBets.filter(b => {
      const matchQ = !q || (b.title || '').toLowerCase().includes(q) || (b.creator?.username || '').toLowerCase().includes(q);
      const matchS = s === 'all' || b.status === s;
      return matchQ && matchS;
    });
    renderBetsTable();
  };

  search.addEventListener('input', applyFilters);
  status.addEventListener('change', applyFilters);
}

function showResolveDialog(betId) {
  const winner = prompt('Winner? (for / against / refund)');
  if (!winner || !['for', 'against', 'refund'].includes(winner)) {
    if (winner !== null) alert('Must be "for", "against", or "refund"');
    return;
  }
  if (!confirm(`Force resolve this bet with winner: "${winner}"?`)) return;
  forceResolve(betId, winner)
    .then(() => {
      alert('Bet resolved successfully');
      loadBets();
    })
    .catch(e => alert('Failed: ' + e.message));
}
