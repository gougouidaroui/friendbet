import { getState } from '../lib/store.js';
import { getBetWithUsernames } from '../services/bets.js';

export function renderBetCard(bet, context = 'feed') {
  const { user, profile } = getState();
  if (!user) return '';
  
  const endTime = new Date(bet.end_time);
  const now = Date.now();
  const isClosed = now > endTime.getTime();
  const userHasWagered = bet.wagers?.some(w => w.user_id === user.id);
  const isCreator = bet.creator_id === user.id;
  
  let statusClass = '';
  let statusText = '';
  
  if (bet.status === 'draft') {
    statusClass = 'status-draft';
    statusText = 'Draft';
  } else if (bet.status === 'in_resolution') {
    statusClass = 'status-resolution';
    statusText = 'In Court';
  } else if (isClosed && bet.status === 'published') {
    statusClass = 'status-closed';
    statusText = 'Closed';
  } else if (bet.status === 'published') {
    statusClass = 'status-published';
    statusText = 'Open';
  } else if (bet.status === 'resolved') {
    statusClass = 'status-resolved';
    statusText = bet.winner === 'for' ? 'For Won' : 'Against Won';
  } else if (bet.status === 'refunded') {
    statusClass = 'status-refunded';
    statusText = 'Refunded';
  }
  
  let actions = '';
  
  if (bet.status === 'draft' && isCreator) {
    actions = `
      <button class="btn btn-edit" data-action="edit" data-bet-id="${bet.id}">Edit</button>
      <button class="btn btn-primary" data-action="publish" data-bet-id="${bet.id}">Publish</button>
      <button class="btn btn-delete" data-action="delete" data-bet-id="${bet.id}">Delete</button>
    `;
  } else if (bet.status === 'published' && !isClosed && !userHasWagered && !isCreator) {
    actions = `
      <button class="btn btn-for" data-action="bet-for" data-bet-id="${bet.id}">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        For
      </button>
      <button class="btn btn-against" data-action="bet-against" data-bet-id="${bet.id}">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Against
      </button>
    `;
  } else if (bet.status === 'published' && !isClosed && userHasWagered) {
    const userWager = bet.wagers.find(w => w.user_id === user.id);
    actions = `<span class="result-badge won">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      You bet ${userWager?.side}
    </span>`;
  } else if (bet.status === 'published' && isClosed && isCreator) {
    actions = `<button class="btn btn-primary" data-action="open-court" data-bet-id="${bet.id}">Resolve Bet</button>`;
  } else if (bet.status === 'published' && isClosed && userHasWagered) {
    actions = `<button class="btn btn-primary" data-action="open-court" data-bet-id="${bet.id}">Resolve Bet</button>`;
  } else if (bet.status === 'in_resolution') {
    actions = `<button class="btn btn-court" data-action="open-court" data-bet-id="${bet.id}">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      View Court
    </button>`;
  }
  
  const timeLeft = getTimeRemaining(endTime);
  const wagerCount = bet.wagers?.length || 0;
  
  return `
    <div class="bet-card" data-bet-id="${bet.id}">
      <div class="bet-header">
        <div class="bet-title">${escapeHtml(bet.title)}</div>
        <div class="bet-status ${statusClass}">${statusText}</div>
      </div>
      ${bet.description ? `<div class="bet-description">${escapeHtml(bet.description)}</div>` : ''}
      <div class="bet-meta">
        ${bet.status === 'published' ? `
          <div class="bet-meta-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${isClosed ? 'Closed' : timeLeft}
          </div>
          <div class="bet-meta-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            ${wagerCount} wager${wagerCount !== 1 ? 's' : ''}
          </div>
        ` : ''}
        ${bet.visibility && bet.visibility !== 'public' ? `
          <span class="visibility-badge ${bet.visibility}">${bet.visibility}</span>
        ` : ''}
        ${bet.status === 'resolved' || bet.status === 'refunded' ? `
          <div class="bet-meta-item" style="color: var(--accent-tertiary);">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            Winner: ${bet.winner === 'for' ? 'For' : 'Against'}
          </div>
        ` : ''}
      </div>
      <div class="bet-actions">
        ${actions}
      </div>
      ${bet.status === 'resolved' ? `
        <div class="wager-reveal">
          <button class="reveal-btn" data-action="reveal-wagers" data-bet-id="${bet.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Reveal who bet
          </button>
          <div class="wager-grid" id="wagers-${bet.id}" style="display: none;"></div>
        </div>
      ` : ''}
    </div>
  `;
}

export async function renderWagers(betId, container) {
  const bet = await getBetWithUsernames(betId);
  if (!bet) return;
  
  const forWagers = bet.wagers.filter(w => w.side === 'for');
  const againstWagers = bet.wagers.filter(w => w.side === 'against');
  
  container.innerHTML = `
    <div class="wager-column for">
      <h4>For (${forWagers.length})</h4>
      ${forWagers.map(w => `<div class="wager-user">${escapeHtml(w.username)}</div>`).join('')}
      ${forWagers.length === 0 ? '<div class="wager-user" style="color: var(--foreground-subtle);">No one</div>' : ''}
    </div>
    <div class="wager-column against">
      <h4>Against (${againstWagers.length})</h4>
      ${againstWagers.map(w => `<div class="wager-user">${escapeHtml(w.username)}</div>`).join('')}
      ${againstWagers.length === 0 ? '<div class="wager-user" style="color: var(--foreground-subtle);">No one</div>' : ''}
    </div>
  `;
}

function getTimeRemaining(endTime) {
  const total = endTime - Date.now();
  if (total <= 0) return 'Time\'s up';
  
  const hours = Math.floor(total / (1000 * 60 * 60));
  const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function renderEmptyState(icon, title, message) {
  const icons = {
    bet: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    shield: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    edit: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  };
  
  return `
    <div class="empty-state">
      ${icons[icon] || icons.bet}
      <h3>${title}</h3>
      <p>${message}</p>
    </div>
  `;
}
