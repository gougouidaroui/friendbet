import { getState } from '../lib/store.js';
import {
  proposeResolution,
  challengeResolution,
  startCourtVoting,
  submitVoteCommit,
  submitVoteReveal,
  resolveCourt,
  getResolutionInfo,
  getCourtParticipants,
  generateVoteCommitHash
} from '../services/court.js';
import { loadProfile } from '../services/auth.js';
import { updateUser } from '../lib/store.js';

let currentBetId = null;
let onSuccessCallback = null;
let currentResolution = null;
let secretSalt = null;

export async function openCourtModal(betId, callback = null) {
  currentBetId = betId;
  onSuccessCallback = callback;

  if (!secretSalt) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    secretSalt = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const modal = document.getElementById('courtModal');
  if (modal) {
    modal.classList.add('active');
    await loadCourtState();
  }
}

export function closeCourtModal() {
  const modal = document.getElementById('courtModal');
  if (modal) {
    modal.classList.remove('active');
  }
  currentBetId = null;
  onSuccessCallback = null;
  currentResolution = null;
}

async function loadCourtState() {
  if (!currentBetId) return;

  const container = document.getElementById('courtContent');
  if (!container) return;

  container.innerHTML = '<div class="loader"></div>';

  try {
    const resolution = await getResolutionInfo(currentBetId);
    currentResolution = resolution;

    if (!resolution || !resolution.resolution_id) {
      renderProposePhase(container);
    } else {
      switch (resolution.status) {
        case 'proposed':
          renderChallengePhase(container);
          break;
        case 'challenged':
          renderStartVotingPhase(container);
          break;
        case 'voting':
          await renderVotingPhase(container);
          break;
        case 'completed':
          renderCompletedPhase(container);
          break;
        default:
          renderProposePhase(container);
      }
    }
  } catch (error) {
    container.innerHTML = `<div class="error">Failed to load court: ${error.message}</div>`;
  }
}

function renderProposePhase(container) {
  const { profile } = getState();

  container.innerHTML = `
    <div class="court-phase">
      <div class="court-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4"/>
          <path d="M12 16h.01"/>
        </svg>
      </div>
      <h3>Resolution Phase</h3>
      <p class="court-description">
        This bet has expired. Propose an outcome to begin resolution.
        A <strong>25 point fee</strong> will be charged (refunded if the court agrees with you).
      </p>
      <div class="court-actions">
        <button class="btn btn-for btn-block" id="proposeForBtn" ${profile.points < 25 ? 'disabled' : ''}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Propose "For" Wins
        </button>
        <button class="btn btn-against btn-block" id="proposeAgainstBtn" ${profile.points < 25 ? 'disabled' : ''}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Propose "Against" Wins
        </button>
      </div>
      <p class="court-note">If no one proposes within 24 hours, all wagers will be refunded.</p>
    </div>
  `;

  document.getElementById('proposeForBtn').onclick = async () => {
    await handlePropose('for');
  };

  document.getElementById('proposeAgainstBtn').onclick = async () => {
    await handlePropose('against');
  };
}

async function handlePropose(outcome) {
  const submitBtn = outcome === 'for'
    ? document.getElementById('proposeForBtn')
    : document.getElementById('proposeAgainstBtn');

  submitBtn.disabled = true;
  submitBtn.innerHTML = `
    <svg class="spinner-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
    Proposing...
  `;

  try {
    await proposeResolution(currentBetId, outcome);
    await loadCourtState();
  } catch (error) {
    alert(error.message || 'Failed to propose outcome');
    submitBtn.disabled = false;
    submitBtn.innerHTML = outcome === 'for'
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Propose "For" Wins'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Propose "Against" Wins';
  }
}

function renderChallengePhase(container) {
  const { user } = getState();
  const isProposer = currentResolution.proposed_by === user.id;

  container.innerHTML = `
    <div class="court-phase">
      <div class="court-icon ${isProposer ? 'proposer' : 'challenger'}">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <h3>Challenge Phase</h3>
      <p class="court-description">
        ${isProposer
          ? `You proposed that <strong>"${currentResolution.proposed_outcome}"</strong> wins. Waiting for others to accept or challenge.`
          : `<strong>${currentResolution.proposed_by_username}</strong> proposes that <strong>"${currentResolution.proposed_outcome}"</strong> wins. Do you agree?`
        }
      </p>
      <div class="court-actions">
        ${!isProposer ? `
          <button class="btn btn-for btn-block" id="acceptProposalBtn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            I Agree - Accept
          </button>
          <button class="btn btn-against btn-block" id="challengeBtn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            I Disagree - Challenge
          </button>
        ` : `
          <div class="court-waiting">
            <svg class="spinner-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
            <p>Waiting for other participants to respond...</p>
          </div>
        `}
      </div>
    </div>
  `;

  const acceptBtn = document.getElementById('acceptProposalBtn');
  if (acceptBtn) {
    acceptBtn.onclick = async () => {
      closeCourtModal();
      if (onSuccessCallback) onSuccessCallback();
    };
  }

  const challengeBtn = document.getElementById('challengeBtn');
  if (challengeBtn) {
    challengeBtn.onclick = async () => {
      challengeBtn.disabled = true;
      challengeBtn.innerHTML = `
        <svg class="spinner-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
        Challenging...
      `;

      try {
        await challengeResolution(currentBetId);
        await loadCourtState();
      } catch (error) {
        alert(error.message || 'Failed to challenge');
        challengeBtn.disabled = false;
        challengeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> I Disagree - Challenge';
      }
    };
  }
}

