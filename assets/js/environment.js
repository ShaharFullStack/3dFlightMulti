// assets/js/environment.js (Updated for multiplayer)

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { scene, player } from './sceneSetup.js';
import { showMessage } from './main.js';
import { sendBalloonHit, remotePlayers, playerId } from './network.js';

let score = 0;
let difficultyLevel = 1;
const balloons = [];
let environmentCreated = false;

function createEnvironment() {
    if (environmentCreated) return;
    environmentCreated = true;
    
    const textureLoader = new THREE.TextureLoader();

    // River
    const riverCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-4000, 1, -2000),
        new THREE.Vector3(-3000, 1, -1000),
        new THREE.Vector3(-2000, 1, 0),
        new THREE.Vector3(-1000, 1, 1000),
        new THREE.Vector3(0, 1, 2000),
        new THREE.Vector3(1000, 1, 3000),
        new THREE.Vector3(2000, 1, 4000)
    ]);
    const riverRadius = 80;

    function isInRiverZone(x, z) {
        const samples = 100;
        let minDist = Infinity;
        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            const cp = riverCurve.getPoint(t);
            const dist = new THREE.Vector2(x, z).distanceTo(new THREE.Vector2(cp.x, cp.z));
            if (dist < minDist) minDist = dist;
        }
        return minDist < riverRadius * 1.2;
    }

    function createRiver() {
        const points = riverCurve.getPoints(300);
        const positions = [];
        const uvs = [];

        for (let i = 0; i < points.length - 1; i++) {
            const current = points[i];
            const next = points[i + 1];
            const tangent = new THREE.Vector3().subVectors(next, current).normalize();
            const up = new THREE.Vector3(0, 1, 0);
            const side = new THREE.Vector3().crossVectors(tangent, up).normalize();

            const leftCurrent = new THREE.Vector3().copy(current).addScaledVector(side, -riverRadius);
            const rightCurrent = new THREE.Vector3().copy(current).addScaledVector(side, riverRadius);
            const leftNext = new THREE.Vector3().copy(next).addScaledVector(side, -riverRadius);
            const rightNext = new THREE.Vector3().copy(next).addScaledVector(side, riverRadius);

            positions.push(leftCurrent.x, leftCurrent.y, leftCurrent.z);
            positions.push(rightCurrent.x, rightCurrent.y, rightCurrent.z);
            positions.push(rightNext.x, rightNext.y, rightNext.z);
            positions.push(leftCurrent.x, leftCurrent.y, leftCurrent.z);
            positions.push(rightNext.x, rightNext.y, rightNext.z);
            positions.push(leftNext.x, leftNext.y, leftNext.z);

            const t1 = i / points.length;
            const t2 = (i + 1) / points.length;
            uvs.push(0, t1, 1, t1, 1, t2);
            uvs.push(0, t1, 1, t2, 0, t2);
        }

        const riverGeometry = new THREE.BufferGeometry();
        riverGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        riverGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        riverGeometry.computeVertexNormals();

        const riverTexture = textureLoader.load('https://t3.ftcdn.net/jpg/00/81/38/10/360_F_81381061_bWZNA5A4G6ru9tnG61gTV0U8ub0nHBMi.jpg');
        riverTexture.wrapS = riverTexture.wrapT = THREE.RepeatWrapping;
        riverTexture.repeat.set(1, 5);

        const riverMaterial = new THREE.MeshPhongMaterial({ map: riverTexture });
        const riverMesh = new THREE.Mesh(riverGeometry, riverMaterial);
        riverMesh.receiveShadow = true;
        scene.add(riverMesh);
    }
    createRiver();

    // Houses
    for (let i = 0; i < 2000; i++) {
        let x, z;
        do {
            x = (Math.random() - 0.5) * 9000;
            z = (Math.random() - 0.5) * 9000;
        } while (isInRunwayZone(x, z) || isInRiverZone(x, z));

        const size = 50 + Math.random() * 100;
        const color = new THREE.Color(Math.random(), Math.random(), Math.random());
        const houseGeometry = new THREE.BoxGeometry(size, size, size);
        const houseMaterial = new THREE.MeshPhongMaterial({ color });
        const house = new THREE.Mesh(houseGeometry, houseMaterial);
        house.position.set(x, size / 2, z);
        scene.add(house);
    }

    // Clouds
    const cloudGeometry = new THREE.SphereGeometry(20, 8, 8);
    const cloudMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 500; i++) {
        const cloud = new THREE.Group();
        const numBlobs = 6 + Math.floor(Math.random() * 5);
        for (let j = 0; j < numBlobs; j++) {
            const blob = new THREE.Mesh(cloudGeometry, cloudMaterial);
            blob.position.set(Math.random() * 30 - 10, Math.random() * 20, Math.random() * 25 - 10);
            blob.scale.set(0.8 + Math.random() * 0.9, 0.8 + Math.random() * 0.8, 0.8 + Math.random() * 0.4);
            cloud.add(blob);
        }
        cloud.position.set((Math.random() - 0.5) * 5000, 600 + Math.random() * 200, (Math.random() - 0.5) * 5000);
        scene.add(cloud);
    }

    // Balloons - now with unique IDs for multiplayer tracking
    for (let i = 0; i < 50; i++) {
        createBalloon(`balloon-${i}`);
    }
}

