// assets/js/network.js - Fixed version with reconnection loop fix

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { scene, player } from './sceneSetup.js';
import { Plane } from './planeControls.js';
import { showMessage } from './main.js';
import { createEnhancedExplosion, createBalloon } from './environment.js';

let socket;
let playerId;
let playerName = "";
let remotePlayers = {};
let serverGameState;
let isConnected = false;
let pingInterval;
let reconnectTimeout = null;  // Track the reconnection timeout
let lastUpdateTime = Date.now();
let manualDisconnect = false; // Flag to track if disconnect was manual
const UPDATE_RATE = 50; // ms between updates

// WebSocket connection URL - change to your actual server address
let SERVER_URL;
if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    // For local development
    SERVER_URL = 'ws://192.168.14.27:3000';
} else {
    // For server deployment
    SERVER_URL = `ws://${window.location.hostname}:3000`;
}

// Make socket accessible globally for debugging and other modules
window.socket = null;

// Initialize network connection
function initializeNetwork() {
    // Clear any existing reconnect timeout
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    try {
        // Close any existing connection first
        if (socket && socket.readyState !== WebSocket.CLOSED) {
            manualDisconnect = true; // Mark this as a manual disconnect
            socket.close();
            // Reset the flag after a short delay
            setTimeout(() => {
                manualDisconnect = false;
            }, 100);
        }
        
        socket = new WebSocket(SERVER_URL);
        window.socket = socket;
        
        socket.onopen = () => {
            console.log('Connected to server');
            isConnected = true;
            showMessage('Connected to multiplayer server');
            
            // Send player info to server once connected
            sendPlayerInfo();
            
            // Send position updates to the server AFTER connection is established
            clearInterval(pingInterval); // Clear any existing interval
            pingInterval = setInterval(sendPositionUpdate, UPDATE_RATE);
        };
        
        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleServerMessage(data);
            } catch (error) {
                console.error('Error parsing server message:', error);
            }
        };
        
        socket.onclose = () => {
            console.log('Disconnected from server');
            isConnected = false;
            
            // Clean up resources
            clearInterval(pingInterval);
            
            // Only show message and clean up if not a manual disconnect for reconnection
            if (!manualDisconnect) {
                showMessage('Disconnected from server');
                
                // Clean up remote players
                Object.keys(remotePlayers).forEach(id => {
                    removeRemotePlayer(id);
                });
                
                // Try to reconnect after a delay, but only if not manually disconnected
                reconnectTimeout = setTimeout(initializeNetwork, 5000);
            }
        };
        
        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            isConnected = false;
            // Don't close here, let the onclose handler handle it
        };
    } catch (error) {
        console.error('Error initializing network:', error);
        // Only set up reconnect if there's not already one pending
        if (!reconnectTimeout) {
            reconnectTimeout = setTimeout(initializeNetwork, 5000);
        }
    }
}

// Properly disconnect from the server
function disconnectFromServer() {
    // Clear any pending reconnections
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    
    // Clear update interval
    if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
    }
    
    // Set manual disconnect flag
    manualDisconnect = true;
    
    // Close the connection if it exists
    if (socket && socket.readyState !== WebSocket.CLOSED) {
        socket.close();
    }
    
    // Clean up state
    isConnected = false;
    
    // Clean up remote players
    Object.keys(remotePlayers).forEach(id => {
        removeRemotePlayer(id);
    });
    
    console.log('Manually disconnected from server');
    
    // Reset the flag after a short delay
    setTimeout(() => {
        manualDisconnect = false;
    }, 100);
}

// Send player information to server
function sendPlayerInfo() {
    if (!isConnected || !socket || socket.readyState !== WebSocket.OPEN) return;
    
    try {
        const playerInfo = {
            type: 'playerInfo',
            name: playerName,
            planeType: window.currentPlane?.type || 'planeOne',
            planeConfig: window.currentPlane?.config || null
        };
        
        socket.send(JSON.stringify(playerInfo));
    } catch (error) {
        console.error('Error sending player info:', error);
    }
}

