import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const random = (min, max) => Math.random() * (max - min) + min;
const pick = (array) => array[Math.floor(Math.random() * array.length)];

const ITEM_DATA = {
  canned_food: { name: 'Comida enlatada', short: 'Comida', icon: '🥫', size: 1, desc: 'Una lata abollada, pero todavía sellada. Puede servirte de alimento o para negociar con alguien que no debería estar aquí.', weight: 17 },
  pill: { name: 'Pastilla', short: 'Pastilla', icon: '💊', size: 1, desc: 'Un medicamento de emergencia. Puede ayudar a recuperar un poco la estabilidad de la cápsula y a tratar pequeños problemas.', weight: 9 },
  flashlight: { name: 'Linterna', short: 'Linterna', icon: '🔦', size: 1, desc: 'Una linterna resistente. Podría ayudarte a revisar señales y rincones oscuros durante la noche.', weight: 8 },
  computer: { name: 'Computadora', short: 'Computadora', icon: '💻', size: 2, desc: 'Una computadora portátil de navegación. Silver podría usarla para optimizar el mecanismo de la red.', weight: 6 },
  battery: { name: 'Batería', short: 'Batería', icon: '🔋', size: 1, desc: 'Una batería auxiliar. Puedes conectarla a la red para aumentar las probabilidades de recuperar comida.', weight: 11 },
  duct_tape: { name: 'Cinta aislante', short: 'Cinta', icon: '🩹', size: 1, desc: 'Cinta industrial. No reemplaza una reparación completa, pero puede contener una fuga o una fisura.', weight: 10 },
  energy_drink: { name: 'Energética', short: 'Energética', icon: '🥤', size: 1, desc: 'Una bebida de emergencia. Recupera toda tu energía de una sola vez.', weight: 7 },
  data_core: { name: 'Núcleo de datos', short: 'Núcleo', icon: '🔷', size: 1, desc: 'Un pequeño núcleo de almacenamiento. Puedes descomponerlo para recuperar una unidad de energía.', weight: 5 },
  star_fragment: { name: 'Fragmento estelar', short: 'Fragmento', icon: '✨', size: 1, desc: 'Un mineral extraño que conserva una carga tenue. Puede convertirse en una unidad de energía.', weight: 8 },
  medkit: { name: 'Kit médico', short: 'Kit médico', icon: '🧰', size: 2, desc: 'Un kit de primeros auxilios compacto. Repara daños menores de la cápsula y puede salvarte en una mala noche.', weight: 4 }
};

const LOOT_TABLE = Object.keys(ITEM_DATA);
const SAVE_KEY = 'stranded-in-space-save-v1';

const EVENT_FILES = ['./events/rest.txt', './events/silver.txt'];
let eventLibrary = { rest: [], silver: [] };
function parseEventFile(source) {
  return source.split(/^---\\s*$/m).map(block => {
    const event = {};
    for (const raw of block.split(/\\r?\\n/)) {
      const line=raw.trim(); if(!line || line.startsWith('#')) continue;
      const i=line.indexOf(':'); if(i<0) continue;
      const key=line.slice(0,i).trim().toLowerCase(); let value=line.slice(i+1).trim();
      if(value.startsWith('[')) { try { value=JSON.parse(value); } catch(_) {} }
      else if(/^".*"$/.test(value)) value=value.slice(1,-1).replace(/\\n/g,'\\n').replace(/\\"/g,'"');
      event[key]=value;
    }
    return event;
  }).filter(event=>event['event name']);
}
async function loadEventLibrary(){
  const files=await Promise.all(EVENT_FILES.map(async path=>{try{const r=await fetch(path);if(!r.ok)throw Error(r.status);return {path,text:await r.text()};}catch(e){console.warn('Event file unavailable:',path,e);return {path,text:''};}}));
  for(const file of files) eventLibrary[file.path.includes('silver')?'silver':'rest']=parseEventFile(file.text);
}
function eventList(value){if(Array.isArray(value))return value;if(!value||value==='none')return [];return String(value).split(';').map(x=>x.trim()).filter(Boolean);}
function eventItem(id){return state.inventory.find(x=>x.id===String(id).trim().toLowerCase().replace(/ /g,'_'));}
function applyEventRewards(value){
  for(const reward of eventList(value)){const m=String(reward).match(/^([+-])\\s*(\\d+)\\s+([a-z0-9_ -]+)$/i);if(!m)continue;const count=Number(m[2])*(m[1]==='-'?-1:1);const id=m[3].trim().toLowerCase().replace(/ /g,'_');if(!ITEM_DATA[id])continue;
    if(count>0)addStorageItem(id,count);else for(let n=0;n<Math.abs(count);n++){const item=eventItem(id);if(item)removeInventoryEntry(item.uid);}
  }
}
function applyEventTrigger(value){
  for(const raw of eventList(value)){const action=String(raw).toLowerCase().trim().replace(/ /g,'_');
    if(['upgrade_red','upgrade_net'].includes(action)){state.networkBoost=Math.max(state.networkBoost,3);showSurvivalToast('Silver mejoró la red: los próximos 3 lanzamientos darán 2 comidas.');}
    else if(action==='break_pod')changeHull(-18);
    else if(action.startsWith('damage_pod_'))changeHull(-Number(action.slice(11))||-10);
    else if(action.startsWith('repair_pod_'))changeHull(Number(action.slice(11))||10);
    else if(action==='break_computer')state.computerBroken=true;
    else if(action==='fix_computer')state.computerBroken=false;
  } syncHud();saveGame();
}
function showDataEvent(event,category){
  state.pendingEvent={event,category};
  const chain=eventList(event['event message chain']);
  $('eventSymbol').textContent=category==='silver'?'S':'✦';
  $('eventKicker').textContent=category==='silver'?'CANAL PRIVADO · SILVER':'EVENTO NOCTURNO';
  $('eventTitle').textContent=event['event name'];
  $('eventDescription').textContent=chain.length?chain.join('\\n\\n'):(event['event message']||'Algo sucede en la oscuridad.');
  const panel=$('eventModal').querySelector('.event-panel');const bg=event['event space background'];
  panel.style.backgroundImage=bg&&bg!=='none'?'linear-gradient(rgba(7,12,22,.82),rgba(7,12,22,.96)),url("'+bg+'")':'';
  panel.style.backgroundSize='cover';panel.style.backgroundPosition='center';
  const root=$('eventChoices');root.innerHTML='';
  const choices=eventList(event['event choices']);
  if(!choices.length){
    addEventChoice(root,'Continuar','',true,()=>{const item=String(event['event use item']||'none').toLowerCase().replace(/ /g,'_');if(item!=='none'){const found=eventItem(item);if(!found){showSurvivalToast('Necesitas '+(ITEM_DATA[item]?.name||item));return;}if(Math.random()*100<clamp(Number(event['event chance consuming item']??100),0,100)){removeInventoryEntry(found.uid);if(item==='computer')state.computerBroken=true;}}
      applyEventTrigger(event['event trigger']);applyEventRewards(event['recompensas']||event['event rewards']);finishNight('La noche continúa.');});
  }else choices.forEach((raw,index)=>{const p=String(raw).split('|').map(x=>x.trim());const label=p[0]||'Opción '+(index+1),trigger=p[1]||'none',item=(p[2]||'none').toLowerCase().replace(/ /g,'_'),chance=Number(p[3]??100),rewards=p[4]||'none',desc=p[5]||'';
    const available=item==='none'||!!eventItem(item);
    addEventChoice(root,label,desc,available,()=>{if(item!=='none'&&Math.random()*100<clamp(chance,0,100)){const found=eventItem(item);if(found){removeInventoryEntry(found.uid);if(item==='computer')state.computerBroken=true;}}applyEventTrigger(trigger);applyEventRewards(rewards);finishNight(p[6]||'La noche continúa.');},'Necesitas '+item);
  });
  showModal('eventModal');
}

const state = {
  phase: 'title',
  day: 1,
  energy: 4,
  maxEnergy: 4,
  hull: 100,
  inventory: [],
  hand: [],
  companion: false,
  companionName: 'Silver',
  computerBroken: false,
  networkBoost: 0,
  flashlightOn: false,
  rescueRemaining: 60,
  rescueStartedAt: 0,
  lastAlarmSecond: -1,
  paused: false,
  muted: false,
  selectedItem: null,
  repairSequence: [],
  repairStep: 0,
  pendingEvent: null,
  sleeping: false,
  toastTimer: null
};

let renderer;
let scene;
let camera;
let menuScene;
let menuCamera;
let rescueObjects = [];
let interactables = [];
let playerYaw = 0;
let playerPitch = 0;
let keys = {};
let lastFrame = performance.now();
let pointerLocked = false;
let audioContext = null;
let ambienceOsc = null;
let cine = null;
let currentPodLights = [];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas: $('world'), antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  buildMenuScene();
  window.addEventListener('resize', onResize);
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === $('world');
  });
  $('world').addEventListener('click', () => {
    if (state.phase === 'rescue' && !state.paused && !pointerLocked && $('titleScreen').classList.contains('hidden')) {
      $('world').requestPointerLock?.();
    }
  });
  document.addEventListener('mousemove', (event) => {
    if (pointerLocked && state.phase === 'rescue' && !state.paused) {
      playerYaw -= event.movementX * 0.0021;
      playerPitch = clamp(playerPitch - event.movementY * 0.0017, -1.05, 1.05);
      camera.rotation.set(playerPitch, playerYaw, 0, 'YXZ');
    }
  });
}

