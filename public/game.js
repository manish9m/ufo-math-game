const socket = io();

let myPlayerIndex = -1;
let gameState = {};

// DOM refs
const screens = {
  welcome: document.getElementById('welcome-screen'),
  create: document.getElementById('create-screen'),
  join: document.getElementById('join-screen'),
  lobby: document.getElementById('lobby-screen'),
  game: document.getElementById('game-screen'),
  winner: document.getElementById('winner-screen'),
};

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// Generate stars
(function createStars() {
  const container = document.getElementById('stars');
  for (let i = 0; i < 120; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = Math.random() * 3 + 1;
    star.style.width = size + 'px';
    star.style.height = size + 'px';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.setProperty('--dur', (Math.random() * 3 + 1) + 's');
    star.style.animationDelay = Math.random() * 3 + 's';
    container.appendChild(star);
  }
})();

// Build track positions
(function buildTrack() {
  const container = document.getElementById('track-positions');
  for (let i = 0; i <= 10; i++) {
    const dot = document.createElement('div');
    dot.className = 'track-dot';
    dot.dataset.pos = i;
    container.appendChild(dot);
  }
})();

// Toast notification
function showToast(msg, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 2500);
}

// Navigation
document.getElementById('btn-create').addEventListener('click', () => showScreen('create'));
document.getElementById('btn-join').addEventListener('click', () => showScreen('join'));
document.getElementById('btn-back-create').addEventListener('click', () => showScreen('welcome'));
document.getElementById('btn-back-join').addEventListener('click', () => showScreen('welcome'));

// Create room
document.getElementById('btn-create-room').addEventListener('click', () => {
  const name = document.getElementById('create-name').value.trim();
  if (!name) {
    showToast('Please enter your name!', 'error');
    return;
  }
  const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
  const target = document.querySelector('input[name="target"]:checked').value;
  socket.emit('createRoom', { playerName: name, difficulty, targetScore: target });
});

// Join room
document.getElementById('btn-join-room').addEventListener('click', () => {
  const name = document.getElementById('join-name').value.trim();
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  if (!name) {
    showToast('Please enter your name!', 'error');
    return;
  }
  if (code.length !== 4) {
    showToast('Room code must be 4 characters!', 'error');
    return;
  }
  socket.emit('joinRoom', { code, playerName: name });
});

// Start game
document.getElementById('btn-start').addEventListener('click', () => {
  socket.emit('startGame');
});

// Submit answer
function submitAnswer() {
  const input = document.getElementById('answer-input');
  const answer = input.value.trim();
  if (!answer) return;
  socket.emit('submitAnswer', { answer });
  input.value = '';
}

document.getElementById('btn-submit').addEventListener('click', submitAnswer);
document.getElementById('answer-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitAnswer();
});

// Play again
document.getElementById('btn-play-again').addEventListener('click', () => {
  socket.emit('playAgain');
});

// Socket events
socket.on('roomCreated', ({ code, playerName, difficulty, targetScore }) => {
  myPlayerIndex = 0;
  gameState = { players: [playerName], difficulty, targetScore };
  document.getElementById('lobby-code').textContent = code;
  showScreen('lobby');
  updateLobbyUI();
});

socket.on('joinError', ({ message }) => {
  showToast(message, 'error');
});

socket.on('lobbyUpdate', ({ players, difficulty, targetScore }) => {
  gameState = { players, difficulty, targetScore };
  if (myPlayerIndex === -1) myPlayerIndex = 1;
  showScreen('lobby');
  updateLobbyUI();
});

function updateLobbyUI() {
  const container = document.getElementById('lobby-players');
  container.innerHTML = '';
  const players = gameState.players || [];
  for (let i = 0; i < 2; i++) {
    const div = document.createElement('div');
    div.className = `lobby-player p${i + 1}`;
    if (i < players.length) {
      div.innerHTML = `
        <div class="label">Player ${i + 1}${i === myPlayerIndex ? ' (You)' : ''}</div>
        <div class="name">${players[i]}</div>
      `;
    } else {
      div.innerHTML = `
        <div class="label">Player ${i + 1}</div>
        <div class="name" style="color:#78909c">Waiting...</div>
      `;
    }
    container.appendChild(div);
  }

  const diffText = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
  document.getElementById('lobby-difficulty').textContent = `Difficulty: ${diffText[gameState.difficulty] || ''}`;
  document.getElementById('lobby-target').textContent = `Target: ${gameState.targetScore || ''} items`;

  const waitMsg = document.getElementById('waiting-msg');
  const startBtn = document.getElementById('btn-start');
  if (players.length >= 2) {
    waitMsg.textContent = 'Both players are ready!';
    if (myPlayerIndex === 0) {
      startBtn.style.display = 'inline-block';
    } else {
      startBtn.style.display = 'none';
      waitMsg.textContent = 'Waiting for host to start...';
    }
  } else {
    waitMsg.textContent = 'Waiting for another player...';
    startBtn.style.display = 'none';
  }
}

