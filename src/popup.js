const STORAGE_KEY = 'enabled';
const CONTROLS_KEY = 'controls';
const SUPPORTED = ['instagram.com', 'threads.com', 'youtube.com'];

const toggle = document.getElementById('toggle');
const showControls = document.getElementById('native-controls');
const stats = document.getElementById('stats');
const reload = document.getElementById('reload');

let supportedTabId = null;

toggle.addEventListener('change', async () => {
  await chrome.storage.local.set({ [STORAGE_KEY]: toggle.checked });
  await refresh();
});

showControls.addEventListener('change', async () => {
  await chrome.storage.local.set({ [CONTROLS_KEY]: showControls.checked });
  await refresh();
});

reload.addEventListener('click', () => {
  if (supportedTabId !== null) chrome.tabs.reload(supportedTabId);
});

refresh();

async function refresh() {
  const stored = await chrome.storage.local.get([STORAGE_KEY, CONTROLS_KEY]);
  toggle.checked = stored[STORAGE_KEY] !== false;
  showControls.checked = stored[CONTROLS_KEY] !== false;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  supportedTabId = SUPPORTED.some((host) => tab?.url?.includes(host)) ? tab.id : null;
  reload.hidden = supportedTabId === null;

  if (supportedTabId === null) {
    stats.textContent = '';
    return;
  }

  try {
    const report = await chrome.tabs.sendMessage(supportedTabId, {
      type: 'stop-looping:stats',
    });
    const replays = report.replaysBlocked;
    if (!report.active && report.host.includes('youtube.com')) {
      stats.textContent = 'YouTube is only handled on Shorts pages.';
    } else if (report.active) {
      stats.textContent = `${replays} ${replays === 1 ? 'replay' : 'replays'} stopped here.`;
    } else {
      stats.textContent = toggle.checked ? 'Reload the page to start.' : '';
    }
  } catch {
    stats.textContent = toggle.checked ? 'Reload the page to start.' : '';
  }
}