function isInRunwayZone(x, z) {
    const runwayMinX = -100;
    const runwayMaxX = 100;
    const runwayMinZ = -600;
    const runwayMaxZ = 600;
    return (x >= runwayMinX && x <= runwayMaxX && z >= runwayMinZ && z <= runwayMaxZ);
}

function createBalloon(balloonData) {
    const balloonGeometry = new THREE.SphereGeometry(6, 16, 16);
    
    // Use the balloon color from server data or generate a random one
    const balloonColor = (typeof balloonData === 'object' && balloonData.color) 
        ? balloonData.color 
        : new THREE.Color(Math.random(), Math.random(), Math.random());
        
    const balloonMaterial = new THREE.MeshLambertMaterial({
        color: balloonColor
    });
    
    const balloon = new THREE.Mesh(balloonGeometry, balloonMaterial);
    balloon.castShadow = true;
    
    // Use position from server data or generate random position
    if (typeof balloonData === 'object' && balloonData.position) {
        balloon.position.set(
            balloonData.position.x,
            balloonData.position.y,
            balloonData.position.z
        );
    } else {
        balloon.position.set(
            (Math.random() - 0.5) * 2500,
            10 + Math.random() * 1500,
            (Math.random() - 0.5) * 1000
        );
    }
    
    // Add unique ID to the balloon for multiplayer tracking
    const balloonId = (typeof balloonData === 'object' && balloonData.id) 
        ? balloonData.id 
        : (typeof balloonData === 'string' ? balloonData : `balloon-${Date.now()}-${Math.random()}`);
        
    balloon.userData.id = balloonId;
    
    // Set active state if provided
    if (typeof balloonData === 'object' && balloonData.hasOwnProperty('active')) {
        balloon.userData.active = balloonData.active;
    } else {
        balloon.userData.active = true;
    }
    
    scene.add(balloon);
    balloons.push(balloon);
    return balloon;
}

function updateEnvironment() {
    // Dynamic environment updates can be added here in the future
    
    // Check for bullets hitting remote players
    checkBulletPlayerCollisions();
}

// Check collisions between local bullets and balloons
function checkCollisions(bullets, balloonList) {
    for (let bulletIndex = bullets.length - 1; bulletIndex >= 0; bulletIndex--) {
        const bullet = bullets[bulletIndex];

        for (let balloonIndex = balloonList.length - 1; balloonIndex >= 0; balloonIndex--) {
            const balloon = balloonList[balloonIndex];
            const distance = bullet.position.distanceTo(balloon.position);

            if (distance < 15) {
                // In multiplayer, notify the server about this hit
                sendBalloonHit(balloon.userData.id, balloon.position);
                
                createEnhancedExplosion(balloon.position);
                scene.remove(balloon);
                balloonList.splice(balloonIndex, 1);
                scene.remove(bullet);
                bullets.splice(bulletIndex, 1);
                score += 10;
                updateDifficulty();
                // In multiplayer, don't immediately recreate balloon - server will do that
                break;
            }
        }
    }
}

