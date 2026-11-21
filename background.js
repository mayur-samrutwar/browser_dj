importScripts('mix.js');

const opening = new Set();

async function openMixer(tab) {
  const { windowId, index } = tab;
  if (opening.has(windowId)) return;
  opening.add(windowId);
  try {
    const tabs = await chrome.tabs.query({ windowId });
    const mixer = tabs.find(candidate =>
      (candidate.pendingUrl ?? candidate.url) === TwinMix.workspaceUrl
    );
    if (mixer) {
      await chrome.tabs.update(mixer.id, { active: true });
    } else {
      await chrome.tabs.create({
        windowId,
        index: index + 1,
        url: TwinMix.workspaceUrl,
        active: true
      });
    }
  } finally {
    opening.delete(windowId);
  }
}

chrome.action.onClicked.addListener(tab => {
  openMixer(tab).catch(error => console.error('Could not open Browser DJ:', error));
});
