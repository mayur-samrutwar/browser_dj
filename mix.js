(function (root) {
  const youtube = 'https://www.youtube.com';
  const workspaceUrl = youtube + '/robots.txt#browser-dj';

  function gains(cross, master, a, b) {
    const clamp = n => Math.max(0, Math.min(1, Number(n) || 0));
    const position = clamp(cross);
    const level = clamp(master);
    return { A: (1 - position) * level * clamp(a), B: position * level * clamp(b) };
  }

  const mix = { gains, youtube, workspaceUrl };
  if (typeof module !== 'undefined') module.exports = mix;
  else root.TwinMix = mix;
})(globalThis);
