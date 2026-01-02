/**
 * Chess GPT Web - Main Application
 * Game logic, UI interactions, and board management
 */

import chessAI from './chess-ai.js';

// ============ Game State ============
const state = {
    game: null,           // chess.js instance
    playerColor: 'white', // 'white' or 'black'
    difficulty: 'normal', // 'easy', 'normal', 'hard'
    moveHistory: [],      // UCI moves array
    gameHistory: [],      // For undo: array of FEN strings
    isPlayerTurn: true,
    isGameOver: false,
    boardFlipped: false,
    // Settings
    soundEnabled: true,
    boardTheme: 'classic',
    pieceSet: 'unicode',
    theme: 'dark'
};

// ============ DOM Elements ============
const elements = {
    loadingScreen: document.getElementById('loading-screen'),
    loadingText: document.querySelector('.loading-text'),
    progressFill: document.querySelector('.progress-fill'),
    app: document.getElementById('app'),
    setupPanel: document.getElementById('setup-panel'),
    gamePanel: document.getElementById('game-panel'),
    chessboard: document.getElementById('chessboard'),
    moveHistory: document.getElementById('move-history'),
    turnIndicator: document.getElementById('turn-indicator'),
    aiThinking: document.getElementById('ai-thinking'),
    aiColor: document.getElementById('ai-color'),
    humanColor: document.getElementById('human-color'),
    currentDiff: document.getElementById('current-diff'),
    resultModal: document.getElementById('result-modal'),
    resultIcon: document.getElementById('result-icon'),
    resultTitle: document.getElementById('result-title'),
    resultMessage: document.getElementById('result-message'),
    confettiCanvas: document.getElementById('confetti-canvas'),
    settingsModal: document.getElementById('settings-modal'),
    btnUndo: document.getElementById('btn-undo')
};

// ============ Result Messages ============
const RESULT_MESSAGES = {
    win: {
        easy: {
            icon: '🎉',
            title: 'Bạn thắng rồi!',
            message: 'Nhưng đó chỉ là chế độ dễ thôi... Dám thử chế độ khó hơn không? 😏'
        },
        normal: {
            icon: '🏆',
            title: 'Tuyệt vời!',
            message: 'Bạn đã đánh bại AI ở mức trung bình! Bạn có skill thật đấy! 🎊'
        },
        hard: {
            icon: '👑',
            title: 'INCREDIBLE!',
            message: 'Bạn là GRANDMASTER! Đánh bại AI được train trên 34 triệu ván cờ! 🏆🔥'
        }
    },
    lose: {
        easy: {
            icon: '😅',
            title: 'Úi...',
            message: 'Thua chế độ dễ á? Chắc bạn đang test thử... đúng không? 🤭'
        },
        normal: {
            icon: '💪',
            title: 'AI thắng rồi!',
            message: 'Đừng nản chí! Thử lại đi, lần này sẽ khác! 🎮'
        },
        hard: {
            icon: '🤖',
            title: 'AI thắng!',
            message: 'Đừng buồn nhé, AI này được train trên 34 triệu ván cờ cơ mà! 🧠'
        }
    },
    draw: {
        icon: '🤝',
        title: 'Hòa!',
        message: 'Một ván cờ cân bằng! Bạn ngang tài với AI đấy! ⚖️'
    }
};

// ============ Chess Board ============
const PIECE_SYMBOLS = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

let selectedSquare = null;
let validMoves = [];

function renderBoard() {
    const board = state.game.board();
    let html = '';

    const ranks = state.boardFlipped ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const files = state.boardFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

    for (const rank of ranks) {
        for (const file of files) {
            const square = String.fromCharCode(97 + file) + (rank + 1);
            const piece = board[7 - rank][file];
            const isLight = (rank + file) % 2 === 1;
            const isSelected = selectedSquare === square;
            const isValidMove = validMoves.includes(square);
            const isLastMove = state.moveHistory.length > 0 &&
                (state.lastMoveFrom === square || state.lastMoveTo === square);

            let classes = `square ${isLight ? 'light' : 'dark'}`;
            if (isSelected) classes += ' selected';
            if (isValidMove) classes += ' valid-move';
            if (isLastMove) classes += ' last-move';

            const pieceHtml = piece ?
                `<span class="piece ${piece.color === 'w' ? 'white' : 'black'}">${PIECE_SYMBOLS[piece.color === 'w' ? piece.type.toUpperCase() : piece.type]}</span>` : '';

            html += `<div class="${classes}" data-square="${square}">${pieceHtml}</div>`;
        }
    }

    elements.chessboard.innerHTML = html;

    // Add click listeners
    document.querySelectorAll('.square').forEach(sq => {
        sq.addEventListener('click', () => handleSquareClick(sq.dataset.square));
    });
}