// Handle incoming server messages
function handleServerMessage(data) {
    if (!data || !data.type) {
        console.error('Invalid message format:', data);
        return;
    }
    
    switch (data.type) {
        case 'init':
            // Initialize with server data
            playerId = data.playerId;
            serverGameState = data.gameState;
            
            // Create remote players that already exist
            if (serverGameState && serverGameState.players) {
                Object.keys(serverGameState.players).forEach(id => {
                    if (id !== playerId) {
                        createRemotePlayer(id, serverGameState.players[id]);
                    }
                });
            }
            
            showMessage(`Joined as Player: ${playerName || playerId.substring(0, 8)}`);
            break;
            
        case 'newPlayer':
            // New player joined
            if (data.playerId !== playerId && data.player) {
                createRemotePlayer(data.playerId, data.player);
                showMessage(`Player ${data.player.name || data.playerId.substring(0, 8)} joined`);
            }
            break;
            
        case 'playerUpdate':
            // Update remote player position
            if (data.playerId && remotePlayers[data.playerId]) {
                updateRemotePlayer(
                    data.playerId, 
                    data.position || { x: 0, y: 0, z: 0 }, 
                    data.quaternion || { _x: 0, _y: 0, _z: 0, _w: 1 }, 
                    data.planeType, 
                    data.planeConfig
                );
            }
            break;
            
        case 'playerDisconnected':
            // Player disconnected
            if (data.playerId && remotePlayers[data.playerId]) {
                const playerName = remotePlayers[data.playerId].name || data.playerId.substring(0, 8);
                showMessage(`Player ${playerName} left`);
                removeRemotePlayer(data.playerId);
            }
            break;
            
        case 'newBullet':
            // Create a bullet from another player
            if (data.bullet && data.bullet.playerId !== playerId) {
                createRemoteBullet(data.bullet);
            }
            break;
            
        case 'balloonHit':
            // Balloon hit by any player
            if (data.playerId === playerId) {
                showMessage(`You hit a balloon! Score: ${data.newScore}`);
            } else if (data.playerId && remotePlayers[data.playerId]) {
                const shooterName = remotePlayers[data.playerId].name || data.playerId.substring(0, 8);
                showMessage(`Player ${shooterName} hit a balloon! Score: ${data.newScore}`);
            }
            
            if (data.position) {
                createEnhancedExplosion(new THREE.Vector3(
                    data.position.x, 
                    data.position.y, 
                    data.position.z
                ));
            }
            break;
            
        case 'playerHit':
            // Player hit by bullet
            if (!data.targetId || !data.shooterId) break;
            
            if (data.targetId === playerId) {
                // Local player was hit
                const shooterName = remotePlayers[data.shooterId]?.name || data.shooterId.substring(0, 8);
                showMessage(`You were hit by ${shooterName}!`);
                
                // Apply damage to local player
                if (window.currentPlane) {
                    window.currentPlane.takeDamage(5);
                }
                
                // Visual feedback at hit position
                if (data.position) {
                    createEnhancedExplosion(new THREE.Vector3(
                        data.position.x,
                        data.position.y,
                        data.position.z
                    ));
                }
            } else if (data.shooterId === playerId) {
                // You hit someone else
                const targetName = remotePlayers[data.targetId]?.name || data.targetId.substring(0, 8);
                showMessage(`You hit ${targetName}!`);
                
                // Update remote player's health in our local representation
                if (remotePlayers[data.targetId]) {
                    remotePlayers[data.targetId].health = data.newHealth || remotePlayers[data.targetId].health - 5;
                    updateRemotePlayerHealthBar(data.targetId);
                }
            } else {
                // Someone hit someone else
                if (remotePlayers[data.targetId]) {
                    remotePlayers[data.targetId].health = data.newHealth || remotePlayers[data.targetId].health - 5;
                    updateRemotePlayerHealthBar(data.targetId);
                }
            }
            break;
            
        case 'bulletsUpdate':
            // Update bullets for a remote player
            if (data.playerId && data.bullets && remotePlayers[data.playerId]) {
                // Remove old bullets from the scene
                if (remotePlayers[data.playerId].bullets && remotePlayers[data.playerId].bullets.length > 0) {
                    remotePlayers[data.playerId].bullets.forEach(bullet => {
                        if (bullet && scene.getObjectById(bullet.id)) {
                            scene.remove(bullet);
                        }
                    });
                }
                
                // Reset bullets array
                remotePlayers[data.playerId].bullets = [];
                
                // Create new bullets based on updated data
                data.bullets.forEach(bulletData => {
                    if (bulletData) {
                        createRemoteBullet({
                            id: bulletData.id,
                            playerId: data.playerId,
                            position: bulletData.position,
                            velocity: bulletData.velocity
                        });
                    }
                });
            }
            break;
            
        case 'newBalloon':
            // Add new balloon to the scene
            if (data.balloon) {
                // Check if we have a createBalloon function in the game
                if (typeof window.createBalloon === 'function') {
                    window.createBalloon(data.balloon);
                } else if (typeof createBalloon === 'function') {
                    createBalloon(data.balloon);
                } else {
                    console.log('Balloon creation function not found');
                }
            }
            break;
            
        case 'playerKilled':
            // Handle player death
            if (!data.targetId || !data.shooterId) break;
            
            if (data.targetId === playerId) {
                // Local player was killed - client-side respawn is handled in planeControls.js
                const shooterName = remotePlayers[data.shooterId]?.name || data.shooterId.substring(0, 8);
                showMessage(`You were destroyed by ${shooterName}!`);
            } else if (data.shooterId === playerId) {
                // You killed another player
                const targetName = remotePlayers[data.targetId]?.name || data.targetId.substring(0, 8);
                showMessage(`You destroyed ${targetName}!`);
                
                // Update remote player's health in our local representation
                if (remotePlayers[data.targetId]) {
                    remotePlayers[data.targetId].health = 100; // Reset health for respawn
                    updateRemotePlayerHealthBar(data.targetId);
                }
            } else {
                // Someone killed someone else
                if (remotePlayers[data.targetId] && remotePlayers[data.shooterId]) {
                    const targetName = remotePlayers[data.targetId].name || data.targetId.substring(0, 8);
                    const shooterName = remotePlayers[data.shooterId].name || data.shooterId.substring(0, 8);
                    showMessage(`${shooterName} destroyed ${targetName}!`);
                    
                    // Update remote player's health in our local representation
                    remotePlayers[data.targetId].health = 100; // Reset health for respawn
                    updateRemotePlayerHealthBar(data.targetId);
                }
            }
            
            // Create explosion at the position where the player was killed
            if (data.position) {
                createEnhancedExplosion(new THREE.Vector3(
                    data.position.x,
                    data.position.y,
                    data.position.z
                ));
            }
            break;
            
        default:
            console.log('Unhandled message type:', data.type);
            break;
    }
}

