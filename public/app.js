// Audio Context and Sound Generation (No external files)
class SoundManager {
    constructor() {
        // AudioContext is initialized on first user interaction to comply with browser autoplay policies
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type, duration, volLevel = 0.1) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(volLevel, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playJoinChime() {
        this.init();
        this.playTone(440, 'sine', 0.1, 0.1);
        setTimeout(() => this.playTone(660, 'sine', 0.3, 0.1), 100);
    }

    playDiceClatter() {
        this.init();
        // Rapid succession of noisy clicks
        for(let i=0; i<6; i++) {
            setTimeout(() => {
                this.playTone(150 + Math.random()*200, 'square', 0.05, 0.05);
            }, i * 40);
        }
    }

    playTick() {
        this.init();
        this.playTone(100, 'square', 0.1, 0.05);
    }

    playSynthDrop() {
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 1.5);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 1.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 1.5);
    }

    playFanfare() {
        this.init();
        this.playTone(523.25, 'triangle', 0.2, 0.1); // C5
        setTimeout(() => this.playTone(659.25, 'triangle', 0.2, 0.1), 200); // E5
        setTimeout(() => this.playTone(783.99, 'triangle', 0.4, 0.15), 400); // G5
    }
}

const sfx = new SoundManager();

// Global State
const socket = io();
let myPlayerId = null;
let currentRoomId = null;
let currentRoleInfo = null; // Stored locally to prevent peeking via console easily, though technically in memory
let lastRoomState = null;

// DOM Elements
const screens = {
    login: document.getElementById('login-screen'),
    lobby: document.getElementById('lobby-screen'),
    role: document.getElementById('role-screen'),
    game: document.getElementById('main-game-ui'),
    reveal: document.getElementById('reveal-screen')
};

const topBar = document.getElementById('status-bar');

function showScreen(screenName) {
    Object.values(screens).forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    screens[screenName].classList.remove('hidden');
    screens[screenName].classList.add('active');

    // Show top bar everywhere except login
    if (screenName === 'login') {
        topBar.classList.add('hidden');
    } else {
        topBar.classList.remove('hidden');
    }
}

// Login Events
document.getElementById('btn-join').addEventListener('click', () => {
    sfx.init();
    const name = document.getElementById('input-name').value.trim();
    const room = document.getElementById('input-room').value.trim().toUpperCase();
    if (name && room) {
        currentRoomId = room;
        document.getElementById('display-room-code').textContent = room;
        document.getElementById('display-username').textContent = name;
        socket.emit('joinRoom', { roomId: room, playerName: name });
    }
});

// Lobby Events
document.getElementById('btn-start').addEventListener('click', () => {
    socket.emit('startGame', currentRoomId);
});

document.getElementById('select-game-mode').addEventListener('change', (e) => {
    socket.emit('changeGameMode', { roomId: currentRoomId, mode: e.target.value });
});

// Tap to reveal secret
const secretCover = document.getElementById('secret-cover');
const secretInfo = document.getElementById('secret-info');

// Handle holding (mousedown/touchstart)
['mousedown', 'touchstart'].forEach(evt => {
    secretCover.addEventListener(evt, (e) => {
        e.preventDefault();
        secretCover.style.opacity = '0';
        secretInfo.style.opacity = '1';
        secretInfo.style.pointerEvents = 'auto';
    });
});

// Handle release (mouseup/touchend/mouseleave)
['mouseup', 'touchend', 'mouseleave'].forEach(evt => {
    secretCover.addEventListener(evt, () => {
        secretCover.style.opacity = '1';
        secretInfo.style.opacity = '0';
        secretInfo.style.pointerEvents = 'none';
    });
});

// Socket Events
socket.on('connect', () => {
    myPlayerId = socket.id;
});

socket.on('privateInfo', (data) => {
    currentRoleInfo = data;
    
    // Render Role Screen
    if (data.role === 'chameleon') {
        secretInfo.innerHTML = `
            <h3 class="text-4xl holo-text mb-4">YOU ARE THE CHAMELEON</h3>
            <p class="text-xl text-pink-400 font-bold mb-4">BLEND IN.</p>
            <p class="text-gray-300 max-w-sm">Listen to the other players' clues carefully. Figure out the secret word and give a clue that doesn't give you away.</p>
        `;
    } else {
        secretInfo.innerHTML = `
            <h3 class="text-2xl text-blue-400 font-bold mb-2">You are a HUMAN</h3>
            <div class="glass-panel p-4 mb-4 border-emerald-400/50 border inline-block">
                <p class="text-gray-400 text-sm mb-1 uppercase tracking-wide">Secret Word</p>
                <p class="text-4xl font-extrabold text-white">${data.secretWord}</p>
            </div>
            <p class="text-gray-300 max-w-sm mb-4">Give a clue that proves you know the word, but don't make it too obvious for the Chameleon!</p>
            <div class="flex gap-2 justify-center">
                <div class="dice border-blue-500 text-blue-400" style="width:40px; height:40px; font-size:1.2rem">${data.dice.d6}</div>
                <div class="dice border-green-500 text-green-400" style="width:40px; height:40px; font-size:1.2rem">${data.dice.d8}</div>
            </div>
        `;
    }
});

