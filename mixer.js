(() => {
  if (location.href !== TwinMix.workspaceUrl) return;

  const app = document.createElement('main');
  app.id = 'browser-dj';
  app.setAttribute('aria-label', 'Browser DJ');
  app.innerHTML = `
    <div class="dj-panes"></div>
    <div class="dj-resize" role="separator" tabindex="0" aria-orientation="horizontal"
      aria-label="Mixer height" aria-controls="dj-console" title="Drag to resize. Double-click to reset."></div>
    <section class="dj-console" id="dj-console" aria-label="DJ mixer">
      <div class="dj-console-main">
        <div class="dj-blend">
          <div class="blend-heading">
            <h2>Crossfader</h2>
            <div class="blend-actions">
              <button type="button" class="beatmatch-toggle" aria-expanded="false" aria-controls="beatmatch-tools">Beatmatch</button>
              <button type="button" class="pause-all" title="Pause both decks (Space)">Pause both</button>
            </div>
          </div>
          <div class="blend-values" aria-hidden="true">
            <span class="blend-a">A <output class="mix-a">50%</output></span>
            <span class="blend-b"><output class="mix-b">50%</output> B</span>
          </div>
          <input type="range" class="cross" aria-label="Crossfader" min="0" max="100" value="50">
          <div class="cuts">
            <button type="button" data-cross="0">A only</button>
            <button type="button" data-cross="50">Center</button>
            <button type="button" data-cross="100">B only</button>
          </div>
          <label class="master">
            <span>Master</span>
            <input type="range" min="0" max="100" value="80">
            <output>80%</output>
          </label>
        </div>
      </div>
      <section id="beatmatch-tools" class="beatmatch-tools" aria-label="Beatmatch controls" hidden></section>
    </section>`;

  document.title = 'Browser DJ';
  document.body.classList.add('browser-dj');
  document.body.replaceChildren(app);

  const panes = app.querySelector('.dj-panes');
  const consolePanel = app.querySelector('.dj-console-main');
  const blend = app.querySelector('.dj-blend');
  const cross = blend.querySelector('.cross');
  const master = blend.querySelector('.master input');
  const presets = blend.querySelectorAll('[data-cross]');
  const decks = ['A', 'B'].map(makeDeck);
  const beatmatch = setupBeatmatch(app, decks);

  function makeDeck(id) {
    const pane = document.createElement('section');
    pane.className = 'dj-pane deck-' + id.toLowerCase();
    pane.setAttribute('aria-label', 'YouTube deck ' + id);
    pane.innerHTML = `
      <iframe title="YouTube deck ${id}" allowfullscreen></iframe>
      <div class="pane-message">
        <span class="loading-mark" aria-hidden="true"></span>
        <p>Opening YouTube…</p>
        <div class="recovery" hidden>
          <button type="button">Retry deck</button>
          <a href="https://www.youtube.com/" target="_blank" rel="noopener">Open YouTube</a>
        </div>
      </div>`;
    panes.append(pane);

    const channel = document.createElement('section');
    channel.className = 'dj-channel deck-' + id.toLowerCase();
    channel.setAttribute('aria-label', 'Deck ' + id + ' controls');
    channel.innerHTML = `
      <div class="channel-heading">
        <span class="channel-id">${id}</span>
        <div class="track-name">No video loaded</div>
        <span class="track-state"></span>
      </div>
      <div class="channel-body">
        <div class="platter-area">
          <button type="button" class="platter" aria-label="Play deck ${id}"
            title="Play or pause deck ${id} (${id === 'A' ? '1' : '2'})" data-action="toggle" disabled>
            <span class="platter-ring" aria-hidden="true"></span>
            <span class="platter-hub" aria-hidden="true"><i></i></span>
          </button>
        </div>
        <div class="channel-controls">
          <div class="timeline">
            <input type="range" class="seek" aria-label="Deck ${id} position" min="0" max="1000" value="0" disabled>
            <div class="clock"><span class="elapsed">0:00</span><span class="duration">0:00</span></div>
          </div>
          <div class="channel-row">
            <button type="button" data-action="seek" data-value="-5" aria-label="Rewind deck ${id} 5 seconds" disabled>−5s</button>
            <button type="button" data-action="seek" data-value="5" aria-label="Advance deck ${id} 5 seconds" disabled>+5s</button>
            <button type="button" data-action="setCue" title="Save the current position" disabled>Set cue</button>
            <button type="button" data-action="cue" title="Return to the saved position" disabled>Go cue</button>
          </div>
          <div class="channel-adjustments">
            <label class="channel-level">
              <span>Level</span>
              <input type="range" class="level" aria-label="Deck ${id} level" min="0" max="100" value="100">
              <output>100%</output>
            </label>
            <label class="channel-speed">
              <span>Speed</span>
              <input type="range" class="rate" aria-label="Deck ${id} speed" min="50" max="150" step="0.1" value="100" disabled>
              <output>1.000×</output>
            </label>
          </div>
          <div class="channel-row">
            <span class="loop-label">Loop</span>
            <button type="button" data-action="loopIn" title="Mark the start of a loop" disabled>In</button>
            <button type="button" data-action="loopOut" title="Mark the end and start looping" disabled>Out</button>
            <button type="button" data-action="clearLoop" disabled>Clear</button>
          </div>
        </div>
      </div>
      <p class="markers"></p>
      <p class="deck-notice" role="status" hidden></p>`;
    if (id === 'A') consolePanel.prepend(channel);
    else consolePanel.append(channel);

    const player = new TwinDeckPlayer(pane.querySelector('iframe'));
    const frameMessage = pane.querySelector('.pane-message');
    const frameText = frameMessage.querySelector('p');
    const recovery = pane.querySelector('.recovery');
    const level = channel.querySelector('.level');
    const rate = channel.querySelector('.rate');
    const seek = channel.querySelector('.seek');
    const elapsed = channel.querySelector('.elapsed');
    const duration = channel.querySelector('.duration');
    const play = channel.querySelector('.platter');
    const trackName = channel.querySelector('.track-name');
    const trackState = channel.querySelector('.track-state');
    const markers = channel.querySelector('.markers');
    const notice = channel.querySelector('.deck-notice');
    const buttons = channel.querySelectorAll('button[data-action]');
    let state;
    let scrubbing = false;

    function open(url) {
      player.open(url);
      scrubbing = false;
      message(notice, '');
      render();
    }

    recovery.querySelector('button').addEventListener('click', () => open(player.lastUrl));
    level.addEventListener('input', () => {
      updateDeckLevel();
      applyMix();
    });
    rate.addEventListener('input', () => control('rate', Number(rate.value) / 100));
    channel.addEventListener('click', event => {
      const button = event.target.closest('button[data-action]');
      if (button) control(button.dataset.action, Number(button.dataset.value));
    });
    seek.addEventListener('input', () => {
      scrubbing = true;
      paintRange(seek);
      setText(elapsed, formatTime(Number(seek.value) / 1000 * (state?.duration || 0)));
    });
    seek.addEventListener('change', () => {
      scrubbing = false;
      control('position', Number(seek.value) / 1000);
    });
    seek.addEventListener('blur', () => { scrubbing = false; });

    async function control(action, value) {
      try {
        message(notice, await player.control(action, value));
      } catch {
        message(notice, 'This control is unavailable for the current video.');
      }
      render();
    }

    function render() {
      state = player.read();
      const ready = state.status === 'ready';
      const seekable = ready && !state.adPlaying && state.duration > 0;
      const blocked = state.status === 'unavailable';
      const pending = state.status === 'loading';
      frameMessage.hidden = !blocked && !pending;
      recovery.hidden = !blocked;
      frameMessage.classList.toggle('is-unavailable', blocked);
      setText(frameText, blocked ? 'YouTube couldn’t open here. Retry, or open YouTube to finish signing in.' : 'Opening YouTube…');
      setText(trackState, statusText(state));
      trackState.classList.toggle('is-playing', Boolean(state.playing) && !state.adPlaying && !state.muted);
      setText(trackName, state.title || 'No video loaded');
      trackName.title = state.title || '';
      const playText = state.playing ? 'Pause' : 'Play';
      play.setAttribute('aria-label', playText + ' deck ' + id);
      play.classList.toggle('is-playing', Boolean(state.playing));
      seek.disabled = !seekable;
      rate.disabled = !ready || state.adPlaying;
      for (const button of buttons) {
        switch (button.dataset.action) {
          case 'toggle': button.disabled = !ready; break;
          case 'cue': button.disabled = !seekable || state.cue === null; break;
          case 'loopOut':
          case 'clearLoop': button.disabled = !seekable || state.loopStart === null; break;
          default: button.disabled = !seekable; break;
        }
      }
      if (!scrubbing) {
        seek.value = state.duration ? state.time / state.duration * 1000 : 0;
        paintRange(seek);
        setText(elapsed, formatTime(state.time));
      }
      setText(duration, formatTime(state.duration));
      rate.value = (state.rate || 1) * 100;
      paintRange(rate);
      setText(rate.nextElementSibling, (state.rate || 1).toFixed(3) + '×');
      const points = [];
      if (state.cue != null) points.push('Cue ' + formatTime(state.cue));
      if (state.loopStart != null) {
        points.push('Loop ' + formatTime(state.loopStart) + ' → ' + (state.loopEnd == null ? 'set Out' : formatTime(state.loopEnd)));
      }
      setText(markers, points.join('  ·  '));
    }

    function updateDeckLevel() {
      paintRange(level);
      setText(level.nextElementSibling, level.value + '%');
    }

    updateDeckLevel();
    open(TwinMix.youtube + '/');
    return { player, level, render, control, state: () => state };
  }

  function formatTime(seconds) {
    const whole = Math.max(0, Math.floor(seconds || 0));
    return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
  }

  function statusText(state) {
    switch (state.status) {
      case 'waiting': return 'Loading video…';
      case 'video-error': return 'Playback unavailable';
      case 'ready':
        if (state.adPlaying) return 'Ad playing';
        if (state.muted) return 'Muted in YouTube';
        return state.playing ? 'Playing' : 'Paused';
      default: return '';
    }
  }

  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  function paintRange(input) {
    const minimum = Number(input.min);
    const percent = (input.valueAsNumber - minimum) * 100 / (Number(input.max) - minimum);
    input.style.setProperty('--range-fill', percent + '%');
  }

  function message(element, text) {
    setText(element, text);
    element.hidden = !text;
  }

  function applyMix() {
    const position = Number(cross.value);
    const gains = TwinMix.gains(position / 100, Number(master.value) / 100,
      Number(decks[0].level.value) / 100, Number(decks[1].level.value) / 100);
    decks[0].player.setGain(gains.A);
    decks[1].player.setGain(gains.B);
    setText(blend.querySelector('.mix-a'), 100 - position + '%');
    setText(blend.querySelector('.mix-b'), position + '%');
    setText(master.nextElementSibling, master.value + '%');
    paintRange(master);
    cross.setAttribute('aria-valuetext', (100 - position) + '% deck A, ' + position + '% deck B');
    for (const preset of presets) {
      preset.setAttribute('aria-pressed', Number(preset.dataset.cross) === position);
    }
  }

  function pauseBoth() {
    for (const deck of decks) deck.control('pause');
  }

  cross.addEventListener('input', applyMix);
  master.addEventListener('input', applyMix);
  app.querySelector('.pause-all').addEventListener('click', pauseBoth);
  for (const button of presets) {
    button.addEventListener('click', () => {
      cross.value = button.dataset.cross;
      applyMix();
    });
  }

  document.addEventListener('keydown', event => {
    if (event.target.closest?.('input, button, a, textarea, select, [role="separator"]') ||
        event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === '1' || event.key === '2') {
      decks[Number(event.key) - 1].control('toggle');
    } else if (event.code === 'Space') {
      event.preventDefault();
      pauseBoth();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      cross.value = Math.max(0, Math.min(100, Number(cross.value) + (event.key === 'ArrowLeft' ? -5 : 5)));
      applyMix();
    }
  });

  setupMixerResize(app);
  applyMix();
  setInterval(() => {
    decks.forEach(deck => deck.render());
    beatmatch.refresh();
  }, 250);
})();
