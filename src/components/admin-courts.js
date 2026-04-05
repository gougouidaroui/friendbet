import { getStuckCourts, forceResolve } from '../services/admin.js';

export async function loadCourts() {
  const container = document.getElementById('adminContent');
  if (!container) return;

  container.innerHTML = '<div class="loader"></div>';

  try {
    const courts = await getStuckCourts();

    if (courts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <h3>No stuck courts</h3>
          <p>All resolutions are progressing normally.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Bet</th>
            <th>Status</th>
            <th>Proposed By</th>
            <th>Outcome</th>
            <th>Challenged By</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${courts.map(c => `
            <tr>
              <td>
                <div class="admin-bet-title">${c.bet?.title || 'Unknown'}</div>
                <div class="admin-bet-id">${c.bet_id?.slice(0, 8) || ''}</div>
              </td>
              <td><span class="admin-badge status-${c.status}">${c.status}</span></td>
              <td>${c.proposed_by ? (c.bet?.creator?.username || c.proposed_by.slice(0, 8)) : '-'}</td>
              <td>${c.proposed_outcome || '-'}</td>
              <td>${c.challenged_by ? c.challenged_by.slice(0, 8) : '-'}</td>
              <td>${c.created_at ? new Date(c.created_at).toLocaleString() : '-'}</td>
              <td>
                <div class="admin-user-actions">
                  <button class="admin-btn-sm admin-btn-resolve" data-bet-id="${c.bet_id}" data-action="resolve-court">
                    Resolve
                  </button>
                  <button class="admin-btn-sm admin-btn-refund" data-bet-id="${c.bet_id}" data-action="refund-court">
                    Refund
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    document.querySelectorAll('[data-action="resolve-court"]').forEach(btn => {
      btn.addEventListener('click', () => showCourtResolveDialog(btn.dataset.betId, 'for'));
    });

    document.querySelectorAll('[data-action="refund-court"]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Refund all wagers and close this resolution?')) return;
        forceResolve(btn.dataset.betId, 'refund')
          .then(() => { alert('Bet refunded'); loadCourts(); })
          .catch(e => alert('Failed: ' + e.message));
      });
    });

  } catch (error) {
    container.innerHTML = `<div class="error">Failed to load courts: ${error.message}</div>`;
  }
}

function showCourtResolveDialog(betId, defaultWinner) {
  const winner = prompt('Winner? (for / against)', defaultWinner);
  if (!winner || !['for', 'against'].includes(winner)) {
    if (winner !== null) alert('Must be "for" or "against"');
    return;
  }
  if (!confirm(`Force resolve with winner: "${winner}"?`)) return;
  forceResolve(betId, winner)
    .then(() => { alert('Court resolved'); loadCourts(); })
    .catch(e => alert('Failed: ' + e.message));
}