let oldState = '';

// Main Sync Loop
socket.on('stateUpdate', (roomState) => {
    lastRoomState = roomState;
    document.getElementById('display-game-state').textContent = roomState.state;

    // Detect state changes for one-time sound effects
    if (oldState !== roomState.state) {
        if (roomState.state === 'ROLE_ASSIGNMENT') sfx.playFanfare();
        if (roomState.state === 'DISCUSSION_AND_VOTING') sfx.playJoinChime();
        if (roomState.state === 'REVEAL') sfx.playSynthDrop();
        oldState = roomState.state;
    }

    if (roomState.state === 'LOBBY') {
        showScreen('lobby');
        renderLobby(roomState);
    } 
    else if (roomState.state === 'ROLE_ASSIGNMENT') {
        showScreen('role');
    }
    else if (roomState.state === 'CLUE_GIVING' || roomState.state === 'DISCUSSION_AND_VOTING') {
        showScreen('game');
        renderGame(roomState);
        if (roomState.state === 'DISCUSSION_AND_VOTING') {
            document.getElementById('timer-display').classList.remove('hidden');
            document.getElementById('timer-display').classList.add('flex');
        } else {
            document.getElementById('timer-display').classList.add('hidden');
            document.getElementById('timer-display').classList.remove('flex');
        }
    }
    else if (roomState.state === 'REVEAL' || roomState.state === 'SCORING') {
        showScreen('reveal');
        if (roomState.state === 'SCORING') {
            renderScoring(roomState);
        }
    }
});

socket.on('timerUpdate', (time) => {
    document.getElementById('time-val').textContent = time;
    if (time <= 10 && time > 0) sfx.playTick();
});

socket.on('revealResult', (data) => {
    const revealContent = document.getElementById('reveal-content');
    const revealTitle = document.getElementById('reveal-title');
    document.getElementById('scoring-content').classList.add('hidden');

    if (data.caught) {
        revealTitle.textContent = "CHAMELEON CAUGHT!";
        revealTitle.className = "text-5xl font-extrabold mb-6 text-green-400";
        revealContent.innerHTML = `
            <p class="mb-4">The group successfully identified <span class="font-bold text-pink-400">${data.chameleonName}</span> as the Chameleon.</p>
            <p class="text-sm text-gray-400 animate-pulse">Waiting for the Chameleon to guess the secret word...</p>
        `;
    } else {
        revealTitle.textContent = "CHAMELEON ESCAPED!";
        revealTitle.className = "text-5xl font-extrabold mb-6 text-pink-400";
        revealContent.innerHTML = `
            <p class="mb-4">The group failed! <span class="font-bold text-pink-400">${data.chameleonName}</span> completely blended in.</p>
        `;
    }
});

socket.on('requestChameleonGuess', () => {
    if (currentRoleInfo && currentRoleInfo.role === 'chameleon') {
        const revealContent = document.getElementById('reveal-content');
        let gridHtml = '<div class="grid grid-cols-4 gap-2 mt-6 text-sm lg:text-base">';
        if (lastRoomState && lastRoomState.words) {
            lastRoomState.words.forEach(w => {
                 gridHtml += `<button class="cham-guess-btn word-card p-3 rounded font-bold">${w}</button>`;
            });
        }
        gridHtml += '</div>';

        revealContent.innerHTML = `
            <p class="text-pink-400 font-bold mb-4 text-2xl">YOU'VE BEEN CAUGHT.</p>
            <p class="mb-2">But you can still escape if you guess the secret word right now!</p>
            <p class="text-sm text-yellow-500 font-bold tracking-widest uppercase mb-4 animate-pulse">Click your guess below!</p>
            ${gridHtml}
        `;
        
        // Setup click listener on the new grid
        document.querySelectorAll('.cham-guess-btn').forEach(btn => {
            btn.onclick = (e) => {
                const word = e.target.textContent;
                socket.emit('chameleonGuess', { roomId: currentRoomId, word });
                // Provide instant feedback to disable spam clicking
                revealContent.innerHTML = `<p class="text-gray-400 font-bold text-xl mt-4">Evaluating guess...</p>`;
            };
        });
    }
});

