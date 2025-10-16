// =======================================================
// 1. CONFIGURATION & STATE
// =======================================================

// IMPORTANT: Your token has been inserted here.
const API_TOKEN = "94K1yepviwtvK1e"; 
const APP_ID = 106984; 

let isRunning = false;
let tickHistory = []; 
let windowSize = 64; 
let currentMarket = 'R_25';
let simulationInterval = null;

// NEW CYCLE CONSTANTS
const PREPARATION_TIME_SEC = 20; // Time before the entry signal appears
const ENTRY_TIME_SEC = 16;       // Time the signal remains active

// State for the new cycle
let predictionCycleInterval = null;
let currentPhase = 'ANALYSIS'; // 'ANALYSIS', 'PREPARATION', 'ENTRY'
let cycleTimer = 0;
let predictedDigit = null; // The digit calculated during the 'ANALYSIS' phase

// Signal threshold: Next most frequent digit must hit this percentage
const SIGNAL_THRESHOLD_PERCENT = 12.5; 

// UI Element References 
const startStopBtn = document.getElementById('startStopBtn');
const marketSelect = document.getElementById('marketSelect');
const ticksInput = document.getElementById('ticksInput');
const windowSizeDisplay = document.getElementById('windowSizeDisplay');
const tickHistoryEl = document.getElementById('tickHistory');
const probabilityTableContainer = document.getElementById('probabilityTableContainer');
const signalDigitEl = document.getElementById('signalDigit');
const signalTextEl = document.getElementById('signalText');
const entrySignalEl = document.getElementById('entrySignal');
const statusMessageEl = document.getElementById('statusMessage');
const currentWindowSizeEl = document.getElementById('currentWindowSize');


// =======================================================
// 2. CORE LOGIC
// =======================================================

/**
 * Starts the main tick stream simulation.
 */
function startStream() {
    if (isRunning) return;
    
    currentMarket = marketSelect.value;
    windowSize = parseInt(ticksInput.value, 10);
    
    setStatus(`Initializing analysis for ${currentMarket}...`, 'var(--text-accent)');
    startStopBtn.disabled = true;

    // 1. Initialize Ticks History
    tickHistory = Array.from({ length: windowSize }, () => Math.floor(Math.random() * 10));
    
    // 2. Start the Tick Stream Simulation (1 tick per second)
    simulationInterval = setInterval(simulateTick, 1000); 
    
    // 3. Start the main prediction cycle timer
    startPredictionCycle();
    
    isRunning = true;
    updateStartStopButton();
    setStatus(`Streaming ticks for ${currentMarket} (Window: ${windowSize} ticks). Cycle: ANALYSIS.`, 'var(--success-color)');
    
    // Initial display update
    analyzeAndDisplay();
}

/**
 * Stops the simulation and resets the cycle.
 */
function stopStream() {
    if (!isRunning) return;
    
    clearInterval(simulationInterval);
    clearInterval(predictionCycleInterval);
    
    simulationInterval = null;
    predictionCycleInterval = null;
    isRunning = false;
    updateStartStopButton();
    setStatus('Analysis Stopped.', 'var(--danger-color)');
    
    // Reset signal display
    signalDigitEl.textContent = '--';
    signalTextEl.textContent = 'Waiting for Data';
    entrySignalEl.textContent = '';
    entrySignalEl.className = 'entry-signal';
}

/**
 * Simulates receiving a new tick, updates history, and triggers analysis.
 */
function simulateTick() {
    const newDigit = Math.floor(Math.random() * 10);
    
    tickHistory.push(newDigit);
    if (tickHistory.length > windowSize) {
        tickHistory.shift();
    }
    
    analyzeAndDisplay();
}

/**
 * Core analysis function: counts digit frequencies and identifies top signals.
 */
