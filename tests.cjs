const { test } = require('node:test');
const assert = require('node:assert/strict');
const { gains } = require('./mix');
const DeckPlayer = require('./deck');

test('the crossfader can isolate each deck or blend them with independent level and master controls', () => {
  assert.deepEqual(gains(0, 0.8, 1, 1), { A: 0.8, B: 0 });
  assert.deepEqual(gains(1, 0.8, 1, 1), { A: 0, B: 0.8 });
  assert.deepEqual(gains(0.5, 0.8, 0.5, 1), { A: 0.2, B: 0.4 });
  assert.deepEqual(gains(0.5, 0, 1, 1), { A: 0, B: 0 });
});

function fixture() {
  const events = new EventTarget();
  const video = {
    volume: 1,
    muted: false,
    paused: true,
    ended: false,
    currentTime: 10,
    duration: 200,
    playbackRate: 1,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    async play() { this.paused = false; },
    pause() { this.paused = true; }
  };
  const doc = {
    URL: 'https://www.youtube.com/watch?v=first',
    readyState: 'complete',
    title: 'Track - YouTube',
    ad: false,
    contains: node => node === video,
    querySelector(selector) {
      if (selector.includes('ad-showing')) return this.ad ? {} : null;
      return selector.includes('video.html5-main-video') ? video : null;
    }
  };
  const frame = { contentDocument: doc };
  return { video, doc, frame, events, deck: new DeckPlayer(frame) };
}

test('two players are independent through play, gain, cueing and a native track change', async () => {
  const a = fixture();
  const b = fixture();
  b.deck.read();

  await a.deck.control('toggle');
  a.deck.setGain(0.25);
  await a.deck.control('rate', 1.2);
  await a.deck.control('setCue');
  await a.deck.control('seek', 40);
  assert.equal(a.video.currentTime, 50);
  await a.deck.control('cue');
  assert.equal(a.video.currentTime, 10);
  assert.equal(b.video.paused, true);
  assert.equal(b.video.volume, 0.4);
  assert.equal(b.video.playbackRate, 1);
  assert.equal(a.video.volume, 0.25);

  assert.match(await a.deck.control('loopOut'), /IN/);
  await a.deck.control('loopIn');
  a.video.currentTime = 20;
  await a.deck.control('loopOut');
  a.video.currentTime = 21;
  a.events.dispatchEvent(new Event('timeupdate'));
  assert.equal(a.video.currentTime, 10);
  a.doc.URL = 'https://www.youtube.com/watch?v=next';
  const next = a.deck.read();
  assert.equal(next.cue, null);
  assert.equal(next.loopStart, null);
  assert.equal(next.rate, 1);
  assert.equal(a.video.volume, 0.25);
});

test('a deck stays loading while the previous document is present, then recovers on retry', async () => {
  const { deck, doc, frame, video } = fixture();
  await deck.control('toggle');
  deck.open('https://www.youtube.com/results?search_query=house');
  assert.equal(video.paused, true);
  assert.equal(deck.read().status, 'loading');

  frame.contentDocument = null;
  assert.equal(deck.read().status, 'loading');
  deck.navigation.time -= 17000;
  assert.equal(deck.read().status, 'unavailable');

  deck.open(deck.lastUrl);
  frame.contentDocument = { ...doc, URL: deck.lastUrl };
  assert.equal(deck.read().status, 'browse');
});

test('an ad does not inherit a loop or tempo change and browser-blocked playback gives a clear instruction', async () => {
  const { deck, doc, events, video } = fixture();
  await deck.control('loopIn');
  video.currentTime = 15;
  await deck.control('loopOut');
  doc.ad = true;
  video.currentTime = 21;
  events.dispatchEvent(new Event('timeupdate'));
  assert.equal(video.currentTime, 21);
  assert.match(await deck.control('rate', 1.4), /after the ad/);
  assert.equal(video.playbackRate, 1);

  doc.ad = false;
  video.play = () => { throw new DOMException('', 'NotAllowedError'); };
  assert.match(await deck.control('toggle'), /Press play inside this YouTube pane/);
});

const { matchingRate, alignedTime, gridFromTaps, suggestBpm } = require('./beatmath');

test('matches the exact tempo in either direction and respects the adjustable speed limits', () => {
  assert.equal(matchingRate(128, 1, 138), 128 / 138);
  assert.equal(matchingRate(138, 1, 128), 138 / 128);
  assert.ok(Math.abs(matchingRate(128, 0.96, 138) * 138 - 128 * 0.96) < 1e-10);
  assert.equal(matchingRate(200, 1, 70), null);
  assert.equal(suggestBpm('Justin Bieber - Beauty And A Beat (Lyrics) ft. Nicki Minaj'), 128);
  assert.equal(suggestBpm('Coldplay - Viva La Vida (Official Video)'), 138);
  assert.equal(suggestBpm('Coldplay - Viva La Vida (Slowed Edit)'), null);
});

test('aligns the nearest matching beat and avoids seeking before or after the track', () => {
  const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7);
  close(alignedTime(10.125, 0, 120, 20.29, 0, 120, 100), 20.125);
  close(alignedTime(10.125, 0, 120, 0, 0.25, 120, 100), 0.375);
  close(alignedTime(10.125, 0, 120, 0.99, 0.25, 120, 1), 0.875);
  assert.equal(alignedTime(10.125, 0, 120, 0, 0.25, 120, 0.05), null);
});

test('uses source video times for tap tempo and preserves manually entered BPM', () => {
  const taps = [2.02, 2.48, 3.004, 3.52, 3.996];
  const estimated = gridFromTaps(taps, null);
  assert.equal(estimated.bpm, 121.5);
  const fixed = gridFromTaps(taps, 120);
  assert.equal(fixed.bpm, 120);
  assert.ok(Math.abs(fixed.anchor - 2.004) < 1e-6);
  assert.equal(gridFromTaps([0, 0.05, 0.79, 0.91], 120), null);
});
