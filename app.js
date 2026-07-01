/* ============================================================
   Morning Stretch — app.js
   ============================================================ */

/* ── Stretch data ──────────────────────────────────────────── */
const STRETCHES = [
  {
    name: "Knees to Chest",
    duration: 30,
    tip: "Breathe out slowly as you pull your knees closer",
    sides: null,
    announce: "Knees to chest. Lie on your back and gently hug both knees in.",
    pose: "poses/knees-to-chest.png"
  },
  {
    name: "Spinal Twist",
    duration: 30,
    tip: "Keep both shoulders pressed gently toward the floor",
    sides: ["Left side", "Right side"],
    announce: "Spinal twist. Lie on your back, drop your knees to one side, arms wide.",
    poses: ["poses/spinal-twist-left.png", "poses/spinal-twist-right.png"]
  },
  {
    name: "Cat-Cow",
    duration: 45,
    tip: "Arch on the inhale, round on the exhale — move with your breath",
    sides: null,
    announce: "Cat cow. On all fours, arch and round your spine with your breath.",
    pose: "poses/cat-cow.png"
  },
  {
    name: "Child's Pose",
    duration: 45,
    tip: "Walk your hands forward for more length, breathe into your lower back",
    sides: null,
    announce: "Child's pose. Sink your hips back toward your heels, arms stretched forward.",
    pose: "poses/childs-pose.png"
  },
  {
    name: "Low Lunge",
    duration: 30,
    tip: "Sink your hips gently forward and down, front knee over ankle",
    sides: ["Left leg forward", "Right leg forward"],
    announce: "Low lunge. Step one foot forward, back knee down, hips sinking forward.",
    poses: ["poses/low-lunge-left.png", "poses/low-lunge-right.png"]
  },
  {
    name: "Seated Forward Fold",
    duration: 45,
    tip: "Bend your knees slightly if needed — reach for your shins, not your ego",
    sides: null,
    announce: "Seated forward fold. Sit tall, then hinge forward from your hips.",
    pose: "poses/seated-fold.png"
  },
  {
    name: "Standing Forward Fold",
    duration: 30,
    tip: "Bend your knees generously, let your head hang heavy, sway gently",
    sides: null,
    announce: "Almost done. Standing forward fold. Soft knees, fold over, let everything hang.",
    pose: "poses/standing-fold.png"
  }
];

const TOTAL_DURATION = STRETCHES.reduce(
  (s, x) => s + (x.sides ? x.duration * 2 : x.duration), 0
);

/* ── State ─────────────────────────────────────────────────── */
let stretchIdx  = 0;
let sideIdx     = 0;
let timeLeft    = 0;
let ticker      = null;
let isPaused    = false;
let voiceEnabled = true;
let elapsed     = 0;
let pendingAnnounce = null;

/* ── DOM refs ───────────────────────────────────────────────── */
const $  = id => document.getElementById(id);
const els = {
  introScreen:    $('introScreen'),
  activeArea:     $('activeArea'),
  completeScreen: $('completeScreen'),
  sessionBar:     $('sessionBar'),
  sessionLabel:   $('sessionLabel'),
  sessionTime:    $('sessionTime'),
  stretchCount:   $('stretchCount'),
  poseIllustration: $('poseIllustration'),
  timerRing:      $('timerRing'),
  timerDisplay:   $('timerDisplay'),
  sideIndicator:  $('sideIndicator'),
  stretchName:    $('stretchName'),
  stretchTip:     $('stretchTip'),
  pauseBtn:       $('pauseBtn'),
  voiceToggle:    $('voiceToggle'),
  speakerWave:    $('speakerWave'),
  muteX1:         $('muteX1'),
  muteX2:         $('muteX2'),
  queue:          $('stretchQueue'),
  versionLabel:   $('versionLabel'),
};

/* ── Timer ring ─────────────────────────────────────────────── */
const CIRC = 2 * Math.PI * 52;
els.timerRing.style.strokeDasharray = CIRC;

function setRing(fraction) {
  els.timerRing.style.strokeDashoffset = CIRC * (1 - fraction);
  els.timerRing.style.stroke =
    fraction > 0.5 ? '#C8894A' :
    fraction > 0.2 ? '#A08070' : '#5A6B4E';
}

/* ── Audio pips ─────────────────────────────────────────────── */
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function pip(freq, vol = 0.18) {
  try {
    const ctx = getAudio();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = freq;
    o.type = 'sine';
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    o.start();
    o.stop(ctx.currentTime + 0.2);
  } catch (e) {}
}

