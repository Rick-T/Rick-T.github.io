const gameGrid = document.getElementById('gameGrid');
const rootSelector = document.getElementById('rootSelector');
const qualitySelector = document.getElementById('qualitySelector');
const playButton = document.getElementById('playButton');
const settingsPanel = document.querySelector('.settings-panel');
let audioContext;

// Hide game grid initially
gameGrid.classList.add('hidden');

// Music Theory Data
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BASE_FREQ = 261.63; // C4

const SCALES = {
    'Major': [0, 2, 4, 5, 7, 9, 11, 12],
    'Minor': [0, 2, 3, 5, 7, 8, 10, 12],
    'Dorian': [0, 2, 3, 5, 7, 9, 10, 12],
    'Phrygian': [0, 1, 3, 5, 7, 8, 10, 12],
    'Lydian': [0, 2, 4, 6, 7, 9, 11, 12],
    'Mixolydian': [0, 2, 4, 5, 7, 9, 10, 12],
    'Locrian': [0, 1, 3, 5, 6, 8, 10, 12]
};

// State
let currentRoot = 'C';
let currentQuality = 'Minor';
let currentGridSize = 16; // Default 4x4
let gameTones = [];

// Game State
let hasFlippedCard = false;
let lockBoard = false;
let firstCard, secondCard;
let matchedPairs = 0;
const totalPairs = 8;
const congratsMessage = document.getElementById('congratsMessage');

function getFrequency(noteIndex, octaveOffset = 0) {
    // A4 is 440Hz. C4 is index 0 relative to our array, but let's calculate from A4 (index 9 in C major scale starting C)
    // Actually simpler: f = f0 * (2^(n/12))
    // C4 is our base.
    return BASE_FREQ * Math.pow(2, (noteIndex + octaveOffset * 12) / 12);
}



// Audio Controller
const AudioController = {
    ctx: null,
    masterGain: null,

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5; // Master volume
            this.masterGain.connect(this.ctx.destination);
        } else if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    playTone(freq, duration = 0.5, type = 'sawtooth', volume = 0.1) {
        if (!this.ctx) this.init();

        const oscillator = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(freq, this.ctx.currentTime);

        // Connect oscillator -> noteGain -> masterGain -> destination
        oscillator.connect(noteGain);
        noteGain.connect(this.masterGain);

        // Envelope
        noteGain.gain.setValueAtTime(volume, this.ctx.currentTime);
        noteGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        oscillator.start();
        oscillator.stop(this.ctx.currentTime + duration);
    }
};

function playWinJingle() {
    const rootIndex = NOTES.indexOf(currentRoot);
    const scaleIntervals = SCALES[currentQuality];

    // Sophisticated Multi-Octave Melody
    const melodySequence = [
        { index: 0, duration: 0.15, vol: 0.2 },
        { index: 1, duration: 0.15, vol: 0.2 },
        { index: 2, duration: 0.15, vol: 0.2 },
        { index: 3, duration: 0.15, vol: 0.2 },
        { index: 4, duration: 0.15, vol: 0.2 },
        { index: 5, duration: 0.15, vol: 0.2 },
        { index: 6, duration: 0.15, vol: 0.2 },
        { index: 7, duration: 0.4, vol: 0.3 }, // Octave
        { index: 9, duration: 0.4, vol: 0.3 }, // 10th (3rd + octave)
        { index: 11, duration: 0.4, vol: 0.3 }, // 12th (5th + octave)
        { index: 14, duration: 0.8, vol: 0.3 }  // 15th (2 octaves)
    ];

    melodySequence.forEach((note, i) => {
        let scaleDegree = note.index % 7;
        let octaveShift = Math.floor(note.index / 7);
        let semitoneOffset = scaleIntervals[scaleDegree];
        let totalSemitones = semitoneOffset + (octaveShift * 12);

        const freq = getFrequency(rootIndex + totalSemitones);

        setTimeout(() => {
            AudioController.playTone(freq, note.duration, 'sine', note.vol);
        }, i * 120);
    });
}

function generateScaleFrequencies(count) {
    const rootIndex = NOTES.indexOf(currentRoot);
    const intervals = SCALES[currentQuality];
    const freqs = [];

    // We need 'count' unique frequencies.
    // We'll span multiple octaves if needed.
    // Scale usually has 7 notes.

    for (let i = 0; i < count; i++) {
        let scaleDegree = i % intervals.length; // 0-6 usually
        let octave = Math.floor(i / intervals.length);

        let semitoneOffset = intervals[scaleDegree];
        let totalSemitones = semitoneOffset + (octave * 12);

        freqs.push(getFrequency(rootIndex + totalSemitones));
    }

    return freqs;
}