function renderStartVotingPhase(container) {
  const { user } = getState();
  const isCreatorOrChallenger =
    currentResolution.challenged_by === user.id ||
    (getState().profile && true);

  container.innerHTML = `
    <div class="court-phase">
      <div class="court-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
      </div>
      <h3>Court Activated</h3>
      <p class="court-description">
        The proposal has been challenged. A vote among all participants will decide the outcome.
        Each voter must stake <strong>100 points</strong>. Wrong votes are forfeited.
      </p>
      <div class="court-actions">
        <button class="btn btn-primary btn-block" id="startVotingBtn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Open Voting
        </button>
      </div>
    </div>
  `;

  document.getElementById('startVotingBtn').onclick = async () => {
    const btn = document.getElementById('startVotingBtn');
    btn.disabled = true;
    btn.innerHTML = `
      <svg class="spinner-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
      Opening...
    `;

    try {
      await startCourtVoting(currentBetId);
      await loadCourtState();
    } catch (error) {
      alert(error.message || 'Failed to start voting');
      btn.disabled = false;
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Open Voting';
    }
  };
}

async function renderVotingPhase(container) {
  const { user, profile } = getState();
  const participants = await getCourtParticipants(currentBetId);

  const userParticipant = participants.find(p => p.user_id === user.id);
  const hasCommitted = userParticipant?.has_committed;
  const hasRevealed = userParticipant?.has_revealed;

  const totalParticipants = participants.length;
  const committedCount = participants.filter(p => p.has_committed).length;
  const revealedCount = participants.filter(p => p.has_revealed).length;

  if (!hasCommitted) {
    renderVoteCommit(container, profile);
  } else if (!hasRevealed) {
    renderVoteReveal(container);
  } else {
    renderVotingWaiting(container, participants, committedCount, revealedCount, totalParticipants);
  }
}

function renderVoteCommit(container, profile) {
  container.innerHTML = `
    <div class="court-phase">
      <div class="court-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <h3>Cast Your Secret Vote</h3>
      <p class="court-description">
        Vote on the outcome. Your vote is <strong>secret</strong> — no one can see how you voted until everyone reveals.
        You must stake <strong>100 points</strong>. If you're on the losing side, you forfeit your stake.
      </p>
      <div class="court-actions">
        <button class="btn btn-for btn-block" id="voteForBtn" ${profile.points < 100 ? 'disabled' : ''}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Vote "For" (Stake 100 pts)
        </button>
        <button class="btn btn-against btn-block" id="voteAgainstBtn" ${profile.points < 100 ? 'disabled' : ''}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Vote "Against" (Stake 100 pts)
        </button>
      </div>
      <p class="court-note">Your vote is encrypted and hidden until all participants reveal.</p>
    </div>
  `;

  document.getElementById('voteForBtn').onclick = async () => {
    await handleVoteCommit('for');
  };

  document.getElementById('voteAgainstBtn').onclick = async () => {
    await handleVoteCommit('against');
  };
}

async function handleVoteCommit(voteSide) {
  const { user } = getState();
  const submitBtn = voteSide === 'for'
    ? document.getElementById('voteForBtn')
    : document.getElementById('voteAgainstBtn');

  submitBtn.disabled = true;
  submitBtn.innerHTML = `
    <svg class="spinner-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
    Committing...
  `;

  try {
    const commitHash = await generateVoteCommitHash(voteSide, user.id, secretSalt);
    await submitVoteCommit(currentResolution.resolution_id, commitHash);

    await loadCourtState();
  } catch (error) {
    alert(error.message || 'Failed to commit vote');
    submitBtn.disabled = false;
    submitBtn.innerHTML = voteSide === 'for'
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Vote "For" (Stake 100 pts)'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Vote "Against" (Stake 100 pts)';
  }
}

function renderVoteReveal(container) {
  container.innerHTML = `
    <div class="court-phase">
      <div class="court-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <h3>Reveal Your Vote</h3>
      <p class="court-description">
        You've committed your vote. Now reveal it to the court.
        <strong>You must reveal the same side you committed to.</strong>
      </p>
      <div class="court-actions">
        <button class="btn btn-for btn-block" id="revealForBtn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Reveal "For"
        </button>
        <button class="btn btn-against btn-block" id="revealAgainstBtn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Reveal "Against"
        </button>
      </div>
    </div>
  `;

  document.getElementById('revealForBtn').onclick = async () => {
    await handleVoteReveal('for');
  };

  document.getElementById('revealAgainstBtn').onclick = async () => {
    await handleVoteReveal('against');
  };
}

