import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* ======================
   THEME CONFIG
====================== */
const theme = {
  primary: 0x00f2ff,   // Cyan
  secondary: 0x7000ff, // Purple
  accent: 0xff0055,    // Pink/Red
  success: 0x00ff9d,   // Green
  warning: 0xffaa00,   // Orange
  dark: 0x05070a,      // Background
  grid: 0x1a2030       // Grid Color
};

/* ======================
   SCENE SETUP
====================== */
const scene = new THREE.Scene();
scene.background = new THREE.Color(theme.dark);
scene.fog = new THREE.FogExp2(theme.dark, 0.015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 40);

const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector("#bg"),
  antialias: true,
  alpha: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ReinhardToneMapping;

/* ======================
   CONTROLS
====================== */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxDistance = 80;
controls.minDistance = 15;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.3;

/* ======================
   POST PROCESSING
====================== */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5, 0.4, 0.85
);
bloomPass.threshold = 0.2;
bloomPass.strength = 1.0;
bloomPass.radius = 0.5;
composer.addPass(bloomPass);

/* ======================
   GRID & PARTICLES
====================== */
const gridHelper = new THREE.GridHelper(200, 50, theme.secondary, theme.grid);
gridHelper.position.y = -8;
scene.add(gridHelper);

// Floating Particles
const particlesGeo = new THREE.BufferGeometry();
const particlesCount = 1000;
const posArray = new Float32Array(particlesCount * 3);
for (let i = 0; i < particlesCount * 3; i++) {
  posArray[i] = (Math.random() - 0.5) * 120;
}
particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particlesMat = new THREE.PointsMaterial({
  size: 0.08,
  color: theme.primary,
  transparent: true,
  opacity: 0.5,
  blending: THREE.AdditiveBlending
});
const particlesMesh = new THREE.Points(particlesGeo, particlesMat);
scene.add(particlesMesh);

/* ======================
   SERVICE FACTORY
====================== */
function createServiceNode(geometry, color) {
  const group = new THREE.Group();

  // Core mesh
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x000000,
    emissive: color,
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.8,
    transparent: true,
    opacity: 0.9,
    clearcoat: 1.0
  });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);

  // Wireframe overlay
  const wireGeo = new THREE.WireframeGeometry(geometry);
  const wireMat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.4 });
  group.add(new THREE.LineSegments(wireGeo, wireMat));

  // Point light
  const light = new THREE.PointLight(color, 1.5, 12);
  group.add(light);

  scene.add(group);
  return group;
}

/* ======================
   CENTRAL ENTRY POINT
====================== */
const entryPointGeo = new THREE.IcosahedronGeometry(3);
const entryPoint = createServiceNode(entryPointGeo, theme.primary);
entryPoint.position.set(0, 0, 0);
entryPoint.userData = { 
  name: "API Gateway", 
  isCenter: true,
  color: theme.primary,
  info: {
    container: "api-gateway",
    port: "80:80",
    network: "external-net",
    depends: "All Services",
    health: "HTTP /health"
  }
};

/* ======================
   ORBITING SERVICES
====================== */
const orbitRadius = 18;
const serviceConfigs = [
  { 
    name: "Frontend", 
    geometry: new THREE.BoxGeometry(2.5, 2.5, 2.5), 
    color: theme.success,
    info: {
      container: "frontend",
      port: "8080:80",
      network: "external-net",
      depends: "None",
      health: "Static Files"
    }
  },
  { 
    name: "Auth Service", 
    geometry: new THREE.OctahedronGeometry(2), 
    color: theme.accent,
    info: {
      container: "auth-service",
      port: "3000:3000",
      network: "external-net, internal-net",
      depends: "mongo",
      health: "http://localhost:3000/health"
    }
  },
  { 
    name: "Database (MongoDB)", 
    geometry: new THREE.CylinderGeometry(1.5, 1.5, 4, 16), 
    color: theme.warning,
    info: {
      container: "auth-mongo",
      port: "27018:27017",
      network: "internal-net",
      depends: "None",
      health: "mongosh ping"
    }
  },
  { 
    name: "Settings Service", 
    geometry: new THREE.TorusKnotGeometry(1, 0.4, 64, 8), 
    color: theme.secondary,
    info: {
      container: "settings-service",
      port: "4000:4000",
      network: "internal-net, external-net",
      depends: "auth-service, mongo",
      health: "http://localhost:4000/health"
    }
  }
];