// Create a representation of another player
function createRemotePlayer(id, playerData) {
    if (!id || !playerData) {
        console.error('Invalid remote player data:', id, playerData);
        return;
    }
    
    // Use the plane type sent from the remote player if available
    const planeType = playerData.planeType || 'planeOne';
    const planeConfig = playerData.planeConfig || null;
    
    try {
        const remotePlane = new Plane(planeType);
        
        if (planeConfig) {
            // Override with the remote player's plane configuration
            remotePlane.config = planeConfig;
            // Recreate the plane with the custom config
            remotePlane.group = remotePlane.createPlane(planeConfig);
        }
        
        remotePlane.group.position.set(0, 0, 0); // The position comes from the parent Object3D
        
        const remotePlayerObj = new THREE.Object3D();
        remotePlayerObj.add(remotePlane.group);
        
        // Set position from server data
        if (playerData.position) {
            remotePlayerObj.position.set(
                playerData.position.x || 0,
                playerData.position.y || 0,
                playerData.position.z || 0
            );
        }
        
        // Create a name tag for the remote player
        const displayName = playerData.name || id.substring(0, 8);
        const nameTag = createPlayerNameTag(displayName);
        nameTag.position.set(0, 10, 0);
        remotePlayerObj.add(nameTag);
        
        // Create health bar for the remote player
        const healthBar = createHealthBar();
        healthBar.position.set(0, 12, 0);
        remotePlayerObj.add(healthBar);
        
        scene.add(remotePlayerObj);
        
        // Store reference to the remote player
        remotePlayers[id] = {
            object: remotePlayerObj,
            plane: remotePlane,
            name: displayName,
            health: playerData.health || 100,
            healthBar: healthBar,
            bullets: []
        };
        
        console.log(`Created remote player: ${displayName}`);
    } catch (error) {
        console.error('Error creating remote player:', error);
    }
}

// Create a text label for player identification
function createPlayerNameTag(name) {
    try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = 'Bold 24px Arial';
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.fillText(name, canvas.width/2, canvas.height/2 + 8);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(20, 5, 1);
        
        return sprite;
    } catch (error) {
        console.error('Error creating player name tag:', error);
        // Return a default sprite if there's an error
        const material = new THREE.SpriteMaterial({ color: 0xffffff });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(10, 2, 1);
        return sprite;
    }
}

// Create a health bar for players
function createHealthBar() {
    try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 100;
        canvas.height = 10;
        
        // Background
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Health fill
        context.fillStyle = '#00ff00';
        context.fillRect(2, 2, 96, 6);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(15, 2, 1);
        
        return sprite;
    } catch (error) {
        console.error('Error creating health bar:', error);
        // Return a default sprite if there's an error
        const material = new THREE.SpriteMaterial({ color: 0x00ff00 });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(15, 2, 1);
        return sprite;
    }
}

