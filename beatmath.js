(function (root) {
  const minBpm = 40;
  const maxBpm = 240;
  const minRate = 0.5;
  const maxRate = 1.5;

  function validBpm(value) {
    return Number.isFinite(value) && value >= minBpm && value <= maxBpm;
  }

  function suggestBpm(title) {
    if (/\b(remix|cover|live|karaoke|acoustic|nightcore|slowed|sped up|mashup|acapella|rework|edit)\b/i.test(title)) {
      return null;
    }
    if (/justin bieber/i.test(title) && /beauty and (?:a|the) beat/i.test(title)) return 128;
    if (/coldplay/i.test(title) && /viva la vida/i.test(title)) return 138;
    return null;
  }

  function matchingRate(sourceBpm, sourceRate, targetBpm) {
    if (!validBpm(sourceBpm) || !validBpm(targetBpm)) return null;
    const rate = sourceBpm * sourceRate / targetBpm;
    return rate >= minRate && rate <= maxRate ? rate : null;
  }

  function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  // The tap times are in source media seconds, even on a sped-up deck.
  function gridFromTaps(times, fixedBpm) {
    if (times.length < 4) return null;
    const intervals = times.slice(1).map((time, index) => time - times[index]);
    const typical = median(intervals);
    if (typical <= 0 || intervals.some(interval => Math.abs(interval - typical) > 0.24 * typical)) {
      return null;
    }
    const average = (times.at(-1) - times[0]) / (times.length - 1);
    const bpm = fixedBpm ?? Math.round(600 / average) / 10;
    if (!validBpm(bpm)) return null;
    const period = 60 / bpm;
    const beatsPerTap = Math.round(average / period);
    if (beatsPerTap < 1 || beatsPerTap > 2 || Math.abs(average / period - beatsPerTap) > 0.22) return null;
    const anchor = median(times.map((time, index) => time - index * beatsPerTap * period));
    return { bpm, anchor };
  }

  function alignedTime(sourceTime, sourceAnchor, sourceBpm, targetTime, targetAnchor, targetBpm, duration) {
    const sourceBeat = (sourceTime - sourceAnchor) * sourceBpm / 60;
    const phase = sourceBeat - Math.floor(sourceBeat);
    const period = 60 / targetBpm;
    const base = targetAnchor + phase * period;
    const first = Math.ceil(-base / period);
    const last = Math.floor((duration - 0.01 - base) / period);
    if (first > last) return null;
    const closest = Math.round((targetTime - base) / period);
    return base + Math.min(last, Math.max(first, closest)) * period;
  }

  function correctionRate(base, secondsBehind) {
    const limit = Math.min(0.12, base * 0.1);
    const bend = Math.max(-limit, Math.min(limit, secondsBehind / 0.48));
    return Math.max(minRate, Math.min(maxRate, base + bend));
  }

  const helpers = { minBpm, maxBpm, validBpm, suggestBpm, matchingRate, gridFromTaps, alignedTime, correctionRate };
  if (typeof module !== 'undefined') module.exports = helpers;
  else root.BeatMath = helpers;
})(globalThis);
