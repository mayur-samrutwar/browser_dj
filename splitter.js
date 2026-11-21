function setupMixerResize(app) {
  const handle = app.querySelector('.dj-resize');
  const beatmatch = app.querySelector('.beatmatch-tools');
  const preferenceKey = 'mixerHeightRatio';
  const defaultRatio = 0.25;
  let ratio = defaultRatio;
  let changed = false;
  let viewport;
  let minimum;
  let maximum;
  let height;
  let drag = null;

  function setHeight(requested) {
    const next = Math.round(Math.max(minimum, Math.min(maximum, requested)));
    if (height === next) return;
    height = next;
    app.style.setProperty('--mixer-height', height + 'px');
    handle.setAttribute('aria-valuenow', height);
    handle.setAttribute('aria-valuetext', height + ' pixels tall');
  }

  function layout() {
    const dimensions = getComputedStyle(app);
    viewport = window.innerHeight;
    minimum = parseFloat(dimensions.getPropertyValue('--min-mixer-height')) + beatmatch.offsetHeight;
    const videoMinimum = parseFloat(dimensions.getPropertyValue('--min-video-height'));
    const handleHeight = handle.offsetHeight;
    maximum = Math.max(minimum, Math.min(
      Math.floor(viewport * 0.66),
      viewport - videoMinimum - handleHeight
    ));
    handle.setAttribute('aria-valuemin', minimum);
    handle.setAttribute('aria-valuemax', maximum);
    handle.setAttribute('aria-disabled', minimum === maximum);
    setHeight(drag ? height : ratio * viewport);
  }

  async function save(nextRatio) {
    changed = true;
    ratio = nextRatio;
    try {
      await chrome.storage.local.set({ [preferenceKey]: ratio });
    } catch {
      // Resizing still works if the extension is reloaded while the page is open.
    }
  }

  handle.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || minimum === maximum) return;
    drag = { pointer: event.pointerId, y: event.clientY, height };
    handle.setPointerCapture(event.pointerId);
    handle.focus({ preventScroll: true });
    app.classList.add('is-resizing');
  });

  handle.addEventListener('pointermove', event => {
    if (drag?.pointer !== event.pointerId) return;
    setHeight(drag.height + drag.y - event.clientY);
  });

  function endDrag(event) {
    if (drag?.pointer !== event.pointerId) return;
    if (height !== drag.height) save(height / viewport);
    drag = null;
    app.classList.remove('is-resizing');
  }

  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    handle.addEventListener(event, endDrag);
  }

  handle.addEventListener('keydown', event => {
    if (minimum === maximum) return;
    const step = event.shiftKey ? 64 : 16;
    switch (event.key) {
      case 'ArrowUp': setHeight(height + step); break;
      case 'ArrowDown': setHeight(height - step); break;
      case 'Home': setHeight(minimum); break;
      case 'End': setHeight(maximum); break;
      default: return;
    }
    event.preventDefault();
    save(height / viewport);
  });

  handle.addEventListener('dblclick', () => {
    setHeight(defaultRatio * viewport);
    save(defaultRatio);
  });

  window.addEventListener('resize', layout);
  new ResizeObserver(layout).observe(beatmatch); // Opening the drawer raises the minimum height.
  layout();

  chrome.storage.local.get(preferenceKey).then(settings => {
    const saved = settings[preferenceKey];
    if (changed || drag || !Number.isFinite(saved) || saved <= 0 || saved > 0.66) return;
    ratio = saved;
    setHeight(ratio * viewport);
  }).catch(() => {});
}