function initSelectors() {

    if (!rootSelector) {
        console.error('Root selector element not found!');
        return;
    }
    rootSelector.innerHTML = ''; // Clear existing content

    // Roots
    NOTES.forEach(note => {
        const btn = document.createElement('button');
        btn.textContent = note;
        btn.classList.add('selector-btn');
        if (note === currentRoot) btn.classList.add('active');

        btn.addEventListener('click', () => {
            document.querySelectorAll('#rootSelector .selector-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRoot = note;
            resetGame();
        });

        rootSelector.appendChild(btn);
    });

    if (!qualitySelector) {
        console.error('Quality selector element not found!');
        return;
    }
    qualitySelector.innerHTML = ''; // Clear existing content

    // Qualities
    Object.keys(SCALES).forEach(quality => {
        const btn = document.createElement('button');
        btn.textContent = quality;
        btn.classList.add('selector-btn');
        if (quality === currentQuality) btn.classList.add('active');

        btn.addEventListener('click', () => {
            document.querySelectorAll('#qualitySelector .selector-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentQuality = quality;
            resetGame();
        });

        qualitySelector.appendChild(btn);
    });

    // Grid Size
    const gridBtns = document.querySelectorAll('#gridSelector .selector-btn');
    if (gridBtns.length === 0) {
        console.error('Grid selector buttons not found!');
    }
    gridBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#gridSelector .selector-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentGridSize = parseInt(btn.dataset.size);
            resetGame();
        });
    });
}

function flipCard(card, freq) {
    if (lockBoard) return;
    if (card === firstCard) return;

    card.classList.add('selected');
    AudioController.playTone(freq);

    if (!hasFlippedCard) {
        // First click
        hasFlippedCard = true;
        firstCard = card;
        firstCard.dataset.freq = freq;
        return;
    }

    // Second click
    secondCard = card;
    secondCard.dataset.freq = freq;

    checkForMatch();
}

function checkForMatch() {
    let isMatch = firstCard.dataset.freq === secondCard.dataset.freq;

    isMatch ? disableCards() : unflipCards();
}

function disableCards() {
    firstCard.classList.remove('selected');
    secondCard.classList.remove('selected');

    firstCard.classList.add('matched');
    secondCard.classList.add('matched');

    resetBoard();

    matchedPairs++;
    // Check win condition based on current grid size
    if (matchedPairs === currentGridSize / 2) {
        setTimeout(handleWin, 500);
    }
}

function handleWin() {
    playWinJingle();
    congratsMessage.classList.remove('hidden');
    // Auto-reset removed. Waiting for user interaction.
}

function resetGame() {
    if (!congratsMessage.classList.contains('hidden')) {
        congratsMessage.classList.add('hidden');
    }
    matchedPairs = 0;
    gameGrid.innerHTML = '';

    // Hide game grid and show settings/play button
    gameGrid.classList.add('hidden');
    settingsPanel.classList.remove('hidden');
    playButton.classList.remove('hidden');

    // Update Grid Layout
    let columns = 4;
    if (currentGridSize === 24) columns = 4;
    if (currentGridSize === 36) columns = 6;
    gameGrid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

    // Regenerate frequencies based on current selection and size
    const pairsNeeded = currentGridSize / 2;
    const scaleFreqs = generateScaleFrequencies(pairsNeeded);
    gameTones = shuffle([...scaleFreqs, ...scaleFreqs]);

    generateCards();
}

// Interaction listeners for reset
function handleInteraction() {
    if (!congratsMessage.classList.contains('hidden')) {
        resetGame();
    }
}

document.addEventListener('click', (e) => {
    AudioController.init();
    // Prevent immediate reset if clicking the last card triggered the win
    // But handleWin has a delay? No, handleWin is called via setTimeout.
    // Let's just check if message is visible.
    handleInteraction();
});

document.addEventListener('keydown', () => {
    AudioController.init();
    handleInteraction();
});

function unflipCards() {
    lockBoard = true;

    firstCard.classList.add('error');
    secondCard.classList.add('error');

    setTimeout(() => {
        firstCard.classList.remove('selected', 'error');
        secondCard.classList.remove('selected', 'error');
        resetBoard();
    }, 1000);
}

function resetBoard() {
    [hasFlippedCard, lockBoard] = [false, false];
    [firstCard, secondCard] = [null, null];
}

function generateCards() {
    gameGrid.innerHTML = ''; // Clear existing cards first
    gameTones.forEach(freq => {
        const card = document.createElement('div');
        card.classList.add('card');

        card.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the global click listener immediately
            flipCard(card, freq);
        });

        gameGrid.appendChild(card);
    });
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Play button handler
playButton.addEventListener('click', () => {
    AudioController.init();
    settingsPanel.classList.add('hidden');
    playButton.classList.add('hidden');
    gameGrid.classList.remove('hidden');
});

// Initialization
initSelectors();

// Prepare game but don't show it yet
resetGame();
