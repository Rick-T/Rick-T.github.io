const gameGrid = document.getElementById('gameGrid');
const rootSelector = document.getElementById('rootSelector');
const qualitySelector = document.getElementById('qualitySelector');
const waveformSelector = document.getElementById('waveformSelector');
const playButton = document.getElementById('playButton');
const wizardContainer = document.querySelector('.wizard-container');
const wizardBackBtn = document.getElementById('wizardBack');
const wizardNextBtn = document.getElementById('wizardNext');

// Wizard state
let currentWizardStep = 1;
const totalWizardSteps = 4;

// Hide game grid initially
gameGrid.classList.add('hidden');

// Music Theory Data
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BASE_FREQ = 261.63; // C4
const INTERVAL_NAMES = {
    0: 'Unison', 1: 'Minor 2nd', 2: 'Major 2nd', 3: 'Minor 3rd', 4: 'Major 3rd',
    5: 'Perfect 4th', 6: 'Tritone', 7: 'Perfect 5th', 8: 'Minor 6th', 9: 'Major 6th',
    10: 'Minor 7th', 11: 'Major 7th', 12: 'Octave', 13: 'Minor 9th', 14: 'Major 9th', 15: '2 Octaves'
};

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
let currentWaveform = 'sawtooth';
let currentGameMode = 'match'; // 'match' or 'interval'
let currentGridSize = 16; // Default 4x4
let gameTones = [];

// Game State
let hasFlippedCard = false;
let lockBoard = false;
let firstCard, secondCard;
let matchedPairs = 0;
const congratsMessage = document.getElementById('congratsMessage');

// WeakMap to store tone data for each card
const cardToneData = new WeakMap();

// Constants
const ERROR_ANIMATION_DURATION = 300;

function getFrequency(noteIndex, octaveOffset = 0) {
    return BASE_FREQ * Math.pow(2, (noteIndex + octaveOffset * 12) / 12);
}

// Helper function to play sound based on tone data type
function playSound(toneData) {
    const { type, data } = toneData;

    switch (type) {
        case 'tone':
            AudioController.playTone(data);
            break;
        case 'sequence':
            AudioController.playSequence(data);
            break;
        case 'chord':
            AudioController.playChord(data);
            break;
    }
}