// Update the health bar of a remote player
function updateRemotePlayerHealthBar(playerId) {
    if (!remotePlayers[playerId] || !remotePlayers[playerId].healthBar) return;
    
    try {
        const health = remotePlayers[playerId].health;
        const healthBar = remotePlayers[playerId].healthBar;
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 100;
        canvas.height = 10;
        
        // Background
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Health fill - color changes based on health level
        let fillColor;
        if (health > 60) {
            fillColor = '#00ff00'; // Green
        } else if (health > 30) {
            fillColor = '#ffff00'; // Yellow
        } else {
            fillColor = '#ff0000'; // Red
        }
        
        context.fillStyle = fillColor;
        context.fillRect(2, 2, Math.max(0, health * 0.96), 6); // Width based on health percentage
        
        // Update the texture
        const texture = new THREE.CanvasTexture(canvas);
        healthBar.material.map.dispose();
        healthBar.material.map = texture;
        healthBar.material.needsUpdate = true;
    } catch (error) {
        console.error('Error updating health bar:', error);
    }
}

// Update remote player position and orientation
function updateRemotePlayer(id, position, quaternion, planeType, planeConfig) {
    if (!id || !remotePlayers[id] || !remotePlayers[id].object) return;
    
    try {
        const remotePlayer = remotePlayers[id].object;
        
        // Update position - with safety checks
        if (position) {
            remotePlayer.position.set(
                position.x !== undefined ? position.x : remotePlayer.position.x,
                position.y !== undefined ? position.y : remotePlayer.position.y,
                position.z !== undefined ? position.z : remotePlayer.position.z
            );
        }
        
        // Update orientation - with safety checks
        if (quaternion) {
            remotePlayer.quaternion.set(
                quaternion._x !== undefined ? quaternion._x : remotePlayer.quaternion.x,
                quaternion._y !== undefined ? quaternion._y : remotePlayer.quaternion.y,
                quaternion._z !== undefined ? quaternion._z : remotePlayer.quaternion.z,
                quaternion._w !== undefined ? quaternion._w : remotePlayer.quaternion.w
            );
        }
        
        // Update plane type if changed
        const currentConfig = remotePlayers[id].plane.config;
        if ((planeType && remotePlayers[id].plane.type !== planeType) || 
            (planeConfig && JSON.stringify(currentConfig) !== JSON.stringify(planeConfig))) {
            
            try {
                remotePlayer.remove(remotePlayers[id].plane.group);
                
                remotePlayers[id].plane = new Plane(planeType || remotePlayers[id].plane.type);
                if (planeConfig) {
                    // Override with the remote player's plane configuration
                    remotePlayers[id].plane.config = planeConfig;
                    // Recreate the plane with the custom config
                    remotePlayers[id].plane.group = remotePlayers[id].plane.createPlane(planeConfig);
                }
                
                remotePlayer.add(remotePlayers[id].plane.group);
            } catch (error) {
                console.error('Error updating remote player plane:', error);
            }
        }
    } catch (error) {
        console.error('Error updating remote player:', error);
    }
}

// Remove a remote player
function removeRemotePlayer(id) {
    if (!id || !remotePlayers[id]) return;
    
    try {
        scene.remove(remotePlayers[id].object);
        
        // Clean up any associated resources
        if (remotePlayers[id].bullets) {
            remotePlayers[id].bullets.forEach(bullet => {
                if (bullet && scene.getObjectById(bullet.id)) {
                    scene.remove(bullet);
                }
            });
        }
        
        delete remotePlayers[id];
        console.log(`Removed remote player: ${id}`);
    } catch (error) {
        console.error('Error removing remote player:', error);
    }
}

// Create a bullet fired by a remote player
function createRemoteBullet(bulletData) {
    if (!bulletData) return;
    
    try {
        const bulletGeometry = new THREE.SphereGeometry(1, 8, 5);
        const bulletMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffe400, 
            emissive: 0xff0000 
        });
        
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        
        if (bulletData.position) {
            bullet.position.set(
                bulletData.position.x || 0,
                bulletData.position.y || 0,
                bulletData.position.z || 0
            );
        }
        
        // Store velocity for animation
        bullet.velocity = new THREE.Vector3(
            bulletData.velocity?.x || 0,
            bulletData.velocity?.y || 0,
            bulletData.velocity?.z || 0
        );
        
        bullet.userData.bulletId = bulletData.id;
        bullet.userData.playerId = bulletData.playerId;
        
        scene.add(bullet);
        
        // Add to remote player's bullets if the player exists
        if (bulletData.playerId && remotePlayers[bulletData.playerId]) {
            if (!remotePlayers[bulletData.playerId].bullets) {
                remotePlayers[bulletData.playerId].bullets = [];
            }
            remotePlayers[bulletData.playerId].bullets.push(bullet);
        }
        
        // Set up collision detection for this bullet
        detectBulletCollisions(bullet);
    } catch (error) {
        console.error('Error creating remote bullet:', error);
    }
}

