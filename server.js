// server.js - WebSocket server for multiplayer functionality
const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Set up Express app
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Player data storage
const players = {};
const balloons = [];
const MAX_PLAYERS = 10;

// Game state
let gameState = {
  players: players,
  balloons: balloons
};

// Initial balloon setup (similar to your original game)
function createInitialBalloons() {
  for (let i = 0; i < 50; i++) {
    balloons.push({
      id: `balloon-${i}`,
      position: {
        x: (Math.random() - 0.5) * 2500,
        y: 10 + Math.random() * 1500,
        z: (Math.random() - 0.5) * 1000
      },
      color: Math.random() * 0xffffff,
      active: true
    });
  }
}

createInitialBalloons();

// Handle WebSocket connections
wss.on('connection', (ws) => {
  // Generate a unique ID for the new player
  const playerId = uuidv4();
  
  // Initial player setup
  players[playerId] = {
    id: playerId,
    name: `Player ${Object.keys(players).length + 1}`, // Default name until player sets it
    position: { x: 2, y: 8, z: 50 },
    quaternion: { _x: 0, _y: 0, _z: 0, _w: 1 },
    planeType: 'planeOne',
    planeConfig: null, // Will be set when player sends info
    score: 0,
    health: 100,
    bullets: []
  };
  
  // Send initial game state to the new player
  ws.send(JSON.stringify({
    type: 'init',
    playerId: playerId,
    gameState: gameState
  }));
  
  // Broadcast new player to all connected clients
  broadcastToAll({
    type: 'newPlayer',
    playerId: playerId,
    player: players[playerId]
  });
  
  console.log(`Player ${playerId} connected. Total players: ${Object.keys(players).length}`);
  
  // Handle messages from client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'playerInfo':
          // Update player info (name, plane type, plane config)
          if (players[playerId]) {
            players[playerId].name = data.name || players[playerId].name;
            players[playerId].planeType = data.planeType || players[playerId].planeType;
            players[playerId].planeConfig = data.planeConfig || players[playerId].planeConfig;
            
            // Broadcast updated player info to all players
            broadcastToAll({
              type: 'playerUpdate',
              playerId: playerId,
              name: players[playerId].name,
              planeType: players[playerId].planeType,
              planeConfig: players[playerId].planeConfig
            });
            
            console.log(`Player ${playerId} set name to: ${players[playerId].name}`);
          }
          break;
          
        case 'playerUpdate':
          // Update player position and orientation
          if (players[data.playerId]) {
            players[data.playerId].position = data.position;
            players[data.playerId].quaternion = data.quaternion;
            players[data.playerId].planeType = data.planeType;
            players[data.playerId].planeConfig = data.planeConfig;
            players[data.playerId].health = data.health;
            
            // Broadcast player update to all other players
            broadcastToAllExcept(data, data.playerId);
          }
          break;
          
        case 'shoot':
          // Handle shooting (create bullets)
          if (players[data.playerId]) {
            const bulletId = `bullet-${data.playerId}-${Date.now()}`;
            const bullet = {
              id: bulletId,
              playerId: data.playerId,
              position: data.position,
              velocity: data.velocity,
              createdAt: Date.now()
            };
            
            // Add to player's bullets
            players[data.playerId].bullets.push(bullet);
            
            // Broadcast bullet creation to all players
            broadcastToAll({
              type: 'newBullet',
              bulletId: bulletId,
              bullet: bullet
            });
          }
          break;
          
        case 'balloonHit':
          // Handle balloon hit
          const balloonIndex = balloons.findIndex(b => b.id === data.balloonId);
          
          if (balloonIndex !== -1 && balloons[balloonIndex].active) {
            balloons[balloonIndex].active = false;
            
            // Increase player score
            if (players[data.playerId]) {
              players[data.playerId].score += 10;
              
              // Broadcast score update and balloon hit
              broadcastToAll({
                type: 'balloonHit',
                balloonId: data.balloonId,
                playerId: data.playerId,
                position: data.position,
                newScore: players[data.playerId].score
              });
              
              // Respawn balloon after 2 seconds
              setTimeout(() => {
                balloons[balloonIndex] = {
                  id: `balloon-${Date.now()}`,
                  position: {
                    x: (Math.random() - 0.5) * 2500,
                    y: 10 + Math.random() * 1500,
                    z: (Math.random() - 0.5) * 1000
                  },
                  color: Math.random() * 0xffffff,
                  active: true
                };
                
                // Broadcast new balloon
                broadcastToAll({
                  type: 'newBalloon',
                  balloon: balloons[balloonIndex]
                });
              }, 2000);
            }
          }
          break;
          
        case 'playerHit':
          // Handle player hit by bullet
          const targetPlayerId = data.targetId;
          const shooterId = data.shooterId;
          
          if (players[targetPlayerId] && players[shooterId]) {
            // Reduce health by 5
            players[targetPlayerId].health -= 5;
            if (players[targetPlayerId].health < 0) {
              players[targetPlayerId].health = 0;
            }
            
            // Broadcast hit information to all players
            broadcastToAll({
              type: 'playerHit',
              targetId: targetPlayerId,
              shooterId: shooterId,
              position: data.position,
              newHealth: players[targetPlayerId].health
            });
            
            console.log(`Player ${shooterId} hit player ${targetPlayerId}. New health: ${players[targetPlayerId].health}`);
            
            // If health reached 0, handle death (respawn handled client-side)
            if (players[targetPlayerId].health <= 0) {
              console.log(`Player ${targetPlayerId} was destroyed by ${shooterId}`);
              
              // Reset health to full for respawn
              players[targetPlayerId].health = 100;
              
              // Broadcast death event
              broadcastToAll({
                type: 'playerKilled',
                targetId: targetPlayerId,
                shooterId: shooterId,
                position: data.position
              });
            }
          }
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log(`Player ${playerId} disconnected`);
    
    // Broadcast player disconnection
    broadcastToAll({
      type: 'playerDisconnected',
      playerId: playerId
    });
    
    // Remove player from server
    delete players[playerId];
  });
  
  // Store the WebSocket connection with the player ID
  ws.playerId = playerId;
});

// Helper: Broadcast to all connected clients
function broadcastToAll(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Helper: Broadcast to all except one player
function broadcastToAllExcept(data, excludePlayerId) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.playerId !== excludePlayerId) {
      client.send(JSON.stringify(data));
    }
  });
}

// Clean up expired bullets - run every second
setInterval(() => {
  const now = Date.now();
  const BULLET_LIFESPAN = 5000; // 5 seconds
  
  Object.keys(players).forEach(playerId => {
    const player = players[playerId];
    const initialBulletCount = player.bullets.length;
    
    // Filter out expired bullets
    player.bullets = player.bullets.filter(bullet => {
      return (now - bullet.createdAt) < BULLET_LIFESPAN;
    });
    
    // If bullets were removed, notify clients
    if (initialBulletCount !== player.bullets.length) {
      broadcastToAll({
        type: 'bulletsUpdate',
        playerId: playerId,
        bullets: player.bullets
      });
    }
  });
}, 1000);

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`...Server running on port ${PORT}...`);
});