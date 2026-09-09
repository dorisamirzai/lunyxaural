const canvas       = document.getElementById('c');
const ctx          = canvas.getContext('2d');
const videoEl      = document.getElementById('video');
const audioEl      = document.getElementById('audio');
const dropzone     = document.getElementById('dropzone');
const dropLabel    = document.getElementById('dropLabel');
const status       = document.getElementById('status');
const controls     = document.getElementById('controls');
const hoverZone    = document.getElementById('hoverZone');
const playPauseBtn = document.getElementById('playPauseBtn');
const iconPause    = document.getElementById('iconPause');
const iconPlay     = document.getElementById('iconPlay');
const reloadBtn    = document.getElementById('reloadBtn');
const trackName    = document.getElementById('trackName');

let analyser, dataArray, bufferLength;
let audioCtx;
const sourceNodes = new WeakMap();

let time = 0;
let smoothBass = 0;
let activeMedia = null;
let isLoaded = false;   // true once a file has been successfully started

// 🎨 COLOUR PALETTE
const palette = {
  emerald: '#284139',
  wasabi:  '#809076',
  khaki:   '#F8D794',
  earth:   '#B86830',
  noir:    '#111419'
};

const colors = [palette.noir, palette.emerald, palette.wasabi, palette.khaki, palette.earth];

function lerpColor(a, b, t) {
  const ah = parseInt(a.replace('#',''), 16);
  const bh = parseInt(b.replace('#',''), 16);
  const ar = (ah >> 16) & 255, ag = (ah >> 8) & 255, ab = ah & 255;
  const br = (bh >> 16) & 255, bg = (bh >> 8) & 255, bb = bh & 255;
  return `rgb(${ar+(br-ar)*t|0},${ag+(bg-ag)*t|0},${ab+(bb-ab)*t|0})`;
}

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// 🔊 Wire media element — source node created only once per element
function setupAudio(mediaEl) {
  if (!audioCtx) {
    audioCtx     = new (window.AudioContext || window.webkitAudioContext)();
    analyser     = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    bufferLength = analyser.frequencyBinCount;
    dataArray    = new Uint8Array(bufferLength);
    analyser.connect(audioCtx.destination);
  }

  if (!sourceNodes.has(mediaEl)) {
    const node = audioCtx.createMediaElementSource(mediaEl);
    node.connect(analyser);
    sourceNodes.set(mediaEl, node);
  }

  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// 📂 Load a file
function loadFile(file) {
  if (!file) return;

  const isAudio = file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3');
  const isVideo = file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.mp4');

  if (!isAudio && !isVideo) {
    setStatus('⚠ Please drop an MP3 or MP4 file');
    return;
  }

  [videoEl, audioEl].forEach(el => {
    el.pause();
    if (el.src && el.src.startsWith('blob:')) URL.revokeObjectURL(el.src);
    el.removeAttribute('src');
    el.load();
  });

  const mediaEl = isAudio ? audioEl : videoEl;
  activeMedia   = mediaEl;

  mediaEl.src = URL.createObjectURL(file);
  mediaEl.load();

  dropLabel.textContent = file.name;
  trackName.textContent = file.name;
  setStatus('loading…');

  mediaEl.oncanplay = () => {
    try {
      setupAudio(mediaEl);
      mediaEl.muted = false;
      mediaEl.play()
        .then(() => {
          setStatus('');
          isLoaded = true;
          setTimeout(() => dropzone.classList.add('hidden'), 600);
          // Hide controls — playing, so they disappear
          hideControls();
          setPaused(false);
        })
        .catch(() => setStatus('⚠ Click anywhere to start'));
    } catch(err) {
      setStatus('⚠ Audio setup failed: ' + err.message);
      console.error(err);
    }
  };

  mediaEl.onerror = () => setStatus('⚠ Could not read this file');
}

function setStatus(msg) { status.textContent = msg; }

function setPaused(paused) {
  iconPause.style.display = paused ? 'none'  : 'block';
  iconPlay.style.display  = paused ? 'block' : 'none';
}

function showControls() {
  if (isLoaded) controls.classList.add('visible');
}

function hideControls() {
  // Keep visible if paused — user needs to be able to press play
  if (activeMedia && !activeMedia.paused) {
    controls.classList.remove('visible');
  }
}

// 🎧 Frequency data
function getAudioData() {
  if (!analyser) return { bass: 0, mid: 0, high: 0, overall: 0 };
  analyser.getByteFrequencyData(dataArray);

  const bassEnd = Math.floor(bufferLength * 0.05);
  const midEnd  = Math.floor(bufferLength * 0.3);

  let bass = 0, mid = 0, high = 0;
  for (let i = 0;       i < bassEnd;      i++) bass += dataArray[i];
  for (let i = bassEnd; i < midEnd;       i++) mid  += dataArray[i];
  for (let i = midEnd;  i < bufferLength; i++) high += dataArray[i];

  bass = bass / bassEnd / 255;
  mid  = mid  / (midEnd - bassEnd) / 255;
  high = high / (bufferLength - midEnd) / 255;

  return { bass, mid, high, overall: bass*0.5 + mid*0.3 + high*0.2 };
}

// 🎨 Draw shape
function drawOpArtShape(cx, cy, t, audio) {
  const { mid } = audio;
  const size = Math.min(canvas.width, canvas.height) * 0.42;
  const numRings = 28 + Math.floor(smoothBass * 14);
  const step     = size / numRings;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.18 + smoothBass * 0.6);

  for (let ring = numRings; ring >= 1; ring--) {
    const frac       = ring / numRings;
    const colorIndex = frac * (colors.length - 1);
    const i          = Math.floor(colorIndex);
    ctx.strokeStyle  = lerpColor(colors[i], colors[i+1] || colors[i], colorIndex - i);
    ctx.beginPath();

    for (let j = 0; j <= 360; j++) {
      const angle       = (j / 360) * Math.PI * 2;
      const petalWave   = 1 + (0.18 + mid*0.22) * Math.sin(8*angle + t*0.6 + smoothBass*3);
      const innerRipple = 1 + (mid*0.12) * Math.sin(16*angle - t*1.1);
      const bassPush    = 1 + Math.pow(smoothBass, 1.5) * 1.1 * (1 - frac);
      const r           = ring * step * petalWave * innerRipple * bassPush * (1 - smoothBass*0.15);

      if (j === 0) ctx.moveTo(r * Math.cos(angle), r * Math.sin(angle));
      else         ctx.lineTo(r * Math.cos(angle), r * Math.sin(angle));
    }

    ctx.lineWidth = step * (0.45 + smoothBass * 0.4);
    ctx.stroke();
  }

  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, size*0.03 + smoothBass*size*0.06, 0, Math.PI*2);
  ctx.fillStyle = palette.noir;
  ctx.fill();
}