// Check if a bullet hits any player
function detectBulletCollisions(bullet) {
    if (!bullet) return;
    
    const checkCollisions = () => {
        // Don't check if bullet is gone
        if (!bullet || !scene.getObjectById(bullet.id)) return;
        
        try {
            // Check if this remote bullet hits the local player
            if (bullet.userData.playerId !== playerId) {
                const distance = bullet.position.distanceTo(player.position);
                
                if (distance < 15) { // Collision threshold
                    // Player hit by remote bullet
                    handleBulletHit(bullet.userData.playerId, playerId, bullet.position);
                    scene.remove(bullet);
                    return;
                }
            }
            
            // Check if this bullet hits any remote players
            // Only for bullets fired by the local player
            if (bullet.userData.playerId === playerId) {
                Object.keys(remotePlayers).forEach(id => {
                    if (!remotePlayers[id] || !remotePlayers[id].object) return;
                    
                    const remotePlayerObj = remotePlayers[id].object;
                    const distance = bullet.position.distanceTo(remotePlayerObj.position);
                    
                    if (distance < 15) { // Collision threshold
                        // Remote player hit by local bullet
                        handleBulletHit(playerId, id, bullet.position);
                        scene.remove(bullet);
                        return;
                    }
                });
            }
            
            // Continue checking if bullet is still active
            if (bullet && scene.getObjectById(bullet.id)) {
                requestAnimationFrame(checkCollisions);
            }
        } catch (error) {
            console.error('Error in bullet collision detection:', error);
        }
    };
    
    requestAnimationFrame(checkCollisions);
}

// Handle a bullet hit on a player
function handleBulletHit(shooterId, targetId, position) {
    if (!isConnected || !playerId || !socket || socket.readyState !== WebSocket.OPEN) return;
    
    try {
        const hitData = {
            type: 'playerHit',
            shooterId: shooterId,
            targetId: targetId,
            position: {
                x: position.x,
                y: position.y,
                z: position.z
            }
        };
        
        socket.send(JSON.stringify(hitData));
    } catch (error) {
        console.error('Error sending bullet hit:', error);
    }
}

// Send player position and orientation to server
function sendPositionUpdate() {
    if (!isConnected || !playerId || !socket || socket.readyState !== WebSocket.OPEN) return;
    
    try {
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
            planeType: window.currentPlane?.type || 'planeOne',
            planeConfig: window.currentPlane?.config || null,
            health: window.currentPlane?.health || 100
        };
        
        socket.send(JSON.stringify(update));
    } catch (error) {
        console.error('Error sending position update:', error);
    }
}

// Send bullet creation event to server
function sendBulletCreation(bulletPosition, bulletVelocity) {
    if (!isConnected || !playerId || !socket || socket.readyState !== WebSocket.OPEN) return;
    
    try {
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
    } catch (error) {
        console.error('Error sending bullet creation:', error);
    }
}

// Send balloon hit event to server
function sendBalloonHit(balloonId, position) {
    if (!isConnected || !playerId || !socket || socket.readyState !== WebSocket.OPEN) return;
    
    try {
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
    } catch (error) {
        console.error('Error sending balloon hit:', error);
    }
}

// Update bullets from remote players
function updateRemoteBullets() {
    Object.keys(remotePlayers).forEach(playerId => {
        const remotePlayer = remotePlayers[playerId];
        
        if (remotePlayer && remotePlayer.bullets && remotePlayer.bullets.length > 0) {
            for (let i = remotePlayer.bullets.length - 1; i >= 0; i--) {
                const bullet = remotePlayer.bullets[i];
                if (!bullet) {
                    remotePlayer.bullets.splice(i, 1);
                    continue;
                }
                
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

// Set player name
function setPlayerName(name) {
    playerName = name || playerName;
    
    // If already connected, update the server
    if (isConnected && playerId && socket && socket.readyState === WebSocket.OPEN) {
        sendPlayerInfo();
    }
}

export { 
    initializeNetwork, 
    sendBulletCreation, 
    sendBalloonHit,
    updateRemoteBullets,
    isConnected,
    playerId,
    remotePlayers,
    setPlayerName,
    playerName,
    disconnectFromServer  // Export the disconnect function
};