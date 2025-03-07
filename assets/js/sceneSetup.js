import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
const player = new THREE.Object3D();

function setupScene() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    player.position.set(2, 8, 50);
    scene.add(player);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const fog = new THREE.FogExp2(0x87CEEB, 0.0005);
    scene.fog = fog;

    const textureLoader = new THREE.TextureLoader();
    const groundTexture = textureLoader.load('../assets/images/grass_top.jpg');
    groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(50, 100);
    groundTexture.anisotropy = 16;

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(10000, 10000),
        new THREE.MeshLambertMaterial({ map: groundTexture, side: THREE.DoubleSide })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const runwayGroup = createRunway();
    scene.add(runwayGroup);
}

function createRunway() {
    const runwayGroup = new THREE.Group();
    const runwayMainGeometry = new THREE.BoxGeometry(12, 0.02, 1200);
    const runwayMainMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const runwayMain = new THREE.Mesh(runwayMainGeometry, runwayMainMaterial);
    runwayMain.receiveShadow = true;
    runwayMain.position.set(0, 1, 0);
    runwayGroup.add(runwayMain);

    const stripeCount = 12;
    const stripeWidth = 0.8;
    const stripeLength = 12;
    const gapBetweenStripes = 70;
    const stripeGeometry = new THREE.PlaneGeometry(stripeWidth, stripeLength);
    const stripeMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const firstStripeZ = -(stripeCount - 1) * gapBetweenStripes * 0.5;

    for (let i = 0; i < stripeCount; i++) {
        const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(0, 1.01, firstStripeZ + i * gapBetweenStripes);
        runwayGroup.add(stripe);
    }

    const coneGeometry = new THREE.ConeGeometry(0.5, 1, 8);
    const coneMaterial = new THREE.MeshLambertMaterial({ color: 0xffff00, emissive: 0x444400 });
    const xOffsets = [-5.5, 5.5];
    xOffsets.forEach(xPos => {
        const cone1 = new THREE.Mesh(coneGeometry, coneMaterial);
        cone1.position.set(xPos, 1, -550);
        cone1.rotation.x = -Math.PI / 2;
        runwayGroup.add(cone1);

        const cone2 = new THREE.Mesh(coneGeometry, coneMaterial);
        cone2.position.set(xPos, 1, 550);
        cone2.rotation.x = -Math.PI / 2;
        runwayGroup.add(cone2);
    });

    return runwayGroup;
}

export { setupScene, scene, camera, renderer, player };