socket.on('chameleonGuessResult', (data) => {
    showScreen('reveal');
    const revealContent = document.getElementById('reveal-content');
    if(data.isCorrect) {
        revealContent.innerHTML = `
            <p class="text-2xl text-green-400 font-bold mb-2">The Chameleon guessed correctly!</p>
            <p>The secret word was <span class="font-bold text-blue-400">${data.secretWord}</span>.</p>
        `;
    } else {
        revealContent.innerHTML = `
            <p class="text-2xl text-red-500 font-bold mb-2">The Chameleon guessed wrong!</p>
            <p class="text-gray-400">They guessed '${data.word}', but the secret word was <span class="font-bold text-blue-400">${data.secretWord}</span>.</p>
        `;
    }
});

// Render Functions
function renderLobby(roomState) {
    const list = document.getElementById('lobby-players-list');
    list.innerHTML = '';
    
    roomState.players.forEach(p => {
        const li = document.createElement('li');
        li.className = "bg-slate-800/80 p-3 rounded border border-slate-600 flex justify-between items-center";
        li.innerHTML = `
            <span>${p.name} ${p.id === myPlayerId ? '(You)' : ''}</span>
            <span class="text-xs ${p.isHost ? 'text-yellow-400' : 'text-gray-500'} font-bold">${p.isHost ? 'HOST' : ''}</span>
        `;
        list.appendChild(li);
    });

    document.getElementById('player-count').textContent = roomState.players.length;

    const me = roomState.players.find(p => p.id === myPlayerId);
    const btnStart = document.getElementById('btn-start');
    const msgHost = document.getElementById('waiting-host-msg');
    const modeSelector = document.getElementById('game-mode-selector');
    const modeDisplay = document.getElementById('game-mode-display');
    const modeText = document.getElementById('display-mode-text');

    if (me && me.isHost) {
        modeSelector.classList.remove('hidden');
        modeDisplay.classList.add('hidden');
        document.getElementById('select-game-mode').value = roomState.gameMode || 'classic';
        
        if (roomState.players.length >= 3) {
            btnStart.classList.remove('hidden');
        } else {
            btnStart.classList.add('hidden');
        }
        msgHost.classList.add('hidden');
    } else {
        modeSelector.classList.add('hidden');
        modeDisplay.classList.remove('hidden');
        let modeNames = { 'classic': '⭐ Classic', 'blindfold': '🙈 Blindfold', 'rapid': '⚡ Rapid Fire' };
        modeText.textContent = modeNames[roomState.gameMode] || roomState.gameMode;

        btnStart.classList.add('hidden');
        msgHost.classList.remove('hidden');
    }
}