function onResize() {
  if (!renderer) return;
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (camera) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  if (menuCamera) {
    menuCamera.aspect = window.innerWidth / window.innerHeight;
    menuCamera.updateProjectionMatrix();
  }
}

function addStarfield(target, count = 850, radius = 90) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = random(-radius, radius);
    positions[i * 3 + 1] = random(-radius, radius);
    positions[i * 3 + 2] = random(-radius, radius);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xb8e8ef, size: 0.11, transparent: true, opacity: 0.8 }));
  target.add(points);
  return points;
}

function buildMenuScene() {
  menuScene = new THREE.Scene();
  menuScene.background = new THREE.Color(0x050b15);
  addStarfield(menuScene, 1150, 100);
  menuCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 180);
  menuCamera.position.set(0, 4, 28);
  menuCamera.lookAt(0, 0, 0);
  const ship = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x142b3d, metalness: 0.72, roughness: 0.34 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(15, 2.3, 4.2), hullMat);
  ship.add(hull);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.8, 5.4, 6), hullMat);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 9.2;
  ship.add(nose);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x203f55, metalness: 0.6, roughness: 0.5 });
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.18, 7), wingMat);
    wing.position.set(-1, side * 0.7, 0);
    wing.rotation.z = side * 0.12;
    ship.add(wing);
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.05, 2.6, 12), new THREE.MeshStandardMaterial({ color: 0x1d3a4b, metalness: 0.8, roughness: 0.25, emissive: 0x0b4a5d, emissiveIntensity: 1.8 }));
    engine.rotation.z = Math.PI / 2;
    engine.position.set(-8.3, side * 0.35, 0);
    ship.add(engine);
  }
  for (let i = 0; i < 7; i++) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x8de7e7 : 0xffad76 }));
    light.position.set(-5 + i * 1.4, 1.22, 2.12);
    ship.add(light);
  }
  ship.rotation.set(0.23, -0.18, -0.12);
  ship.position.set(1.2, 0.3, -3);
  menuScene.add(ship);
  const planet = new THREE.Mesh(new THREE.SphereGeometry(5.5, 48, 48), new THREE.MeshStandardMaterial({ color: 0x172f49, roughness: 0.92, metalness: 0.05, emissive: 0x061323 }));
  planet.position.set(13, 3, -25);
  menuScene.add(planet);
  menuScene.add(new THREE.AmbientLight(0x6d93b0, 0.95));
  const keyLight = new THREE.DirectionalLight(0x9ce4ea, 1.6);
  keyLight.position.set(3, 12, 16);
  menuScene.add(keyLight);
  scene = menuScene;
  camera = menuCamera;
}

function addBox(target, position, size, material, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  target.add(mesh);
  return mesh;
}

function addCylinder(target, position, radiusTop, radiusBottom, height, material, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 24), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  target.add(mesh);
  return mesh;
}

function makeRoomLights(target) {
  target.add(new THREE.HemisphereLight(0x8ab6cc, 0x101a28, 1.2));
  const ceiling = new THREE.PointLight(0x8de7e7, 2.2, 24);
  ceiling.position.set(0, 4.1, -1);
  target.add(ceiling);
  const warm = new THREE.PointLight(0xffad76, 1.15, 15);
  warm.position.set(-5, 2.8, 4);
  target.add(warm);
  const podLight = new THREE.PointLight(0x8de7e7, 2.4, 11);
  podLight.position.set(0, 2.6, -6.3);
  target.add(podLight);
}

function createPodModel(target, x, z, scale = 1) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x526a7b, metalness: 0.82, roughness: 0.3 });
  const pale = new THREE.MeshStandardMaterial({ color: 0xb0c4cc, metalness: 0.62, roughness: 0.35 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x174b53, emissive: 0x3bd5d3, emissiveIntensity: 1.5, metalness: 0.45, roughness: 0.28 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 1.02, 2.5, 12), metal);
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.78, 1.4, 12), pale);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -1.75;
  group.add(nose);
  const windowMesh = new THREE.Mesh(new THREE.SphereGeometry(0.47, 24, 18), glow);
  windowMesh.scale.set(1, 1, 0.26);
  windowMesh.position.set(0, 0.22, -1.0);
  group.add(windowMesh);
  const finMat = new THREE.MeshStandardMaterial({ color: 0x263e50, metalness: 0.65, roughness: 0.42 });
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 0.9), finMat);
    fin.position.set(Math.cos(i * Math.PI * 2 / 3) * 0.8, Math.sin(i * Math.PI * 2 / 3) * 0.8, 0.75);
    fin.rotation.z = i * Math.PI * 2 / 3;
    group.add(fin);
  }
  group.scale.setScalar(scale);
  group.position.set(x, 1.25 * scale, z);
  group.rotation.x = -Math.PI / 2;
  target.add(group);
  return group;
}

function createPodZone(target, x, z) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.78, 48), new THREE.MeshBasicMaterial({ color: 0x8de7e7, transparent: true, opacity: 0.72, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.055, z);
  target.add(ring);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(1.54, 48), new THREE.MeshBasicMaterial({ color: 0x2dbfc1, transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
  inner.rotation.x = -Math.PI / 2;
  inner.position.set(x, 0.048, z);
  target.add(inner);
  const pulse = new THREE.PointLight(0x8de7e7, 1.2, 5);
  pulse.position.set(x, 0.9, z);
  target.add(pulse);
  currentPodLights = [ring, inner, pulse];
}

function makePlaceholderTexture(itemId) {
  const info = ITEM_DATA[itemId] || { icon: '◉', name: 'Objeto' };
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(20, 20, 230, 230);
  grad.addColorStop(0, '#325264');
  grad.addColorStop(1, '#101b2a');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(16, 16, 224, 224, 38);
  ctx.fill();
  ctx.strokeStyle = 'rgba(141,231,231,.65)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#e4ffff';
  ctx.font = '100px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(info.icon || '◉', 128, 117);
  ctx.fillStyle = 'rgba(220,245,248,.88)';
  ctx.font = '500 18px Arial';
  ctx.fillText((info.short || info.name).toUpperCase(), 128, 205);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createIconNode(itemId, emoji, className) {
  const wrapper = el('span', className || 'item-icon-wrap');
  const image = document.createElement('img');
  image.alt = ITEM_DATA[itemId]?.name || itemId;
  image.src = itemId === 'silver' ? './assets/characters/silver.png' : './assets/items/' + itemId + '.png';
  image.onerror = () => { image.classList.add('hidden'); fallback.classList.remove('hidden'); };
  const fallback = el('span', 'icon-fallback hidden', emoji || '◉');
  wrapper.append(image, fallback);
  return wrapper;
}

const textureCache = new Map();
function getItemTexture(itemId) {
  if (!textureCache.has(itemId)) {
    const texture = makePlaceholderTexture(itemId);
    textureCache.set(itemId, texture);
  }
  return textureCache.get(itemId);
}

function tryLoadItemPng(itemId, material) {
  const loader = new THREE.TextureLoader();
  const path = './assets/items/' + itemId + '.png';
  loader.load(path, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    material.map = texture;
    material.needsUpdate = true;
  }, undefined, () => {});
}

function createWorldItem(itemId, position) {
  const info = ITEM_DATA[itemId];
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.43, 0.05, 24), new THREE.MeshStandardMaterial({ color: 0x23414f, emissive: 0x0a6670, emissiveIntensity: 0.35, metalness: 0.65, roughness: 0.4 }));
  base.position.y = 0.08;
  group.add(base);
  const material = new THREE.SpriteMaterial({ map: getItemTexture(itemId), transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(itemId === 'computer' || itemId === 'medkit' ? 0.92 : 0.72, itemId === 'computer' || itemId === 'medkit' ? 0.92 : 0.72, 1);
  sprite.position.y = 0.78;
  group.add(sprite);
  tryLoadItemPng(itemId, material);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.012, 6, 40), new THREE.MeshBasicMaterial({ color: 0x8de7e7, transparent: true, opacity: 0.55 }));
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.12;
  group.add(halo);
  group.position.set(position[0], 0, position[1]);
  scene.add(group);
  const obj = { id: itemId, group, sprite, halo, position: new THREE.Vector3(position[0], 0.8, position[1]), taken: false };
  interactables.push(obj);
  return obj;
}