/* ── Speech ─────────────────────────────────────────────────── */
function speak(text) {
  if (!voiceEnabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.88; u.pitch = 0.95; u.volume = 1;
  const pref = window.speechSynthesis.getVoices()
    .find(v => /samantha|karen|moira|fiona|daniel|en-GB|en-AU/i.test(v.name + v.lang));
  if (pref) u.voice = pref;
  window.speechSynthesis.speak(u);
}
if ('speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

/* ── Screen wake lock ───────────────────────────────────────── */
// Keep the screen awake during a session so the phone doesn't sleep mid-routine.
let wakeLock = null;

async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return;      // unsupported (e.g. iOS < 16.4)
  if (wakeLock && !wakeLock.released) return;  // already held
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  } catch (e) {}
}

async function releaseWakeLock() {
  try { await wakeLock?.release(); } catch (e) {}
  wakeLock = null;
}

// The OS releases the lock whenever the tab is hidden (screen off, app switch);
// re-acquire it on return if a session is still running.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' &&
      els.activeArea.classList.contains('visible')) {
    acquireWakeLock();
  }
});

/* ── Queue ───────────────────────────────────────────────────── */
function buildQueue() {
  els.queue.innerHTML = STRETCHES.map((s, i) => `
    <div class="queue-item upcoming" id="qi-${i}">
      <div class="queue-dot"></div>
      <div class="queue-name">${s.name.split(' ')[0]}</div>
    </div>`).join('');
}

