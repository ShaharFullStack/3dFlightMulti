// assets/js/network.js

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { scene, player } from './sceneSetup.js';
import { Plane } from './planeControls.js';
import { showMessage } from './main.js';
import { createEnhancedExplosion } from './environment.js';

let socket;
let playerId;
let remotePlayers = {};
let serverGameState;
let isConnected = false;
let pingInterval;
let lastUpdateTime = Date.now();
const UPDATE_RATE = 50; // ms between updates

// WebSocket connection URL - change to your actual server address
// במקום הקוד הנוכחי, שנה ל:
let SERVER_URL;
if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    // אם המשחק נטען מסביבת פיתוח מקומית
    SERVER_URL = 'ws://192.168.14.27:3000';
} else {
    // אם המשחק נטען ישירות משרת המשחק
    SERVER_URL = `ws://${window.location.hostname}:3000`;
}

    

// Initialize network connection
function initializeNetwork() {
    try {
        socket = new WebSocket(SERVER_URL);
        
        socket.onopen = () => {
            console.log('Connected to server');
            isConnected = true;
            showMessage('Connected to multiplayer server');
            
            // Send position updates to the server
            pingInterval = setInterval(sendPositionUpdate, UPDATE_RATE);
        };
        
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleServerMessage(data);
        };
        
        socket.onclose = () => {
            console.log('Disconnected from server');
            isConnected = false;
            showMessage('Disconnected from server');
            clearInterval(pingInterval);
            
            // Clean up remote players
            Object.keys(remotePlayers).forEach(id => {
                removeRemotePlayer(id);
            });
            
            // Try to reconnect after a delay
            setTimeout(initializeNetwork, 5000);
        };
        
        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            socket.close();
        };
    } catch (error) {
        console.error('Error initializing network:', error);
        setTimeout(initializeNetwork, 5000);
    }
}

// Handle incoming server messages
function handleServerMessage(data) {
    switch (data.type) {
        case 'init':
            // Initialize with server data
            playerId = data.playerId;
            serverGameState = data.gameState;
            
            // Create remote players that already exist
            Object.keys(serverGameState.players).forEach(id => {
                if (id !== playerId) {
                    createRemotePlayer(id, serverGameState.players[id]);
                }
            });
            
            showMessage(`Joined as Player ID: ${playerId.substring(0, 8)}`);
            break;
            
        case 'newPlayer':
            // New player joined
            if (data.playerId !== playerId) {
                createRemotePlayer(data.playerId, data.player);
                showMessage(`Player ${data.playerId.substring(0, 8)} joined`);
            }
            break;
            
        case 'playerUpdate':
            // Update remote player position
            if (remotePlayers[data.playerId]) {
                updateRemotePlayer(data.playerId, data.position, data.quaternion, data.planeType);
            }
            break;
            
        case 'playerDisconnected':
            // Player disconnected
            if (remotePlayers[data.playerId]) {
                showMessage(`Player ${data.playerId.substring(0, 8)} left`);
                removeRemotePlayer(data.playerId);
            }
            break;
            
        case 'newBullet':
            // Create a bullet from another player
            if (data.bullet.playerId !== playerId) {
                createRemoteBullet(data.bullet);
            }
            break;
            
        case 'balloonHit':
            // Balloon hit by any player
            if (data.playerId === playerId) {
                showMessage(`You hit a balloon! Score: ${data.newScore}`);
            } else {
                showMessage(`Player ${data.playerId.substring(0, 8)} hit a balloon! Score: ${data.newScore}`);
            }
            createEnhancedExplosion(new THREE.Vector3(
                data.position.x, 
                data.position.y, 
                data.position.z
            ));
            break;
            
        case 'playerCollision':
            // Handle player collision effects
            showMessage(`Aircraft collision detected!`);
            const collisionPos = new THREE.Vector3(
                data.position.x,
                data.position.y,
                data.position.z
            );
            createEnhancedExplosion(collisionPos);
            createEnhancedExplosion(collisionPos);
            createEnhancedExplosion(collisionPos);
            break;
    }
}

// Create a representation of another player
function createRemotePlayer(id, playerData) {
    const remotePlane = new Plane(playerData.planeType);
    remotePlane.group.position.set(0, 0, 0); // The position comes from the parent Object3D
    
    const remotePlayerObj = new THREE.Object3D();
    remotePlayerObj.add(remotePlane.group);
    
    // Set position from server data
    remotePlayerObj.position.set(
        playerData.position.x,
        playerData.position.y,
        playerData.position.z
    );
    
    // Create a name tag for the remote player
    const nameTag = createPlayerNameTag(id.substring(0, 8));
    nameTag.position.set(0, 10, 0);
    remotePlayerObj.add(nameTag);
    
    scene.add(remotePlayerObj);
    
    // Store reference to the remote player
    remotePlayers[id] = {
        object: remotePlayerObj,
        plane: remotePlane
    };
    
    console.log(`Created remote player: ${id}`);
}

