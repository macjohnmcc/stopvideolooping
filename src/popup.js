const STORAGE_KEY = 'enabled';
const INSTAGRAM = 'instagram.com';

const toggle = document.getElementById('toggle');
const stats = document.getElementById('stats');
const reload = document.getElementById('reload');

let instagramTabId = null;

toggle.addEventListener('change', async () => {
  await chrome.storage.local.set({ [STORAGE_KEY]: toggle.checked });
  await refresh();
});

reload.addEventListener('click', () => {
  if (instagramTabId !== null) chrome.tabs.reload(instagramTabId);
});

refresh();

async function refresh() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  toggle.checked = stored[STORAGE_KEY] !== false;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  instagramTabId = tab?.url?.includes(INSTAGRAM) ? tab.id : null;
  reload.hidden = instagramTabId === null;

  if (instagramTabId === null) {
    stats.textContent = '';
    return;
  }

  try {
    const report = await chrome.tabs.sendMessage(instagramTabId, {
      type: 'stop-looping:stats',
    });
    const replays = report.replaysBlocked;
    stats.textContent = `${replays} ${replays === 1 ? 'replay' : 'replays'} stopped here.`;
  } catch {
    stats.textContent = toggle.checked ? 'Reload the page to start.' : '';
  }
}