function handleSquareClick(square) {
    if (state.isGameOver || !state.isPlayerTurn) return;

    const piece = state.game.get(square);

    // If clicking on own piece, select it
    if (piece && piece.color === (state.playerColor === 'white' ? 'w' : 'b')) {
        selectedSquare = square;
        validMoves = state.game.moves({ square, verbose: true }).map(m => m.to);
        renderBoard();
        return;
    }

    // If piece is selected and clicking valid move
    if (selectedSquare && validMoves.includes(square)) {
        makeMove(selectedSquare, square);
        return;
    }

    // Clear selection
    selectedSquare = null;
    validMoves = [];
    renderBoard();
}

async function makeMove(from, to) {
    // Check for promotion
    const piece = state.game.get(from);
    const targetPiece = state.game.get(to);
    let promotion = null;

    if (piece && piece.type === 'p') {
        const toRank = parseInt(to[1]);
        if ((piece.color === 'w' && toRank === 8) || (piece.color === 'b' && toRank === 1)) {
            promotion = 'q'; // Auto-promote to queen
        }
    }

    const move = state.game.move({ from, to, promotion });

    if (move) {
        // Record move and game state
        const uciMove = from + to + (promotion || '');
        state.moveHistory.push(uciMove);
        state.gameHistory.push(state.game.fen());
        state.lastMoveFrom = from;
        state.lastMoveTo = to;

        // Play sound
        if (targetPiece) {
            playSound('capture');
        } else {
            playSound('move');
        }

        // Clear selection
        selectedSquare = null;
        validMoves = [];

        // Update UI
        renderBoard();
        updateMoveHistory();
        updateUndoButton();

        // Check game over
        if (checkGameOver()) {
            playSound('gameEnd');
            return;
        }

        // Check for check
        if (state.game.in_check()) {
            playSound('check');
        }

        // AI turn
        state.isPlayerTurn = false;
        updateTurnIndicator();

        // Get AI move
        await getAIMove();
    }
}

async function getAIMove() {
    elements.aiThinking.classList.remove('hidden');

    try {
        // Small delay for UX
        await new Promise(r => setTimeout(r, 500));

        const moveHistoryStr = state.moveHistory.join(' ');
        const aiMove = await chessAI.getMove(moveHistoryStr, state.difficulty);

        if (aiMove && aiMove.length >= 4) {
            const from = aiMove.substring(0, 2);
            const to = aiMove.substring(2, 4);
            const promotion = aiMove.length > 4 ? aiMove[4] : null;
            const targetPiece = state.game.get(to);

            const move = state.game.move({ from, to, promotion });

            if (move) {
                state.moveHistory.push(aiMove);
                state.gameHistory.push(state.game.fen());
                state.lastMoveFrom = from;
                state.lastMoveTo = to;

                // Play sound
                playSound(targetPiece ? 'capture' : 'move');

                renderBoard();
                updateMoveHistory();
                updateUndoButton();

                if (!checkGameOver()) {
                    if (state.game.in_check()) playSound('check');
                    state.isPlayerTurn = true;
                    updateTurnIndicator();
                } else {
                    playSound('gameEnd');
                }
            }
        }
    } catch (error) {
        console.error('AI move error:', error);
        // Fallback: make random legal move
        const moves = state.game.moves({ verbose: true });
        if (moves.length > 0) {
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            state.game.move(randomMove);
            const uci = randomMove.from + randomMove.to + (randomMove.promotion || '');
            state.moveHistory.push(uci);
            state.gameHistory.push(state.game.fen());
            state.lastMoveFrom = randomMove.from;
            state.lastMoveTo = randomMove.to;
            playSound('move');
            renderBoard();
            updateMoveHistory();
            updateUndoButton();
            if (!checkGameOver()) {
                state.isPlayerTurn = true;
                updateTurnIndicator();
            }
        }
    } finally {
        elements.aiThinking.classList.add('hidden');
    }
}

function checkGameOver() {
    // chess.js 0.10.3 uses in_checkmate(), in_draw(), in_stalemate()
    if (state.game.in_checkmate()) {
        state.isGameOver = true;
        const winner = state.game.turn() === 'w' ? 'black' : 'white';
        showResult(winner === state.playerColor ? 'win' : 'lose');
        return true;
    }

    if (state.game.in_draw() || state.game.in_stalemate() || state.game.in_threefold_repetition()) {
        state.isGameOver = true;
        showResult('draw');
        return true;
    }

    return false;
}