// 🎬 Render loop
function draw() {
  requestAnimationFrame(draw);
  time += 0.016;

  const audioData = getAudioData();
  smoothBass += (audioData.bass - smoothBass) * 0.05;

  const W = canvas.width, H = canvas.height;
  const bgMix = 0.2 + audioData.overall * 0.25 + Math.sin(time * 0.5) * 0.05;

  ctx.fillStyle = lerpColor('#0e1a16', palette.emerald, bgMix);
  ctx.fillRect(0, 0, W, H);
  drawOpArtShape(W/2, H/2, time, audioData);
}

draw();

// ── HOVER ZONE — reveals controls on mouse enter, hides on leave ──

hoverZone.addEventListener('mouseenter', showControls);

// Hide when mouse leaves both the hoverZone AND the controls panel
hoverZone.addEventListener('mouseleave', (e) => {
  // If moving into the controls, don't hide yet
  if (!controls.contains(e.relatedTarget)) hideControls();
});

controls.addEventListener('mouseleave', (e) => {
  // If moving back into the hoverZone, don't hide
  if (e.relatedTarget !== hoverZone && !hoverZone.contains(e.relatedTarget)) {
    hideControls();
  }
});

// ── CONTROLS ─────────────────────────────────────────────

playPauseBtn.addEventListener('click', () => {
  if (!activeMedia) return;

  if (activeMedia.paused) {
    audioCtx.resume().then(() => activeMedia.play());
    setPaused(false);
    // Playing — schedule hide after a moment
    setTimeout(hideControls, 800);
  } else {
    activeMedia.pause();
    audioCtx.suspend();
    setPaused(true);
    // Paused — keep controls visible so user can resume
    showControls();
  }
});

reloadBtn.addEventListener('click', () => {
  if (activeMedia) {
    activeMedia.pause();
    if (audioCtx) audioCtx.suspend();
  }
  isLoaded = false;
  controls.classList.remove('visible');
  dropzone.classList.remove('hidden');
  dropLabel.textContent = 'Drop an MP3 or MP4 here';
  setStatus('');
  setPaused(false);
});

// ── DRAG & DROP ───────────────────────────────────────────

window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop',     e => e.preventDefault());

dropzone.addEventListener('dragenter', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', e => { if (!dropzone.contains(e.relatedTarget)) dropzone.classList.remove('dragover'); });
dropzone.addEventListener('dragover',  e => e.preventDefault());
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  loadFile(e.dataTransfer.files[0]);
});

dropzone.addEventListener('click', () => {
  const input    = document.createElement('input');
  input.type     = 'file';
  input.accept   = 'audio/mpeg,video/mp4,audio/*,video/*';
  input.onchange = () => loadFile(input.files[0]);
  input.click();
});

[videoEl, audioEl].forEach(el => {
  el.addEventListener('ended', () => {
    isLoaded = false;
    controls.classList.remove('visible');
    dropzone.classList.remove('hidden');
    dropLabel.textContent = 'Drop an MP3 or MP4 here';
    setStatus('');
    setPaused(false);
  });
});