function addShipProp(target, x, z, width = 1.2, height = 1.5) {
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x1e3549, metalness: 0.55, roughness: 0.62 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x46677b, metalness: 0.78, roughness: 0.32 });
  const box = new THREE.Group();
  addBox(box, [0, height / 2, 0], [width, height, 0.9], crateMat);
  addBox(box, [0, height / 2, 0.47], [width + 0.08, 0.08, 0.06], trimMat);
  addBox(box, [0, height / 2, -0.47], [width + 0.08, 0.08, 0.06], trimMat);
  box.position.set(x, 0, z);
  target.add(box);
}

function buildRescueScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07111f);
  scene.fog = new THREE.Fog(0x07111f, 15, 34);
  addStarfield(scene, 480, 55);
  makeRoomLights(scene);

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x172433, metalness: 0.48, roughness: 0.65 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1b2b3a, metalness: 0.63, roughness: 0.54 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0c1927, metalness: 0.58, roughness: 0.55 });
  const cyanMat = new THREE.MeshStandardMaterial({ color: 0x22515c, emissive: 0x1b7e87, emissiveIntensity: 0.7, metalness: 0.6 });
  addBox(scene, [0, -0.18, 0], [14, 0.35, 20], floorMat);
  addBox(scene, [0, 2.6, -10], [14, 5.4, 0.45], wallMat);
  addBox(scene, [-7, 2.6, 0], [0.45, 5.4, 20], wallMat);
  addBox(scene, [7, 2.6, 0], [0.45, 5.4, 20], wallMat);
  addBox(scene, [0, 5.25, 0], [14, 0.35, 20], darkMat);
  addBox(scene, [0, 2.6, 10], [14, 5.4, 0.45], wallMat);
  for (let z = -8.5; z <= 8.5; z += 2) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(13.7, 0.015, 0.035), new THREE.MeshBasicMaterial({ color: z < -5 ? 0x2a7e87 : 0x294259, transparent: true, opacity: 0.48 }));
    stripe.position.set(0, 0.012, z);
    scene.add(stripe);
  }
  for (let x = -6; x <= 6; x += 2) {
    addBox(scene, [x, 2.6, -9.73], [0.045, 4.9, 0.08], cyanMat);
    addBox(scene, [x, 0.05, 0], [0.035, 0.02, 19.5], new THREE.MeshBasicMaterial({ color: 0x314a60, transparent: true, opacity: 0.28 }));
  }
  for (let z = -8; z <= 8; z += 4) {
    addBox(scene, [-6.72, 4.95, z], [0.12, 0.13, 0.9], cyanMat);
    addBox(scene, [6.72, 4.95, z], [0.12, 0.13, 0.9], cyanMat);
  }
  // Emergency glass and structural ribs.
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 2.9), new THREE.MeshBasicMaterial({ color: 0x102c43, transparent: true, opacity: 0.8 }));
  glass.position.set(0, 3.05, -9.72);
  scene.add(glass);
  for (let x = -3; x <= 3; x += 1.5) addBox(scene, [x, 3.05, -9.65], [0.055, 3.1, 0.09], cyanMat);

  addShipProp(scene, -5.35, -4.9, 1.5, 1.45);
  addShipProp(scene, 5.35, 3.2, 1.4, 1.2);
  addShipProp(scene, -5.2, 5.9, 1.3, 1.05);
  addShipProp(scene, 5.25, -5.8, 1.3, 1.6);
  // Wall consoles.
  for (const side of [-1, 1]) {
    const consoleGroup = new THREE.Group();
    addBox(consoleGroup, [0, 1.5, 0], [0.14, 2.1, 1.5], darkMat);
    addBox(consoleGroup, [side * 0.09, 1.75, 0], [0.04, 0.75, 0.92], cyanMat);
    consoleGroup.position.set(side * 6.5, 0, -0.7);
    scene.add(consoleGroup);
  }

  // Escape capsule at the evacuation point.
  createPodModel(scene, 0, -7.2, 1.15);
  createPodZone(scene, 0, -5.1);
  const podSign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.36), new THREE.MeshBasicMaterial({ color: 0x8de7e7, transparent: true, opacity: 0.9 }));
  podSign.position.set(0, 2.8, -7.0);
  scene.add(podSign);

  interactables = [];
  const spawns = [
    ['canned_food', [-4.0, 2.6]],
    ['battery', [3.8, -1.4]],
    ['pill', [-4.7, -5.7]],
    ['flashlight', [4.6, 5.2]],
    ['computer', [-1.3, -2.9]],
    ['duct_tape', [5.0, -6.8]],
    ['energy_drink', [-2.1, 6.3]],
    ['data_core', [2.3, 4.6]],
    ['star_fragment', [-2.8, -7.7]],
    ['medkit', [3.0, 0.8]],
    ['silver', [5.4, 1.0]]
  ];
  for (const [id, pos] of spawns) {
    if (id === 'silver') createCharacterSprite('silver', pos);
    else createWorldItem(id, pos);
  }
  scene.userData.podPosition = new THREE.Vector3(0, 0, -5.1);

  camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.1, 90);
  camera.position.set(0, 1.65, 7.1);
  playerYaw = 0;
  playerPitch = 0;
  camera.rotation.set(0, playerYaw, 0, 'YXZ');
}

function createCharacterSprite(characterId, position) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 24), new THREE.MeshStandardMaterial({ color: 0x27535a, emissive: 0x0c6569, emissiveIntensity: 0.4 }));
  base.position.y = 0.08;
  group.add(base);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#18384a';
  ctx.beginPath(); ctx.roundRect(22, 10, 212, 236, 78); ctx.fill();
  ctx.strokeStyle = '#8de7e7'; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = '#d5eeee'; ctx.beginPath(); ctx.arc(128, 86, 47, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#253a4a'; ctx.beginPath(); ctx.ellipse(128, 184, 72, 71, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8de7e7'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center'; ctx.fillText('SILVER', 128, 230);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(spriteMat);
  new THREE.TextureLoader().load('./assets/characters/silver.png', (loaded) => { loaded.colorSpace = THREE.SRGBColorSpace; spriteMat.map = loaded; spriteMat.needsUpdate = true; }, undefined, () => {});
  sprite.scale.set(0.95, 1.25, 1);
  sprite.position.y = 1.0;
  group.add(sprite);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.013, 6, 40), new THREE.MeshBasicMaterial({ color: 0xffad76, transparent: true, opacity: 0.7 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.12; group.add(ring);
  group.position.set(position[0], 0, position[1]);
  scene.add(group);
  interactables.push({ id: characterId, group, sprite, halo: ring, position: new THREE.Vector3(position[0], 0.8, position[1]), taken: false });
}

function buildCinematicScene() {
  const cineScene = new THREE.Scene();
  cineScene.background = new THREE.Color(0x030812);
  addStarfield(cineScene, 1500, 140);
  cineScene.add(new THREE.AmbientLight(0x6688a4, 0.8));
  const sun = new THREE.PointLight(0xa3f3ed, 2.5, 80);
  sun.position.set(-8, 12, 12); cineScene.add(sun);
  const ship = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x243c50, metalness: 0.75, roughness: 0.32 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(13, 3, 5.4), hullMat);
  ship.add(hull);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.0, 5.4, 8), hullMat);
  nose.rotation.z = -Math.PI / 2; nose.position.x = 9.1; ship.add(nose);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x172e41, metalness: 0.75, roughness: 0.4 });
  for (const side of [-1, 1]) {
    addBox(ship, [-1.0, side * 1.0, 4.4], [7.0, 0.17, 7.0], wingMat);
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.1, 2.6, 14), new THREE.MeshStandardMaterial({ color: 0x183a4b, emissive: 0x0e6674, emissiveIntensity: 1.6, metalness: 0.7 }));
    engine.rotation.z = Math.PI / 2; engine.position.set(-7.7, side * 0.5, 0); ship.add(engine);
  }
  const windowMat = new THREE.MeshBasicMaterial({ color: 0x79d6d6 });
  for (let i = 0; i < 8; i++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.04), windowMat);
    w.position.set(-4.8 + i * 1.35, 1.53, 2.72); ship.add(w);
  }
  ship.position.set(0, 0.2, 0);
  ship.rotation.set(0.04, -0.13, 0.02);
  cineScene.add(ship);
  const pod = createPodModel(cineScene, -7, -2.1, 0.72);
  pod.rotation.y = 0.28;
  const debris = new THREE.Group();
  const particles = [];
  const particleMat = new THREE.MeshBasicMaterial({ color: 0xffad76 });
  for (let i = 0; i < 55; i++) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(random(0.035, 0.12), 6, 6), particleMat.clone());
    mesh.position.set(random(-1, 1), random(-1, 1), random(-1, 1));
    debris.add(mesh); particles.push(mesh);
  }
  cineScene.add(debris);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), new THREE.MeshBasicMaterial({ color: 0xffc48e, transparent: true, opacity: 0 }));
  flash.position.set(0, 0, 0); cineScene.add(flash);
  const cineCamera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 240);
  cineCamera.position.set(0, 6, 31); cineCamera.lookAt(0, 0, 0);
  return { scene: cineScene, camera: cineCamera, ship, pod, debris, particles, flash, started: performance.now(), exploded: false };
}

function buildPodInteriorScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040b15);
  scene.fog = new THREE.Fog(0x050d17, 8, 28);
  addStarfield(scene, 750, 55);
  scene.add(new THREE.HemisphereLight(0x89c6d7, 0x111a25, 1.2));
  const ceiling = new THREE.PointLight(0x8de7e7, 1.8, 18); ceiling.position.set(0, 3.8, 1); scene.add(ceiling);
  const warm = new THREE.PointLight(0xffad76, 0.45, 9); warm.position.set(-2, 1.8, 3); scene.add(warm);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x203444, metalness: 0.72, roughness: 0.39 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0d1d2b, metalness: 0.64, roughness: 0.52 });
  addBox(scene, [0, -0.2, 0], [8, 0.4, 13], darkMat);
  addBox(scene, [0, 4, 0], [8, 0.25, 13], darkMat);
  addBox(scene, [-4, 1.9, 0], [0.25, 4, 13], wallMat);
  addBox(scene, [4, 1.9, 0], [0.25, 4, 13], wallMat);
  addBox(scene, [0, 1.9, 6.4], [8, 4, 0.25], wallMat);
  // Forward observation window.
  const windowRim = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.18, 16, 64), new THREE.MeshStandardMaterial({ color: 0x647d8c, metalness: 0.8, roughness: 0.25 }));
  windowRim.position.set(0, 2.1, -6.15); scene.add(windowRim);
  const windowGlass = new THREE.Mesh(new THREE.CircleGeometry(1.52, 64), new THREE.MeshBasicMaterial({ color: 0x102d48, transparent: true, opacity: 0.2, depthWrite: false }));
  windowGlass.position.set(0, 2.1, -6.18); scene.add(windowGlass);
  const planet = new THREE.Mesh(new THREE.SphereGeometry(0.95, 28, 28), new THREE.MeshStandardMaterial({ color: 0x355a77, emissive: 0x0b2138, roughness: 0.95 }));
  planet.position.set(-0.55, 2.4, -7.0); scene.add(planet);
  const planetLight = new THREE.PointLight(0x81b9d6, 0.5, 4); planetLight.position.set(-0.3, 2.3, -6.5); scene.add(planetLight);
  for (let i = 0; i < 5; i++) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), new THREE.MeshBasicMaterial({ color: 0xe4ffff }));
    light.position.set(random(-1.3, 1.3), random(1.1, 3.1), -7); scene.add(light);
  }
  // Console and sleeping bunk.
  addBox(scene, [0, 0.95, -3.35], [4.5, 0.55, 1.05], wallMat);
  addBox(scene, [0, 1.35, -3.6], [2.5, 0.08, 0.8], new THREE.MeshStandardMaterial({ color: 0x244b56, emissive: 0x0c4b54, emissiveIntensity: 0.7 }));
  for (let i = 0; i < 4; i++) {
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x8de7e7 : 0xffad76 }));
    button.position.set(-1.25 + i * 0.8, 1.46, -3.3); scene.add(button); currentPodLights.push(button);
  }
  addBox(scene, [-2.6, 0.75, 1.0], [1.45, 0.42, 3.8], darkMat);
  addBox(scene, [2.6, 0.75, 1.0], [1.45, 0.42, 3.8], darkMat);
  addBox(scene, [0, 0.35, 4.6], [3.1, 0.14, 0.55], wallMat);
  for (const side of [-1, 1]) {
    addBox(scene, [side * 3.72, 2.2, -1.5], [0.08, 2.8, 0.07], new THREE.MeshBasicMaterial({ color: 0x39818a }));
  }
  camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 80);
  camera.position.set(0, 2.05, 5.75);
  camera.lookAt(0, 1.9, -3.3);
  state.podLights = currentPodLights;
}

function setupAudio() {
  if (audioContext) {
    if (audioContext.state === 'suspended') audioContext.resume();
    return;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  audioContext = new AudioCtx();
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  osc.type = 'sine'; osc.frequency.value = 48; filter.type = 'lowpass'; filter.frequency.value = 90;
  gain.gain.value = 0.018;
  osc.connect(filter); filter.connect(gain); gain.connect(audioContext.destination); osc.start();
  ambienceOsc = { osc, gain };
}

function playSound(type) {
  if (state.muted) return;
  setupAudio();
  if (!audioContext) return;
  const presets = {
    pickup: [620, 880, 0.12, 'triangle'],
    deposit: [420, 660, 0.18, 'sine'],
    alarm: [480, 760, 0.42, 'sawtooth'],
    launch: [90, 380, 0.9, 'sawtooth'],
    net: [240, 520, 0.34, 'triangle'],
    reward: [660, 990, 0.32, 'sine'],
    repair: [180, 320, 0.16, 'square'],
    success: [520, 1040, 0.4, 'triangle'],
    failure: [240, 80, 0.6, 'sawtooth'],
    event: [310, 170, 0.5, 'sine'],
    click: [480, 560, 0.07, 'sine']
  };
  const data = presets[type] || presets.click;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = data[3];
  oscillator.frequency.setValueAtTime(data[0], now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, data[1]), now + data[2]);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(type === 'alarm' || type === 'launch' ? 0.12 : 0.075, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + data[2] + 0.05);
  oscillator.connect(gain); gain.connect(audioContext.destination);
  oscillator.start(now); oscillator.stop(now + data[2] + 0.07);
}

function showToast(message, duration = 2400) {
  const node = $('toast');
  node.textContent = message;
  node.classList.remove('hidden');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => node.classList.add('hidden'), duration);
}

function showRescueNotice(message) {
  const node = $('rescueNotice');
  node.textContent = message;
  node.classList.remove('hidden');
  setTimeout(() => node.classList.add('hidden'), 1900);
}

function showSurvivalToast(message) {
  const node = $('survivalToast');
  node.textContent = message;
  node.classList.remove('hidden');
  setTimeout(() => node.classList.add('hidden'), 2600);
}

function showModal(id) { $(id).classList.remove('hidden'); }
function hideModal(id) { $(id).classList.add('hidden'); }

function setInterface(phase) {
  $('titleScreen').classList.toggle('hidden', phase !== 'title');
  $('topbar').classList.toggle('hidden', phase === 'title' || phase === 'gameover' || phase === 'cinematic');
  $('rescueHud').classList.toggle('hidden', phase !== 'rescue');
  $('survivalHud').classList.toggle('hidden', phase !== 'survival');
  $('launchOverlay').classList.toggle('hidden', phase !== 'cinematic');
  $('gameOverScreen').classList.toggle('hidden', phase !== 'gameover');
  $('phaseLabel').textContent = phase === 'rescue' ? 'EVACUACIÓN' : 'SUPERVIVENCIA';
}

function startNewGame() {
  Object.assign(state, {
    phase: 'rescue', day: 1, energy: 4, hull: 100, inventory: [], hand: [],
    companion: false, computerBroken: false, networkBoost: 0, flashlightOn: false,
    rescueRemaining: 60, lastAlarmSecond: -1, paused: false, selectedItem: null,
    sleeping: false, pendingEvent: null
  });
  cine = null;
  $('gameOverScreen').classList.add('hidden');
  for (const modal of ['netModal', 'repairModal', 'eventModal', 'dialogModal', 'itemModal', 'pauseModal']) hideModal(modal);
  currentPodLights = [];
  buildRescueScene();
  setInterface('rescue');
  renderHand();
  syncHud();
  showRescueNotice('¡EMERGENCIA! RECOGE LO QUE PUEDAS.');
  $('titleScreen').classList.add('hidden');
  saveGame();
  if (document.pointerLockElement) document.exitPointerLock();
  setupAudio();
}