function showResult(result) {
    let data;

    if (result === 'draw') {
        data = RESULT_MESSAGES.draw;
    } else {
        data = RESULT_MESSAGES[result][state.difficulty];
    }

    elements.resultIcon.textContent = data.icon;
    elements.resultTitle.textContent = data.title;
    elements.resultMessage.textContent = data.message;

    elements.resultModal.classList.remove('hidden');

    if (result === 'win') {
        elements.resultModal.classList.add('win');
        elements.resultModal.classList.remove('lose');
        launchConfetti();
    } else if (result === 'lose') {
        elements.resultModal.classList.add('lose');
        elements.resultModal.classList.remove('win');
    }
}

function updateMoveHistory() {
    let html = '';
    for (let i = 0; i < state.moveHistory.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        const whiteMove = state.moveHistory[i] || '';
        const blackMove = state.moveHistory[i + 1] || '';
        html += `<div class="move-row">
            <span class="move-num">${moveNum}.</span>
            <span class="white-move">${whiteMove}</span>
            <span class="black-move">${blackMove}</span>
        </div>`;
    }
    elements.moveHistory.innerHTML = html;
    elements.moveHistory.scrollTop = elements.moveHistory.scrollHeight;
}

function updateTurnIndicator() {
    elements.turnIndicator.textContent = state.isPlayerTurn ? 'Lượt của bạn' : 'AI đang suy nghĩ...';
}

// ============ Confetti ============
function launchConfetti() {
    const canvas = elements.confettiCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#6366f1', '#818cf8', '#10b981', '#f59e0b', '#ef4444', '#ffffff'];

    for (let i = 0; i < 150; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 8 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            speedY: Math.random() * 3 + 2,
            speedX: Math.random() * 4 - 2,
            rotation: Math.random() * 360
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let active = false;
        particles.forEach(p => {
            if (p.y < canvas.height) {
                active = true;
                p.y += p.speedY;
                p.x += p.speedX;
                p.rotation += 5;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation * Math.PI / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            }
        });

        if (active) requestAnimationFrame(animate);
    }

    animate();
}

// ============ Game Setup ============
function startGame() {
    state.game = new Chess();
    state.moveHistory = [];
    state.gameHistory = [];
    state.isGameOver = false;
    state.isPlayerTurn = state.playerColor === 'white';
    state.boardFlipped = state.playerColor === 'black';
    state.lastMoveFrom = null;
    state.lastMoveTo = null;

    // Update UI
    elements.setupPanel.classList.add('hidden');
    elements.gamePanel.classList.remove('hidden');
    elements.resultModal.classList.add('hidden');

    elements.aiColor.textContent = state.playerColor === 'white' ? 'Đen' : 'Trắng';
    elements.humanColor.textContent = state.playerColor === 'white' ? 'Trắng' : 'Đen';
    elements.currentDiff.textContent = chessAI.getDifficultyConfig(state.difficulty).description;

    // Apply board theme
    elements.chessboard.className = 'chessboard ' + state.boardTheme;

    renderBoard();
    updateMoveHistory();
    updateTurnIndicator();
    updateUndoButton();

    // If AI plays first (player is black)
    if (!state.isPlayerTurn) {
        getAIMove();
    }
}

function resetGame() {
    startGame();
}

function quitGame() {
    elements.gamePanel.classList.add('hidden');
    elements.setupPanel.classList.remove('hidden');
    elements.resultModal.classList.add('hidden');
}

// ============ Sound Effects ============
const sounds = {
    move: null,
    capture: null,
    check: null,
    gameEnd: null
};

function initSounds() {
    // Create sounds using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    sounds.play = (type) => {
        if (!state.soundEnabled) return;

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        const frequencies = { move: 400, capture: 300, check: 600, gameEnd: 500 };
        const durations = { move: 0.1, capture: 0.15, check: 0.2, gameEnd: 0.3 };

        oscillator.frequency.value = frequencies[type] || 400;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.1;
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + (durations[type] || 0.1));

        oscillator.start();
        oscillator.stop(audioContext.currentTime + (durations[type] || 0.1));
    };
}

function playSound(type) {
    if (sounds.play) sounds.play(type);
}

