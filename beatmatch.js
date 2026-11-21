function setupBeatmatch(app, decks) {
  const toggle = app.querySelector('.beatmatch-toggle');
  const panel = app.querySelector('.beatmatch-tools');
  panel.innerHTML = `
    <p class="beat-instructions">Enter the BPM or tap at least four steady beats. With both decks playing, Sync also lines up the beats you marked or tapped.</p>
    <div class="beat-decks"></div>`;
  const row = panel.querySelector('.beat-decks');
  const channels = decks.map(makeChannel);
  let alignment = null;

  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) refresh();
  });

  function makeChannel(deck, index) {
    const id = index === 0 ? 'A' : 'B';
    const otherId = index === 0 ? 'B' : 'A';
    const section = document.createElement('section');
    section.className = 'beat-deck deck-' + id.toLowerCase();
    section.setAttribute('aria-label', 'Beatmatch deck ' + id);
    section.innerHTML = `
      <div class="beat-keys">
        <span class="beat-id" aria-hidden="true">${id}</span>
        <label>Track BPM
          <input type="number" min="${BeatMath.minBpm}" max="${BeatMath.maxBpm}" step="0.1"
            aria-label="Deck ${id} track BPM" placeholder="BPM" inputmode="decimal">
        </label>
        <button type="button" data-beat="tap" aria-label="Tap beat on deck ${id}">Tap</button>
        <button type="button" data-beat="mark" title="Click on a clear beat">Mark beat</button>
        <button type="button" class="beat-sync" data-beat="sync">Sync to ${otherId}</button>
        <div class="beat-nudge" aria-label="Nudge deck ${id} timing">
          <button type="button" data-beat="back" aria-label="Nudge deck ${id} back 30 milliseconds">−30 ms</button>
          <button type="button" data-beat="ahead" aria-label="Nudge deck ${id} ahead 30 milliseconds">+30 ms</button>
        </div>
      </div>
      <p class="beat-status"></p>
      <p class="beat-feedback" role="status" hidden></p>`;
    row.append(section);
    const channel = {
      deck, id, section,
      input: section.querySelector('input'),
      status: section.querySelector('.beat-status'),
      feedback: section.querySelector('.beat-feedback'),
      buttons: [...section.querySelectorAll('[data-beat]')],
      trackId: null, bpm: null, anchor: null, source: '', taps: [], lastTap: 0
    };

    channel.input.addEventListener('input', () => {
      if (alignment) finishAlignment('');
      const value = channel.input.valueAsNumber;
      channel.bpm = BeatMath.validBpm(value) ? value : null;
      channel.source = 'manual';
      channel.taps = [];
      notice(channel, channel.input.value && !channel.bpm ? 'Enter a BPM between 40 and 240.' : '');
      refresh();
    });
    section.addEventListener('click', event => {
      const button = event.target.closest('button[data-beat]');
      if (button) act(index, button.dataset.beat);
    });
    return channel;
  }

  function text(element, value) {
    if (element.textContent !== value) element.textContent = value;
  }

  function notice(channel, message) {
    text(channel.feedback, message);
    channel.feedback.hidden = !message;
  }

  function track(channel, state) {
    const id = state.trackId ?? null;
    if (channel.trackId !== id) {
      Object.assign(channel, { trackId: id, bpm: null, anchor: null, source: '', taps: [], lastTap: 0 });
      channel.input.value = '';
      notice(channel, '');
    }
    if (id && !channel.source) {
      const bpm = BeatMath.suggestBpm(state.title);
      if (bpm) {
        channel.bpm = bpm;
        channel.source = 'suggested';
        channel.input.value = bpm;
      }
    }
  }

  function refresh() {
    if (panel.hidden) return;
    const states = channels.map(channel => channel.deck.state());
    for (const [index, channel] of channels.entries()) track(channel, states[index]);
    for (const [index, channel] of channels.entries()) {
      const state = states[index];
      const other = channels[1 - index];
      const reference = states[1 - index];
      const available = state.status === 'ready' && !state.adPlaying;
      channel.input.disabled = !available;
      for (const button of channel.buttons) {
        const action = button.dataset.beat;
        button.disabled = !available ||
          (action === 'sync' && (!channel.bpm || !other.bpm || reference.adPlaying)) ||
          (['mark', 'back', 'ahead'].includes(action) && !state.duration);
      }
      const details = [];
      if (!available) details.push(state.adPlaying ? 'Available after the ad' : 'Load a video to begin');
      else if (channel.bpm) details.push((channel.bpm * state.rate).toFixed(1) + ' BPM at current speed');
      else details.push('Enter or tap a BPM');
      if (available && channel.anchor !== null) details.push('Beat marked');
      if (available && channel.source === 'suggested') details.push('BPM suggested from title');
      text(channel.status, details.join(' · '));
    }
  }

  function tap(channel, state) {
    if (!state.playing || !state.stable) return 'Play this deck to tap along with its beat.';
    const now = performance.now();
    const previous = channel.taps.at(-1);
    const gap = previous === undefined ? 0 : state.time - previous;
    if (now - channel.lastTap > 3500 || gap < 0 || gap > 3) {
      channel.taps = [];
    }
    channel.lastTap = now;
    channel.taps.push(state.time);
    if (channel.taps.length > 8) channel.taps.shift();

    const fixedBpm = channel.source === 'tapped' ? null : channel.bpm;
    const grid = BeatMath.gridFromTaps(channel.taps, fixedBpm);
    if (!grid) {
      return channel.taps.length < 4
        ? 'Tapped ' + channel.taps.length + ' of 4. Keep tapping the beat.'
        : 'Tap steady beats. Count 1, 2, 3, 4 and tap on each number.';
    }
    channel.anchor = grid.anchor;
    if (!fixedBpm) channel.source = 'tapped';
    channel.bpm = grid.bpm;
    channel.input.value = grid.bpm;
    return 'Beat timing saved.';
  }

  function finishAlignment(message) {
    if (!alignment) return;
    const { channel, timer } = alignment;
    alignment = null;
    clearTimeout(timer);
    channel.deck.player.setPhaseRate(null);
    notice(channel, message);
  }

  function alignWhilePlaying(channel, other, state, reference, targetTime, rate, result) {
    // Follow this particular pair of beats until the adjustment settles.
    const job = { channel, timer: null };
    const conversion = other.bpm / channel.bpm;
    const stopAt = performance.now() + 7000;
    alignment = job;

    function adjust() {
      if (alignment !== job) return;
      const source = other.deck.player.read();
      const target = channel.deck.player.read();
      if (source.trackId !== reference.trackId || target.trackId !== state.trackId ||
          !source.playing || !target.playing || source.adPlaying || target.adPlaying ||
          source.rate !== reference.rate || channel.deck.player.speed !== rate) {
        finishAlignment('Playback changed. Sync again when both decks are playing.');
        return;
      }

      if (source.stable && target.stable) {
        const desired = targetTime + (source.time - reference.time) * conversion;
        const gap = desired - target.time;
        if (Math.abs(gap) < 0.018) {
          finishAlignment(result + ' Beats aligned.');
          return;
        }
        const correction = BeatMath.correctionRate(rate, gap);
        if (correction === rate || Math.abs(gap) > 0.75 * 60 / channel.bpm) {
          finishAlignment(result + ' Try nudging the timing.');
          return;
        }
        channel.deck.player.setPhaseRate(correction);
      } else {
        channel.deck.player.setPhaseRate(null);
      }

      if (performance.now() >= stopAt) {
        finishAlignment(result + ' Try Sync again or nudge the timing.');
      } else {
        job.timer = setTimeout(adjust, 35);
      }
    }

    job.timer = setTimeout(adjust, 0);
  }

  async function sync(channel, state, other, reference) {
    if (!other.bpm || !channel.bpm || reference.status !== 'ready' || reference.adPlaying) {
      return 'Load both decks and enter or tap their BPMs.';
    }
    const rate = BeatMath.matchingRate(other.bpm, reference.rate, channel.bpm);
    if (rate === null) return 'These tempos are outside the speed range. Check both BPMs.';

    const marked = channel.anchor !== null && other.anchor !== null;
    const canAlign = marked && state.playing && reference.playing && state.stable && reference.stable && state.duration > 0;
    const time = canAlign ? BeatMath.alignedTime(
      reference.time, other.anchor, other.bpm, state.time, channel.anchor, channel.bpm, state.duration
    ) : null;
    const error = await channel.deck.player.control('rate', rate);
    if (error) return error;

    const result = 'Matched deck ' + other.id + ' at ' + (other.bpm * reference.rate).toFixed(1) + ' BPM.';
    if (time !== null) {
      if (Math.abs(time - state.time) < 0.018) return result + ' Beats aligned.';
      alignWhilePlaying(channel, other, state, reference, time, rate, result);
      return result + ' Aligning beats…';
    }
    if (!marked) return result + ' Mark a beat on each deck to align their timing.';
    return result + ' Let both decks play, then Sync again to align their beats.';
  }

  async function act(index, action) {
    const channel = channels[index];
    try {
      if (alignment) finishAlignment('');
      const state = channel.deck.player.read();
      track(channel, state);
      if (state.status !== 'ready' || state.adPlaying) return;
      let message = '';
      switch (action) {
        case 'tap':
          message = tap(channel, state);
          break;
        case 'mark':
          if (state.playing && !state.stable) {
            message = 'Wait for playback to settle, then mark a beat.';
          } else {
            channel.anchor = state.time;
            channel.taps = [];
            message = 'Beat marked.';
          }
          break;
        case 'sync': {
          const other = channels[1 - index];
          const reference = other.deck.player.read();
          track(other, reference);
          message = await sync(channel, state, other, reference);
          break;
        }
        case 'back':
        case 'ahead':
          message = await channel.deck.player.control('seek', state.rate * (action === 'ahead' ? 0.03 : -0.03));
          break;
      }
      notice(channel, message);
    } catch {
      notice(channel, 'That control is unavailable for this video.');
    }
    channel.deck.render();
    refresh();
  }

  return { refresh };
}