function continueGame() {
  const saved = loadSavedData();
  if (!saved || saved.phase !== 'survival') {
    startNewGame();
    return;
  }
  Object.assign(state, saved);
  state.phase = 'survival';
  state.paused = false;
  buildPodInteriorScene();
  setInterface('survival');
  syncHud();
  renderStorage();
  showToast('Bienvenido de vuelta. Día ' + state.day + '.');
  setupAudio();
}

function saveGame() {
  if (state.phase !== 'survival') return;
  const data = {
    phase: 'survival', day: state.day, energy: state.energy, maxEnergy: state.maxEnergy,
    hull: state.hull, inventory: state.inventory, companion: state.companion,
    companionName: state.companionName, computerBroken: state.computerBroken,
    networkBoost: state.networkBoost, flashlightOn: state.flashlightOn
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (error) { console.warn('No se pudo guardar la partida', error); }
}

function loadSavedData() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!data || data.phase !== 'survival') return null;
    if (!Array.isArray(data.inventory)) data.inventory = [];
    return data;
  } catch (error) { return null; }
}

function deleteSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (error) {}
}

function updateCountdown() {
  if (state.phase !== 'rescue' || state.paused) return;
  const second = Math.ceil(state.rescueRemaining);
  $('countdown').innerHTML = second + '<span>s</span>';
  $('timerFill').style.width = (state.rescueRemaining / 60 * 100) + '%';
  const urgent = state.rescueRemaining <= 10;
  $('countdown').classList.toggle('urgent', urgent);
  $('timerFill').classList.toggle('urgent', urgent);
  if (urgent && second !== state.lastAlarmSecond) {
    state.lastAlarmSecond = second;
    playSound('alarm');
  }
}

