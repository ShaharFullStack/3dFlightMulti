// assets/js/planeControls.js (Updated for multiplayer)

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { scene, player } from './sceneSetup.js';
import { showMessage } from './main.js';
import { sendBulletCreation } from './network.js';
import { createEnhancedExplosion } from './environment.js';

const randomColor1 = Math.random() * 0xffffff;
const randomColor2 = Math.random() * 0xffffff;

// Add additional plane types for more variety in multiplayer
const planeConfigs = {
    planeOne: {
        body: { width: 0.8, height: 0.8, length: 4, color: randomColor1 },
        nose: { width: 0.6, height: 0.6, length: 0.8, position: { x: 0, y: -0.1, z: -0.4 } },
        guns: [
            { width: 0.2, height: 0.1, length: 1.2, color: randomColor1, position: { x: 0, y: 0, z: 0 } },
            { width: 0.2, height: 0.1, length: 1.2, color: randomColor1, position: { x: -2, y: 0.2, z: 0 }, rotationZ: Math.PI / 2 },
            { width: 0.2, height: 0.1, length: 1.2, color: randomColor1, position: { x: 2, y: 0.2, z: 0 }, rotationZ: Math.PI / 2 }
        ],
        wing: { width: 7, height: 0.1, length: 1.2, color: randomColor2, position: { x: 0, y: 0.3, z: 0 } },
        tailWing: { width: 2.2, height: 0.1, length: 0.8, position: { x: 0, y: 0.2, z: 1.8 } },
        stabilizer: { width: 0.1, height: 0.8, length: 1.2, position: { x: 0, y: 0.5, z: 1.8 } },
        windows: { width: 0.9, height: 1.2, length: 0.5, color: randomColor2, opacity: 0.5, position: { x: 0, y: 0.5, z: -0.6 } },
        wheels: [
            { x: -1, y: -0.2, z: 0 },
            { x: 1, y: -0.2, z: 0 },
            { x: 0, y: -0.2, z: -1.5 }
        ],
        scale: { x: 5, y: 5, z: 5 }
    },
    planeTwo: {
        body: { width: 0.6, height: 0.6, length: 3, color: randomColor2 },
        nose: { width: 0.7, height: 0.7, length: 0.3, position: { x: 0, y: -0.1, z: -0.4 } },
        guns: [
            { width: 0.3, height: 0.3, length: 1.2, color: randomColor2, position: { x: 0, y: 0, z: 0 } },
            { width: 0.3, height: 0.3, length: 1.2, color: randomColor2, position: { x: -2.5, y: 0.2, z: 0 }, rotationZ: Math.PI / 2 },
            { width: 0.3, height: 0.3, length: 1.2, color: randomColor2, position: { x: 2.5, y: 0.2, z: 0 }, rotationZ: Math.PI / 2 }
        ],
        wing: { width: 8, height: 0.05, length: 1.2, color: randomColor1, position: { x: 0, y: 0.3, z: 0 } },
        tailWing: { width: 2.2, height: 0.1, length: 0.8, position: { x: 0, y: 0.2, z: 1.8 } },
        stabilizer: { width: 0.1, height: 0.8, length: 1.2, position: { x: 0, y: 0.5, z: 1.8 } },
        windows: { width: 0.9, height: 1.2, length: 0.5, color: randomColor2, opacity: 0.5, position: { x: 0, y: 0.5, z: -0.6 } },
        wheels: [
            { x: -1, y: -0.2, z: 0 },
            { x: 1, y: -0.2, z: 0 },
            { x: 0, y: -0.2, z: -1.5 }
        ],
        scale: { x: 5, y: 5, z: 5 }
    },
    // Add a third plane type for multiplayer variety
    planeThree: {
        body: { width: 0.9, height: 0.5, length: 3.5, color: 0x5588ff },
        nose: { width: 0.5, height: 0.5, length: 1.0, position: { x: 0, y: -0.1, z: -0.4 } },
        guns: [
            { width: 0.15, height: 0.15, length: 1.5, color: 0xff0000, position: { x: -1, y: 0, z: -1 } },
            { width: 0.15, height: 0.15, length: 1.5, color: 0xff0000, position: { x: 1, y: 0, z: -1 } }
        ],
        wing: { width: 6, height: 0.08, length: 1.5, color: 0x555555, position: { x: 0, y: 0.2, z: 0.5 } },
        tailWing: { width: 3, height: 0.08, length: 0.7, position: { x: 0, y: 0.2, z: 1.8 } },
        stabilizer: { width: 0.08, height: 1.2, length: 0.7, position: { x: 0, y: 0.5, z: 1.8 } },
        windows: { width: 0.7, height: 0.7, length: 0.6, color: 0x88aaff, opacity: 0.6, position: { x: 0, y: 0.4, z: -0.6 } },
        wheels: [
            { x: -1.2, y: -0.2, z: 0.2 },
            { x: 1.2, y: -0.2, z: 0.2 },
            { x: 0, y: -0.2, z: -1.2 }
        ],
        scale: { x: 5, y: 5, z: 5 }
    }
};

