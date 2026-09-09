const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const audio = document.getElementById('audio');

// ─────────────────────────────────────────────
// 🎛️ STATE
// ─────────────────────────────────────────────

let analyser;
let dataArray;
let bufferLength;
let audioCtx;
let time = 0;

let smoothBass = 0;
let smoothMid = 0;
let smoothHigh = 0;
let visualEnergy = 0;

// ─────────────────────────────────────────────
// 🎨 COLOUR PALETTE
// ─────────────────────────────────────────────

const palette = {
    aura: '#852616',
    sunbeam: '#DA7134',
    eclipse: '#2A0001',
    bliss: '#E89154',
    ardent: '#FFD5A9'
};

const colors = [
    palette.eclipse,
    palette.aura,
    palette.sunbeam,
    palette.bliss,
    '#FFF5C2'
];

// ─────────────────────────────────────────────
// 🌈 COLOUR INTERPOLATION
// ─────────────────────────────────────────────

function lerpColor(a, b, t) {
    const ah = parseInt(a.replace('#', ''), 16);
    const bh = parseInt(b.replace('#', ''), 16);

    const ar = (ah >> 16) & 255;
    const ag = (ah >> 8) & 255;
    const ab = ah & 255;

    const br = (bh >> 16) & 255;
    const bg = (bh >> 8) & 255;
    const bb = bh & 255;

    const rr = ar + (br - ar) * t;
    const rg = ag + (bg - ag) * t;
    const rb = ab + (bb - ab) * t;

    return `rgb(${rr},${rg},${rb})`;
}

// ─────────────────────────────────────────────
// 📐 CANVAS RESIZE
// ─────────────────────────────────────────────

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

resize();
window.addEventListener('resize', resize);

// ─────────────────────────────────────────────
// 🔊 AUDIO SETUP
// ─────────────────────────────────────────────

function setupAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.82;

        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        const source = audioCtx.createMediaElementSource(audio);

        source.connect(analyser);
        analyser.connect(audioCtx.destination);
    }

    audio.play()
        .then(() => {
            audio.muted = false;
        })
        .catch(() => {
            console.log('Autoplay blocked — click anywhere to enable audio');
        });
}

// ─────────────────────────────────────────────
// 🎧 AUDIO ANALYSIS
// Bass: 20–180 Hz   → subtle influence
// Mid:  180–4000 Hz → main influence
// High: 4000–12000 Hz → secondary detail
// ─────────────────────────────────────────────

function getAudioData() {
    if (!analyser) {
        return {
            bass: 0,
            mid: 0,
            high: 0,
            overall: 0
        };
    }

    analyser.getByteFrequencyData(dataArray);

    const sampleRate = audioCtx.sampleRate;
    const nyquist = sampleRate / 2;

    function hzToBin(hz) {
        return Math.floor((hz / nyquist) * bufferLength);
    }

    const bassStart = hzToBin(20);
    const bassEnd = hzToBin(180);

    const midStart = hzToBin(180);
    const midEnd = hzToBin(4000);

    const highStart = hzToBin(4000);
    const highEnd = hzToBin(12000);

    let bass = 0;
    let mid = 0;
    let high = 0;

    for (let i = bassStart; i < bassEnd; i++) {
        bass += dataArray[i];
    }

    for (let i = midStart; i < midEnd; i++) {
        mid += dataArray[i];
    }

    for (let i = highStart; i < highEnd; i++) {
        high += dataArray[i];
    }

    bass = bass / Math.max(1, bassEnd - bassStart) / 255;
    mid = mid / Math.max(1, midEnd - midStart) / 255;
    high = high / Math.max(1, highEnd - highStart) / 255;

    // Mid is the dominant frequency range.
    const overall =
        mid * 0.70 +
        high * 0.20 +
        bass * 0.10;

    return { bass, mid, high, overall };
}

// ─────────────────────────────────────────────
// 🌅 BACKGROUND
// ─────────────────────────────────────────────

function drawBackground(W, H) {
    const grad = ctx.createRadialGradient(
        W / 2,
        H / 2,
        0,
        W / 2,
        H / 2,
        Math.max(W, H) * 0.7
    );

    grad.addColorStop(0, palette.eclipse);
    grad.addColorStop(0.35, palette.aura);
    grad.addColorStop(0.7, palette.sunbeam);
    grad.addColorStop(0.9, palette.bliss);
    grad.addColorStop(1, '#FFF5C2');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
}

// ─────────────────────────────────────────────
// 🌸 OP-ART / MANDALA VISUAL
// Mid frequencies = main movement
// Bass = subtle body
// High = small amount of detail
// ─────────────────────────────────────────────

