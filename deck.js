class DeckPlayer {
  constructor(frame) {
    this.frame = frame;
    this.document = null;
    this.video = null;
    this.track = null;
    this.cue = null;
    this.loopStart = null;
    this.loopEnd = null;
    this.speed = null;
    this.phaseRate = null;
    this.gain = 0.4;
    this.navigation = null;
    this.lastUrl = null;
    this.checkLoop = this.checkLoop.bind(this);
  }

  open(url) {
    this.video?.pause();
    this.attachVideo(null);
    this.resetTrack();
    this.navigation = { from: this.frame.contentDocument, time: Date.now() };
    this.lastUrl = url;
    this.frame.src = url;
  }

  resetTrack() {
    this.track = null;
    this.cue = null;
    this.loopStart = null;
    this.loopEnd = null;
    this.speed = null;
    this.phaseRate = null;
  }

  attachVideo(video) {
    if (video === this.video) return;
    this.video?.removeEventListener('timeupdate', this.checkLoop);
    this.video?.removeEventListener('ended', this.checkLoop);
    this.video = video;
    video?.addEventListener('timeupdate', this.checkLoop);
    video?.addEventListener('ended', this.checkLoop);
  }

  isAdPlaying() {
    return Boolean(this.document?.querySelector('#movie_player.ad-showing, #movie_player.ad-interrupting'));
  }

  checkLoop() {
    const video = this.video;
    if (!video || video.seeking || this.loopEnd === null || this.isAdPlaying()) return;
    if (video.currentTime >= this.loopEnd) {
      const ended = video.ended;
      video.currentTime = this.loopStart;
      if (ended) video.play().catch(() => {});
    }
  }

  setGain(gain) {
    this.gain = gain;
    this.syncVolume();
  }

  setPhaseRate(rate) {
    this.phaseRate = rate;
    this.syncRate();
  }

  syncRate() {
    const rate = this.phaseRate ?? this.speed;
    if (this.video && rate !== null && this.video.playbackRate !== rate && !this.isAdPlaying()) {
      this.video.playbackRate = rate;
    }
  }

  syncVolume() {
    if (this.video && Math.abs(this.video.volume - this.gain) > 0.002) {
      this.video.volume = this.gain;
    }
  }

  read() {
    const doc = this.frame.contentDocument;
    const loading = !doc || doc.URL === 'about:blank' || doc.readyState === 'loading';
    if (this.navigation && (loading || doc === this.navigation.from)) {
      return { status: Date.now() - this.navigation.time < 16000 ? 'loading' : 'unavailable' };
    }
    if (loading) {
      this.attachVideo(null);
      return { status: doc?.readyState === 'loading' ? 'loading' : 'unavailable' };
    }
    this.navigation = null;

    const url = new URL(doc.URL);
    const track = url.pathname === '/watch' ? url.searchParams.get('v') : null;
    if (doc !== this.document || track !== this.track) {
      const resetSpeed = this.speed !== null && this.video && doc.contains(this.video);
      // The native mini player can keep a song going when the pane returns to browsing.
      if (!track && this.track) this.video?.pause();
      this.resetTrack();
      this.document = doc;
      this.track = track;
      if (resetSpeed && track) this.speed = 1;
    }

    this.attachVideo(track ? doc.querySelector('#movie_player video.html5-main-video') : null);
    const video = this.video;
    if (!video) return { status: track ? 'waiting' : 'browse' };
    if (video.error) return { status: 'video-error' };

    const adPlaying = this.isAdPlaying();
    this.syncVolume();
    this.syncRate();
    return {
      status: 'ready',
      trackId: track,
      stable: !video.seeking && video.readyState >= 3,
      title: doc.querySelector('ytd-watch-metadata h1')?.textContent.trim() ||
        doc.title.replace(/\s+- YouTube$/, ''),
      playing: !video.paused && !video.ended,
      muted: video.muted,
      time: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      rate: video.playbackRate,
      adPlaying,
      cue: this.cue,
      loopStart: this.loopStart,
      loopEnd: this.loopEnd
    };
  }

  async control(action, value) {
    const state = this.read();
    const video = this.video;
    if (action === 'pause') {
      video?.pause();
      return '';
    }
    if (state.status !== 'ready') return 'Choose a video in this deck first.';

    if (action === 'toggle') {
      if (state.playing) {
        video.pause();
      } else {
        try {
          await video.play();
        } catch (error) {
          if (error.name === 'NotAllowedError') return 'Press play inside this YouTube pane to start.';
          if (error.name !== 'AbortError') return 'YouTube couldn’t start playback. Try the video’s play button.';
        }
      }
      return '';
    }
    if (state.adPlaying) return 'This control is available after the ad.';
    if (action === 'rate') {
      video.playbackRate = value;
      this.speed = value;
      this.phaseRate = null;
      return '';
    }
    if (!state.duration) return 'This video is not ready to seek.';

    switch (action) {
      case 'seek':
        video.currentTime = Math.max(0, Math.min(state.duration, video.currentTime + value));
        break;
      case 'position':
        video.currentTime = value * state.duration;
        break;
      case 'setCue':
        this.cue = video.currentTime;
        break;
      case 'cue':
        if (this.cue !== null) video.currentTime = this.cue;
        break;
      case 'loopIn':
        this.loopStart = video.currentTime;
        this.loopEnd = null;
        break;
      case 'loopOut':
        if (this.loopStart === null || video.currentTime < this.loopStart + 0.3) {
          return 'Play forward from IN before setting OUT.';
        }
        this.loopEnd = video.currentTime;
        break;
      case 'clearLoop':
        this.loopStart = null;
        this.loopEnd = null;
        break;
    }
    return '';
  }
}

if (typeof module !== 'undefined') module.exports = DeckPlayer;
else globalThis.TwinDeckPlayer = DeckPlayer;