function distance2d(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function updateRescue(delta) {
  if (state.phase !== 'rescue' || state.paused) return;
  state.rescueRemaining = Math.max(0, state.rescueRemaining - delta);
  updateCountdown();

  const speed = 4.2;
  const direction = new THREE.Vector3();
  const forward = new THREE.Vector3(-Math.sin(playerYaw), 0, -Math.cos(playerYaw));
  const right = new THREE.Vector3(Math.cos(playerYaw), 0, -Math.sin(playerYaw));
  if (keys.KeyW || keys.ArrowUp) direction.add(forward);
  if (keys.KeyS || keys.ArrowDown) direction.sub(forward);
  if (keys.KeyD || keys.ArrowRight) direction.add(right);
  if (keys.KeyA || keys.ArrowLeft) direction.sub(right);
  if (direction.lengthSq() > 0) {
    direction.normalize().multiplyScalar(speed * delta);
    camera.position.add(direction);
    camera.position.x = clamp(camera.position.x, -6.0, 6.0);
    camera.position.z = clamp(camera.position.z, -9.0, 9.0);
  }
  const player = camera.position;
  let nearest = null;
  let nearestDist = 2.35;
  for (const object of interactables) {
    if (object.taken) continue;
    const dist = Math.hypot(player.x - object.position.x, player.z - object.position.z);
    if (dist < nearestDist) { nearest = object; nearestDist = dist; }
  }
  const pod = scene.userData.podPosition;
  const podDistance = Math.hypot(player.x - pod.x, player.z - pod.z);
  const inPodZone = podDistance < 1.95;
  if (inPodZone) {
    $('podDistance').textContent = 'AQUÍ';
    $('podDistance').style.color = '#8de7e7';
  } else {
    $('podDistance').textContent = podDistance < 4.5 ? 'CERCA' : 'LEJOS';
    $('podDistance').style.color = '';
  }
  const hint = $('interactionHint');
  if (nearest && !inPodZone) {
    hint.classList.remove('hidden');
    $('interactionText').textContent = 'RECOGER ' + (nearest.id === 'silver' ? 'SILVER' : ITEM_DATA[nearest.id].name.toUpperCase());
  } else if (inPodZone && state.hand.length > 0) {
    hint.classList.remove('hidden');
    $('interactionText').textContent = 'DEPOSITAR OBJETOS';
  } else if (inPodZone) {
    hint.classList.remove('hidden');
    $('interactionText').textContent = 'ZONA DE ESCAPE';
  } else {
    hint.classList.add('hidden');
  }
  $('objectiveText').textContent = inPodZone && state.hand.length ? 'Pulsa E para guardar todo lo que llevas en la cápsula.' : 'Encuentra objetos, llena tus manos y vuelve a la cápsula.';
  if (state.rescueRemaining <= 0) {
    if (inPodZone) beginLaunch();
    else endGame(false, 'No llegaste a la zona de escape antes del impacto. La señal de tu traje se perdió junto con la nave.');
  }
}

function canCarry(itemId) {
  if (itemId === 'silver' && state.companion) return false;
  if (state.hand.some((entry) => entry.id === 'silver')) return false;
  const used = state.hand.reduce((sum, entry) => sum + (entry.id === 'silver' ? 3 : ITEM_DATA[entry.id].size), 0);
  const size = itemId === 'silver' ? 3 : ITEM_DATA[itemId].size;
  return used + size <= 3;
}

function interact() {
  if (state.phase !== 'rescue' || state.paused) return;
  const player = camera.position;
  let nearest = null;
  let nearestDist = 2.35;
  for (const object of interactables) {
    if (object.taken) continue;
    const dist = Math.hypot(player.x - object.position.x, player.z - object.position.z);
    if (dist < nearestDist) { nearest = object; nearestDist = dist; }
  }
  const pod = scene.userData.podPosition;
  const inPodZone = Math.hypot(player.x - pod.x, player.z - pod.z) < 1.95;
  if (nearest && !inPodZone) {
    if (!canCarry(nearest.id)) {
      showRescueNotice(nearest.id === 'silver' && state.companion ? 'SOLO PUEDES LLEVAR A UNA PERSONA.' : 'NO TIENES ESPACIO EN LAS MANOS.');
      playSound('failure');
      return;
    }
    nearest.taken = true;
    scene.remove(nearest.group);
    state.hand.push({ id: nearest.id, uid: Math.random().toString(36).slice(2) });
    renderHand();
    syncHud();
    playSound('pickup');
    if (nearest.id === 'silver') showRescueNotice('SILVER SE HA UNIDO A TI. ¡VAMOS!');
    else showRescueNotice(ITEM_DATA[nearest.id].name.toUpperCase() + ' RECUPERADO.');
    return;
  }
  if (inPodZone) {
    if (!state.hand.length) {
      showRescueNotice('LA CÁPSULA ESTÁ LISTA. ESPERA AQUÍ.');
      return;
    }
    depositHand();
    return;
  }
  showRescueNotice('NO HAY NADA CERCA. ACÉRCATE A UN OBJETO.');
}

function depositHand() {
  const stored = [];
  for (const entry of state.hand) {
    if (entry.id === 'silver') {
      state.companion = true;
      stored.push('Silver');
    } else {
      state.inventory.push({ id: entry.id, uid: entry.uid || Math.random().toString(36).slice(2) });
      stored.push(ITEM_DATA[entry.id].name);
    }
  }
  state.hand = [];
  renderHand();
  syncHud();
  playSound('deposit');
  showRescueNotice('GUARDADO EN LA CÁPSULA: ' + stored.join(' · '));
  saveGame();
}

function renderHand() {
  const root = $('handSlots');
  root.innerHTML = '';
  let slot = 0;
  for (const entry of state.hand) {
    const info = entry.id === 'silver' ? { name: 'Silver', icon: '🧑‍🚀', size: 3 } : ITEM_DATA[entry.id];
    const card = el('div', 'hand-slot filled');
    card.style.gridColumn = 'span ' + info.size;
    card.appendChild(el('span', 'slot-size', info.size + ' SLOT' + (info.size > 1 ? 'S' : '')));
    card.appendChild(createIconNode(entry.id, info.icon, 'slot-icon'));
    card.appendChild(el('span', 'slot-name', info.name));
    root.appendChild(card);
    slot += info.size;
  }
  while (slot < 3) {
    const empty = el('div', 'hand-slot empty');
    const number = String(slot + 1).padStart(2, '0');
    empty.innerHTML = '<span>' + number + '</span>';
    root.appendChild(empty);
    slot++;
  }
  const usedSlots = state.hand.reduce((sum, entry) => sum + (entry.id === 'silver' ? 3 : ITEM_DATA[entry.id].size), 0);
  $('handCount').textContent = usedSlots + ' / 3';
  $('podItemCount').textContent = state.inventory.length + (state.companion ? ' objetos + 1 persona' : ' objetos guardados');
}

function beginLaunch() {
  if (state.phase !== 'rescue') return;
  state.phase = 'cinematic';
  state.paused = false;
  depositHand();
  if (document.pointerLockElement) document.exitPointerLock();
  cine = buildCinematicScene();
  scene = cine.scene;
  camera = cine.camera;
  setInterface('cinematic');
  $('cinematicTitle').innerHTML = 'SEPARACIÓN<br>CONFIRMADA';
  $('cinematicText').textContent = 'Abandonando la nave nodriza…';
  playSound('launch');
}

function updateCinematic(now) {
  if (!cine) return;
  const elapsed = (now - cine.started) / 1000;
  cine.pod.position.x = -7 + elapsed * 1.65;
  cine.pod.position.y = -2.1 + Math.sin(elapsed * 1.7) * 0.25 + elapsed * 0.17;
  cine.pod.rotation.z = Math.sin(elapsed * 1.2) * 0.08;
  cine.ship.rotation.y = -0.13 + Math.sin(elapsed * 0.45) * 0.04;
  if (elapsed > 2.1 && !cine.exploded) {
    cine.exploded = true;
    cine.flash.material.opacity = 0.92;
    playSound('failure');
    $('cinematicTitle').innerHTML = 'NO MIRES<br>ATRÁS';
    $('cinematicText').textContent = 'La nave nodriza ya no existe.';
    for (const particle of cine.particles) {
      particle.position.set(random(-1, 1), random(-1, 1), random(-1, 1));
      particle.userData.velocity = new THREE.Vector3(random(-1, 1), random(-1, 1), random(-1, 1)).normalize().multiplyScalar(random(2, 9));
    }
  }
  if (cine.exploded) {
    cine.flash.scale.setScalar(1 + elapsed * 1.8);
    cine.flash.material.opacity = Math.max(0, 0.92 - (elapsed - 2.1) * 0.42);
    for (const p of cine.particles) {
      p.position.addScaledVector(p.userData.velocity, 0.016);
      p.scale.multiplyScalar(0.994);
    }
    cine.ship.scale.setScalar(Math.max(0.55, 1 - (elapsed - 2.1) * 0.09));
  }
  if (elapsed > 6.4) {
    cine = null;
    state.phase = 'survival';
    state.rescueRemaining = 0;
    buildPodInteriorScene();
    setInterface('survival');
    syncHud();
    renderStorage();
    showSurvivalToast('La cápsula está a salvo. Por ahora.');
    saveGame();
  }
}

function endGame(success, message) {
  state.phase = 'gameover';
  state.paused = true;
  if (document.pointerLockElement) document.exitPointerLock();
  $('endingTitle').textContent = success ? 'SIGUES A FLOTE' : 'NO HUBO ESCAPE';
  $('endingText').textContent = message;
  $('gameOverScreen').classList.remove('hidden');
  $('topbar').classList.add('hidden');
  $('rescueHud').classList.add('hidden');
  $('survivalHud').classList.add('hidden');
  playSound('failure');
  deleteSave();
}

function syncHud() {
  $('energyTop').textContent = state.energy + ' / ' + state.maxEnergy;
  $('dayLabel').textContent = 'DÍA ' + String(state.day).padStart(2, '0');
  $('dayNumber').textContent = String(state.day).padStart(2, '0');
  $('energyLabel').textContent = state.energy + ' / ' + state.maxEnergy;
  $('hullValue').textContent = Math.round(state.hull) + '%';
  $('hullFill').style.width = state.hull + '%';
  $('hullFill').classList.toggle('danger', state.hull <= 35);
  $('hullStatus').textContent = state.hull > 75 ? 'Estructura estable' : state.hull > 35 ? 'Daños estructurales detectados' : 'PELIGRO · FUGA CRÍTICA';
  $('energyPips').innerHTML = '';
  for (let i = 0; i < state.maxEnergy; i++) {
    const pip = document.createElement('i');
    if (i < state.energy) pip.classList.add('on');
    $('energyPips').appendChild(pip);
  }
  $('netButton').disabled = state.energy < 1;
  $('repairButton').disabled = state.energy < 1 || state.hull >= 100;
  $('talkButton').disabled = state.energy < 1 || !state.companion;
  $('companionName').textContent = state.companion ? state.companionName : 'Nadie a bordo';
  $('companionStatus').textContent = state.companion ? 'A bordo · listo para hablar' : 'Viajas en solitario';
  $('companionCard').classList.toggle('is-active', state.companion);
  $('podItemCount').textContent = state.inventory.length + (state.companion ? ' objetos + 1 persona' : ' objetos guardados');
  $('storageCount').textContent = state.inventory.length + ' ITEMS';
  renderHand();
}

function renderStorage() {
  const root = $('storageGrid');
  root.innerHTML = '';
  if (!state.inventory.length) {
    root.appendChild(el('div', 'storage-empty', 'Todavía no has recuperado ningún objeto.'));
    return;
  }
  for (const entry of state.inventory) {
    const info = ITEM_DATA[entry.id];
    if (!info) continue;
    const button = el('button', 'storage-item');
    button.type = 'button';
    button.appendChild(createIconNode(entry.id, info.icon, 'storage-icon'));
    button.appendChild(el('span', 'storage-name', info.name));
    button.addEventListener('click', () => openItem(entry.uid));
    root.appendChild(button);
  }
}

function consumeEnergy(amount = 1) {
  if (state.energy < amount) {
    showSurvivalToast('No tienes suficiente energía.');
    playSound('failure');
    return false;
  }
  state.energy -= amount;
  syncHud();
  saveGame();
  return true;
}

function changeHull(amount) {
  state.hull = clamp(state.hull + amount, 0, 100);
  syncHud();
  if (state.hull <= 0) endGame(false, 'La estructura de la cápsula cedió. La última luz se apagó lentamente.');
  saveGame();
}

function addStorageItem(itemId, count = 1) {
  for (let i = 0; i < count; i++) state.inventory.push({ id: itemId, uid: Math.random().toString(36).slice(2) });
  renderStorage();
  syncHud();
  saveGame();
}

function openItem(uid) {
  const entry = state.inventory.find((item) => item.uid === uid);
  if (!entry) return;
  const info = ITEM_DATA[entry.id];
  state.selectedItem = uid;
  $('itemDetailIcon').innerHTML = '';
  $('itemDetailIcon').appendChild(createIconNode(entry.id, info.icon, 'detail-icon-art'));
  $('itemDetailName').textContent = info.name;
  $('itemDetailDescription').textContent = info.desc;
  const actions = $('itemDetailActions');
  actions.innerHTML = '';
  const action = el('button', 'choice-button');
  action.type = 'button';
  action.textContent = itemActionLabel(entry.id);
  action.addEventListener('click', () => useItem(uid));
  actions.appendChild(action);
  const keep = el('button', 'choice-button', 'Dejarlo guardado');
  keep.addEventListener('click', () => hideModal('itemModal'));
  actions.appendChild(keep);
  showModal('itemModal');
}

function itemActionLabel(id) {
  const labels = {
    canned_food: 'Comer · recuperar 1 energía',
    pill: 'Usar pastilla · estabilizar la cápsula',
    flashlight: 'Encender linterna',
    computer: 'Revisar computadora',
    battery: 'Reservar para la red',
    duct_tape: 'Aplicar cinta · contener una fisura',
    energy_drink: 'Beber · recuperar toda la energía',
    data_core: 'Descomponer · +1 energía',
    star_fragment: 'Extraer carga · +1 energía',
    medkit: 'Usar kit médico · +35% integridad'
  };
  return labels[id] || 'Usar objeto';
}

function removeInventoryEntry(uid) {
  const index = state.inventory.findIndex((entry) => entry.uid === uid);
  if (index >= 0) state.inventory.splice(index, 1);
  renderStorage();
  syncHud();
  saveGame();
}

function useItem(uid) {
  const entry = state.inventory.find((item) => item.uid === uid);
  if (!entry) return;
  const id = entry.id;
  if (id === 'canned_food') {
    if (state.energy >= state.maxEnergy) { showSurvivalToast('Tu energía ya está completa.'); return; }
    removeInventoryEntry(uid); state.energy = Math.min(state.maxEnergy, state.energy + 1);
    showSurvivalToast('Comiste algo. +1 energía.'); playSound('success');
  } else if (id === 'pill') {
    if (state.hull >= 100) { showSurvivalToast('No necesitas usarla ahora.'); return; }
    removeInventoryEntry(uid); changeHull(20); showSurvivalToast('El estabilizador hizo efecto. +20% integridad.'); playSound('success');
  } else if (id === 'flashlight') {
    state.flashlightOn = true; removeInventoryEntry(uid); showSurvivalToast('Linterna encendida. Puede servir durante un evento nocturno.'); playSound('click');
  } else if (id === 'computer') {
    if (state.computerBroken) { showSurvivalToast('La computadora está averiada.'); return; }
    hideModal('itemModal');
    showDialog('La computadora responde. Puedo revisar los sistemas de navegación, aunque para la red todavía necesito un poco más de tiempo.');
    return;
  } else if (id === 'battery') {
    hideModal('itemModal'); $('batteryBoost').checked = true; openNetModal(); return;
  } else if (id === 'duct_tape') {
    if (state.hull >= 100) { showSurvivalToast('El casco no tiene fisuras que sellar.'); return; }
    removeInventoryEntry(uid); changeHull(12); showSurvivalToast('La cinta contuvo una pequeña fisura. +12% integridad.'); playSound('repair');
  } else if (id === 'energy_drink') {
    removeInventoryEntry(uid); state.energy = state.maxEnergy; syncHud(); showSurvivalToast('¡Energía restaurada al máximo!'); playSound('success');
  } else if (id === 'data_core' || id === 'star_fragment') {
    if (state.energy >= state.maxEnergy) { showSurvivalToast('Tu energía ya está completa.'); return; }
    removeInventoryEntry(uid); state.energy = Math.min(state.maxEnergy, state.energy + 1); syncHud(); showSurvivalToast('Carga recuperada. +1 energía.'); playSound('success');
  } else if (id === 'medkit') {
    if (state.hull >= 100) { showSurvivalToast('No necesitas el kit médico ahora.'); return; }
    removeInventoryEntry(uid); changeHull(35); showSurvivalToast('El kit estabilizó el casco. +35% integridad.'); playSound('success');
  }
  hideModal('itemModal');
  syncHud();
  saveGame();
}

function openNetModal() {
  if (state.energy < 1) { showSurvivalToast('Necesitas 1 de energía para lanzar la red.'); return; }
  $('netStatusText').textContent = 'Te acercas a la ventana y preparas el mecanismo de lanzamiento.';
  $('netAnimation').classList.remove('casting');
  $('netReward').classList.add('hidden');
  $('castNetButton').disabled = false;
  $('castNetButton').dataset.mode = 'cast';
  $('castNetButton').textContent = 'LANZAR LA RED · 1 ⚡';
  $('batteryBoost').disabled = !state.inventory.some((entry) => entry.id === 'battery');
  $('batteryBoost').checked = false;
  showModal('netModal');
}

function castNet() {
  if ($('castNetButton').dataset.mode === 'close') { hideModal('netModal'); $('castNetButton').dataset.mode = 'cast'; return; }
  if (state.energy < 1) { showSurvivalToast('No tienes energía suficiente.'); return; }
  const useBattery = $('batteryBoost').checked;
  const batteryEntry = state.inventory.find((entry) => entry.id === 'battery');
  if (useBattery && !batteryEntry) { showSurvivalToast('No tienes una batería disponible.'); $('batteryBoost').checked = false; return; }
  consumeEnergy(1);
  if (useBattery) removeInventoryEntry(batteryEntry.uid);
  $('castNetButton').disabled = true;
  $('batteryBoost').disabled = true;
  $('netAnimation').classList.add('casting');
  $('netStatusText').textContent = 'La red se aleja de la cápsula. Algo acaba de engancharse…';
  playSound('net');
  setTimeout(() => {
    let resultId;
    let amount = 1;
    let note = 'Algo quedó atrapado en la malla.';
    if (state.networkBoost > 0) {
      resultId = 'canned_food';
      amount = 2;
      state.networkBoost -= 1;
      note = 'La mejora de Silver funcionó: recuperaste dos latas de comida.';
    } else {
      const table = [];
      for (const id of LOOT_TABLE) {
        const info = ITEM_DATA[id];
        let weight = info.weight;
        if (useBattery && (id === 'canned_food' || id === 'energy_drink' || id === 'medkit')) weight *= 2.3;
        if (useBattery && (id === 'data_core' || id === 'star_fragment')) weight *= 0.65;
        for (let n = 0; n < Math.round(weight); n++) table.push(id);
      }
      resultId = pick(table);
    }
    addStorageItem(resultId, amount);
    const info = ITEM_DATA[resultId];
    $('netReward').innerHTML = '<div class="reward-icon">' + info.icon + (amount > 1 ? ' ×' + amount : '') + '</div><b></b><small></small>';
    $('netReward').querySelector('b').textContent = amount > 1 ? amount + ' × ' + info.name : info.name;
    $('netReward').querySelector('small').textContent = note + (useBattery ? ' La batería mejoró las probabilidades.' : '');
    $('netReward').classList.remove('hidden');
    $('netStatusText').textContent = 'La red regresó. Mira lo que encontraste.';
    $('castNetButton').textContent = 'CERRAR';
    $('castNetButton').dataset.mode = 'close';
    $('castNetButton').disabled = false;
    playSound('reward');
    saveGame();
  }, 2100);
}

function openRepair() {
  if (state.hull >= 100) { showSurvivalToast('La cápsula ya está al 100%.'); return; }
  if (!consumeEnergy(1)) return;
  state.repairSequence = [];
  while (state.repairSequence.length < 3) {
    const n = Math.floor(Math.random() * 6);
    if (!state.repairSequence.includes(n)) state.repairSequence.push(n);
  }
  state.repairStep = 0;
  $('repairStatus').textContent = 'ESPERANDO ALINEACIÓN';
  $('repairInstructions').textContent = 'Te acercas a la pared dañada. Asegura los tres tornillos en el orden indicado.';
  $('repairFill').style.width = '0%';
  $('repairStartButton').classList.remove('hidden');
  $('repairStartButton').disabled = false;
  $('repairStartButton').dataset.mode = 'start';
  $('repairStartButton').textContent = 'COMENZAR REPARACIÓN';
  const board = $('screwBoard');
  board.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const screw = el('button', 'screw');
    screw.type = 'button';
    screw.dataset.index = String(i);
    screw.setAttribute('aria-label', 'Tornillo ' + (i + 1));
    screw.addEventListener('click', () => tightenScrew(i));
    board.appendChild(screw);
  }
  showModal('repairModal');
}

