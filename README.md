# browser dj

Browser DJ turns a Chromium browser tab into a two-deck DJ console for YouTube. Load and play two videos independently, then mix them live with a crossfader, separate deck levels, speed, cue points, loops, and beatmatching.

## Install

Browser DJ is designed for desktop Chromium browsers that support unpacked Manifest V3 extensions. Playback and mixing have been tested in Brave on macOS. Chrome and Edge both support loading unpacked extensions. [Chrome setup guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) · [Edge setup guide](https://learn.microsoft.com/microsoft-edge/extensions-chromium/getting-started/extension-sideloading)

1. Open your browser’s extensions page and turn on **Developer mode**. Use `brave://extensions` in Brave, `chrome://extensions` in Chrome, or `edge://extensions` in Edge.
2. Click **Load unpacked** and select the **browser_dj** folder that contains `manifest.json`.
3. Open the **Extensions** menu and choose **Browser DJ**. Pin it if you want it on the toolbar.

Keep the folder in place after installation. Browser DJ opens in the current window and returns to the mixer tab if it’s already open.

To update an existing install, click the reload arrow on the **Browser DJ** card in your extensions page, then refresh or reopen the mixer tab. Refreshing resets the loaded tracks and cues. Your preferred split is saved.

## Mix two tracks

1. Click **A only** at the crossfader. Use YouTube’s search in the left pane to find and play your first song.
2. Find your next song in the right pane. If it starts on its own, click the right platter to pause it. Use the seek bar to find a clear intro.
3. As the first song reaches its outro, start the right deck and move the crossfader toward B. You’ll hear both songs as you pass through the middle.
4. Once the fader is fully on B, pause A and load another song. Reverse the same steps for the next transition.

Try two tracks with a similar tempo first. A short overlap usually sounds cleaner when one track has finished its vocal line.

## Beatmatch two tracks

Matching tempo stops the beats from drifting apart. Marking the beat gives the mixer a timing reference so the kicks can land together.

1. Open **Beatmatch** next to the crossfader. Enter the original tempo of each recording in **Track BPM**. The readout underneath shows the BPM at that deck’s current speed.
2. Solo one deck using **A only** or **B only**. While it plays, click **Mark beat** on a clear kick, or click **Tap** on at least four steady beats. Tapping estimates the tempo if the BPM field is empty. Repeat for the other deck.
3. Leave the crossfader on the song you want to keep hearing. Start both decks, then click **Sync to A** on B if A is your reference. **Sync to B** on A works in the other direction. The button matches the deck it’s on to the other deck’s current tempo.
4. Wait for **Beats aligned** before fading in the second track. Sync briefly adjusts the incoming deck’s speed to bring its beats into line, then returns it to the matched tempo.
5. If the incoming kick still sounds late, press **+30 ms** on that deck. If it sounds early, press **−30 ms**. If a video buffers, sync again once both decks are playing smoothly.

### Example - Practice Pair

The regular versions of **“Beauty and a Beat”** and **“Viva La Vida”** are about **128 BPM** and **138 BPM**, respectively. Browser DJ suggests these values when it recognizes the titles. Check the tempo by ear for alternate uploads. [Beatport](https://www.beatport.com/fr/track/beauty-and-a-beat/20910871) · [Tency Music](https://www.tencymusic.com/music-licensing/coldplay/viva-la-vida.html)

| Keep at normal speed | Sync the other deck | Matched tempo |
| --- | --- | --- |
| “Beauty and a Beat” | “Viva La Vida” slows to about **0.928×** | 128 BPM |
| “Viva La Vida” | “Beauty and a Beat” speeds up to about **1.078×** | 138 BPM |

## Mixer controls

| Control | What it does |
| --- | --- |
| Round platter | Plays or pauses that deck. |
| Seek bar and **−5s / +5s** | Move through the current video. |
| **Set cue** and **Go cue** | Save the current position and jump back to it. |
| **Loop In / Out / Clear** | Mark the start, let the video play forward, then mark the end. **Clear** exits the loop. Loop boundaries are approximate. |
| **Level** and **Master** | Set the volume for one deck or the whole mix, respectively. |
| **Crossfader** | Blends the decks. Hear A on the far left, B on the far right, and both in the middle. |
| **Speed** | Adjusts playback from 0.500× to 1.500×. Normal speed is 1.000×. |
| **Pause both** | Pauses both videos. |

Drag the handle above the mixer **up** for larger controls or **down** for more video space. Double-click it to reset the layout. With the handle focused, use **↑ / ↓** to resize or **Home / End** to jump to the smallest or largest size.

With focus on the mixer page outside a control, **1 / 2** toggle the left and right decks, **← / →** move the crossfader, and **Space** pauses both.

## Troubleshooting

| What you see | What to try |
| --- | --- |
| A video is playing but you can’t hear it | Move the crossfader toward that deck, turn up its **Level** and **Master**, and check that YouTube and the browser tab are unmuted. |
| The mixer’s play button doesn’t start the video | Click play directly in that deck’s YouTube player once. |
| **Sync** is disabled | Load a video on each deck, enter or tap both BPMs, and wait for any ads to finish. |
| Both BPMs match but the kicks still sound doubled | Mark a steady beat in each deck and sync while both are playing. Beat alignment uses your marks and applies once per sync. |
| A pane is stuck loading | Click **Retry deck**. If YouTube needs you to sign in, use **Open YouTube** to do that in a regular tab, then retry. |
| You see the old controls after an update | Reload Browser DJ from your extensions page, then refresh or reopen the mixer tab. |

The mixer tab uses a YouTube address so both panes can load the standard YouTube site. Browser and YouTube settings affect ad playback. During ads, speed, seek, cue, loop, and beatmatching controls wait for the video to resume. Changing a track resets its speed, cue, loop, and beat markers.

## Development

The Manifest V3 configuration grants the extension access to `www.youtube.com` for the mixer. The window split is saved in local extension storage.

| File | Role |
| --- | --- |
| `manifest.json`, `background.js` | Extension configuration and toolbar launcher |
| `mixer.js`, `mixer.css`, `splitter.js` | Mixer UI and resizing |
| `deck.js`, `mix.js` | Playback controls and crossfader gain |
| `beatmatch.js`, `beatmath.js`, `beatmatch.css` | Beatmatch controls and tempo and timing calculations |

Run the regression checks with Node.js from this folder.

```sh
node --test tests.cjs
```