socket.on('gameStarted', ({ players, difficulty, targetScore, food }) => {
  gameState = { players, difficulty, targetScore, food, foodPosition: 5 };
  document.getElementById('p1-name').textContent = players[0];
  document.getElementById('p2-name').textContent = players[1];
  document.getElementById('p1-score').textContent = '0';
  document.getElementById('p2-score').textContent = '0';
  document.getElementById('p1-target').textContent = targetScore;
  document.getElementById('p2-target').textContent = targetScore;
  document.getElementById('collected-items').innerHTML = '';
  document.getElementById('game-status').textContent = 'Get Ready!';
  showScreen('game');
  updateTrack(5, food);
});

let timerAnimation = null;

socket.on('newQuestion', ({ question, food, foodPosition, scores }) => {
  gameState.food = food;
  gameState.foodPosition = foodPosition;
  document.getElementById('question-text').textContent = question;
  document.getElementById('p1-score').textContent = scores[0];
  document.getElementById('p2-score').textContent = scores[1];

  // Show answer input immediately - both players can type
  document.getElementById('answer-area').style.display = 'flex';
  const input = document.getElementById('answer-input');
  input.disabled = false;
  input.value = '';
  input.focus();
  document.getElementById('btn-submit').disabled = false;
  document.getElementById('info-text').textContent = 'Type your answer first!';
  document.getElementById('info-text').className = 'info-text';
  document.getElementById('game-status').textContent = 'Race to answer!';

  updateTrack(foodPosition, food);
  startTimer(20);
});

socket.on('wrongAttempt', () => {
  const input = document.getElementById('answer-input');
  input.disabled = false;
  input.value = '';
  input.focus();
  document.getElementById('btn-submit').disabled = false;
  document.getElementById('info-text').textContent = 'Wrong! Try again!';
  document.getElementById('info-text').className = 'info-text wrong';

  // Shake the input
  input.style.animation = 'none';
  requestAnimationFrame(() => {
    input.style.animation = 'shake 0.4s ease-in-out';
  });
});

socket.on('answerResult', ({ correct, playerIndex, foodPosition, scores, collected, collectorIndex, correctAnswer, collectedFood }) => {
  document.getElementById('p1-score').textContent = scores[0];
  document.getElementById('p2-score').textContent = scores[1];
  document.getElementById('answer-area').style.display = 'none';

  cancelTimer();

  if (correct) {
    const name = gameState.players[playerIndex];
    document.getElementById('info-text').textContent = `${name} got it right! Answer: ${correctAnswer}`;
    document.getElementById('info-text').className = 'info-text correct';
    document.getElementById('game-status').textContent = 'Correct!';

    const playerEl = document.getElementById(`player${playerIndex + 1}-info`);
    playerEl.classList.add('highlight');
    setTimeout(() => playerEl.classList.remove('highlight'), 700);
  } else {
    document.getElementById('info-text').textContent = `Time's up! Answer: ${correctAnswer}`;
    document.getElementById('info-text').className = 'info-text wrong';
    document.getElementById('game-status').textContent = 'Next question...';
  }

  if (collected && collectedFood) {
    showEatAnimation(collectorIndex, collectedFood);
    addCollectedItem(collectorIndex, collectedFood);
  }

  updateTrack(foodPosition, gameState.food);
});

socket.on('gameOver', ({ winnerName, winnerIndex, scores }) => {
  showScreen('winner');
  document.getElementById('winner-title').textContent = 'Winner!';
  document.getElementById('winner-name-display').textContent = winnerName;

  // Show winner UFO
  const ufoContainer = document.getElementById('winner-ufo');
  if (winnerIndex === 0) {
    ufoContainer.innerHTML = `<svg viewBox="0 0 120 80" width="150">
      <ellipse cx="60" cy="28" rx="22" ry="20" fill="#64ffda" opacity="0.6"/>
      <circle cx="55" cy="26" r="4" fill="#222"/><circle cx="65" cy="26" r="4" fill="#222"/>
      <ellipse cx="60" cy="42" rx="45" ry="14" fill="#4dd0e1"/>
      <circle cx="28" cy="45" r="4" fill="#ff5252"><animate attributeName="opacity" values="1;0.3;1" dur="0.7s" repeatCount="indefinite"/></circle>
      <circle cx="44" cy="49" r="4" fill="#ffab40"><animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite"/></circle>
      <circle cx="60" cy="50" r="4" fill="#69f0ae"><animate attributeName="opacity" values="1;0.3;1" dur="0.5s" repeatCount="indefinite"/></circle>
      <circle cx="76" cy="49" r="4" fill="#ffab40"><animate attributeName="opacity" values="1;0.3;1" dur="0.9s" repeatCount="indefinite"/></circle>
      <circle cx="92" cy="45" r="4" fill="#ff5252"><animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite"/></circle>
      <polygon points="38,56 82,56 95,75 25,75" fill="#64ffda" opacity="0.15"/>
    </svg>`;
  } else {
    ufoContainer.innerHTML = `<svg viewBox="0 0 120 80" width="150">
      <ellipse cx="60" cy="28" rx="22" ry="20" fill="#ea80fc" opacity="0.6"/>
      <circle cx="55" cy="26" r="4" fill="#222"/><circle cx="65" cy="26" r="4" fill="#222"/>
      <ellipse cx="60" cy="42" rx="45" ry="14" fill="#ce93d8"/>
      <circle cx="28" cy="45" r="4" fill="#ffab40"><animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite"/></circle>
      <circle cx="44" cy="49" r="4" fill="#ff5252"><animate attributeName="opacity" values="1;0.3;1" dur="0.6s" repeatCount="indefinite"/></circle>
      <circle cx="60" cy="50" r="4" fill="#ea80fc"><animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite"/></circle>
      <circle cx="76" cy="49" r="4" fill="#ff5252"><animate attributeName="opacity" values="1;0.3;1" dur="0.7s" repeatCount="indefinite"/></circle>
      <circle cx="92" cy="45" r="4" fill="#ffab40"><animate attributeName="opacity" values="1;0.3;1" dur="0.9s" repeatCount="indefinite"/></circle>
      <polygon points="38,56 82,56 95,75 25,75" fill="#ea80fc" opacity="0.15"/>
    </svg>`;
  }

  // Final scores
  const scoresContainer = document.getElementById('final-scores');
  scoresContainer.innerHTML = scores
    .map(
      (s, i) => `
    <div class="final-score-card ${i === winnerIndex ? 'winner' : ''}">
      <div class="name">${s.name}</div>
      <div class="score">${s.score}</div>
    </div>
  `
    )
    .join('');

  launchConfetti();
});