function renderGame(roomState) {
    if (roomState.gameMode === 'blindfold' && currentRoleInfo && currentRoleInfo.role === 'chameleon') {
        document.getElementById('topic-display').textContent = `Category: ????? (BLINDFOLD)`;
        document.getElementById('topic-display').classList.add('text-red-500');
    } else {
        document.getElementById('topic-display').textContent = `Category: ${roomState.categoryName}`;
        document.getElementById('topic-display').classList.remove('text-red-500');
    }

    // Render Dice (Obfuscated if chameleon or if roles not sent)
    const d6 = document.getElementById('d6-display');
    const d8 = document.getElementById('d8-display');

    if (currentRoleInfo && currentRoleInfo.role === 'human') {
        d6.textContent = currentRoleInfo.dice.d6;
        d8.textContent = currentRoleInfo.dice.d8;
        d6.classList.remove('roll'); d8.classList.remove('roll');
        // Hack to trigger visual animation css
        void d6.offsetWidth; void d8.offsetWidth; 
        d6.classList.add('roll'); d8.classList.add('roll');
        if(roomState.state === 'ROLE_ASSIGNMENT') sfx.playDiceClatter();
    } else {
        d6.textContent = '?';
        d8.textContent = '?';
    }

    // Render Grid
    const grid = document.getElementById('word-grid');
    grid.innerHTML = '';
    roomState.words.forEach((w, idx) => {
        const btn = document.createElement('button');
        btn.className = "word-card p-3 md:p-4 rounded-lg font-semibold text-center text-sm md:text-base cursor-default";
        btn.textContent = w;
        
        // Highlight secret word for humans secretly
        if (currentRoleInfo && currentRoleInfo.role === 'human' && currentRoleInfo.secretWord === w) {
            btn.classList.add('border-blue-500', 'bg-blue-900/40', 'text-blue-300');
        }
        
        grid.appendChild(btn);
    });

    // Render Players & Clues Log
    const tracker = document.getElementById('clue-tracker');
    tracker.innerHTML = '';
    
    roomState.players.forEach((p, idx) => {
        const isCurrentTurn = (idx === roomState.turnIndex && roomState.state === 'CLUE_GIVING');
        
        const li = document.createElement('li');
        li.className = `p-3 rounded glass-panel flex justify-between items-center ${isCurrentTurn ? 'turn-active' : ''}`;
        
        // Indicator for voting
        let voteIndicator = '';
        if (roomState.state === 'DISCUSSION_AND_VOTING') {
            if (p.hasVoted) voteIndicator = '<span class="text-green-400 text-xs mt-1 block">✓ Voted</span>';
            else voteIndicator = '<span class="text-gray-500 text-xs mt-1 block">Thinking...</span>';
        }

        li.innerHTML = `
            <div>
                <p class="font-bold ${p.id === myPlayerId ? 'text-blue-400' : ''}">${p.name}</p>
                ${voteIndicator}
            </div>
            <div class="bg-black/30 border border-gray-700 rounded px-4 py-2 min-w-[100px] text-center font-mono font-bold text-pink-300">
                ${p.clue ? p.clue.toUpperCase() : (isCurrentTurn ? '...' : '-')}
            </div>
        `;
        tracker.appendChild(li);
    });

    // Render Action Panel dynamically
    const actionPanel = document.getElementById('action-panel');
    const actionTitle = document.getElementById('action-title');
    const actionContent = document.getElementById('action-content');
    
    actionPanel.classList.remove('hidden');

    if (roomState.state === 'CLUE_GIVING') {
        const pPlayer = roomState.players[roomState.turnIndex];
        if (pPlayer && pPlayer.id === myPlayerId) {
            actionTitle.textContent = "YOUR TURN: Give a 1-word clue";
            actionPanel.classList.add('turn-active');
            actionContent.innerHTML = `
                <div class="flex gap-2">
                    <input type="text" id="input-clue" maxlength="15" class="w-full bg-slate-800 border border-slate-600 rounded py-2 px-3 focus:outline-none focus:border-pink-400 uppercase font-mono" placeholder="ONE WORD ONLY">
                    <button id="btn-submit-clue" class="btn-neon font-bold py-2 px-6 rounded">SUBMIT</button>
                </div>
            `;
            setTimeout(() => document.getElementById('input-clue').focus(), 100);
            
            document.getElementById('btn-submit-clue').onclick = () => {
                const clue = document.getElementById('input-clue').value;
                if(clue && !clue.includes(' ')) {
                    socket.emit('submitClue', { roomId: currentRoomId, clue });
                } else {
                    alert("Please enter exactly ONE word, no spaces!");
                }
            };
        } else {
            actionPanel.classList.remove('turn-active');
            actionTitle.textContent = "Wait for your turn";
            actionContent.innerHTML = `<p class="text-gray-400 italic">Waiting for ${pPlayer ? pPlayer.name : 'Unknown'} to give a clue...</p>`;
        }
    } 
    else if (roomState.state === 'DISCUSSION_AND_VOTING') {
        actionPanel.classList.remove('turn-active');
        const me = roomState.players.find(p => p.id === myPlayerId);
        
        if (!me.hasVoted) {
            actionTitle.textContent = "VOTING PHASE: Who is the Chameleon?";
            let btnsHtml = '<div class="grid grid-cols-2 gap-2">';
            roomState.players.forEach(p => {
                // Cannot vote for self unless feeling funny, but usually allowed in bad code, let's omit self to be standard
                if (p.id !== myPlayerId) {
                    btnsHtml += `<button class="vote-btn border border-red-500/50 bg-red-900/20 hover:bg-red-600/50 text-white font-bold py-2 px-4 rounded transition" data-target="${p.id}">${p.name}</button>`;
                }
            });
            btnsHtml += '</div>';
            actionContent.innerHTML = btnsHtml;

            document.querySelectorAll('.vote-btn').forEach(btn => {
                btn.onclick = (e) => {
                    const targetId = e.target.getAttribute('data-target');
                    socket.emit('submitVote', { roomId: currentRoomId, targetId });
                    actionContent.innerHTML = `<p class="text-green-400 font-bold">Vote cast! Waiting for others...</p>`;
                };
            });
        } else {
            actionTitle.textContent = "Votes logged";
            actionContent.innerHTML = `<p class="text-green-400 font-bold">Waiting for others to finish voting.</p>`;
        }
    }
}

function renderScoring(roomState) {
    document.getElementById('scoring-content').classList.remove('hidden');
    const board = document.getElementById('scoreboard-list');
    board.innerHTML = '';
    
    // Sort by score
    const sorted = [...roomState.players].sort((a,b) => b.score - a.score);
    
    sorted.forEach(p => {
        const li = document.createElement('li');
        li.className = "flex justify-between p-3 glass-panel rounded";
        li.innerHTML = `
            <span class="font-bold">${p.name} ${p.id === myPlayerId ? '<span class="text-xs text-blue-400 mr-2">(You)</span>' : ''}</span>
            <span class="font-mono text-pink-400 text-xl">${p.score} pts</span>
        `;
        board.appendChild(li);
    });
}