function startRepairMinigame() {
  if ($('repairStartButton').dataset.mode === 'close') {
    hideModal('repairModal');
    $('repairStartButton').dataset.mode = 'start';
    $('repairStartButton').textContent = 'COMENZAR REPARACIÓN';
    return;
  }
  $('repairStartButton').dataset.mode = 'playing';
  $('repairStartButton').classList.add('hidden');
  $('repairInstructions').textContent = 'Sigue el destello. Haz clic en cada tornillo en el orden correcto.';
  $('repairStatus').textContent = 'ALINEANDO TALADRO…';
  $('drillTool').classList.add('drilling');
  setTimeout(() => {
    $('drillTool').classList.remove('drilling');
    $('repairStatus').textContent = 'TORNILLO 1 DE 3 · SIGUE EL DESTELLO';
    highlightRepairScrew();
    playSound('repair');
  }, 900);
}

function highlightRepairScrew() {
  document.querySelectorAll('.screw').forEach((node) => node.classList.remove('current'));
  const current = document.querySelector('.screw[data-index="' + state.repairSequence[state.repairStep] + '"]');
  if (current) current.classList.add('current');
}

function tightenScrew(index) {
  if ($('repairStartButton').dataset.mode !== 'playing') return;
  if (state.repairStep >= 3) return;
  const expected = state.repairSequence[state.repairStep];
  if (index !== expected) {
    $('repairStatus').textContent = 'ESE NO ES EL TORNILLO. SIGUE EL DESTELLO.';
    playSound('failure');
    return;
  }
  const node = document.querySelector('.screw[data-index="' + index + '"]');
  node.classList.remove('current');
  node.classList.add('done');
  state.repairStep += 1;
  $('repairFill').style.width = (state.repairStep / 3 * 100) + '%';
  playSound('repair');
  if (state.repairStep === 3) {
    $('repairStatus').textContent = 'PANEL ASEGURADO · CASCO RESTAURADO';
    $('repairInstructions').textContent = 'El taladro se detiene. La cápsula vuelve a estar como nueva.';
    state.hull = 100;
    syncHud();
    saveGame();
    $('repairStartButton').classList.remove('hidden');
    $('repairStartButton').dataset.mode = 'close';
    $('repairStartButton').textContent = 'TERMINAR';
    playSound('success');
  } else {
    $('repairStatus').textContent = 'TORNILLO ' + (state.repairStep + 1) + ' DE 3 · SIGUE EL DESTELLO';
    highlightRepairScrew();
  }
}

function showDialog(message) {
  $('dialogText').textContent = message;
  $('dialogChoices').innerHTML = '';
  const close = el('button', 'choice-button', 'Cerrar conversación');
  close.addEventListener('click', () => hideModal('dialogModal'));
  $('dialogChoices').appendChild(close);
  showModal('dialogModal');
}