const services = [];
const angleOffset = (Math.PI * 2) / serviceConfigs.length;

serviceConfigs.forEach((config, i) => {
  const node = createServiceNode(config.geometry, config.color);
  node.userData = { 
    name: config.name, 
    color: config.color,
    info: config.info,
    orbitAngle: i * angleOffset,
    orbitSpeed: 0.15 + Math.random() * 0.05  // Slight variation
  };
  services.push(node);
});

/* ======================
   CONNECTION LINES
====================== */
const connections = [];

function createConnection(target, color) {
  const points = [entryPoint.position.clone(), target.position.clone()];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.4
  });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
  connections.push({ line, target, color });
}

services.forEach(service => {
  createConnection(service, service.userData.color);
});

/* ======================
   JWT PACKET
====================== */
const jwtTooltip = document.getElementById("jwt-tooltip");
const jwtHeaderEl = jwtTooltip.querySelector(".jwt-header");
const jwtPayloadEl = jwtTooltip.querySelector(".jwt-payload");
const jwtSignatureEl = jwtTooltip.querySelector(".jwt-signature");

const demoJWT = {
  header: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`,
  payload: `eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0`,
  signature: `SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`
};

const packetGeo = new THREE.SphereGeometry(0.5, 16, 16);
const packetMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const packet = new THREE.Mesh(packetGeo, packetMat);
scene.add(packet);

let currentTargetIndex = 0;
let packetProgress = 0;
let packetDirection = 1; // 1 = outward, -1 = inward

/* ======================
   LIGHTING
====================== */
scene.add(new THREE.AmbientLight(0x111122, 0.8));

const mainLight = new THREE.PointLight(theme.primary, 2, 100);
mainLight.position.set(0, 30, 0);
scene.add(mainLight);

/* ======================
   INTERACTION
====================== */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredNode = null;
let autoRotateTimeout = null;

function resetAutoRotate() {
  clearTimeout(autoRotateTimeout);
  controls.autoRotate = false;
  autoRotateTimeout = setTimeout(() => {
    controls.autoRotate = true;
  }, 4000);
}

window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  resetAutoRotate();
});

function updateHover() {
  raycaster.setFromCamera(mouse, camera);
  const allNodes = [entryPoint, ...services];
  const intersects = raycaster.intersectObjects(allNodes, true);

  if (intersects.length > 0) {
    const hitGroup = intersects[0].object.parent;
    if (hoveredNode !== hitGroup) {
      if (hoveredNode) {
        hoveredNode.children[0].material.emissiveIntensity = 0.5;
        hoveredNode.scale.setScalar(1);
      }
      hoveredNode = hitGroup;
      hoveredNode.children[0].material.emissiveIntensity = 1.2;
      hoveredNode.scale.setScalar(1.2);
      document.body.style.cursor = 'pointer';
    }
  } else {
    if (hoveredNode) {
      hoveredNode.children[0].material.emissiveIntensity = 0.5;
      hoveredNode.scale.setScalar(1);
      hoveredNode = null;
      document.body.style.cursor = 'default';
    }
  }
}

/* ======================
   MODAL POPUP
====================== */
const modal = document.getElementById('service-modal');
const modalClose = document.getElementById('modal-close');
const modalTitle = document.getElementById('modal-title');
const modalIcon = document.getElementById('modal-icon');
const modalContainer = document.getElementById('modal-container');
const modalPort = document.getElementById('modal-port');
const modalNetwork = document.getElementById('modal-network');
const modalDepends = document.getElementById('modal-depends');
const modalHealth = document.getElementById('modal-health');

function showServiceModal(serviceData) {
  const { name, color, info } = serviceData;
  
  modalTitle.textContent = name;
  modalIcon.style.background = `#${color.toString(16).padStart(6, '0')}`;
  modalIcon.style.boxShadow = `0 0 15px #${color.toString(16).padStart(6, '0')}`;
  
  modalContainer.textContent = info.container;
  modalPort.textContent = info.port;
  modalNetwork.textContent = info.network;
  modalDepends.textContent = info.depends;
  modalHealth.textContent = info.health;
  
  modal.classList.add('active');
}