// Create a text label for player identification
function createPlayerNameTag(name) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.font = 'Bold 24px Arial';
    context.fillStyle = '#000000';
    context.textAlign = 'center';
    context.fillText(name, canvas.width/2, canvas.height/2 + 8);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(20, 5, 1);
    
    return sprite;
}

// Update remote player position and orientation
function updateRemotePlayer(id, position, quaternion, planeType) {
    if (!remotePlayers[id]) return;
    
    const remotePlayer = remotePlayers[id].object;
    
    // Update position
    remotePlayer.position.set(position.x, position.y, position.z);
    
    // Update orientation
    remotePlayer.quaternion.set(quaternion._x, quaternion._y, quaternion._z, quaternion._w);
    
    // Update plane type if changed
    if (remotePlayers[id].plane.type !== planeType) {
        remotePlayer.remove(remotePlayers[id].plane.group);
        remotePlayers[id].plane = new Plane(planeType);
        remotePlayer.add(remotePlayers[id].plane.group);
    }
}

// Remove a remote player
function removeRemotePlayer(id) {
    if (remotePlayers[id]) {
        scene.remove(remotePlayers[id].object);
        delete remotePlayers[id];
        console.log(`Removed remote player: ${id}`);
    }
}

// Create a bullet fired by a remote player
function createRemoteBullet(bulletData) {
    const bulletGeometry = new THREE.SphereGeometry(1, 8, 5);
    const bulletMaterial = new THREE.MeshLambertMaterial({ 
        color: 0xffe400, 
        emissive: 0xff0000 
    });
    
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bullet.position.set(
        bulletData.position.x,
        bulletData.position.y,
        bulletData.position.z
    );
    
    // Store velocity for animation
    bullet.velocity = new THREE.Vector3(
        bulletData.velocity.x,
        bulletData.velocity.y,
        bulletData.velocity.z
    );
    
    bullet.userData.bulletId = bulletData.id;
    bullet.userData.playerId = bulletData.playerId;
    
    scene.add(bullet);
    
    // Add to remote player's bullets if the player exists
    if (remotePlayers[bulletData.playerId]) {
        if (!remotePlayers[bulletData.playerId].bullets) {
            remotePlayers[bulletData.playerId].bullets = [];
        }
        remotePlayers[bulletData.playerId].bullets.push(bullet);
    }
}

// Send player position and orientation to server
function sendPositionUpdate() {
    if (!isConnected || !playerId) return;
    
    const now = Date.now();
    if (now - lastUpdateTime < UPDATE_RATE) return;
    lastUpdateTime = now;
    
    const update = {
        type: 'playerUpdate',
        playerId: playerId,
        position: {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z
        },
        quaternion: {
            _x: player.quaternion.x,
            _y: player.quaternion.y,
            _z: player.quaternion.z,
            _w: player.quaternion.w
        },
        planeType: window.currentPlane.type
    };
    
    socket.send(JSON.stringify(update));
}

// Send bullet creation event to server
function sendBulletCreation(bulletPosition, bulletVelocity) {
    if (!isConnected || !playerId) return;
    
    const bulletData = {
        type: 'shoot',
        playerId: playerId,
        position: {
            x: bulletPosition.x,
            y: bulletPosition.y,
            z: bulletPosition.z
        },
        velocity: {
            x: bulletVelocity.x,
            y: bulletVelocity.y,
            z: bulletVelocity.z
        }
    };
    
    socket.send(JSON.stringify(bulletData));
}

// Send balloon hit event to server
function sendBalloonHit(balloonId, position) {
    if (!isConnected || !playerId) return;
    
    const hitData = {
        type: 'balloonHit',
        playerId: playerId,
        balloonId: balloonId,
        position: {
            x: position.x,
            y: position.y,
            z: position.z
        }
    };
    
    socket.send(JSON.stringify(hitData));
}

// Send player collision event to server
function sendPlayerCollision(otherPlayerId, position) {
    if (!isConnected || !playerId) return;
    
    const collisionData = {
        type: 'playerCollision',
        player1Id: playerId,
        player2Id: otherPlayerId,
        position: {
            x: position.x,
            y: position.y,
            z: position.z
        }
    };
    
    socket.send(JSON.stringify(collisionData));
}

// Update bullets from remote players
function updateRemoteBullets() {
    Object.keys(remotePlayers).forEach(playerId => {
        const remotePlayer = remotePlayers[playerId];
        
        if (remotePlayer.bullets && remotePlayer.bullets.length > 0) {
            for (let i = remotePlayer.bullets.length - 1; i >= 0; i--) {
                const bullet = remotePlayer.bullets[i];
                
                // Update position
                bullet.position.add(bullet.velocity);
                
                // Remove if too far
                if (bullet.position.distanceTo(player.position) > 1200) {
                    scene.remove(bullet);
                    remotePlayer.bullets.splice(i, 1);
                }
            }
        }
    });
}

export { 
    initializeNetwork, 
    sendBulletCreation, 
    sendBalloonHit, 
    sendPlayerCollision,
    updateRemoteBullets,
    isConnected,
    playerId,
    remotePlayers
};