async function handleVoteReveal(voteSide) {
  const submitBtn = voteSide === 'for'
    ? document.getElementById('revealForBtn')
    : document.getElementById('revealAgainstBtn');

  submitBtn.disabled = true;
  submitBtn.innerHTML = `
    <svg class="spinner-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
    Revealing...
  `;

  try {
    await submitVoteReveal(currentResolution.resolution_id, voteSide);

    const { user } = getState();
    const newProfile = await loadProfile(user);
    updateUser(user, newProfile);

    await loadCourtState();
  } catch (error) {
    alert(error.message || 'Failed to reveal vote');
    submitBtn.disabled = false;
    submitBtn.innerHTML = voteSide === 'for'
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Reveal "For"'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Reveal "Against"';
  }
}

function renderVotingWaiting(container, participants, committedCount, revealedCount, totalParticipants) {
  const allRevealed = revealedCount === totalParticipants && totalParticipants > 0;

  container.innerHTML = `
    <div class="court-phase">
      <div class="court-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <h3>Waiting for Votes</h3>
      <p class="court-description">
        ${allRevealed
          ? 'All votes have been cast and revealed. Ready to resolve the court.'
          : 'Your vote has been cast. Waiting for other participants to vote.'
        }
      </p>
      <div class="court-progress">
        <div class="progress-item">
          <span class="progress-label">Committed</span>
          <span class="progress-value">${committedCount} / ${totalParticipants}</span>
        </div>
        <div class="progress-item">
          <span class="progress-label">Revealed</span>
          <span class="progress-value">${revealedCount} / ${totalParticipants}</span>
        </div>
      </div>
      <div class="court-participants">
        ${participants.map(p => `
          <div class="participant ${p.has_committed ? 'committed' : ''} ${p.has_revealed ? 'revealed' : ''}">
            <span class="participant-name">${escapeHtml(p.username)}</span>
            <span class="participant-status">
              ${p.has_revealed ? 'Voted' : p.has_committed ? 'Committed' : 'Pending'}
            </span>
          </div>
        `).join('')}
      </div>
      ${allRevealed ? `
        <div class="court-actions" style="margin-top: var(--spacing-4);">
          <button class="btn btn-primary btn-block" id="resolveCourtBtn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Resolve Court
          </button>
        </div>
      ` : ''}
    </div>
  `;

  const resolveBtn = document.getElementById('resolveCourtBtn');
  if (resolveBtn) {
    resolveBtn.onclick = async () => {
      resolveBtn.disabled = true;
      resolveBtn.innerHTML = `
        <svg class="spinner-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
        Resolving...
      `;

      try {
        const { resolveCourt } = await import('../services/court.js');
        await resolveCourt(currentBetId);

        const { user } = getState();
        const newProfile = await loadProfile(user);
        updateUser(user, newProfile);

        await loadCourtState();
      } catch (error) {
        alert(error.message || 'Failed to resolve court');
        resolveBtn.disabled = false;
        resolveBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Resolve Court';
      }
    };
  }
}

function renderCompletedPhase(container) {
  const { user } = getState();
  const winner = currentResolution.court_winner;

  let resultText = '';
  let resultClass = '';

  if (winner === 'refund') {
    resultText = 'All wagers refunded — court was tied or no votes cast.';
    resultClass = 'refund';
  } else {
    resultText = `"${winner.charAt(0).toUpperCase() + winner.slice(1)}" wins the court!`;
    resultClass = winner === 'for' ? 'for-win' : 'against-win';
  }

  container.innerHTML = `
    <div class="court-phase">
      <div class="court-icon ${resultClass}">
        ${winner === 'refund'
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>'
          : '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>'
        }
      </div>
      <h3>Court Decision</h3>
      <p class="court-description">${resultText}</p>
      <div class="court-vote-summary">
        <div class="vote-count for">
          <span class="vote-label">For</span>
          <span class="vote-number">${currentResolution.for_votes || 0}</span>
        </div>
        <div class="vote-count against">
          <span class="vote-label">Against</span>
          <span class="vote-number">${currentResolution.against_votes || 0}</span>
        </div>
      </div>
      <div class="court-actions">
        <button class="btn btn-primary btn-block" id="closeCourtBtn">Close</button>
      </div>
    </div>
  `;

  document.getElementById('closeCourtBtn').onclick = () => {
    closeCourtModal();
    if (onSuccessCallback) onSuccessCallback();
  };
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function renderCourtModal() {
  return `
    <div class="modal-overlay" id="courtModal">
      <div class="modal-content court-modal-content">
        <div class="modal-header">
          <h2>Court Resolution</h2>
          <button class="close-btn" id="closeCourtModal" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div id="courtContent"></div>
      </div>
    </div>
  `;
}

export function attachCourtModalListeners() {
  const modal = document.getElementById('courtModal');
  if (!modal) return;

  document.getElementById('closeCourtModal').onclick = closeCourtModal;

  modal.onclick = (e) => {
    if (e.target === modal) closeCourtModal();
  };
}
