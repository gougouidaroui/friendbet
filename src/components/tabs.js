import { getState, setCurrentTab } from '../lib/store.js';

export function renderTabs() {
  const { currentTab } = getState();
  
  return `
    <div class="nav-tabs">
      <button class="nav-tab ${currentTab === 'feed' ? 'active' : ''}" data-tab="feed">Feed</button>
      <button class="nav-tab ${currentTab === 'mybets' ? 'active' : ''}" data-tab="mybets">My Bets</button>
      <button class="nav-tab ${currentTab === 'drafts' ? 'active' : ''}" data-tab="drafts">Drafts</button>
    </div>
    <div id="feed" class="tab-content ${currentTab === 'feed' ? 'active' : ''}">
      <div id="feedContent"></div>
    </div>
    <div id="mybets" class="tab-content ${currentTab === 'mybets' ? 'active' : ''}">
      <div id="mybetsContent"></div>
    </div>
    <div id="drafts" class="tab-content ${currentTab === 'drafts' ? 'active' : ''}">
      <div id="draftsContent"></div>
    </div>
  `;
}

export function attachTabsListeners(app, onTabChange) {
  app.querySelectorAll('.nav-tab').forEach(tab => {
    tab.onclick = () => {
      const tabId = tab.dataset.tab;
      setCurrentTab(tabId);
      
      app.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      app.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      app.querySelector(`#${tabId}`).classList.add('active');
      
      if (onTabChange) onTabChange(tabId);
    };
  });
}