// Check for bullets hitting remote players
function checkBulletPlayerCollisions() {
    // Only check if we're in multiplayer and have our local player set up
    if (!window.currentPlane || !window.currentPlane.bullets || !remotePlayers) return;
    
    const bullets = window.currentPlane.bullets;
    const COLLISION_THRESHOLD = 15;
    
    for (let bulletIndex = bullets.length - 1; bulletIndex >= 0; bulletIndex--) {
        const bullet = bullets[bulletIndex];
        
        // Check against each remote player
        Object.keys(remotePlayers).forEach(remoteId => {
            if (!remotePlayers[remoteId] || !remotePlayers[remoteId].object) return;
            
            const remotePlayerObj = remotePlayers[remoteId].object;
            const distance = bullet.position.distanceTo(remotePlayerObj.position);
            
            if (distance < COLLISION_THRESHOLD) {
                // Hit detected!
                const hitPosition = bullet.position.clone();
                
                // Remove the bullet
                scene.remove(bullet);
                bullets.splice(bulletIndex, 1);
                
                // Create hit effect
                createEnhancedExplosion(hitPosition);
                showMessage(`Hit player ${remotePlayers[remoteId].name || remoteId.substring(0, 8)}`);
                
                // Let the server know about the hit
                const hitData = {
                    type: 'playerHit',
                    shooterId: playerId,
                    targetId: remoteId,
                    position: {
                        x: hitPosition.x,
                        y: hitPosition.y,
                        z: hitPosition.z
                    }
                };
                
                // Send using the WebSocket connection in network.js
                if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                    window.socket.send(JSON.stringify(hitData));
                }
            }
        });
    }
}

function updateDifficulty() {
    if (score >= 100 && difficultyLevel < 2) {
        difficultyLevel = 2;
        showMessage("רמת קושי עלתה ל-2!");
    } else if (score >= 200 && difficultyLevel < 3) {
        difficultyLevel = 3;
        showMessage("רמת קושי עלתה ל-3!");
    }
}

function createEnhancedExplosion(position) {
    // Ring effect
    const ringGeometry = new THREE.RingGeometry(0.1, 0.5, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.copy(position);
    ring.lookAt(player.position);
    scene.add(ring);

    const expandRing = () => {
        if (ring.scale.x < 20) {
            ring.scale.x += 0.5;
            ring.scale.y += 0.5;
            ring.material.opacity -= 0.02;
            requestAnimationFrame(expandRing);
        } else {
            scene.remove(ring);
        }
    };
    expandRing();

    // Colored particles
    const particleCount = 50;
    const particleColors = [
        Math.random() * 0xffffff,
        Math.random() * 0xffffff,
        Math.random() * 0xffffff
    ];
    const colors = particleColors.map(color => new THREE.Color(color));

    for (let i = 0; i < particleCount; i++) {
        const particleGeometry = new THREE.SphereGeometry(0.2 + Math.random() * 0.3, 8, 8);
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: colors[Math.floor(Math.random() * colors.length)],
            transparent: true,
            opacity: 0.8
        });
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);

        particle.position.copy(position);
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.7,
            (Math.random() - 0.5) * 0.7,
            (Math.random() - 0.5) * 0.7
        );
        scene.add(particle);

        let frame = 0;
        const animateParticle = () => {
            frame++;
            particle.position.add(velocity);
            particle.material.opacity -= 0.02;
            particle.scale.multiplyScalar(0.98);

            if (frame < 60 && particle.material.opacity > 0) {
                requestAnimationFrame(animateParticle);
            } else {
                scene.remove(particle);
            }
        };
        animateParticle();
    }

    // Flash light effect
    const flashLight = new THREE.PointLight(0xffff00, 5, 50);
    flashLight.position.copy(position);
    scene.add(flashLight);

    let intensity = 5;
    const animateFlash = () => {
        intensity -= 0.2;
        flashLight.intensity = intensity;
        if (intensity > 0) {
            requestAnimationFrame(animateFlash);
        } else {
            scene.remove(flashLight);
        }
    };
    animateFlash();
}

export { createEnhancedExplosion, balloons, checkCollisions, createEnvironment, difficultyLevel, score, updateEnvironment, createBalloon }