// import express from 'express';
import express = require('express');

// import http from 'http';
import http = require('http');
import { Server, Socket } from 'socket.io';
import cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 2000, pingTimeout: 5000 });
const port = 3000;

app.use(express.static('public'));
app.use(cors({
    origin: 'https://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  // app.get('/', (req, res) => {
//   res.sendFile(__dirname + '/index.html');
// });

interface Canvas {
  width: number;
  height: number;
}

interface Player {
  x: number;
  y: number;
  color: string;
  sequencenumber: number;
  score: number;
  vel: number;
  radius: number;
  isdouble: boolean;
  canvas?: Canvas; // Add canvas property
}

interface Coin {
  x: number;
  y: number;
  colornum: number;
  isdouble: boolean;
}

interface PowerUp {
  type: string;
  x: number;
  y: number;
}

interface Instance {
  id: number;
  league: string;
  players: { [key: string]: Player };
  coins: { [key: string]: Coin };
  coinId: number;
  coinRadius: number;
  powerUps: { [key: string]: PowerUp };
  powerUpId: number;
  powerUpRadius: number;
  coinSpawnInterval: NodeJS.Timeout | null;
  countdown: NodeJS.Timeout | null;
}

const instances: Instance[] = [];
let instanceIdCounter = 0;

const createInstance = (league: string): Instance => {
  const instance: Instance = {
    id: instanceIdCounter++,
    league,
    players: {},
    coins: {},
    coinId: 0,
    coinRadius: 15,
    powerUps: {},
    powerUpId: 0,
    powerUpRadius: 20,
    coinSpawnInterval: null,
    countdown: null,
  };

  instance.coinSpawnInterval = setInterval(() => {
    if (Object.keys(instance.players).length > 2) {
      instance.coinId++;
      instance.coins[instance.coinId] = {
        x: 100 + Math.random() * 1600,
        y: 100 + Math.random() * 700,
        colornum: Math.ceil(Math.random() * 100),
        isdouble: false,
      };
      setTimeout(() => {
        if (instance.coinSpawnInterval) {
          clearInterval(instance.coinSpawnInterval);
        }
      }, 13000);
    }
  }, 2000);

  instances.push(instance);
  return instance;
};

io.on('connection', (socket: Socket) => {
  let currentInstance: Instance | undefined;
  let playerLeague: string;

  socket.on('selectLeague', (league: string) => {
    playerLeague = league;

    // Find an instance with the same league that isn't full
    currentInstance = instances.find(
      (instance) =>
        instance.league === playerLeague && Object.keys(instance.players).length < 3
    );

    // If no instance is found, create a new one
    if (!currentInstance) {
      currentInstance = createInstance(playerLeague);
    }

    console.log(`Player ${socket.id} joined instance ${currentInstance.id} in league ${playerLeague}`);

    currentInstance.players[socket.id] = {
      x: 500 * Math.random(),
      y: 500 * Math.random(),
      color: `hsl(${Math.random() * 360},100%,50%)`,
      sequencenumber: 0,
      score: 0,
      vel: 0,
      radius: 10,
      isdouble: false,
    };

    if (Object.keys(currentInstance.players).length === 3) {
      let countdown = 5;
      currentInstance.countdown = setInterval(() => {
        io.to(`instance-${currentInstance!.id}`).emit('countdown', countdown);
        countdown--;
        if (countdown < 0) {
          for (const playerId in currentInstance!.players) {
            currentInstance!.players[playerId].vel = 10;
          }
          if (currentInstance!.countdown) {
            clearInterval(currentInstance!.countdown);
          }
          io.to(`instance-${currentInstance!.id}`).emit('countdown', 'Go!');
        }
      }, 1000);

      setTimeout(() => {
        io.to(`instance-${currentInstance!.id}`).emit('countdown', 'Stop!');
        for (const playerId in currentInstance!.players) {
          currentInstance!.players[playerId].vel = 0;
        }
      }, 16000);
    }

    io.to(`instance-${currentInstance.id}`).emit('updatePlayers', currentInstance.players);

    socket.join(`instance-${currentInstance.id}`);
  });

  socket.on('initcanvas', ({ width, height, devicepixelratio }: { width: number; height: number; devicepixelratio: number }) => {
    if (currentInstance) {
      currentInstance.players[socket.id].canvas = { width, height };
      currentInstance.players[socket.id].radius = devicepixelratio > 1 ? 20 : 10;
    }
  });

  socket.on('placePowerUp', ({ type, x, y }: { type: string; x: number; y: number }) => {
    if (currentInstance) {
      currentInstance.powerUpId++;
      currentInstance.powerUps[currentInstance.powerUpId] = { type, x, y };
    }
  });

  socket.on('keydown', ({ keycode, sequencenumber }: { keycode: string; sequencenumber: number }) => {
    if (currentInstance && currentInstance.players[socket.id]) {
      currentInstance.players[socket.id].sequencenumber = sequencenumber;
      switch (keycode) {
        case 'KeyW':
          currentInstance.players[socket.id].y -= currentInstance.players[socket.id].vel;
          break;
        case 'KeyA':
          currentInstance.players[socket.id].x -= currentInstance.players[socket.id].vel;
          break;
        case 'KeyS':
          currentInstance.players[socket.id].y += currentInstance.players[socket.id].vel;
          break;
        case 'KeyD':
          currentInstance.players[socket.id].x += currentInstance.players[socket.id].vel;
          break;
      }
    }
  });
});

setInterval(() => {
  instances.forEach((instance) => {
    for (const playerId in instance.players) {
      const player = instance.players[playerId];

      for (const coinId in instance.coins) {
        const coin = instance.coins[coinId];
        const distance = Math.hypot(player.x - coin.x, player.y - coin.y);
        if (distance <= player.radius + instance.coinRadius) {
          const cond = player.isdouble;
          const inc = coin.colornum % 10;
          if (inc <= 3) {
            if (cond) {
              player.score += 20;
              player.isdouble = false;
            } else {
              player.score += 10;
            }
          } else if (inc > 3 && inc <= 6) {
            if (cond) {
              player.score += 40;
              player.isdouble = false;
            } else {
              player.score += 20;
            }
          } else if (inc > 6 && inc <= 8) {
            if (cond) {
              player.score += 100;
              player.isdouble = false;
            } else {
              player.score += 50;
            }
          } else {
            player.isdouble = true;
          }

          delete instance.coins[coinId];
          break;
        }
      }

      for (const powerUpId in instance.powerUps) {
        const powerUp = instance.powerUps[powerUpId];
        const distance = Math.hypot(player.x - powerUp.x, player.y - powerUp.y);
        if (distance <= player.radius + instance.powerUpRadius) {
          if (powerUp.type === 'speed') {
            player.vel = 25;
            setTimeout(() => {
              player.vel = 10;
            }, 10000);
          } else if (powerUp.type === 'slow') {
            player.vel = 3;
            setTimeout(() => {
              player.vel = 10;
            }, 10000);
          } else if (powerUp.type === 'freeze') {
            player.vel = 0;
            setTimeout(() => {
              player.vel = 10;
            }, 10000);
          }
          delete instance.powerUps[powerUpId];
          break;
        }
      }
    }

    io.to(`instance-${instance.id}`).emit('updatePlayers', instance.players);
    io.to(`instance-${instance.id}`).emit('updateCoins', instance.coins);
    io.to(`instance-${instance.id}`).emit('updatePowerUps', instance.powerUps);
  });
}, 15);

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