// Audio Controller
const AudioController = {
    ctx: null,
    masterGain: null,
    isPlaying: false,

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

    playTone(freq, duration = 0.5, type = currentWaveform, volume = 0.1, startTime = null) {
        if (!this.ctx) this.init();

        // Only set isPlaying if this is an immediate playback (not scheduled far in future)
        // But for simplicity, let's just set it.
        if (startTime === null || startTime <= this.ctx.currentTime + 0.1) {
            this.isPlaying = true;
            setTimeout(() => { this.isPlaying = false; }, duration * 1000);
        }

        const start = startTime !== null ? startTime : this.ctx.currentTime;
        const oscillator = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(freq, start);

        // Connect oscillator -> noteGain -> masterGain -> destination
        oscillator.connect(noteGain);
        noteGain.connect(this.masterGain);

        // Adjust volume based on waveform to normalize perceived loudness
        const waveformGainMultiplier = {
            'sine': 1.0,
            'triangle': 1.0,
            'sawtooth': 0.5,  // Sawtooth is much louder due to harmonics
            'square': 0.5     // Square is also louder
        };
        const adjustedVolume = volume * (waveformGainMultiplier[type] || 1.0);

        // Envelope
        noteGain.gain.setValueAtTime(adjustedVolume, start);
        noteGain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        oscillator.start(start);
        oscillator.stop(start + duration);
    },

    playChord(freqs) {
        if (!this.ctx) this.init();
        this.isPlaying = true;
        const duration = 0.8;
        freqs.forEach(f => this.playTone(f, duration, currentWaveform, 0.1));
        setTimeout(() => { this.isPlaying = false; }, duration * 1000);
    },

    playSequence(freqs) {
        if (!this.ctx) this.init();
        this.isPlaying = true;
        const now = this.ctx.currentTime;
        const noteDuration = 0.5;
        const gap = 0.4;

        freqs.forEach((f, i) => {
            this.playTone(f, noteDuration, currentWaveform, 0.1, now + i * gap);
        });

        const totalDuration = (freqs.length - 1) * gap + noteDuration;
        setTimeout(() => { this.isPlaying = false; }, totalDuration * 1000);
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
    const data = [];

    for (let i = 0; i < count; i++) {
        let scaleDegree = i % intervals.length; // 0-6 usually
        let octave = Math.floor(i / intervals.length);

        let semitoneOffset = intervals[scaleDegree];
        let totalSemitones = semitoneOffset + (octave * 12);

        const freq = getFrequency(rootIndex + totalSemitones);

        // Calculate Label
        // rootIndex + totalSemitones is semitones from C4
        // Note index = (rootIndex + totalSemitones) % 12
        // Octave = 4 + Math.floor((rootIndex + totalSemitones) / 12)
        const absSemitones = rootIndex + totalSemitones;
        const noteName = NOTES[absSemitones % 12];
        const noteOctave = 4 + Math.floor(absSemitones / 12);
        const label = `${noteName}${noteOctave}`;

        data.push({ freq, label });
    }

    return data;
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
        btn.classList.add('wizard-option');
        if (note === currentRoot) btn.classList.add('active');

        btn.addEventListener('click', () => {
            document.querySelectorAll('#rootSelector .wizard-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRoot = note;
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
        btn.classList.add('wizard-option');
        if (quality === currentQuality) btn.classList.add('active');

        btn.addEventListener('click', () => {
            document.querySelectorAll('#qualitySelector .wizard-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentQuality = quality;
        });

        qualitySelector.appendChild(btn);
    });

    if (!waveformSelector) {
        console.error('Waveform selector element not found!');
        return;
    }
    waveformSelector.innerHTML = ''; // Clear existing content

    // Waveforms
    const waveforms = [
        { value: 'sawtooth', label: 'Sawtooth', desc: 'Bright, rich harmonics' },
        { value: 'sine', label: 'Sine', desc: 'Pure, smooth tone' },
        { value: 'square', label: 'Square', desc: 'Hollow, clarinet-like' },
        { value: 'triangle', label: 'Triangle', desc: 'Soft, flute-like' }
    ];

    waveforms.forEach(wave => {
        const btn = document.createElement('button');
        btn.classList.add('wizard-option');
        if (wave.value === currentWaveform) btn.classList.add('active');

        const title = document.createElement('span');
        title.classList.add('option-title');
        title.textContent = wave.label;

        const desc = document.createElement('span');
        desc.classList.add('option-desc');
        desc.textContent = wave.desc;

        btn.appendChild(title);
        btn.appendChild(desc);

        btn.addEventListener('click', () => {
            AudioController.init();
            document.querySelectorAll('#waveformSelector .wizard-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentWaveform = wave.value;

            // Play preview sound based on mode
            playWaveformPreview();
        });

        waveformSelector.appendChild(btn);
    });
}

function playWaveformPreview() {
    const rootIndex = NOTES.indexOf(currentRoot);
    const rootFreq = BASE_FREQ * Math.pow(2, rootIndex / 12);

    if (currentGameMode === 'match') {
        // Play single root note
        AudioController.playTone(rootFreq);
    } else if (currentGameMode === 'interval') {
        // Play interval as a chord (root + perfect fifth)
        const intervals = SCALES[currentQuality];
        const fifthSemitones = intervals[4]; // Perfect fifth is usually the 5th note
        const secondFreq = rootFreq * Math.pow(2, fifthSemitones / 12);
        AudioController.playChord([rootFreq, secondFreq]);
    } else if (currentGameMode === 'triad') {
        // Build triad from selected scale (root, 3rd, 5th scale degrees)
        const scaleIntervals = SCALES[currentQuality];
        const triadSemitones = [0, scaleIntervals[2], scaleIntervals[4]]; // 1st, 3rd, 5th degrees
        const chordFreqs = triadSemitones.map(semitones => rootFreq * Math.pow(2, semitones / 12));
        AudioController.playChord(chordFreqs);
    } else if (currentGameMode === 'jazz') {
        // Build 7th chord from selected scale (root, 3rd, 5th, 7th scale degrees)
        const scaleIntervals = SCALES[currentQuality];
        const seventhSemitones = [0, scaleIntervals[2], scaleIntervals[4], scaleIntervals[6]]; // 1st, 3rd, 5th, 7th degrees
        const chordFreqs = seventhSemitones.map(semitones => rootFreq * Math.pow(2, semitones / 12));
        AudioController.playChord(chordFreqs);
    }
}


function generateIntervalPairs(count) {
    const rootIndex = NOTES.indexOf(currentRoot);
    const intervals = SCALES[currentQuality];
    const pairs = [];

    for (let i = 0; i < count; i++) {
        // Use scale degrees 1..7 (skip root unison for more interesting intervals, or include it?)
        // Let's iterate through the scale.
        let degreeIndex = (i % (intervals.length - 1)) + 1; // 1 to length-1
        let octave = Math.floor(i / (intervals.length - 1));

        let semitoneOffset = intervals[degreeIndex];
        let totalSemitones = semitoneOffset + (octave * 12);

        const rootFreq = getFrequency(rootIndex);
        const intervalFreq = getFrequency(rootIndex + totalSemitones);

        const id = `interval-${i}`;
        const notes = [rootFreq, intervalFreq];

        // Label
        // semitoneOffset is the interval from root (if octave is 0)
        // If octave > 0, we add 12 * octave to semitoneOffset
        const intervalSemitones = semitoneOffset + (octave * 12);
        const label = INTERVAL_NAMES[intervalSemitones] || 'Interval';

        pairs.push({ id: id, type: 'sequence', data: notes, label: label });
        pairs.push({ id: id, type: 'chord', data: notes, label: label });
    }
    return pairs;
}

function flipCard(card, toneData) {
    if (lockBoard) return;

    // If clicking a matched card, replay sound
    if (card.classList.contains('matched')) {
        if (AudioController.isPlaying) return;
        const storedData = cardToneData.get(card);
        if (!storedData) return;
        playSound(storedData);
        return;
    }

    // If clicking the same card that is already selected (yellow), replay sound
    if (card.classList.contains('selected')) {
        if (AudioController.isPlaying) return;
        playSound(toneData);
        return;
    }

    if (card === firstCard) return;
    if (AudioController.isPlaying) return;

    // Enforce cross-grid selection in Interval, Triad, and Jazz Modes
    if (['interval', 'triad', 'jazz'].includes(currentGameMode) && hasFlippedCard) {
        if (firstCard.dataset.type === toneData.type) {
            card.classList.add('error');
            setTimeout(() => card.classList.remove('error'), ERROR_ANIMATION_DURATION);
            return;
        }
    }

    card.classList.add('selected');
    playSound(toneData);

    if (!hasFlippedCard) {
        // First click
        hasFlippedCard = true;
        firstCard = card;
        // Store the ID for matching
        firstCard.dataset.matchId = toneData.id;
        // Store label for display later
        firstCard.dataset.label = toneData.label;
        // Store type for validation
        firstCard.dataset.type = toneData.type;
        return;
    }

    // Second click
    secondCard = card;
    secondCard.dataset.matchId = toneData.id;
    secondCard.dataset.label = toneData.label;

    checkForMatch();
}

function checkForMatch() {
    let isMatch = firstCard.dataset.matchId === secondCard.dataset.matchId;

    isMatch ? disableCards() : unflipCards();
}

function disableCards() {
    firstCard.classList.remove('selected');
    secondCard.classList.remove('selected');

    firstCard.classList.add('matched');
    secondCard.classList.add('matched');

    // Show label
    firstCard.textContent = firstCard.dataset.label;
    secondCard.textContent = secondCard.dataset.label;

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

// Interaction listeners for reset
function handleInteraction() {
    if (!congratsMessage.classList.contains('hidden')) {
        resetGame();
    }
}

document.addEventListener('click', (e) => {
    AudioController.init();
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

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

const intervalContainer = document.getElementById('intervalContainer');
const sequenceGrid = document.getElementById('sequenceGrid');
const chordGrid = document.getElementById('chordGrid');
const appSubtitle = document.getElementById('appSubtitle');
const gameSubtitle = document.getElementById('gameSubtitle');
const settingsDescription = document.getElementById('settingsDescription');

const currentScaleDisplay = document.getElementById('currentScaleDisplay');

const CHORD_TYPES = {
    'triad': [
        { name: 'Major', intervals: [0, 4, 7] },
        { name: 'Minor', intervals: [0, 3, 7] },
        { name: 'Diminished', intervals: [0, 3, 6] },
        { name: 'Augmented', intervals: [0, 4, 8] },
        { name: 'Sus2', intervals: [0, 2, 7] },
        { name: 'Sus4', intervals: [0, 5, 7] }
    ],
    'jazz': [
        { name: 'Maj7', intervals: [0, 4, 7, 11] },
        { name: 'min7', intervals: [0, 3, 7, 10] },
        { name: 'Dom7', intervals: [0, 4, 7, 10] },
        { name: 'min7b5', intervals: [0, 3, 6, 10] },
        { name: 'dim7', intervals: [0, 3, 6, 9] },
        { name: '7sus4', intervals: [0, 5, 7, 10] },
        { name: '7sus2', intervals: [0, 2, 7, 10] },
        { name: 'Maj7sus4', intervals: [0, 5, 7, 11] },
        { name: 'Maj7sus2', intervals: [0, 2, 7, 11] }
    ]
};

const MODE_DESCRIPTIONS = {
    'match': 'Match pairs of identical tones to clear the board.',
    'interval': 'Match a sequence of notes to its corresponding harmonic interval.',
    'triad': 'Match a sequence of notes to its corresponding triad chord.',
    'jazz': 'Match a sequence of notes to its corresponding 7th or suspended chord.'
};

function updateDescriptions() {
    const desc = MODE_DESCRIPTIONS[currentGameMode];
    if (settingsDescription) settingsDescription.textContent = desc;
    if (gameSubtitle) gameSubtitle.textContent = desc;
}

// Play button handler
playButton.addEventListener('click', () => {
    AudioController.init();
    wizardContainer.classList.add('hidden');

    // Toggle subtitles
    appSubtitle.classList.add('hidden');
    gameSubtitle.classList.remove('hidden');

    // Show Scale Display for Match mode
    if (currentScaleDisplay && currentGameMode === 'match') {
        currentScaleDisplay.textContent = `${currentRoot} ${currentQuality}`;
        currentScaleDisplay.classList.remove('hidden');
    }

    // Generate cards for the game
    generateGameCards();

    if (currentGameMode === 'match') {
        gameGrid.classList.remove('hidden');
        intervalContainer.classList.add('hidden');
    } else {
        // Interval, Triad, Jazz all use the split container
        gameGrid.classList.add('hidden');
        intervalContainer.classList.remove('hidden');
    }
});

function getChordName(intervals) {
    // Intervals are semitones from the chord root: [0, 3, 7], etc.
    const third = intervals[1];
    const fifth = intervals[2];
    const seventh = intervals[3]; // Undefined for triads

    if (seventh === undefined) {
        // Triads
        if (third === 4 && fifth === 7) return 'Maj';
        if (third === 3 && fifth === 7) return 'min';
        if (third === 3 && fifth === 6) return 'dim';
        if (third === 4 && fifth === 8) return 'Aug';
        if (third === 2 && fifth === 7) return 'sus2';
        if (third === 5 && fifth === 7) return 'sus4';
        // Fallback
        return '';
    } else {
        // 7ths
        if (third === 4 && fifth === 7 && seventh === 11) return 'Maj7';
        if (third === 3 && fifth === 7 && seventh === 10) return 'min7';
        if (third === 4 && fifth === 7 && seventh === 10) return '7';
        if (third === 3 && fifth === 6 && seventh === 10) return 'min7b5'; // Half-dim
        if (third === 3 && fifth === 6 && seventh === 9) return 'dim7';
        if (third === 3 && fifth === 7 && seventh === 11) return 'minMaj7';
        if (third === 3 && fifth === 7 && seventh === 11) return 'minMaj7';
        if (third === 5 && fifth === 7 && seventh === 10) return '7sus4';
        if (third === 2 && fifth === 7 && seventh === 10) return '7sus2';
        if (third === 5 && fifth === 7 && seventh === 11) return 'Maj7sus4';
        if (third === 2 && fifth === 7 && seventh === 11) return 'Maj7sus2';
        return '7';
    }
}

function generateChordPairs(count, mode) {
    const rootIndex = NOTES.indexOf(currentRoot);
    const scaleIntervals = SCALES[currentQuality]; // e.g. [0, 2, 4, 5, 7, 9, 11, 12]
    const pairs = [];
    const usedChordSignatures = new Set(); // Track used chord voicings to prevent duplicates

    // We have 7 diatonic chords usually (scaleIntervals length is 8 including octave)
    const numDegrees = scaleIntervals.length - 1;

    let attempts = 0;
    const maxAttempts = count * 10; // Prevent infinite loop

    while (pairs.length < count * 2 && attempts < maxAttempts) {
        attempts++;

        const i = Math.floor(pairs.length / 2);

        // Cycle through scale degrees: 0, 1, 2...
        // If count > 7, we wrap around (effectively next octave or just repeat)
        // User said "Don't shift the octave", so maybe just repeat the chords?
        // But for a memory game, identical pairs are confusing if they are not THE match.
        // But here we are generating PAIRS. So (Card A, Card B) is one pair.
        // If we have 8 pairs, we need 8 distinct chords ideally.
        // Diatonic scales have 7. The 8th could be the octave of the tonic (I).

        let degree = i % numDegrees;
        let octaveShift = Math.floor(i / numDegrees); // Only shift if we run out of degrees

        // Construct the chord from scale degrees
        // Triad: degree, degree+2, degree+4
        // 7th: degree, degree+2, degree+4, degree+6

        const indices = mode === 'triad'
            ? (allowSuspended && Math.random() > 0.6
                ? (Math.random() > 0.5 ? [0, 1, 4] : [0, 3, 4]) // sus2 or sus4
                : [0, 2, 4]) // Normal triad
            : (allowSuspended && Math.random() > 0.5
                ? (Math.random() > 0.5 ? [0, 1, 4, 6] : [0, 3, 4, 6]) // 7sus2 or 7sus4
                : [0, 2, 4, 6]); // Normal 7th

        let chordNotes = [];
        const chordIntervals = []; // To determine quality

        // Base pitch for this chord's root
        // We need to handle wrapping around the scale array
        // scaleIntervals[degree] is semitones from Scale Root

        const rootSemitone = scaleIntervals[degree];

        indices.forEach(offset => {
            let noteDegree = degree + offset;
            let noteOctave = octaveShift + Math.floor(noteDegree / numDegrees);
            let wrappedDegree = noteDegree % numDegrees;

            let semitoneInScale = scaleIntervals[wrappedDegree];
            let totalSemitonesFromScaleRoot = semitoneInScale + (noteOctave * 12);

            // Calculate interval relative to the chord root for naming
            let intervalFromChordRoot = totalSemitonesFromScaleRoot - (rootSemitone + (octaveShift * 12));
            chordIntervals.push(intervalFromChordRoot);

            // Absolute frequency
            // Scale Root is 'rootIndex' relative to C4
            // totalSemitonesFromScaleRoot is offset from that
            const absIndex = rootIndex + totalSemitonesFromScaleRoot;
            chordNotes.push(getFrequency(absIndex));
        });

        // Determine Label
        // Note Name of the chord root
        const absRootIndex = rootIndex + rootSemitone + (octaveShift * 12);
        const noteName = NOTES[absRootIndex % 12];
        const quality = getChordName(chordIntervals);
        let label = `${noteName}${quality}`;

        // Inversions Logic
        if (allowInversions) {
            // Randomly invert: 0 = root pos, 1 = 1st inv, 2 = 2nd inv, etc.
            const numInversions = chordNotes.length;
            const inversion = Math.floor(Math.random() * numInversions);

            if (inversion > 0) {
                // For inversions, we want to shift the upper notes DOWN an octave
                // 1st inversion of [C, E, G]: E should be in bass
                // Take the first 'inversion' notes (stay at current pitch)
                // Take the remaining notes and shift them DOWN an octave
                // Result: [E, G, C_low] - but this puts C in bass, not E!

                // Actually, the correct way:
                // 1st inv: [E, G, C] where E is lowest
                // We need: remainingNotes at original pitch, first notes shifted DOWN
                // [C, E, G] -> [E, G] stay, [C] goes down -> but we want [E, G, C_low]
                // That's still wrong!

                // Let me think differently:
                // [C4, E4, G4] in root position
                // 1st inversion should be [E3, G3, C4] (E in bass, everything shifted down)
                // So we shift the LAST (length - inversion) notes down

                const notesToKeep = chordNotes.slice(0, inversion); // First 'inversion' notes stay
                const notesToShift = chordNotes.slice(inversion); // Rest shift down

                // Shift down an octave (freq / 2)
                const shiftedNotes = notesToShift.map(f => f / 2);

                // Put shifted notes first (they're now lower), then the kept notes
                chordNotes = [...shiftedNotes, ...notesToKeep];

                // Update Label with bass note
                const bassFreq = chordNotes[0];
                const semitonesFromC4 = Math.round(12 * Math.log2(bassFreq / BASE_FREQ));
                const bassNoteName = NOTES[(semitonesFromC4 + 12000) % 12];

                label += ` / ${bassNoteName}`;
            }
        }

        // Create a signature for this chord (sorted note classes, octave-independent)
        const chordSignature = chordNotes
            .map(freq => {
                const semitones = Math.round(12 * Math.log2(freq / BASE_FREQ));
                return semitones % 12; // Note class only
            })
            .sort((a, b) => a - b)
            .join(',');

        // Check if we've already used this chord voicing
        if (usedChordSignatures.has(chordSignature)) {
            continue; // Skip this duplicate
        }

        usedChordSignatures.add(chordSignature);

        const id = `${mode}-${i}`;

        pairs.push({ id: id, type: 'sequence', data: chordNotes, label: label });
        pairs.push({ id: id, type: 'chord', data: chordNotes, label: label });
    }

    return pairs;
}

function generateGameCards() {
    // Clear all grids
    gameGrid.innerHTML = '';
    sequenceGrid.innerHTML = '';
    chordGrid.innerHTML = '';

    // Update Grid Layout
    let columns = 4;
    if (currentGridSize === 24) columns = 4;
    if (currentGridSize === 36) columns = 6;

    gameGrid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    sequenceGrid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    chordGrid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

    // Regenerate frequencies based on current selection and size
    const pairsNeeded = currentGridSize / 2;

    if (currentGameMode === 'match') {
        const scaleData = generateScaleFrequencies(pairsNeeded);
        const cardObjects = scaleData.map(item => ({ id: item.freq, type: 'tone', data: item.freq, label: item.label }));
        gameTones = shuffle([...cardObjects, ...cardObjects]); // Duplicate for pairs
        generateCards(gameGrid, gameTones);
    } else if (currentGameMode === 'interval') {
        const pairs = generateIntervalPairs(pairsNeeded);
        const sequences = shuffle(pairs.filter(p => p.type === 'sequence'));
        const chords = shuffle(pairs.filter(p => p.type === 'chord'));

        generateCards(sequenceGrid, sequences);
        generateCards(chordGrid, chords);
    } else {
        // Triad or Jazz
        const pairs = generateChordPairs(pairsNeeded, currentGameMode);
        const sequences = shuffle(pairs.filter(p => p.type === 'sequence'));
        const chords = shuffle(pairs.filter(p => p.type === 'chord'));

        generateCards(sequenceGrid, sequences);
        generateCards(chordGrid, chords);
    }
}

function resetGame() {
    if (!congratsMessage.classList.contains('hidden')) {
        congratsMessage.classList.add('hidden');
    }
    matchedPairs = 0;

    // Update descriptions based on current mode
    updateDescriptions();

    // Hide game grids and show wizard
    gameGrid.classList.add('hidden');
    intervalContainer.classList.add('hidden');
    wizardContainer.classList.remove('hidden');

    // Reset wizard to step 1
    updateWizardStep(1);

    // Reset subtitles
    appSubtitle.classList.remove('hidden');
    gameSubtitle.classList.add('hidden');

    if (currentScaleDisplay) {
        currentScaleDisplay.classList.add('hidden');
    }
}

function generateCards(container, tones) {
    container.innerHTML = ''; // Clear existing cards first
    tones.forEach(toneData => {
        const card = document.createElement('div');
        card.classList.add('card');

        // Store label and type in dataset
        card.dataset.label = toneData.label;
        card.dataset.type = toneData.type;

        // Store the complete toneData in WeakMap
        cardToneData.set(card, toneData);

        card.addEventListener('click', (e) => {
            e.stopPropagation();
            flipCard(card, toneData);
        });

        container.appendChild(card);
    });
}

// Inversions Checkbox
const inversionsCheckbox = document.getElementById('inversionsCheckbox');
let allowInversions = false;

if (inversionsCheckbox) {
    inversionsCheckbox.addEventListener('change', (e) => {
        allowInversions = e.target.checked;
    });
}

// Suspended Checkbox
const susCheckbox = document.getElementById('susCheckbox');
let allowSuspended = false;

if (susCheckbox) {
    susCheckbox.addEventListener('change', (e) => {
        allowSuspended = e.target.checked;
    });
}

// Wizard Navigation
function updateWizardStep(step) {
    currentWizardStep = step;

    // Update progress indicators
    document.querySelectorAll('.progress-step').forEach((el, index) => {
        const stepNum = index + 1;
        el.classList.remove('active', 'completed');
        if (stepNum < currentWizardStep) {
            el.classList.add('completed');
        } else if (stepNum === currentWizardStep) {
            el.classList.add('active');
        }
    });

    // Update step visibility
    document.querySelectorAll('.wizard-step').forEach((el) => {
        el.classList.remove('active');
        if (parseInt(el.dataset.step) === currentWizardStep) {
            el.classList.add('active');
        }
    });

    // Update navigation buttons
    wizardBackBtn.disabled = currentWizardStep === 1;

    if (currentWizardStep === totalWizardSteps) {
        wizardNextBtn.classList.add('hidden');
        playButton.classList.remove('hidden');
    } else {
        wizardNextBtn.classList.remove('hidden');
        playButton.classList.add('hidden');
    }


    // Show/hide inversions checkbox based on mode
    const inversionsContainer = document.getElementById('inversionsContainer');
    if (inversionsContainer) {
        if (currentGameMode === 'match') {
            inversionsContainer.classList.add('hidden');
        } else {
            inversionsContainer.classList.remove('hidden');
        }
    }


    // Hide step 2 (Scale) for Intervals mode
    if (currentGameMode === 'interval' && currentWizardStep === 2) {
        // Skip to next step
        updateWizardStep(3);
        return;
    }
}

function goToNextStep() {
    if (currentWizardStep < totalWizardSteps) {
        // Skip scale step for Intervals mode
        if (currentWizardStep === 1 && currentGameMode === 'interval') {
            updateWizardStep(3);
        } else {
            updateWizardStep(currentWizardStep + 1);
        }
    }
}

function goToPreviousStep() {
    if (currentWizardStep > 1) {
        // Skip scale step for Intervals mode when going back
        if (currentWizardStep === 3 && currentGameMode === 'interval') {
            updateWizardStep(1);
        } else {
            updateWizardStep(currentWizardStep - 1);
        }
    }
}

// Wizard button event listeners
if (wizardNextBtn) {
    wizardNextBtn.addEventListener('click', goToNextStep);
}

if (wizardBackBtn) {
    wizardBackBtn.addEventListener('click', goToPreviousStep);
}

// Update mode selector to use wizard-option class
const modeButtons = document.querySelectorAll('#modeSelector .wizard-option');
modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentGameMode = btn.dataset.mode;

        // Update inversions visibility when mode changes
        const inversionsContainer = document.getElementById('inversionsContainer');
        if (inversionsContainer) {
            if (currentGameMode === 'match') {
                inversionsContainer.classList.add('hidden');
            } else {
                inversionsContainer.classList.remove('hidden');
            }
        }
    });
});

// Update grid selector to use wizard-option class
const gridButtons = document.querySelectorAll('#gridSelector .wizard-option');
gridButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        gridButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentGridSize = parseInt(btn.dataset.size);
    });
});

// Initialization
initSelectors();

// Hide inversions checkbox for Match mode on page load
const inversionsContainer = document.getElementById('inversionsContainer');
if (inversionsContainer && currentGameMode === 'match') {
    inversionsContainer.classList.add('hidden');
}

// Prepare game but don't show it yet
resetGame();
