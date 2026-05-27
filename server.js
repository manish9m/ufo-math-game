const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = new Map();

const FOODS = [
  { emoji: '\u{1F355}', name: 'Pizza' },
  { emoji: '\u{1F354}', name: 'Burger' },
  { emoji: '\u{1F36B}', name: 'Chocolate' },
  { emoji: '\u{1F366}', name: 'Ice Cream' },
  { emoji: '\u{1F369}', name: 'Donut' },
  { emoji: '\u{1F382}', name: 'Cake' },
  { emoji: '\u{1F36A}', name: 'Cookie' },
  { emoji: '\u{1F9C1}', name: 'Cupcake' },
  { emoji: '\u{1F36D}', name: 'Lollipop' },
  { emoji: '\u{1F32E}', name: 'Taco' },
  { emoji: '\u{1F32D}', name: 'Hot Dog' },
  { emoji: '\u{1F35F}', name: 'Fries' },
  { emoji: '\u{1F37F}', name: 'Popcorn' },
  { emoji: '\u{1F95E}', name: 'Pancakes' },
];

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

function getRandomFood() {
  return FOODS[Math.floor(Math.random() * FOODS.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toRoman(num) {
  const vals = [50, 40, 10, 9, 5, 4, 1];
  const syms = ['L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let result = '';
  for (let i = 0; i < vals.length; i++) {
    while (num >= vals[i]) {
      result += syms[i];
      num -= vals[i];
    }
  }
  return result;
}

const ONES = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function numberToWords(num) {
  if (num === 0) return 'zero';
  if (num === 100) return 'one hundred';
  if (num < 20) return ONES[num];
  const t = Math.floor(num / 10);
  const o = num % 10;
  return o ? `${TENS[t]}-${ONES[o]}` : TENS[t];
}

function generateQuestion(difficulty) {
  const types = [];
  if (difficulty === 'easy') {
    types.push('add', 'subtract');
  } else if (difficulty === 'medium') {
    types.push('add', 'subtract', 'multiply', 'divide');
  } else {
    types.push('add', 'subtract', 'multiply', 'divide', 'roman_to_num', 'num_to_roman', 'word_to_num', 'num_to_word');
  }
  const type = types[Math.floor(Math.random() * types.length)];

  switch (type) {
    case 'add': {
      const max = difficulty === 'easy' ? 20 : 100;
      const a = randInt(1, max);
      const b = randInt(1, max);
      return { text: `What is ${a} + ${b}?`, answer: a + b, answerType: 'number' };
    }
    case 'subtract': {
      const max = difficulty === 'easy' ? 20 : 100;
      let a = randInt(1, max);
      let b = randInt(1, max);
      if (b > a) [a, b] = [b, a];
      return { text: `What is ${a} - ${b}?`, answer: a - b, answerType: 'number' };
    }
    case 'multiply': {
      const a = randInt(2, 12);
      const b = randInt(2, 12);
      return { text: `What is ${a} × ${b}?`, answer: a * b, answerType: 'number' };
    }
    case 'divide': {
      const b = randInt(2, 12);
      const answer = randInt(1, 12);
      const a = b * answer;
      return { text: `What is ${a} ÷ ${b}?`, answer, answerType: 'number' };
    }
    case 'roman_to_num': {
      const num = randInt(1, 50);
      const roman = toRoman(num);
      return { text: `What is ${roman} in numbers?`, answer: num, answerType: 'number' };
    }
    case 'num_to_roman': {
      const num = randInt(1, 50);
      return { text: `Write ${num} in Roman numerals`, answer: toRoman(num), answerType: 'roman' };
    }
    case 'word_to_num': {
      const num = randInt(1, 99);
      const words = numberToWords(num);
      return { text: `What is "${words}" in digits?`, answer: num, answerType: 'number' };
    }
    case 'num_to_word': {
      const num = randInt(1, 99);
      return { text: `Write ${num} in words`, answer: numberToWords(num), answerType: 'word' };
    }
  }
}

function normalizeWord(str) {
  return str.toLowerCase().trim().replace(/[\s-]+/g, ' ').replace(/ /g, '-');
}

function checkAnswer(question, userAnswer) {
  const raw = String(userAnswer).trim();
  if (!raw) return false;
  if (question.answerType === 'number') {
    const num = parseInt(raw, 10);
    return !isNaN(num) && num === question.answer;
  }
  if (question.answerType === 'roman') {
    return raw.toUpperCase() === question.answer;
  }
  if (question.answerType === 'word') {
    return normalizeWord(raw) === normalizeWord(question.answer);
  }
  return false;
}

function formatAnswer(question) {
  return String(question.answer);
}

function sendNewQuestion(room) {
  room.questionResolved = false;
  room.currentQuestion = generateQuestion(room.difficulty);
  io.to(room.code).emit('newQuestion', {
    question: room.currentQuestion.text,
    food: room.currentFood,
    foodPosition: room.foodPosition,
    scores: room.players.map((p) => p.score),
  });
  room.questionTimer = setTimeout(() => {
    if (!room.questionResolved) {
      room.questionResolved = true;
      io.to(room.code).emit('answerResult', {
        correct: false,
        playerIndex: -1,
        foodPosition: room.foodPosition,
        scores: room.players.map((p) => p.score),
        collected: false,
        correctAnswer: formatAnswer(room.currentQuestion),
      });
      setTimeout(() => sendNewQuestion(room), 2500);
    }
  }, 20000);
}

function handleCorrectAnswer(room, playerIndex) {
  room.foodPosition += playerIndex === 0 ? -1 : 1;

  let collected = false;
  let collectorIndex = -1;
  if (room.foodPosition <= 0) {
    room.players[0].score++;
    collected = true;
    collectorIndex = 0;
  } else if (room.foodPosition >= 10) {
    room.players[1].score++;
    collected = true;
    collectorIndex = 1;
  }

  io.to(room.code).emit('answerResult', {
    correct: true,
    playerIndex,
    foodPosition: room.foodPosition,
    scores: room.players.map((p) => p.score),
    collected,
    collectorIndex,
    correctAnswer: formatAnswer(room.currentQuestion),
    collectedFood: collected ? room.currentFood : null,
  });

  if (collected) {
    const winner = room.players.find((p) => p.score >= room.targetScore);
    if (winner) {
      setTimeout(() => {
        io.to(room.code).emit('gameOver', {
          winnerName: winner.name,
          winnerIndex: room.players.indexOf(winner),
          scores: room.players.map((p) => ({ name: p.name, score: p.score })),
        });
      }, 2500);
      return;
    }
    room.foodPosition = 5;
    room.currentFood = getRandomFood();
  }

  setTimeout(() => sendNewQuestion(room), 2500);
}


io.on('connection', (socket) => {
  socket.on('createRoom', ({ playerName, difficulty, targetScore }) => {
    const code = generateRoomCode();
    const room = {
      code,
      difficulty,
      targetScore: parseInt(targetScore, 10),
      players: [{ id: socket.id, name: playerName, score: 0 }],
      foodPosition: 5,
      currentFood: getRandomFood(),
      currentQuestion: null,
      questionResolved: false,
      questionTimer: null,
      gameStarted: false,
    };
    rooms.set(code, room);
    socket.join(code);
    socket.roomCode = code;
    socket.playerIndex = 0;
    socket.emit('roomCreated', {
      code,
      playerName,
      difficulty,
      targetScore: room.targetScore,
    });
  });

  socket.on('joinRoom', ({ code, playerName }) => {
    const room = rooms.get(code.toUpperCase());
    if (!room) {
      socket.emit('joinError', { message: 'Room not found! Check the code.' });
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('joinError', { message: 'Room is full!' });
      return;
    }
    if (room.gameStarted) {
      socket.emit('joinError', { message: 'Game already in progress!' });
      return;
    }
    room.players.push({ id: socket.id, name: playerName, score: 0 });
    socket.join(code.toUpperCase());
    socket.roomCode = code.toUpperCase();
    socket.playerIndex = 1;
    io.to(room.code).emit('lobbyUpdate', {
      players: room.players.map((p) => p.name),
      difficulty: room.difficulty,
      targetScore: room.targetScore,
    });
  });

  socket.on('startGame', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.players.length < 2 || socket.playerIndex !== 0) return;
    room.gameStarted = true;
    io.to(room.code).emit('gameStarted', {
      players: room.players.map((p) => p.name),
      difficulty: room.difficulty,
      targetScore: room.targetScore,
      food: room.currentFood,
    });
    setTimeout(() => sendNewQuestion(room), 2000);
  });

  socket.on('submitAnswer', ({ answer }) => {
    const room = rooms.get(socket.roomCode);
    if (!room || !room.gameStarted || room.questionResolved) return;
    if (checkAnswer(room.currentQuestion, answer)) {
      room.questionResolved = true;
      clearTimeout(room.questionTimer);
      handleCorrectAnswer(room, socket.playerIndex);
    } else {
      socket.emit('wrongAttempt');
    }
  });

  socket.on('playAgain', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    room.players.forEach((p) => (p.score = 0));
    room.foodPosition = 5;
    room.currentFood = getRandomFood();
    room.gameStarted = false;
    room.questionResolved = false;
    clearTimeout(room.questionTimer);
    io.to(room.code).emit('lobbyUpdate', {
      players: room.players.map((p) => p.name),
      difficulty: room.difficulty,
      targetScore: room.targetScore,
    });
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    clearTimeout(room.questionTimer);
    const idx = room.players.findIndex((p) => p.id === socket.id);
    if (idx !== -1) {
      const name = room.players[idx].name;
      room.players.splice(idx, 1);
      if (room.players.length === 0) {
        rooms.delete(socket.roomCode);
      } else {
        room.gameStarted = false;
        io.to(room.code).emit('playerDisconnected', { name });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`UFO Math Game server running on http://localhost:${PORT}`);
});