// ============ Undo Move ============
function undoMove() {
    if (state.gameHistory.length < 2 || !state.isPlayerTurn || state.isGameOver) return;

    // Undo AI move and player move
    state.game.undo(); // AI move
    state.game.undo(); // Player move

    state.moveHistory.pop();
    state.moveHistory.pop();
    state.gameHistory.pop();
    state.gameHistory.pop();

    // Update last move highlight
    if (state.moveHistory.length >= 1) {
        const lastMove = state.moveHistory[state.moveHistory.length - 1];
        state.lastMoveFrom = lastMove.substring(0, 2);
        state.lastMoveTo = lastMove.substring(2, 4);
    } else {
        state.lastMoveFrom = null;
        state.lastMoveTo = null;
    }

    renderBoard();
    updateMoveHistory();
    updateUndoButton();
    playSound('move');
}

function updateUndoButton() {
    if (elements.btnUndo) {
        elements.btnUndo.disabled = state.gameHistory.length < 2 || !state.isPlayerTurn;
    }
}

// ============ Settings ============
function openSettings() {
    elements.settingsModal.classList.remove('hidden');
}

function closeSettings() {
    elements.settingsModal.classList.add('hidden');
}

function setTheme(theme) {
    state.theme = theme;
    document.body.classList.toggle('light-theme', theme === 'light');
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
    localStorage.setItem('chess-theme', theme);
}

function setBoardTheme(theme) {
    state.boardTheme = theme;
    elements.chessboard.className = 'chessboard ' + theme;
    document.querySelectorAll('.board-theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.board === theme);
    });
    localStorage.setItem('chess-board-theme', theme);
}

function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    const btn = document.getElementById('btn-sound');
    btn.textContent = state.soundEnabled ? 'Bật' : 'Tắt';
    btn.classList.toggle('active', state.soundEnabled);
    localStorage.setItem('chess-sound', state.soundEnabled);
}

function setPieceSet(pieceSet) {
    state.pieceSet = pieceSet;
    document.querySelectorAll('.piece-set-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.pieces === pieceSet);
    });
    localStorage.setItem('chess-piece-set', pieceSet);
    // Re-render board if game is active
    if (state.game) {
        renderBoard();
    }
}

function loadSettings() {
    const theme = localStorage.getItem('chess-theme') || 'dark';
    const boardTheme = localStorage.getItem('chess-board-theme') || 'classic';
    const pieceSet = localStorage.getItem('chess-piece-set') || 'unicode';
    const sound = localStorage.getItem('chess-sound');

    setTheme(theme);
    setBoardTheme(boardTheme);
    setPieceSet(pieceSet);

    if (sound !== null) {
        state.soundEnabled = sound === 'true';
        const btn = document.getElementById('btn-sound');
        if (btn) {
            btn.textContent = state.soundEnabled ? 'Bật' : 'Tắt';
            btn.classList.toggle('active', state.soundEnabled);
        }
    }
}

// ============ Event Listeners ============
function setupEventListeners() {
    // Color selection
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.playerColor = btn.dataset.color;
        });
    });

    // Difficulty selection
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.difficulty = btn.dataset.diff;
        });
    });

    // Start button
    document.getElementById('btn-start').addEventListener('click', startGame);

    // Game controls
    document.getElementById('btn-reset').addEventListener('click', resetGame);
    document.getElementById('btn-quit').addEventListener('click', quitGame);
    document.getElementById('btn-undo')?.addEventListener('click', undoMove);
    document.getElementById('btn-settings')?.addEventListener('click', openSettings);
    document.getElementById('btn-close-settings')?.addEventListener('click', closeSettings);

    // Modal buttons
    document.getElementById('btn-play-again').addEventListener('click', resetGame);
    document.getElementById('btn-change-settings').addEventListener('click', quitGame);

    // Settings controls
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => setTheme(btn.dataset.theme));
    });

    document.querySelectorAll('.board-theme-btn').forEach(btn => {
        btn.addEventListener('click', () => setBoardTheme(btn.dataset.board));
    });

    document.querySelectorAll('.piece-set-btn').forEach(btn => {
        btn.addEventListener('click', () => setPieceSet(btn.dataset.pieces));
    });

    document.getElementById('btn-sound')?.addEventListener('click', toggleSound);

    // Close settings modal on backdrop click
    elements.settingsModal?.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) closeSettings();
    });
}

// ============ Initialization ============
async function init() {
    setupEventListeners();
    initSounds();
    loadSettings();

    try {
        await chessAI.init((progress, text) => {
            elements.progressFill.style.width = progress + '%';
            elements.loadingText.textContent = text;
        });

        // Hide loading, show app
        setTimeout(() => {
            elements.loadingScreen.classList.add('hidden');
            elements.app.classList.remove('hidden');
            // Re-render Lucide icons
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }, 500);

    } catch (error) {
        console.error('Failed to initialize:', error);
        elements.loadingText.textContent = 'Lỗi tải model! Vui lòng refresh trang.';
    }
}

// Start app
init();
