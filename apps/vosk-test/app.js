const micBtn = document.getElementById('micBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const transcriptEl = document.getElementById('transcript');
const partialEl = document.getElementById('partial');
const welcomeText = document.getElementById('welcomeText');
const transcriptContainer = document.querySelector('.transcript-container');

let model;
let recognizer;
let mediaStream;
let audioContext;
let processorNode;
let sourceNode;
let isRecording = false;

function getModelCandidates() {
    const fromPage = new URL('./model.tar.gz', window.location.href).toString();
    const fromAppRoot = new URL('/apps/vosk-test/model.tar.gz', window.location.origin).toString();
    const fromRoot = new URL('/vosk-test/model.tar.gz', window.location.origin).toString();

    return [...new Set([fromPage, fromAppRoot, fromRoot])];
}

async function loadModelWithFallback() {
    let lastError;

    for (const modelUrl of getModelCandidates()) {
        try {
            setStatus('loading', `Loading model from ${new URL(modelUrl).pathname}...`);
            return await Vosk.createModel(modelUrl);
        } catch (err) {
            lastError = err;
            console.warn(`Model load failed for ${modelUrl}:`, err);
        }
    }

    throw lastError || new Error('Unable to load Vosk model from known locations');
}

// Format status
function setStatus(status, text) {
    statusDot.className = `dot ${status}`;
    statusText.textContent = text;
}

async function initVosk() {
    try {
        if (!window.Vosk || typeof Vosk.createModel !== 'function') {
            throw new Error('Vosk library not loaded');
        }

        setStatus('loading', 'Loading Model (may take a moment)...');
        model = await loadModelWithFallback();
        
        // initialize recognizer with proper sample rate
        recognizer = new model.KaldiRecognizer(16000);
        
        recognizer.on("result", (message) => {
            const result = message.result;
            if (result && result.text) {
                transcriptEl.textContent += (transcriptEl.textContent ? " " : "") + result.text;
                partialEl.textContent = ""; // clear partial text
            }
        });

        recognizer.on("partialresult", (message) => {
            const result = message.result;
            if (result && result.partial) {
                partialEl.textContent = result.partial;
            }
        });

        setStatus('ready', 'Model Ready');
        micBtn.disabled = false;
    } catch (err) {
        console.error("Failed to load model:", err);
        setStatus('error', 'Failed to load model. Check console.');
    }
}

async function startRecording() {
    if (!recognizer) {
        setStatus('error', 'Model is not ready yet');
        return;
    }

    transcriptContainer.classList.add('active');
    
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                channelCount: 1,
                sampleRate: 16000
            }
        });

        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        sourceNode = audioContext.createMediaStreamSource(mediaStream);
        processorNode = audioContext.createScriptProcessor(4096, 1, 1);

        processorNode.onaudioprocess = (event) => {
            try {
                if (isRecording) {
                    recognizer.acceptWaveform(event.inputBuffer);
                }
            } catch (e) {
                console.error("Audio processing error:", e);
            }
        };

        sourceNode.connect(processorNode);
        processorNode.connect(audioContext.destination);
        
        isRecording = true;
        micBtn.classList.add('active');
        setStatus('recording', 'Recording...');
    } catch (err) {
        console.error("Microphone access denied:", err);
        setStatus('error', 'Microphone access denied');
    }
}

function stopRecording() {
    isRecording = false;
    micBtn.classList.remove('active');
    setStatus('ready', 'Model Ready (Paused)');
    
    if (processorNode) {
        processorNode.disconnect();
        processorNode = null;
    }
    if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    // Play text-to-speech confirmation
    const utterance = new SpeechSynthesisUtterance("I hear you");
    window.speechSynthesis.speak(utterance);
}

micBtn.addEventListener('click', () => {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
});

// Initialize on page load
window.addEventListener('load', initVosk);