function updateQueue() {
  STRETCHES.forEach((_, i) => {
    const el = $(`qi-${i}`);
    if (el) el.className = 'queue-item ' +
      (i < stretchIdx ? 'done' : i === stretchIdx ? 'active' : 'upcoming');
  });
  const active = $(`qi-${stretchIdx}`);
  if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

/* ── Pose loading ────────────────────────────────────────────── */
function getPoseUrl(stretch, si) {
  // Stretches with side-specific images use a `poses` array; others use `pose`
  if (stretch.poses) return stretch.poses[si] || stretch.poses[0];
  return stretch.pose;
}

function loadPose(url) {
  // Pre-load into an off-screen image, then swap in — container never changes height
  const img = new Image();
  img.alt = 'stretch pose';
  img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
  img.onload = () => {
    els.poseIllustration.innerHTML = '';
    els.poseIllustration.appendChild(img);
    els.poseIllustration.classList.remove('animate-in');
    void els.poseIllustration.offsetWidth;
    els.poseIllustration.classList.add('animate-in');
  };
  img.onerror = () => {
    // Placeholder if image not yet in poses/ — keeps same fixed height
    els.poseIllustration.innerHTML =
      `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
        width:100%;height:100%;gap:8px;color:#9A8A7A;font-size:12px;
        font-family:Lora,serif;font-style:italic;opacity:0.5">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        add image to poses/
      </div>`;
  };
  img.src = url;
}

/* ── Show stretch ────────────────────────────────────────────── */
function showStretch(i, si, doAnnounce) {
  const s = STRETCHES[i];
  timeLeft = s.duration;

  els.stretchCount.textContent = `Stretch ${i + 1} of ${STRETCHES.length}`;
  els.timerDisplay.textContent = s.duration;
  setRing(1);

  // Side indicator
  if (s.sides) {
    els.sideIndicator.textContent = s.sides[si];
    els.sideIndicator.classList.add('visible');
  } else {
    els.sideIndicator.textContent = '';
    els.sideIndicator.classList.remove('visible');
  }

  // Animate text in
  ['stretchName', 'stretchTip'].forEach(id => {
    const el = els[id];
    el.classList.remove('animate-in');
    void el.offsetWidth;
    el.classList.add('animate-in');
  });
  els.stretchName.textContent = s.name;
  els.stretchTip.textContent  = s.tip;

  // Load pose illustration (side-specific or single)
  loadPose(getPoseUrl(s, si));

  updateQueue();

  // Voice announcement
  if (doAnnounce) {
    const text = s.announce + (s.sides ? ` ${s.sides[si]}.` : '');
    if (isPaused) {
      pendingAnnounce = text;
    } else {
      speak(text);
      pendingAnnounce = null;
    }
  }
}

/* ── Ticker ──────────────────────────────────────────────────── */
function startTicker() {
  clearInterval(ticker);
  const total = STRETCHES[stretchIdx].duration;

  ticker = setInterval(() => {
    if (isPaused) return;

    timeLeft--;
    elapsed++;

    els.timerDisplay.textContent = timeLeft;
    setRing(timeLeft / total);

    // Session bar + time remaining
    const rem = Math.max(0, TOTAL_DURATION - elapsed);
    const m = Math.floor(rem / 60);
    const s = rem % 60;
    els.sessionTime.textContent = `${m}:${String(s).padStart(2, '0')}`;
    els.sessionBar.style.width = Math.min(100, (elapsed / TOTAL_DURATION) * 100) + '%';

    // Countdown pips (low, low, high)
    if (timeLeft === 3) pip(600, 0.15);
    else if (timeLeft === 2) pip(600, 0.15);
    else if (timeLeft === 1) pip(880, 0.22);

    if (timeLeft <= 0) advance();
  }, 1000);
}

/* ── Advance ─────────────────────────────────────────────────── */
function advance() {
  const s = STRETCHES[stretchIdx];
  if (s.sides && sideIdx === 0) {
    sideIdx = 1;
    showStretch(stretchIdx, 1, true);
  } else {
    sideIdx = 0;
    stretchIdx++;
    if (stretchIdx >= STRETCHES.length) {
      finishSession();
      return;
    }
    showStretch(stretchIdx, 0, true);
  }
}

/* ── Session controls ────────────────────────────────────────── */
function startSession() {
  els.introScreen.classList.remove('visible');
  els.activeArea.classList.add('visible');
  els.sessionLabel.textContent = 'In progress';
  buildQueue();
  showStretch(0, 0, true);
  startTicker();
  acquireWakeLock();
}

function togglePause() {
  isPaused = !isPaused;
  els.pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
  if (isPaused) {
    // Stop any speech and audio immediately on pause
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  } else if (pendingAnnounce) {
    speak(pendingAnnounce);
    pendingAnnounce = null;
  }
}

function skipStretch() {
  clearInterval(ticker);
  elapsed += timeLeft;
  advance();
  if (stretchIdx < STRETCHES.length) startTicker();
}

function prevStretch() {
  clearInterval(ticker);
  if (sideIdx > 0) {
    sideIdx = 0;
  } else {
    stretchIdx = Math.max(0, stretchIdx - 1);
    sideIdx = 0;
  }
  showStretch(stretchIdx, sideIdx, false);
  startTicker();
}

function finishSession() {
  clearInterval(ticker);
  els.activeArea.classList.remove('visible');
  els.completeScreen.classList.add('visible');
  els.sessionBar.style.width = '100%';
  els.sessionLabel.textContent = 'Complete';
  els.sessionTime.textContent = '0:00';
  speak("Session complete. Well done. Have a wonderful day.");
  releaseWakeLock();
}

function resetSession() {
  // Clear all state fully
  clearInterval(ticker);
  ticker      = null;
  stretchIdx  = 0;
  sideIdx     = 0;
  timeLeft    = 0;
  elapsed     = 0;
  isPaused    = false;
  pendingAnnounce = null;

  // Reset UI
  els.pauseBtn.textContent = 'Pause';
  els.sessionBar.style.width = '0%';
  els.sessionLabel.textContent = 'In progress';
  els.sessionTime.textContent = `${Math.floor(TOTAL_DURATION/60)}:${String(TOTAL_DURATION%60).padStart(2,'0')}`;
  els.timerDisplay.textContent = STRETCHES[0].duration;
  setRing(1);

  // Switch screens
  els.completeScreen.classList.remove('visible');
  els.activeArea.classList.add('visible');

  // Rebuild and start fresh
  buildQueue();
  showStretch(0, 0, true);
  startTicker();
  acquireWakeLock();
}


// resetToStart: goes back to intro screen from any state
function resetToStart() {
  clearInterval(ticker);
  ticker = null; stretchIdx = 0; sideIdx = 0;
  timeLeft = 0; elapsed = 0; isPaused = false; pendingAnnounce = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  els.sessionBar.style.width = "0%";
  els.sessionLabel.textContent = "Ready to begin";
  els.sessionTime.textContent = Math.floor(TOTAL_DURATION/60) + ":" + String(TOTAL_DURATION%60).padStart(2,"0");
  els.pauseBtn.textContent = "Pause";
  setRing(1);
  els.activeArea.classList.remove("visible");
  els.completeScreen.classList.remove("visible");
  els.introScreen.classList.add("visible");
  els.queue.innerHTML = "";
  releaseWakeLock();
}

function toggleVoice() {
  voiceEnabled = !voiceEnabled;
  els.voiceToggle.classList.toggle('muted', !voiceEnabled);
  els.speakerWave.style.display = voiceEnabled ? ''     : 'none';
  els.muteX1.style.display      = voiceEnabled ? 'none' : '';
  els.muteX2.style.display      = voiceEnabled ? 'none' : '';
  if (!voiceEnabled) window.speechSynthesis.cancel();
}


/* -- Help modal ─────────────────────────────────────────────── */
function toggleHelp() {
  document.getElementById('helpOverlay').classList.toggle('visible');
}
function closeHelp() {
  document.getElementById('helpOverlay').classList.remove('visible');
}
// Close on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeHelp();
});

/* ── Version label ───────────────────────────────────────────── */
function initVersion() {
  if (typeof CONFIG !== 'undefined' && els.versionLabel) {
    els.versionLabel.textContent = `v${CONFIG.VERSION}`;
  }
}

/* ── Init ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initVersion();
});
