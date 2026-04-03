import { getBet } from '../services/bets.js';
import { getState } from '../lib/store.js';

let currentBetId = null;
let onSuccessCallback = null;

export function openBetModal(betId = null, callback = null) {
  currentBetId = betId;
  onSuccessCallback = callback;
  
  const modal = document.getElementById('betModal');
  const title = document.getElementById('modalTitle');
  const saveDraftBtn = document.getElementById('saveDraftBtn');
  const publishBtn = document.getElementById('publishBtn');
  
  if (modal) {
    title.textContent = betId ? 'Edit Bet' : 'Create Bet';
    saveDraftBtn.style.display = betId ? 'inline-flex' : 'none';
    
    if (betId) {
      loadBetForEdit(betId);
    } else {
      resetForm();
    }
    
    modal.classList.add('active');
    updatePreview();
  }
}

export function closeBetModal() {
  const modal = document.getElementById('betModal');
  if (modal) {
    modal.classList.remove('active');
  }
  currentBetId = null;
  onSuccessCallback = null;
}

async function loadBetForEdit(betId) {
  const bet = await getBet(betId);
  
  if (bet) {
    document.getElementById('betTitle').value = bet.title || '';
    document.getElementById('betDesc').value = bet.description || '';
    document.getElementById('betDuration').value = bet.duration || 24;
    document.getElementById('betStake').value = bet.stake || 0;
    document.getElementById('betVisibility').value = bet.visibility || 'public';
    updatePreview();
  }
}

function resetForm() {
  document.getElementById('betTitle').value = '';
  document.getElementById('betDesc').value = '';
  document.getElementById('betDuration').value = 24;
  document.getElementById('betStake').value = '';
  document.getElementById('betVisibility').value = 'public';
}

function updatePreview() {
  const title = document.getElementById('betTitle').value || 'Your bet title...';
  const duration = parseInt(document.getElementById('betDuration').value) || 24;
  
  document.getElementById('betPreview').textContent = title;
  document.getElementById('betCost').textContent = `10 pts + ${duration} pts = ${10 + duration} pts`;
}

export function renderBetModal() {
  return `
    <div class="modal-overlay" id="betModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="modalTitle">Create Bet</h2>
          <button class="close-btn" id="closeBetModal" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div>
          <div class="input-group">
            <label for="betTitle">Title</label>
            <input type="text" id="betTitle" placeholder="What's the bet?">
          </div>
          <div class="input-group">
            <label for="betDesc">Description (optional)</label>
            <textarea id="betDesc" placeholder="Add more details..." rows="3"></textarea>
          </div>
          <div class="input-group">
            <label for="betDuration">Duration (hours)</label>
            <input type="number" id="betDuration" value="24" min="1" max="720">
          </div>
          <div class="input-group">
            <label for="betStake">Creator Stake</label>
            <input type="number" id="betStake" placeholder="Points to win" min="0">
          </div>
          <div class="input-group">
            <label for="betVisibility">Visibility</label>
            <select id="betVisibility">
              <option value="public">Public - Everyone can see and join</option>
              <option value="friends">Friends Only - Only friends can see and join</option>
              <option value="private">Private - Share link to let others join</option>
            </select>
          </div>
          <div class="preview-box">
            <div class="preview-label">Preview</div>
            <div class="preview-value" id="betPreview">Your bet preview will appear here...</div>
            <div class="preview-cost">
              <span class="preview-label">Fee</span>
              <span class="preview-value" id="betCost">10 pts + 24 pts = 34 pts</span>
            </div>
          </div>
          <div id="shareLinkBox" class="share-link-box" style="display: none;">
            <input type="text" id="shareLink" readonly>
            <button class="btn btn-secondary" id="copyLinkBtn">Copy</button>
          </div>
          <div class="bet-actions" style="margin-top: 0;">
            <button class="btn btn-secondary" id="saveDraftBtn" style="display: none;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Save Draft
            </button>
            <button class="btn btn-primary" id="publishBtn">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Publish
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function attachBetModalListeners() {
  const modal = document.getElementById('betModal');
  if (!modal) return;
  
  document.getElementById('closeBetModal').onclick = closeBetModal;
  
  modal.onclick = (e) => {
    if (e.target === modal) closeBetModal();
  };
  
  const titleInput = document.getElementById('betTitle');
  const durationInput = document.getElementById('betDuration');
  
  titleInput.oninput = updatePreview;
  durationInput.oninput = updatePreview;
  
  document.getElementById('saveDraftBtn').onclick = async () => {
    await saveDraft();
  };
  
  document.getElementById('publishBtn').onclick = async () => {
    await publish();
  };
  
  document.getElementById('copyLinkBtn').onclick = () => {
    const input = document.getElementById('shareLink');
    navigator.clipboard.writeText(input.value);
    document.getElementById('copyLinkBtn').textContent = 'Copied!';
    setTimeout(() => {
      document.getElementById('copyLinkBtn').textContent = 'Copy';
    }, 2000);
  };
}

async function saveDraft() {
  const { user } = getState();
  if (!user) return;
  
  const title = document.getElementById('betTitle').value.trim();
  const description = document.getElementById('betDesc').value.trim();
  const duration = parseInt(document.getElementById('betDuration').value) || 24;
  const stake = parseInt(document.getElementById('betStake').value) || 0;
  const visibility = document.getElementById('betVisibility').value;
  
  if (!title) {
    alert('Please enter a title');
    return;
  }
  
  try {
    const { createBet } = await import('../services/bets.js');
    
    if (currentBetId) {
      await updateBetData(currentBetId, title, description, duration, stake, visibility);
    } else {
      await createBet({ title, description, duration, stake, visibility }, user.id, false);
    }
    
    closeBetModal();
    if (onSuccessCallback) onSuccessCallback();
  } catch (error) {
    alert(error.message || 'Failed to save draft');
  }
}

async function updateBetData(betId, title, description, duration, stake, visibility) {
  const { updateBet } = await import('../services/bets.js');
  await updateBet(betId, { title, description, duration, stake, visibility });
}

async function publish() {
  const { user } = getState();
  if (!user) return;
  
  const title = document.getElementById('betTitle').value.trim();
  const description = document.getElementById('betDesc').value.trim();
  const duration = parseInt(document.getElementById('betDuration').value) || 24;
  const stake = parseInt(document.getElementById('betStake').value) || 0;
  const visibility = document.getElementById('betVisibility').value;
  
  if (!title) {
    alert('Please enter a title');
    return;
  }
  
  try {
    const { createBet } = await import('../services/bets.js');
    
    let result;
    if (currentBetId) {
      const { publishBet } = await import('../services/bets.js');
      await publishBet(currentBetId);
      result = { id: currentBetId };
    } else {
      result = await createBet({ title, description, duration, stake, visibility }, user.id, true);
    }
    
    if (visibility === 'private') {
      const shareLink = `${window.location.origin}${window.location.pathname}#/bet/${result.id}`;
      document.getElementById('shareLinkBox').style.display = 'flex';
      document.getElementById('shareLink').value = shareLink;
      return;
    }
    
    closeBetModal();
    if (onSuccessCallback) onSuccessCallback();
  } catch (error) {
    alert(error.message || 'Failed to publish bet');
  }
}