function analyzeDigits(ticks) {
    const counts = new Array(10).fill(0);
    ticks.forEach(digit => {
        if (digit >= 0 && digit <= 9) {
            counts[digit]++;
        }
    });

    const frequencies = counts.map((count, digit) => ({
        digit,
        count,
        frequency: (count / ticks.length) * 100
    })).sort((a, b) => b.count - a.count);

    const mostFrequent = frequencies[0];
    const nextMostFrequent = frequencies.length > 1 ? frequencies[1] : frequencies[0];

    return { frequencies, mostFrequent, nextMostFrequent };
}


// --- PREDICTION CYCLE STATE MACHINE ---

function startPredictionCycle() {
    if (predictionCycleInterval) clearInterval(predictionCycleInterval);
    
    currentPhase = 'ANALYSIS';
    cycleTimer = 0;
    
    predictionCycleInterval = setInterval(handleCycleTick, 1000);
}

function handleCycleTick() {
    if (!isRunning) return;

    const { nextMostFrequent } = analyzeDigits(tickHistory);
    const isSignalFound = nextMostFrequent.frequency >= SIGNAL_THRESHOLD_PERCENT;

    cycleTimer++;

    // STATE 1: ANALYSIS (Default State, runs constantly)
    if (currentPhase === 'ANALYSIS') {
        if (isSignalFound) {
            predictedDigit = nextMostFrequent.digit;
            currentPhase = 'PREPARATION';
            cycleTimer = 0; // Reset timer for the new phase
            setStatus(`Signal Found! Starting 20s Preparation for DIGIT ${predictedDigit}.`, 'var(--text-accent)');
        }
        
        // Update display to show current analysis state
        entrySignalEl.textContent = `Next Hottest: ${nextMostFrequent.digit} at ${nextMostFrequent.frequency.toFixed(2)}% (Target > ${SIGNAL_THRESHOLD_PERCENT}%)`;
        entrySignalEl.className = 'entry-signal';
        entrySignalEl.removeAttribute('data-time'); // Ensure timer is hidden
    }

    // STATE 2: PREPARATION (20-second countdown)
    else if (currentPhase === 'PREPARATION') {
        const remaining = PREPARATION_TIME_SEC - cycleTimer;
        
        // Update the text and the data-time attribute for the big number display
        entrySignalEl.textContent = `Next prediction in:`;
        entrySignalEl.setAttribute('data-time', `${remaining}s`);
        entrySignalEl.className = 'entry-signal active countdown';
        
        if (remaining <= 0) {
            currentPhase = 'ENTRY';
            cycleTimer = 0; // Reset timer for the new phase
            entrySignalEl.removeAttribute('data-time'); // Clear timer attribute
            setStatus(`Entry Window OPEN for DIGIT ${predictedDigit}! (16s)`, 'var(--success-color)');
        }
    }

    // STATE 3: ENTRY (16-second entry window)
    else if (currentPhase === 'ENTRY') {
        const remaining = ENTRY_TIME_SEC - cycleTimer;
        entrySignalEl.textContent = `DIGIT ${predictedDigit} ENTRY NOW! (${remaining}s remaining)`;
        entrySignalEl.className = 'entry-signal active final-signal';
        entrySignalEl.removeAttribute('data-time'); // Ensure timer is hidden
        
        if (remaining <= 0) {
            currentPhase = 'ANALYSIS';
            cycleTimer = 0; // Reset timer for the new phase
            predictedDigit = null; // Clear the previous prediction
            setStatus(`Entry Window Closed. Back to ANALYSIS.`, 'var(--text-secondary)');
            // Re-run analyzeAndDisplay to refresh the entry signal
            analyzeAndDisplay(); 
        }
    }
}


/**
 * Updates all UI components (history, table, and signals) with current analysis.
 * Note: The main entry signal (entrySignalEl) is now managed by handleCycleTick().
 */