class Plane {
    constructor(type) {
        this.type = type;
        this.config = planeConfigs[type];
        this.group = this.createPlane(this.config);
        this.speed = 0;
        this.maxSpeed = 2.0;
        this.speedIncrement = 0.1;
        this.liftCoefficient = 0.08;
        this.dragCoefficient = 0.004;
        this.minSpeedForLift = 0.5;
        this.gravity = 0.0098;
        this.orientation = new THREE.Quaternion();
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.isDoingBarrelRoll = false;
        this.barrelRollStartTime = 0;
        this.barrelRollDuration = 1000;
        this.bullets = [];
        this.lastShotTime = 0;
        this.shootCooldown = 100;
        this.bulletSpeed = 5;
        
        // Health system
        this.health = 100;
        this.isInvulnerable = false;
        this.respawnProtectionTime = 3000; // 3 seconds of invulnerability after respawn
        this.healthBar = this.createHealthBar();
        this.group.add(this.healthBar);
        this.healthBar.position.set(0, 10, 0);
    }

    createPlane(config) {
        const planeGroup = new THREE.Group();

        // Plane body
        const bodyGeo = new THREE.BoxGeometry(config.body.width, config.body.height, config.body.length);
        const bodyMat = new THREE.MeshPhongMaterial({ color: config.body.color });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        planeGroup.add(body);

        // Nose
        const noseGeo = new THREE.BoxGeometry(config.nose.width, config.nose.height, config.nose.length);
        const nose = new THREE.Mesh(noseGeo, bodyMat);
        nose.position.set(config.nose.position.x, config.nose.position.y, config.nose.position.z);
        planeGroup.add(nose);

        // Guns
        config.guns.forEach(gunConfig => {
            const gunGeo = new THREE.BoxGeometry(gunConfig.width, gunConfig.height, gunConfig.length);
            const gunMat = new THREE.MeshPhongMaterial({ color: gunConfig.color });
            const gun = new THREE.Mesh(gunGeo, gunMat);
            gun.position.set(gunConfig.position.x, gunConfig.position.y, gunConfig.position.z);
            if (gunConfig.rotationZ) gun.rotation.z = gunConfig.rotationZ;
            planeGroup.add(gun);
        });

        // Wings
        const wingGeo = new THREE.BoxGeometry(config.wing.width, config.wing.height, config.wing.length);
        const wingMat = new THREE.MeshPhongMaterial({ color: config.wing.color });
        const wings = new THREE.Mesh(wingGeo, wingMat);
        wings.position.set(config.wing.position.x, config.wing.position.y, config.wing.position.z);
        planeGroup.add(wings);

        // Tail
        const tailWingGeo = new THREE.BoxGeometry(config.tailWing.width, config.tailWing.height, config.tailWing.length);
        const tailWing = new THREE.Mesh(tailWingGeo, wingMat);
        tailWing.position.set(config.tailWing.position.x, config.tailWing.position.y, config.tailWing.position.z);
        planeGroup.add(tailWing);

        // Stabilizers
        const stabilizerGeo = new THREE.BoxGeometry(config.stabilizer.width, config.stabilizer.height, config.stabilizer.length);
        const stabilizer = new THREE.Mesh(stabilizerGeo, wingMat);
        stabilizer.position.set(config.stabilizer.position.x, config.stabilizer.position.y, config.stabilizer.position.z);
        planeGroup.add(stabilizer);

        // Windows
        const windowGeo = new THREE.BoxGeometry(config.windows.width, config.windows.height, config.windows.length);
        const windowMat = new THREE.MeshPhongMaterial({
            color: config.windows.color,
            transparent: true,
            opacity: config.windows.opacity
        });
        const windows = new THREE.Mesh(windowGeo, windowMat);
        windows.position.set(config.windows.position.x, config.windows.position.y, config.windows.position.z);
        planeGroup.add(windows);

        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8);
        const wheelMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
        config.wheels.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos.x, pos.y, pos.z);
            planeGroup.add(wheel);
        });

        // Scale the plane
        planeGroup.scale.set(config.scale.x, config.scale.y, config.scale.z);

        return planeGroup;
    }

    // Create a health bar for the plane
    createHealthBar() {
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
    }

    // Update the health bar based on current health
    updateHealthBar() {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 100;
        canvas.height = 10;
        
        // Background
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Health fill - color changes based on health level
        let fillColor;
        if (this.health > 60) {
            fillColor = '#00ff00'; // Green
        } else if (this.health > 30) {
            fillColor = '#ffff00'; // Yellow
        } else {
            fillColor = '#ff0000'; // Red
        }
        
        context.fillStyle = fillColor;
        context.fillRect(2, 2, Math.max(0, this.health * 0.96), 6); // Width based on health percentage
        
        // Update the texture
        const texture = new THREE.CanvasTexture(canvas);
        this.healthBar.material.map.dispose();
        this.healthBar.material.map = texture;
        this.healthBar.material.needsUpdate = true;
    }

    update(keys) {
        if (this.isDoingBarrelRoll) {
            this.updateBarrelRoll();
        } else {
            if (keys['w'] || keys['W']) this.euler.x -= 0.005;
            if (keys['s'] || keys['S']) this.euler.x += 0.005;
            if (keys['a'] || keys['A']) {
                this.euler.z += 0.005;
                this.euler.y += 0.005;
            }
            if (keys['d'] || keys['D']) {
                this.euler.z -= 0.005;
                this.euler.y -= 0.005;
            }
            if (keys['q'] || keys['Q']) this.euler.y += 0.015;
            if (keys['e'] || keys['E']) this.euler.y -= 0.015;
            this.updateQuaternion();
        }

        if (keys['ArrowUp']) this.speed = Math.min(this.maxSpeed, this.speed + this.speedIncrement);
        if (keys['ArrowDown']) this.speed = Math.max(0, this.speed - this.speedIncrement);
        if (keys['ArrowLeft']) this.euler.z += 0.01;
        if (keys['ArrowRight']) this.euler.z -= 0.01;

        const now = Date.now();
        if ((keys[' '] || keys['Spacebar']) && (!this.lastShotTime || now - this.lastShotTime > this.shootCooldown)) {
            this.shootBullet();
            this.lastShotTime = now;
        }

        const angleOfAttack = this.euler.x;
        const lift = this.speed > this.minSpeedForLift ? this.liftCoefficient * this.speed * Math.sin(angleOfAttack) : 0;
        const drag = this.dragCoefficient * this.speed * this.speed;
        this.speed = Math.max(0, this.speed - drag);

        const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(this.orientation);
        player.position.add(forwardVector.multiplyScalar(this.speed));
        player.position.y += lift - this.gravity;

        if (player.position.y < 0.5) {
            player.position.y = 0.5;
            this.speed = 0;
        }

        this.updateBullets();
        
        // Update invulnerability status
        if (this.isInvulnerable && now - this.respawnTime > this.respawnProtectionTime) {
            this.isInvulnerable = false;
            
            // If we're using visual effects for invulnerability, remove them here
            this.group.traverse(child => {
                if (child.isMesh) {
                    child.material.opacity = 1.0;
                    child.material.transparent = child.material.originalTransparency || false;
                }
            });
        }
    }

    updateQuaternion() {
        this.orientation.setFromEuler(this.euler);
        player.quaternion.copy(this.orientation);
    }

    startBarrelRoll() {
        if (!this.isDoingBarrelRoll && this.speed > 0.5) {
            this.isDoingBarrelRoll = true;
            this.barrelRollStartTime = Date.now();
            showMessage("סיבוב חבית!");
        }
    }

    updateBarrelRoll() {
        const elapsedTime = Date.now() - this.barrelRollStartTime;
        const progress = Math.min(elapsedTime / this.barrelRollDuration, 1);
        const startQuat = this.orientation.clone();
        const endQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI * 2);
        
        // Create a temporary quaternion and use slerp
        const tempQuat = startQuat.clone();
        tempQuat.slerp(endQuat, progress);
        
        // Update the player's quaternion
        player.quaternion.copy(tempQuat);
        
        if (progress >= 1) {
            this.isDoingBarrelRoll = false;
            this.orientation.copy(player.quaternion);
        }
    }

    shootBullet() {
        const bulletGeometry = new THREE.SphereGeometry(1, 8, 5);
        const bulletMaterial = new THREE.MeshLambertMaterial({ color: 0xffe400, emissive: 0xff0000 });

        const leftGunPosition = new THREE.Vector3(-12, 1, 1).applyQuaternion(this.orientation).add(player.position);
        const rightGunPosition = new THREE.Vector3(12, 1, 1).applyQuaternion(this.orientation).add(player.position);

        const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(this.orientation);
        
        // Left bullet
        const leftBullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        leftBullet.position.copy(leftGunPosition);
        leftBullet.velocity = forwardVector.clone().multiplyScalar(this.bulletSpeed);
        scene.add(leftBullet);
        this.bullets.push(leftBullet);

        // Right bullet
        const rightBullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        rightBullet.position.copy(rightGunPosition);
        rightBullet.velocity = forwardVector.clone().multiplyScalar(this.bulletSpeed);
        scene.add(rightBullet);
        this.bullets.push(rightBullet);
        
        // Notify the server about bullets for multiplayer
        sendBulletCreation(leftGunPosition, leftBullet.velocity);
        sendBulletCreation(rightGunPosition, rightBullet.velocity);
    }

    updateBullets() {
        for (let index = this.bullets.length - 1; index >= 0; index--) {
            const bullet = this.bullets[index];
            bullet.position.add(bullet.velocity);
            if (bullet.position.distanceTo(player.position) > 1200) {
                scene.remove(bullet);
                this.bullets.splice(index, 1);
            }
        }
    }
    
    // Method for handling damage in multiplayer
    takeDamage(amount) {
        if (this.isInvulnerable) return;
        
        this.health -= amount;
        
        // Update health bar
        this.updateHealthBar();
        
        // Visual feedback
        this.flashDamage();
        
        if (this.health <= 0) {
            this.die();
        }
    }
    
    // Visual feedback for taking damage
    flashDamage() {
        const originalMaterials = [];
        
        // Store original materials and change to red
        this.group.traverse(child => {
            if (child.isMesh) {
                originalMaterials.push({
                    mesh: child,
                    material: child.material.clone()
                });
                
                child.material = new THREE.MeshPhongMaterial({
                    color: 0xff0000,
                    transparent: true,
                    opacity: 0.8
                });
            }
        });
        
        // Restore original materials after a short delay
        setTimeout(() => {
            originalMaterials.forEach(item => {
                item.mesh.material = item.material;
            });
        }, 200);
    }
    
    // Handle player death and respawn
    die() {
        showMessage("Aircraft destroyed! Respawning...");
        
        // Create explosion at player position
        const explosionPosition = player.position.clone();
        
        // Call the explosion function 3 times for a bigger effect
        for (let i = 0; i < 3; i++) {
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            );
            createEnhancedExplosion(explosionPosition.clone().add(offset));
        }
        
        // Reset plane position - find a safe spawn point
        player.position.set(
            (Math.random() - 0.5) * 1000,
            100 + Math.random() * 100,
            (Math.random() - 0.5) * 1000
        );
        
        // Reset health and speed
        this.health = 100;
        this.speed = 0;
        
        // Update health bar
        this.updateHealthBar();
        
        // Set invulnerability
        this.isInvulnerable = true;
        this.respawnTime = Date.now();
        
        // Visual effect for invulnerability - semi-transparent
        this.group.traverse(child => {
            if (child.isMesh) {
                child.material.originalTransparency = child.material.transparent;
                child.material.transparent = true;
                child.material.opacity = 0.6;
            }
        });
    }
}

// Create the first plane
let currentPlane = new Plane('planeOne');
player.add(currentPlane.group);

// Make currentPlane globally accessible for network.js to reference
window.currentPlane = currentPlane;

// Function to switch between plane types (now with three options)
function switchPlane() {
    player.remove(currentPlane.group);
    
    // Cycle through the three plane types
    let nextType;
    switch(currentPlane.type) {
        case 'planeOne':
            nextType = 'planeTwo';
            break;
        case 'planeTwo':
            nextType = 'planeThree';
            break;
        case 'planeThree':
            nextType = 'planeOne';
            break;
        default:
            nextType = 'planeOne';
    }
    
    currentPlane = new Plane(nextType);
    player.add(currentPlane.group);
    
    // Update the global reference
    window.currentPlane = currentPlane;
    
    showMessage(`מטוס: ${nextType}`);
}

export { Plane, currentPlane, switchPlane, createEnhancedExplosion };