function drawOpArtShape(cx, cy, t, audioData) {
    const { mid, high } = audioData;

    const W = canvas.width;
    const H = canvas.height;
    const size = Math.min(W, H) * 0.42;

    // More rings as the mid frequencies increase.
    const numRings = 28 + Math.floor(smoothMid * 12);

    const petals = 8;

    // Mid controls the main petal movement.
    const waveAmp =
        0.14 +
        smoothMid * 0.34 +
        smoothHigh * 0.10;

    // Mid controls rotation.
    // Bass is deliberately excluded to prevent jitter.
    const rotation =
        t * 0.10 +
        smoothMid * 0.55;

    const step = size / numRings;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    // Draw outer rings first.
    for (let ring = numRings; ring >= 1; ring--) {
        const frac = ring / numRings;

        // Ring colour.
        const colorIndex = frac * (colors.length - 1);
        const i = Math.floor(colorIndex);
        const blend = colorIndex - i;

        ctx.strokeStyle = lerpColor(
            colors[i],
            colors[Math.min(i + 1, colors.length - 1)],
            blend
        );

        ctx.beginPath();

        const pts = 360;

        for (let j = 0; j <= pts; j++) {
            const angle = (j / pts) * Math.PI * 2;

            // Main petal movement.
            const petalWave =
                1 +
                waveAmp *
                Math.sin(
                    petals * angle +
                    t * 0.45 +
                    smoothMid * 4 +
                    Math.sin(t * 0.3) * 1.5
                );

            // Secondary ripple.
            const innerRipple =
                1 +
                (smoothMid * 0.10 + smoothHigh * 0.04) *
                Math.sin(
                    petals * 2 * angle -
                    t * 1.1 +
                    ring * 0.12
                );

            const baseRadius = ring * step;

            // Small, slow bass influence.
            const bassPush =
                1 +
                Math.pow(smoothBass, 1.8) *
                0.35 *
                (1 - frac);

            // Main expansion from the mid frequencies.
            const midPush =
                1 +
                Math.pow(smoothMid, 1.3) *
                0.75 *
                (1 - frac);

            const r =
                baseRadius *
                petalWave *
                innerRipple *
                bassPush *
                midPush;

            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle);

            if (j === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        // Mainly controlled by mids.
        ctx.lineWidth =
            step *
            (
                0.45 +
                smoothMid * 0.30 +
                smoothBass * 0.05
            );

        ctx.stroke();
    }

    ctx.restore();

    // ─────────────────────────────────────────
    // CENTER DOT
    // ─────────────────────────────────────────

    ctx.beginPath();

    const centreSize =
        size * 0.03 +
        smoothMid * size * 0.045 +
        smoothBass * size * 0.015;

    ctx.arc(
        cx,
        cy,
        centreSize,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = palette.eclipse;
    ctx.fill();
}

// ─────────────────────────────────────────────
// 🎬 MAIN ANIMATION LOOP
// ─────────────────────────────────────────────

function draw() {
    requestAnimationFrame(draw);

    time += 0.016;

    const audioData = getAudioData();

    // Bass is heavily smoothed.
    // This prevents kicks from causing sudden jumps.
    smoothBass +=
        (audioData.bass - smoothBass) * 0.025;

    // Mid reacts faster because it is the main driver.
    smoothMid +=
        (audioData.mid - smoothMid) * 0.10;

    // High reacts moderately.
    smoothHigh +=
        (audioData.high - smoothHigh) * 0.08;

    // Combined energy.
    visualEnergy =
        smoothMid * 0.70 +
        smoothHigh * 0.20 +
        smoothBass * 0.10;

    const W = canvas.width;
    const H = canvas.height;

    drawBackground(W, H);
    drawOpArtShape(
        W / 2,
        H / 2,
        time,
        audioData
    );
}

// Start animation.
draw();

// ─────────────────────────────────────────────
// 🚀 STARTUP
// ─────────────────────────────────────────────

window.addEventListener('load', () => {
    if (typeof trim_start === 'function') {
        trim_start();
    }

    setupAudio();
});

// ─────────────────────────────────────────────
// 🔓 CLICK FALLBACK
// ─────────────────────────────────────────────

document.addEventListener('click', () => {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
        audio.play();
    }
});

// ─────────────────────────────────────────────
// 🔇 MUTE / UNMUTE
// ─────────────────────────────────────────────

const muteButton = document.getElementById('muteButton');

if (muteButton) {
    muteButton.addEventListener('click', (event) => {
        event.stopPropagation();

        audio.muted = !audio.muted;

        muteButton.textContent =
            audio.muted ? 'Unmute' : 'Mute';
    });
}