function hideModal() {
  modal.classList.remove('active');
}

// Close modal events
modalClose.addEventListener('click', hideModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) hideModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideModal();
});

// Click on 3D objects
window.addEventListener('click', () => {
  if (hoveredNode && hoveredNode.userData) {
    showServiceModal(hoveredNode.userData);
  }
});

/* ======================
   ANIMATION LOOP
====================== */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  controls.update();
  updateHover();

  // Orbit services around center
  services.forEach((service, i) => {
    const data = service.userData;
    data.orbitAngle += data.orbitSpeed * 0.01;
    
    service.position.x = Math.cos(data.orbitAngle) * orbitRadius;
    service.position.z = Math.sin(data.orbitAngle) * orbitRadius;
    service.position.y = Math.sin(t * 0.5 + i) * 1.5; // Gentle bob
    
    service.rotation.y += 0.01;
    service.children[1].rotation.z += 0.005; // Wireframe spin
  });

  // Update connection lines to follow orbiting services
  connections.forEach((conn, i) => {
    const positions = conn.line.geometry.attributes.position.array;
    // Start point (center)
    positions[0] = entryPoint.position.x;
    positions[1] = entryPoint.position.y;
    positions[2] = entryPoint.position.z;
    // End point (service)
    positions[3] = conn.target.position.x;
    positions[4] = conn.target.position.y;
    positions[5] = conn.target.position.z;
    conn.line.geometry.attributes.position.needsUpdate = true;
    
    // Pulse opacity
    conn.line.material.opacity = 0.3 + Math.sin(t * 2 + i) * 0.15;
  });

  // Animate entry point
  entryPoint.rotation.y += 0.005;
  entryPoint.rotation.x = Math.sin(t * 0.3) * 0.1;
  entryPoint.children[0].material.emissiveIntensity = 0.5 + Math.sin(t * 2) * 0.2;

  // Animate JWT packet along connection lines
  const targetService = services[currentTargetIndex];
  packetProgress += 0.015 * packetDirection;

  if (packetProgress >= 1) {
    packetProgress = 1;
    packetDirection = -1; // Return to center
  } else if (packetProgress <= 0) {
    packetProgress = 0;
    packetDirection = 1;
    currentTargetIndex = (currentTargetIndex + 1) % services.length; // Next service
  }

  // Interpolate packet position
  const start = entryPoint.position;
  const end = targetService.position;
  packet.position.lerpVectors(start, end, packetProgress);

  // Update JWT tooltip
  const screenPos = packet.position.clone().project(camera);
  const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;

  if (packetProgress > 0.1 && packetProgress < 0.9) {
    jwtTooltip.style.display = "block";
    jwtTooltip.style.left = `${x}px`;
    jwtTooltip.style.top = `${y}px`;
    jwtHeaderEl.textContent = `H: ${demoJWT.header.substring(0, 8)}...`;
    jwtPayloadEl.textContent = `P: ${demoJWT.payload.substring(0, 10)}...`;
    jwtSignatureEl.textContent = `S: ${demoJWT.signature.substring(0, 8)}...`;
  } else {
    jwtTooltip.style.display = "none";
  }

  // Rotate particles slowly
  particlesMesh.rotation.y = t * 0.02;

  composer.render();
}

animate();

/* ======================
   RESIZE
====================== */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.resolution.set(window.innerWidth, window.innerHeight);
});
