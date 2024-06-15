// const express = require('express');
// const fs = require('fs');
// const https = require('https');
// const { Server } = require('socket.io');
// const cors = require('cors');

// const app = express();
// const server = https.createServer({
//   key: fs.readFileSync('localhost-key.pem'),
//   cert: fs.readFileSync('localhost.pem')
// }, app);

// const io = new Server(server, {
//   cors: {
//     origin: 'https://localhost:5173', // Replace with your React app's URL
//     methods: ['GET', 'POST'],
//     credentials: true
//   }
// });

// const port = process.env.PORT || 3000;

// let players = {};
// let readyPlayers = 0;

// app.use(cors({
//   origin: 'https://localhost:5173', // Replace with your React app's URL
//   methods: ['GET', 'POST'],
//   credentials: true
// }));

// io.on('connection', (socket) => {
//   console.log('a user connected:', socket.id);

//   socket.on('joinLobby', (username) => {
//     players[socket.id] = { username, ready: false };
//     io.emit('players', players);
//   });

//   socket.on('setReady', (ready) => {
//     if (players[socket.id]) {
//       players[socket.id].ready = ready;
//       if (ready) {
//         readyPlayers++;
//       } else {
//         readyPlayers--;
//       }
//       io.emit('players', players);
//       if (readyPlayers === Object.keys(players).length) {
//         io.emit('startGame');
//       }
//     }
//   });

//   socket.on('disconnect', () => {
//     console.log('user disconnected:', socket.id);
//     delete players[socket.id];
//     readyPlayers--;
//     io.emit('players', players);
//   });
// });

// server.listen(port, () => {
//   console.log(`Server listening on port ${port}`);
// });



const express = require('express');
const fs = require('fs');
const https = require('https');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = https.createServer({
  key: fs.readFileSync(path.join(__dirname, 'localhost-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'localhost.pem'))
}, app);

const io = new Server(server, {
  cors: {
    origin: 'https://localhost:5173', // Use HTTPS
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const port = process.env.PORT || 3000;

let players = {};
let readyPlayers = 0;

app.use(cors({
  origin: 'https://localhost:5173', // Use HTTPS
  methods: ['GET', 'POST'],
  credentials: true,
}));

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinLobby', ({ username, room }, callback) => {
    console.log('joinLobby event received', { username, room });
    if (!username || !room) {
      console.log('Error: username or room is undefined');
      if (callback) callback({ success: false, message: 'username or room is undefined' });
      return;
    }
    players[socket.id] = { username, room, ready: false, position: { x: 5, y: 5 } };
    io.emit('players', players);
    console.log(`Player ${socket.id} joined room ${room} with username ${username}`);
    if (callback) callback({ success: true });
  });

  socket.on('setReady', ({ ready, room }) => {
    console.log(`Player ${socket.id} set ready to ${ready} in room ${room}`);
    if (players[socket.id]) {
      players[socket.id].ready = ready;
      if (ready) {
        readyPlayers++;
      } else {
        readyPlayers--;
      }
      io.emit('players', players);
      const allReady = Object.values(players).every(player => player.ready && player.room === room);
      if (allReady) {
        io.emit('startGame');
      }
    }
  });

  socket.on('movePlayer', ({ x, y, room }) => {
    if (players[socket.id] && players[socket.id].room === room) {
      players[socket.id].position = { x, y };
      io.emit('players', players);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (players[socket.id] && players[socket.id].ready) {
      readyPlayers--;
    }
    delete players[socket.id];
    io.emit('players', players);
  });
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