socket.on('playerDisconnected', ({ name }) => {
  showToast(`${name} disconnected!`, 'error');
  showScreen('lobby');
  updateLobbyUI();
});

// Track rendering
function updateTrack(position, food) {
  const foodEl = document.getElementById('food-item');
  foodEl.textContent = food.emoji;
  const pct = (position / 10) * 100;
  foodEl.style.left = pct + '%';
  foodEl.classList.remove('collected');

  // Update dots
  const dots = document.querySelectorAll('.track-dot');
  dots.forEach((dot) => {
    const pos = parseInt(dot.dataset.pos);
    dot.classList.remove('active-left', 'active-right');
    if (pos < 5 && pos >= position) {
      dot.classList.add('active-left');
    } else if (pos > 5 && pos <= position) {
      dot.classList.add('active-right');
    }
  });
}

// Timer
function startTimer(seconds) {
  cancelTimer();
  const fill = document.getElementById('timer-fill');
  fill.style.transition = 'none';
  fill.style.width = '100%';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fill.style.transition = `width ${seconds}s linear`;
      fill.style.width = '0%';
    });
  });
}

function cancelTimer() {
  const fill = document.getElementById('timer-fill');
  const current = fill.getBoundingClientRect().width;
  const parent = fill.parentElement.getBoundingClientRect().width;
  fill.style.transition = 'none';
  fill.style.width = (current / parent) * 100 + '%';
}

// Eat animation
function showEatAnimation(playerIndex, food) {
  const playerEl = document.getElementById(`player${playerIndex + 1}-info`);
  const rect = playerEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'eat-animation';
  el.textContent = food.emoji;
  el.style.left = rect.left + rect.width / 2 - 30 + 'px';
  el.style.top = rect.top + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);

  // Trigger collected animation on food
  const foodEl = document.getElementById('food-item');
  foodEl.classList.add('collected');
}

// Collected items
function addCollectedItem(playerIndex, food) {
  const container = document.getElementById('collected-items');
  const el = document.createElement('div');
  el.className = `collected-display p${playerIndex + 1}`;
  el.innerHTML = `${food.emoji} <span>${gameState.players[playerIndex]}</span>`;
  container.appendChild(el);
  if (container.children.length > 8) {
    container.removeChild(container.firstChild);
  }
}

// Confetti
function launchConfetti() {
  const container = document.getElementById('confetti-container');
  container.innerHTML = '';
  const colors = ['#ff5252', '#ffab40', '#ffd740', '#69f0ae', '#448aff', '#ea80fc', '#64ffda', '#ff6d00'];
  const shapes = ['square', 'circle'];
  for (let i = 0; i < 80; i++) {
    const conf = document.createElement('div');
    conf.className = 'confetti';
    const color = colors[Math.floor(Math.random() * colors.length)];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const size = Math.random() * 10 + 6;
    conf.style.width = size + 'px';
    conf.style.height = size + 'px';
    conf.style.background = color;
    conf.style.borderRadius = shape === 'circle' ? '50%' : '2px';
    conf.style.left = Math.random() * 100 + '%';
    conf.style.setProperty('--fall-dur', (Math.random() * 2 + 2) + 's');
    conf.style.setProperty('--rotation', Math.random() * 720 - 360 + 'deg');
    conf.style.animationDelay = Math.random() * 1.5 + 's';
    container.appendChild(conf);
  }
  // Repeat confetti
  setTimeout(() => launchConfetti(), 4000);
}