function talkToSilver() {
  if (!state.companion) { showSurvivalToast('No hay nadie más en la cápsula.'); return; }
  if (!consumeEnergy(1)) return;
  const casual = [
    '¿Escuchaste eso? Creo que fue una pieza suelta… o prefiero pensar que fue una pieza suelta.',
    'La vista es preciosa, pero extraño tener suelo de verdad bajo los pies.',
    'Podríamos ponerle un nombre a esta cápsula. Aunque “lata con ventanas” me parece bastante honesto.',
    'Estoy revisando las lecturas. No son buenas, pero tampoco son el fin del mundo. Creo.'
  ];
  if (!state.computerBroken && state.networkBoost <= 0 && state.inventory.some((entry) => entry.id === 'computer') && Math.random() < 0.62) {
    $('dialogText').textContent = 'Se me ocurrió algo. Si me dejas usar la computadora, puedo reprogramar la red: durante los próximos 3 lanzamientos recuperaremos 2 latas de comida en vez de una. ¿Qué dices?';
    $('dialogChoices').innerHTML = '';
    const yes = el('button', 'choice-button', 'Sí, mejora la red');
    yes.addEventListener('click', acceptSilverUpgrade);
    const no = el('button', 'choice-button', 'Mejor no arriesguemos la computadora');
    no.addEventListener('click', () => { hideModal('dialogModal'); showSurvivalToast('Silver asiente y vuelve a revisar los controles.'); });
    $('dialogChoices').append(yes, no);
  } else if (state.computerBroken) {
    showDialog('La computadora está hecha polvo, pero la mejora que instalé sigue funcionando. Al menos algo salió bien.');
  } else {
    showDialog(pick(casual));
  }
  showModal('dialogModal');
}

function acceptSilverUpgrade() {
  state.networkBoost = 3;
  const breaks = Math.random() < 0.22;
  if (breaks) {
    state.computerBroken = true;
    const computer = state.inventory.find((entry) => entry.id === 'computer');
    if (computer) state.inventory.splice(state.inventory.indexOf(computer), 1);
    renderStorage();
  }
  $('dialogText').textContent = breaks
    ? '¡Listo! La red está mejorada para los próximos 3 lanzamientos. Ehm… la computadora hizo un ruido horrible y dejó de funcionar. Pero la mejora quedó guardada. Creo que valió la pena.'
    : '¡Listo! La red está mejorada para los próximos 3 lanzamientos. Ahora debería recuperar dos latas por tiro. Eso sí que es eficiencia.';
  $('dialogChoices').innerHTML = '';
  const done = el('button', 'choice-button', 'Genial, gracias Silver');
  done.addEventListener('click', () => hideModal('dialogModal'));
  $('dialogChoices').appendChild(done);
  playSound('success');
  saveGame();
  syncHud();
}

function sleep() {
  if (state.sleeping || state.phase !== 'survival') return;
  state.sleeping = true;
  showSurvivalToast('Apagas las luces y cierras los ojos…');
  playSound('click');
  setTimeout(() => {
    if (state.phase !== 'survival') return;
    state.sleeping = false;
    if (Math.random() < 0.36) triggerNightEvent();
    else {
      if (Math.random() < 0.12) {
        const damage = Math.round(random(4, 8));
        changeHull(-damage);
        if (state.phase === 'gameover') return;
        finishNight('Una vibración recorrió el casco, pero pudiste seguir durmiendo.');
      } else {
        finishNight('Descansaste sin problema.');
      }
    }
  }, 1450);
}

function triggerNightEvent() {
  playSound('event');
  const category=state.companion&&eventLibrary.silver.length&&Math.random()<0.45?'silver':'rest';
  const pool=eventLibrary[category];
  if(!pool.length){finishNight('Descansaste sin problema.');return;}
  const weight=pool.map(e=>Math.max(1,Number(e['event weight']||1)));
  let roll=Math.random()*weight.reduce((a,b)=>a+b,0),chosen=pool[0];
  for(let i=0;i<pool.length;i++){roll-=weight[i];if(roll<=0){chosen=pool[i];break;}}
  showDataEvent(chosen,category);
}

function addEventChoice(root, label, description, enabled, callback, disabledText) {
  const button = el('button', 'choice-button');
  const title = el('span', '', label);
  const detail = el('small', '', enabled ? description : disabledText || description);
  button.append(title, detail);
  button.disabled = !enabled;
  button.addEventListener('click', () => {
    hideModal('eventModal');
    callback();
  });
  root.appendChild(button);
}

function finishNight(message) {
  hideModal('eventModal');
  state.pendingEvent = null;
  state.day += 1;
  state.energy = Math.min(state.maxEnergy, state.energy + 1);
  $('dayCaption').textContent = 'Una nueva vuelta alrededor de las estrellas.';
  syncHud();
  renderStorage();
  showSurvivalToast(message, 3600);
  playSound('success');
  saveGame();
}

function openPause() {
  if (state.phase !== 'rescue' && state.phase !== 'survival') return;
  state.paused = true;
  if (document.pointerLockElement) document.exitPointerLock();
  showModal('pauseModal');
}

function closePause() {
  state.paused = false;
  hideModal('pauseModal');
}

function animate(now) {
  requestAnimationFrame(animate);
  const delta = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  if (state.phase === 'title') {
    if (menuScene && menuScene.children[3]) menuScene.children[3].rotation.y += delta * 0.018;
    renderer.render(scene, camera);
  } else if (state.phase === 'rescue') {
    updateRescue(delta);
    const t = now * 0.001;
    for (const object of interactables) {
      if (!object.taken) {
        object.group.position.y = Math.sin(t * 1.4 + object.position.x) * 0.07;
        object.halo.rotation.z += delta * 0.5;
      }
    }
    if (currentPodLights.length) currentPodLights[0].material.opacity = 0.54 + Math.sin(t * 2.6) * 0.18;
    renderer.render(scene, camera);
  } else if (state.phase === 'cinematic') {
    updateCinematic(now);
    if (cine) renderer.render(cine.scene, cine.camera);
  } else if (state.phase === 'survival' || state.phase === 'gameover') {
    renderer.render(scene, camera);
  }
}

function bindEvents() {
  $('startButton').addEventListener('click', startNewGame);
  $('continueButton').addEventListener('click', continueGame);
  $('retryButton').addEventListener('click', () => { deleteSave(); $('gameOverScreen').classList.add('hidden'); $('titleScreen').classList.remove('hidden'); state.phase = 'title'; buildMenuScene(); });
  $('soundButton').addEventListener('click', () => {
    state.muted = !state.muted;
    $('soundButton').textContent = state.muted ? '×' : '♫';
    if (ambienceOsc) ambienceOsc.gain.gain.value = state.muted ? 0 : 0.018;
    if (!state.muted) playSound('click');
  });
  $('pauseButton').addEventListener('click', openPause);
  $('resumeButton').addEventListener('click', closePause);
  $('resetButton').addEventListener('click', () => {
    deleteSave(); hideModal('pauseModal'); state.paused = false; startNewGame();
  });
  $('netButton').addEventListener('click', openNetModal);
  $('castNetButton').addEventListener('click', castNet);
  $('repairButton').addEventListener('click', openRepair);
  $('repairStartButton').addEventListener('click', startRepairMinigame);
  $('talkButton').addEventListener('click', talkToSilver);
  $('sleepButton').addEventListener('click', sleep);
  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => hideModal(button.dataset.close));
  });
  document.addEventListener('keydown', (event) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (event.code === 'Escape') {
      if (!$('pauseModal').classList.contains('hidden')) closePause();
      else if (state.phase === 'rescue' || state.phase === 'survival') openPause();
      return;
    }
    if (state.phase === 'rescue' && !state.paused) {
      keys[event.code] = true;
      if (event.code === 'KeyE') interact();
    }
    if (state.phase === 'survival' && !state.paused) {
      if (event.code === 'Digit1') openNetModal();
      if (event.code === 'Digit2') openRepair();
      if (event.code === 'Digit3') talkToSilver();
      if (event.code === 'Digit4') sleep();
    }
  });
  document.addEventListener('keyup', (event) => { keys[event.code] = false; });
  window.addEventListener('blur', () => { keys = {}; });
}

function boot() {
  loadEventLibrary();
  initRenderer();
  bindEvents();
  const saved = loadSavedData();
  if (saved) $('continueButton').classList.remove('hidden');
  requestAnimationFrame(animate);
  const query = new URLSearchParams(window.location.search);
  if (query.get('debug') === '1') {
    $('startButton').textContent = 'INICIAR PRUEBA';
  }
}

boot();