function analyzeAndDisplay() {
    if (tickHistory.length === 0) {
        signalTextEl.textContent = 'Gathering data...';
        return;
    }

    const { frequencies, mostFrequent, nextMostFrequent } = analyzeDigits(tickHistory);
    
    // --- 1. Update Signal Card ---
    signalDigitEl.textContent = mostFrequent.digit;
    signalTextEl.textContent = `Most Frequent: ${mostFrequent.frequency.toFixed(2)}%`;
    
    // --- 2. Update History ---
    tickHistoryEl.innerHTML = tickHistory.map(d => 
        `<span class="tick-digit">${d}</span>`
    ).join('');
    
    tickHistoryEl.scrollLeft = tickHistoryEl.scrollWidth;

    // --- 3. Update Table ---
    currentWindowSizeEl.textContent = tickHistory.length;
    renderProbabilityTable(frequencies, mostFrequent.digit);
}

/**
 * Generates and injects the HTML table for digit probabilities.
 */
function renderProbabilityTable(frequencies, mostFrequentDigit) {
    let html = '<table class="probability-table">';
    html += '<thead><tr><th>Digit</th><th>Count</th><th>Frequency (%)</th><th>Status</th></tr></thead>';
    html += '<tbody>';

    frequencies.forEach(f => {
        const isMostFrequent = f.digit === mostFrequentDigit;
        const status = isMostFrequent ? 'Most Frequent' : (f.frequency >= SIGNAL_THRESHOLD_PERCENT ? 'Strong Signal' : 'Normal');
        const rowClass = isMostFrequent ? 'highlight-digit' : '';
        
        html += `<tr class="${rowClass}">
                    <td>${f.digit}</td>
                    <td>${f.count}</td>
                    <td style="color: ${f.frequency > 10.0 ? 'var(--success-color)' : (f.frequency < 10.0 ? 'var(--danger-color)' : 'var(--text-light)')}">${f.frequency.toFixed(2)}%</td>
                    <td>${status}</td>
                </tr>`;
    });

    html += '</tbody></table>';
    probabilityTableContainer.innerHTML = html;
}

// =======================================================
// 3. UTILITY & EVENT HANDLERS
// =======================================================

function setStatus(message, color) {
    statusMessageEl.style.display = 'block';
    statusMessageEl.textContent = message;
    statusMessageEl.style.backgroundColor = color ? `${color}40` : 'rgba(255, 255, 255, 0.1)';
}

function updateStartStopButton() {
    if (isRunning) {
        startStopBtn.textContent = 'Stop Analysis';
        startStopBtn.classList.add('stop');
        startStopBtn.disabled = false;
    } else {
        startStopBtn.textContent = 'Start Analysis';
        startStopBtn.classList.remove('stop');
        startStopBtn.disabled = false;
    }
}

// Initial setup and event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Set initial display values
    windowSizeDisplay.textContent = ticksInput.value;
    updateStartStopButton();
    
    // Listener for window size changes
    ticksInput.addEventListener('input', (e) => {
        windowSize = parseInt(e.target.value, 10);
        windowSizeDisplay.textContent = windowSize;
        if (isRunning) {
            // Trim history if the new size is smaller
            if (tickHistory.length > windowSize) {
                tickHistory = tickHistory.slice(tickHistory.length - windowSize);
            }
            analyzeAndDisplay();
        }
    });

    // Listener for Start/Stop button
    startStopBtn.addEventListener('click', () => {
        if (isRunning) {
            stopStream();
        } else {
            startStream();
        }
    });
    
    // Listener for market selection change
    marketSelect.addEventListener('change', () => {
        // Stop and inform user to restart if currently running
        if (isRunning) {
            stopStream();
            setStatus(`Market changed to ${marketSelect.value}. Press 'Start Analysis' to begin streaming.`, 'var(--text-secondary)');
        }
    });

    // Initial UI update for blank state
    const initialFrequencies = Array.from({ length: 10 }, (_, i) => ({ 
        digit: i, 
        count: 0, 
        frequency: 0.0 
    })).sort((a, b) => a.digit - b.digit); 
    
    renderProbabilityTable(initialFrequencies, -1);
    setStatus('Ready. Select options and press Start Analysis.', 'rgba(255, 255, 255, 0.1)');
});
