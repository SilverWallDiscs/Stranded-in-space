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
  // Nuevo formato por bloques: [EVENT], [MESSAGE] y [CHOICE].
  // Se conserva la lectura del formato anterior para no romper archivos antiguos.
  if (!/^\[(EVENT|MESSAGE|CHOICE)\]\s*$/im.test(source)) {
    return source.split(/^---\s*$/m).map((block) => {
      const event = {};
      for (const raw of block.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const separator = line.indexOf(':');
        if (separator < 0) continue;
        const key = line.slice(0, separator).trim().toLowerCase();
        let value = line.slice(separator + 1).trim();
        if (value.startsWith('[')) {
          try { value = JSON.parse(value); } catch (_) {}
        } else if (/^".*"$/.test(value)) {
          try { value = JSON.parse(value); } catch (_) { value = value.slice(1, -1); }
        }
        event[key] = value;
      }
      return event;
    }).filter((event) => event['event name']);
  }

  const events = [];
  let currentEvent = null;
  let section = null;
  let currentChoice = null;
  let messageLines = [];

  const unquote = (value) => {
    const text = String(value ?? '').trim();
    if (text.startsWith('"') && text.endsWith('"')) {
      try { return JSON.parse(text); } catch (_) { return text.slice(1, -1); }
    }
    if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1);
    return text;
  };

  const flushMessage = () => {
    if (!currentEvent || section !== 'MESSAGE') return;
    const message = messageLines.join('\n').trim();
    if (message) {
      currentEvent['event message chain'] ||= [];
      currentEvent['event message chain'].push(message);
    }
    messageLines = [];
  };

  const eventAliases = {
    name: 'event name',
    type: 'event type',
    weight: 'event weight',
    'requires companion': 'event requires companion',
    background: 'event space background',
    trigger: 'event trigger',
    'use item': 'event use item',
    'chance consuming item': 'event chance consuming item',
    rewards: 'event rewards'
  };

  const choiceAliases = {
    text: 'text',
    description: 'description',
    'requires item': 'item',
    item: 'item',
    'consume chance': 'chance',
    chance: 'chance',
    trigger: 'trigger',
    rewards: 'rewards',
    result: 'result'
  };

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    const header = line.match(/^\[(EVENT|MESSAGE|CHOICE)\]$/i);
    if (header) {
      flushMessage();
      section = header[1].toUpperCase();
      if (section === 'EVENT') {
        currentEvent = { 'event message chain': [], 'event choices': [] };
        events.push(currentEvent);
        currentChoice = null;
      } else if (!currentEvent) {
        section = null;
      } else if (section === 'MESSAGE') {
        messageLines = [];
        currentChoice = null;
      } else if (section === 'CHOICE') {
        currentChoice = {};
        currentEvent['event choices'].push(currentChoice);
      }
      continue;
    }

    if (!currentEvent || section === null || line.startsWith('#')) continue;

    if (section === 'MESSAGE') {
      // El texto del mensaje es libre: no necesita comillas ni prefijos.
      messageLines.push(raw.trimEnd());
      continue;
    }

    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const rawKey = line.slice(0, separator).trim().toLowerCase();
    const value = unquote(line.slice(separator + 1));
    if (section === 'EVENT') {
      const key = eventAliases[rawKey] || rawKey;
      currentEvent[key] = value;
    } else if (section === 'CHOICE' && currentChoice) {
      const key = choiceAliases[rawKey] || rawKey;
      currentChoice[key] = value;
    }
  }
  flushMessage();

  return events.filter((event) => {
    if (!event['event message chain'].length) delete event['event message chain'];
    if (!event['event choices'].length) delete event['event choices'];
    return event['event name'];
  });
}

function eventChance(value, fallback = 100) {
  const parsed = Number(String(value ?? fallback).replace('%', '').trim());
  return clamp(Number.isFinite(parsed) ? parsed : fallback, 0, 100);
}

async function loadEventLibrary(){
  const files=await Promise.all(EVENT_FILES.map(async path=>{try{const r=await fetch(path);if(!r.ok)throw Error(r.status);return {path,text:await r.text()};}catch(e){console.warn('Event file unavailable:',path,e);return {path,text:''};}}));
  for(const file of files) eventLibrary[file.path.includes('silver')?'silver':'rest']=parseEventFile(file.text);
}
function eventList(value){if(Array.isArray(value))return value;if(!value||value==='none')return [];return String(value).split(';').map(x=>x.trim()).filter(Boolean);}
function eventItem(id){return state.inventory.find(x=>x.id===String(id).trim().toLowerCase().replace(/ /g,'_'));}
function applyEventRewards(value){
  for(const reward of eventList(value)){const m=String(reward).match(/^([+-])\s*(\d+)\s+([a-z0-9_ -]+)$/i);if(!m)continue;const count=Number(m[2])*(m[1]==='-'?-1:1);const id=m[3].trim().toLowerCase().replace(/ /g,'_');if(!ITEM_DATA[id])continue;
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
function showDataEvent(event, category) {
  state.pendingEvent = { event, category };

  const messages = eventList(event['event message chain']);
  $('eventSymbol').textContent = category === 'silver' ? 'S' : '✦';
  $('eventKicker').textContent = category === 'silver' ? 'CANAL PRIVADO · SILVER' : 'EVENTO NOCTURNO';
  $('eventTitle').textContent = event['event name'];
  $('eventDescription').textContent = messages.length
    ? messages.join('\\n\\n')
    : (event['event message'] || 'Algo sucede en la oscuridad.');

  const panel = $('eventModal').querySelector('.event-panel');
  const background = event['event space background'];
  panel.style.backgroundImage = background && background !== 'none'
    ? 'linear-gradient(rgba(7,12,22,.82),rgba(7,12,22,.96)),url("' + background + '")'
    : '';
  panel.style.backgroundSize = 'cover';
  panel.style.backgroundPosition = 'center';

  const root = $('eventChoices');
  root.innerHTML = '';
  const rawChoices = eventList(event['event choices']);

  if (!rawChoices.length) {
    addEventChoice(root, 'Continuar', '', true, () => {
      const itemId = String(event['event use item'] || 'none').toLowerCase().replace(/ /g, '_');
      if (itemId !== 'none') {
        const required = eventItem(itemId);
        if (!required) {
          showSurvivalToast('Necesitas ' + (ITEM_DATA[itemId]?.name || itemId));
          return;
        }
        if (Math.random() * 100 < eventChance(event['event chance consuming item'], 100)) {
          removeInventoryEntry(required.uid);
          if (itemId === 'computer') state.computerBroken = true;
        }
      }
      applyEventTrigger(event['event trigger']);
      applyEventRewards(event['recompensas'] || event['event rewards']);
      finishNight('La noche continúa.');
    });
  } else {
    rawChoices.forEach((rawChoice, index) => {
      // También acepta la sintaxis antigua con campos separados por |.
      const choice = typeof rawChoice === 'string'
        ? (() => {
            const p = rawChoice.split('|').map((value) => value.trim());
            return {
              text: p[0] || 'Opción ' + (index + 1),
              trigger: p[1] || 'none',
              item: p[2] || 'none',
              chance: p[3] ?? 100,
              rewards: p[4] || 'none',
              description: p[5] || '',
              result: p[6] || 'La noche continúa.'
            };
          })()
        : rawChoice;

      const label = choice.text || 'Opción ' + (index + 1);
      const itemId = String(choice.item || 'none').toLowerCase().replace(/ /g, '_');
      const chance = eventChance(choice.chance, 100);
      const required = itemId === 'none' ? null : eventItem(itemId);
      const available = itemId === 'none' || !!required;

      addEventChoice(root, label, choice.description || '', available, () => {
        if (itemId !== 'none' && Math.random() * 100 < chance) {
          const itemToConsume = eventItem(itemId);
          if (itemToConsume) {
            removeInventoryEntry(itemToConsume.uid);
            if (itemId === 'computer') state.computerBroken = true;
          }
        }
        applyEventTrigger(choice.trigger);
        applyEventRewards(choice.rewards);
        finishNight(choice.result || 'La noche continúa.');
      }, 'Necesitas ' + (ITEM_DATA[itemId]?.name || itemId));
    });
  }

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
let rescueColliders = [];
let podStations = [];
let podInventoryObjects = [];
let podNearby = null;
let podNetRunning = false;
let podNetLight = null;

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
  renderer.toneMappingExposure = 1.28;
  buildMenuScene();
  window.addEventListener('resize', onResize);
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === $('world');
  });
  $('world').addEventListener('click', () => {
    if ((state.phase === 'rescue' || state.phase === 'survival') && !state.paused && !pointerLocked && $('titleScreen').classList.contains('hidden')) {
      $('world').requestPointerLock?.();
    }
  });
  document.addEventListener('mousemove', (event) => {
    if (pointerLocked && (state.phase === 'rescue' || state.phase === 'survival') && !state.paused) {
      playerYaw -= event.movementX * 0.0021;
      playerPitch = clamp(playerPitch - event.movementY * 0.0017, -0.92, 0.92);
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
  target.add(new THREE.HemisphereLight(0xc8e8f4, 0x263746, 1.85));
  target.add(new THREE.AmbientLight(0x9bb7c9, 0.5));
  const ceiling = new THREE.PointLight(0xe4f7ff, 2.8, 24);
  ceiling.position.set(0, 4.7, -1);
  target.add(ceiling);
  const warm = new THREE.PointLight(0xffc18d, 1.25, 17);
  warm.position.set(-4.8, 2.9, 3.5);
  target.add(warm);
  const podLight = new THREE.PointLight(0x9feeff, 2.6, 14);
  podLight.position.set(0, 2.8, -6.3);
  target.add(podLight);
}

function addCeilingLight(target, x, z, color = 0xd9f4ff, intensity = 2.4, distance = 10, ceilingY = 5.02) {
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 0.055, 0.42),
    new THREE.MeshBasicMaterial({ color })
  );
  panel.position.set(x, ceilingY - 0.03, z);
  target.add(panel);
  const light = new THREE.PointLight(color, intensity, distance, 1.65);
  light.position.set(x, ceilingY - 0.48, z);
  target.add(light);
  return light;
}

function addRoomWall(target, x, z, width, depth, material, height = 4.9) {
  addBox(target, [x, height / 2, z], [width, height, depth], material);
  rescueColliders.push({
    minX: x - width / 2, maxX: x + width / 2,
    minZ: z - depth / 2, maxZ: z + depth / 2
  });
}

function rescuePositionBlocked(x, z) {
  const radius = 0.34;
  return rescueColliders.some((wall) =>
    x + radius > wall.minX && x - radius < wall.maxX &&
    z + radius > wall.minZ && z - radius < wall.maxZ
  );
}

function addRoomSign(label, x, z, side) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#172c3b'; ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#7795a5'; ctx.lineWidth = 7; ctx.strokeRect(5, 5, 502, 118);
  ctx.fillStyle = '#e2f5f6'; ctx.font = 'bold 34px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label.toUpperCase(), 256, 65);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 0.36),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  sign.position.set(x, 2.3, z);
  sign.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  scene.add(sign);
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

function itemMaterial(color, metalness = 0.28, roughness = 0.58) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function addItemPart(group, geometry, material, position, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  group.add(mesh);
  return mesh;
}

function createPhysicalItemModel(itemId) {
  const group = new THREE.Group();
  const metal = itemMaterial(0x9aabb6, 0.78, 0.3);
  const darkMetal = itemMaterial(0x283b4a, 0.72, 0.38);
  const white = itemMaterial(0xd9e3e7, 0.12, 0.72);
  const accent = itemMaterial(0x3b9ca0, 0.38, 0.45);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(itemId === 'computer' || itemId === 'medkit' ? 0.43 : 0.29, 24),
    new THREE.MeshBasicMaterial({ color: 0x02070c, transparent: true, opacity: 0.28, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.018;
  group.add(shadow);

  if (itemId === 'canned_food' || itemId === 'energy_drink') {
    const can = itemMaterial(itemId === 'canned_food' ? 0xb66e47 : 0x2b9fa5, 0.42, 0.34);
    const body = addItemPart(group, new THREE.CylinderGeometry(0.19, 0.19, 0.44, 20), can, [0, 0.24, 0]);
    body.rotation.z = 0.05;
    addItemPart(group, new THREE.CylinderGeometry(0.193, 0.193, 0.025, 20), metal, [0, 0.47, 0]);
    addItemPart(group, new THREE.CylinderGeometry(0.194, 0.194, 0.11, 20), white, [0, 0.24, 0]);
    addItemPart(group, new THREE.TorusGeometry(0.16, 0.012, 6, 20), darkMetal, [0, 0.46, 0]);
  } else if (itemId === 'pill') {
    addItemPart(group, new THREE.CapsuleGeometry(0.12, 0.19, 4, 10), white, [0, 0.13, 0], [0, 0, Math.PI / 2]);
    addItemPart(group, new THREE.CylinderGeometry(0.121, 0.121, 0.095, 16), accent, [0, 0.13, 0], [0, 0, Math.PI / 2]);
  } else if (itemId === 'flashlight') {
    addItemPart(group, new THREE.CylinderGeometry(0.12, 0.12, 0.72, 16), darkMetal, [0, 0.15, 0], [0, 0, Math.PI / 2]);
    addItemPart(group, new THREE.CylinderGeometry(0.17, 0.15, 0.15, 16), metal, [0.34, 0.15, 0], [0, 0, Math.PI / 2]);
    addItemPart(group, new THREE.CircleGeometry(0.12, 16), itemMaterial(0xc6eff0, 0.1, 0.2), [0.425, 0.15, 0], [0, Math.PI / 2, 0]);
    addItemPart(group, new THREE.TorusGeometry(0.125, 0.025, 6, 16), accent, [-0.27, 0.15, 0], [0, Math.PI / 2, 0]);
  } else if (itemId === 'computer') {
    addItemPart(group, new THREE.BoxGeometry(0.74, 0.055, 0.5), darkMetal, [0, 0.13, 0]);
    addItemPart(group, new THREE.BoxGeometry(0.72, 0.45, 0.055), metal, [0, 0.38, -0.22], [-0.12, 0, 0]);
    addItemPart(group, new THREE.BoxGeometry(0.64, 0.36, 0.018), new THREE.MeshStandardMaterial({ color: 0x173b4a, emissive: 0x1e7b86, emissiveIntensity: 0.42, roughness: 0.3 }), [0, 0.39, -0.185], [-0.12, 0, 0]);
    addItemPart(group, new THREE.BoxGeometry(0.38, 0.018, 0.2), itemMaterial(0x546b78, 0.5, 0.42), [0, 0.165, 0.07]);
  } else if (itemId === 'battery') {
    addItemPart(group, new THREE.CylinderGeometry(0.19, 0.19, 0.48, 18), itemMaterial(0x456a84, 0.56, 0.34), [0, 0.25, 0]);
    addItemPart(group, new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12), metal, [0, 0.52, 0]);
    addItemPart(group, new THREE.BoxGeometry(0.26, 0.035, 0.035), accent, [0, 0.3, 0.195]);
  } else if (itemId === 'duct_tape') {
    addItemPart(group, new THREE.TorusGeometry(0.23, 0.085, 10, 24), itemMaterial(0x7b9e91, 0.08, 0.82), [0, 0.12, 0], [Math.PI / 2, 0, 0]);
    addItemPart(group, new THREE.CylinderGeometry(0.145, 0.145, 0.035, 18), itemMaterial(0xb8a88b, 0.08, 0.9), [0, 0.12, 0]);
  } else if (itemId === 'data_core') {
    addItemPart(group, new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshStandardMaterial({ color: 0x68b9cf, emissive: 0x1b607f, emissiveIntensity: 0.48, metalness: 0.36, roughness: 0.22 }), [0, 0.31, 0], [0.18, 0.3, 0.2]);
    addItemPart(group, new THREE.TorusGeometry(0.25, 0.018, 6, 24), metal, [0, 0.31, 0], [Math.PI / 2, 0, 0]);
  } else if (itemId === 'star_fragment') {
    const crystal = new THREE.MeshStandardMaterial({ color: 0xd4b4a1, emissive: 0x774d39, emissiveIntensity: 0.24, metalness: 0.22, roughness: 0.3 });
    addItemPart(group, new THREE.ConeGeometry(0.12, 0.56, 5), crystal, [-0.1, 0.28, 0], [0.2, 0, -0.22]);
    addItemPart(group, new THREE.ConeGeometry(0.09, 0.42, 5), crystal, [0.13, 0.22, 0.07], [-0.2, 0.1, 0.32]);
    addItemPart(group, new THREE.OctahedronGeometry(0.13, 0), white, [0.04, 0.15, -0.12]);
  } else if (itemId === 'medkit') {
    addItemPart(group, new THREE.BoxGeometry(0.68, 0.34, 0.48), white, [0, 0.2, 0]);
    addItemPart(group, new THREE.BoxGeometry(0.7, 0.06, 0.5), metal, [0, 0.39, 0]);
    addItemPart(group, new THREE.BoxGeometry(0.16, 0.045, 0.035), itemMaterial(0x328c73, 0.1, 0.6), [0, 0.22, 0.25]);
    addItemPart(group, new THREE.BoxGeometry(0.045, 0.16, 0.035), itemMaterial(0x328c73, 0.1, 0.6), [0, 0.22, 0.25]);
    addItemPart(group, new THREE.TorusGeometry(0.13, 0.025, 6, 18), darkMetal, [0, 0.47, -0.08], [Math.PI / 2, 0, 0]);
  }
  group.userData.itemId = itemId;
  return group;
}

function createWorldItem(itemId, position) {
  const group = createPhysicalItemModel(itemId);
  group.position.set(position[0], 0, position[1]);
  scene.add(group);
  const obj = { id: itemId, group, position: new THREE.Vector3(position[0], 0, position[1]), taken: false };
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
  scene.background = new THREE.Color(0x122335);
  scene.fog = new THREE.Fog(0x172a3b, 25, 54);
  addStarfield(scene, 340, 72);
  makeRoomLights(scene);
  rescueColliders = [];

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x334b5b, metalness: 0.42, roughness: 0.66 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x304858, metalness: 0.55, roughness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c2d3c, metalness: 0.58, roughness: 0.57 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x6a8794, metalness: 0.72, roughness: 0.34 });
  const floorLineMat = new THREE.MeshBasicMaterial({ color: 0x6fa2ad, transparent: true, opacity: 0.22 });

  addBox(scene, [0, -0.18, 0], [14, 0.35, 20], floorMat);
  addRoomWall(scene, 0, -9.82, 14, 0.36, wallMat);
  addRoomWall(scene, -6.82, 0, 0.36, 20, wallMat);
  addRoomWall(scene, 6.82, 0, 0.36, 20, wallMat);
  addRoomWall(scene, 0, 9.82, 14, 0.36, wallMat);
  addBox(scene, [0, 5.22, 0], [14, 0.25, 20], darkMat);

  for (const side of [-1, 1]) {
    const x = side * 1.9;
    for (const [z, length] of [[-8.32, 3.36], [-3.0, 4.5], [3.0, 4.5], [8.32, 3.36]]) {
      addRoomWall(scene, x, z, 0.2, length, wallMat);
    }
    for (const doorZ of [-6, 0, 6]) {
      addBox(scene, [x, 4.65, doorZ], [0.22, 0.18, 1.5], trimMat);
      for (const offset of [-0.68, 0.68]) addBox(scene, [x, 2.2, doorZ + offset], [0.11, 4.4, 0.12], trimMat);
    }
  }

  for (const z of [-3, 3]) {
    addRoomWall(scene, -6.38, z, 1.24, 0.2, wallMat);
    addRoomWall(scene, -3.1, z, 2.2, 0.2, wallMat);
    addRoomWall(scene, 3.1, z, 2.2, 0.2, wallMat);
    addRoomWall(scene, 6.38, z, 1.24, 0.2, wallMat);
    for (const x of [-5, 5]) {
      addBox(scene, [x, 4.65, z], [1.65, 0.18, 0.2], trimMat);
      addBox(scene, [x - 0.78, 2.1, z], [0.1, 4.2, 0.12], trimMat);
      addBox(scene, [x + 0.78, 2.1, z], [0.1, 4.2, 0.12], trimMat);
    }
  }

  for (let z = -8.5; z <= 8.5; z += 1.5) addBox(scene, [0, 0.012, z], [0.055, 0.02, 0.55], floorLineMat);
  for (const side of [-1, 1]) {
    addBox(scene, [side * 1.65, 0.015, 0], [0.035, 0.025, 18.8], floorLineMat);
    for (const z of [-6, 0, 6]) {
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 3), new THREE.MeshBasicMaterial({ color: 0x8de7e7 }));
      arrow.rotation.x = Math.PI / 2;
      arrow.position.set(side * 1.25, 0.04, z);
      scene.add(arrow);
    }
  }

  addRoomSign('GALLEY / FOOD', -2.05, 6, -1);
  addRoomSign('CARGO BAY', 2.05, 6, 1);
  addRoomSign('MEDICAL BAY', -2.05, 0, -1);
  addRoomSign('ENGINEERING', 2.05, 0, 1);
  addRoomSign('CREW QUARTERS', -2.05, -6, -1);
  addRoomSign('AUXILIARY STORAGE', 2.05, -6, 1);

  for (const z of [-6.2, 0, 6.2]) {
    addCeilingLight(scene, -4.6, z, 0xd7efff, 2.45, 10);
    addCeilingLight(scene, 4.6, z, 0xffd4ae, 2.15, 10);
  }
  addCeilingLight(scene, 0, -6.5, 0xb7f8f2, 2.1, 10);
  addCeilingLight(scene, 0, 0, 0xc9e8ff, 2.0, 10);
  addCeilingLight(scene, 0, 6.5, 0xffd7b8, 2.0, 10);

  addShipProp(scene, -5.55, 8.0, 1.55, 0.92);
  addShipProp(scene, 5.5, 8.0, 1.55, 1.1);
  addShipProp(scene, -5.55, 1.1, 1.4, 1.45);
  addShipProp(scene, 5.45, 1.05, 1.55, 1.25);
  addShipProp(scene, -5.5, -7.0, 1.5, 1.05);
  addShipProp(scene, 5.5, -7.0, 1.55, 1.3);

  createPodModel(scene, 0, -8.0, 1.12);
  createPodZone(scene, 0, -6.35);

  interactables = [];
  const spawns = [
    ['canned_food', [-4.45, 7.0]], ['energy_drink', [-5.0, 5.15]],
    ['battery', [4.45, 7.0]], ['duct_tape', [5.0, 5.1]],
    ['pill', [-4.35, 0.0]], ['medkit', [-5.1, -1.35]],
    ['computer', [4.4, 0.0]], ['data_core', [5.0, -1.35]],
    ['flashlight', [-4.35, -6.2]], ['star_fragment', [4.45, -6.25]],
    ['silver', [5.05, -4.65]]
  ];
  for (const [id, pos] of spawns) {
    if (id === 'silver') createCharacterSprite('silver', pos);
    else createWorldItem(id, pos);
  }

  scene.userData.podPosition = new THREE.Vector3(0, 0, -6.35);
  camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.1, 90);
  camera.position.set(0, 1.65, 8.55);
  playerYaw = 0;
  playerPitch = 0;
  camera.rotation.set(0, playerYaw, 0, 'YXZ');
}

function createCharacterSprite(characterId, position) {
  const group = new THREE.Group();
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.36, 20),
    new THREE.MeshBasicMaterial({ color: 0x02070c, transparent: true, opacity: 0.32, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.018;
  group.add(shadow);

  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#253b4b';
  ctx.beginPath(); ctx.roundRect(34, 8, 188, 238, 58); ctx.fill();
  ctx.fillStyle = '#d9e6e8'; ctx.beginPath(); ctx.arc(128, 83, 47, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#304b5a'; ctx.beginPath(); ctx.ellipse(128, 185, 74, 72, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8de7e7'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center'; ctx.fillText('SILVER', 128, 230);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(spriteMat);
  new THREE.TextureLoader().load('./assets/characters/silver.png', (loaded) => {
    loaded.colorSpace = THREE.SRGBColorSpace;
    spriteMat.map = loaded;
    spriteMat.needsUpdate = true;
  }, undefined, () => {});
  sprite.scale.set(0.95, 1.25, 1);
  sprite.position.y = 0.92;
  group.add(sprite);
  group.position.set(position[0], 0, position[1]);
  scene.add(group);
  interactables.push({ id: characterId, group, sprite, position: new THREE.Vector3(position[0], 0, position[1]), taken: false });
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

function createPodStation(type, position) {
  const group = new THREE.Group();
  const shell = itemMaterial(0x40596a, 0.62, 0.38);
  const dark = itemMaterial(0x1b2e3d, 0.7, 0.48);
  const trim = itemMaterial(0x9aabb4, 0.76, 0.3);
  const screen = new THREE.MeshStandardMaterial({ color: 0x276c76, emissive: 0x2a9ba0, emissiveIntensity: 0.65, metalness: 0.45, roughness: 0.3 });

  if (type === 'net') {
    addBox(group, [0, 0.72, 0], [1.65, 1.3, 0.86], shell);
    addBox(group, [0, 1.39, 0.16], [1.3, 0.12, 0.48], dark);
    addCylinder(group, [0, 1.52, -0.23], 0.42, 0.42, 0.18, trim, [Math.PI / 2, 0, 0]);
    addCylinder(group, [0, 1.52, -0.23], 0.12, 0.12, 0.2, dark, [Math.PI / 2, 0, 0]);
    addBox(group, [0, 1.02, -0.45], [0.62, 0.28, 0.035], screen);
    addBox(group, [-0.48, 0.11, 0.19], [0.12, 0.22, 0.12], trim);
    addBox(group, [0.48, 0.11, 0.19], [0.12, 0.22, 0.12], trim);
  } else if (type === 'repair') {
    addBox(group, [0, 1.22, 0], [0.22, 2.05, 1.15], dark);
    addBox(group, [-0.13, 1.45, 0], [0.08, 0.82, 0.76], screen);
    addBox(group, [-0.2, 0.73, 0], [0.09, 0.12, 0.56], trim);
    for (const z of [-0.44, 0.44]) addCylinder(group, [-0.08, 1.92, z], 0.07, 0.07, 0.07, trim, [0, 0, Math.PI / 2]);
  } else if (type === 'sleep') {
    addBox(group, [0, 0.58, 0], [1.65, 0.38, 3.15], dark);
    addBox(group, [0, 0.82, -0.12], [1.48, 0.18, 2.88], itemMaterial(0x536f83, 0.08, 0.92));
    addBox(group, [0, 0.98, -1.04], [1.05, 0.15, 0.5], itemMaterial(0xd5dfe2, 0.02, 0.95));
    addBox(group, [0, 1.0, 0.34], [1.45, 0.08, 0.74], itemMaterial(0x2d6972, 0.04, 0.88));
    addBox(group, [-0.84, 0.76, 0], [0.08, 0.55, 3.18], trim);
  } else if (type === 'counter') {
    addBox(group, [0, 0.62, 0], [2.25, 1.1, 0.75], shell);
    addBox(group, [0, 1.2, -0.02], [2.28, 0.09, 0.8], trim);
  }
  group.position.set(position[0], 0, position[1]);
  scene.add(group);
  podStations.push({ type, group, position: new THREE.Vector3(position[0], 0, position[1]) });
  return group;
}

function getPodItemPosition(index) {
  const columns = [-2.35, -1.05, 1.05, 2.35];
  const rows = [0.65, 1.75, 2.85, 3.95];
  return [columns[index % columns.length], rows[Math.floor(index / columns.length) % rows.length]];
}

function renderPodInventory() {
  for (const object of podInventoryObjects) scene.remove(object.group);
  podInventoryObjects = [];
  if (!scene?.userData?.isPod) return;
  state.inventory.forEach((entry, index) => {
    if (!ITEM_DATA[entry.id]) return;
    const group = createPhysicalItemModel(entry.id);
    const [x, z] = getPodItemPosition(index);
    group.position.set(x, 0, z);
    scene.add(group);
    podInventoryObjects.push({ uid: entry.uid, id: entry.id, group, position: new THREE.Vector3(x, 0, z) });
  });
}

function buildPodInteriorScene() {
  scene = new THREE.Scene();
  scene.userData.isPod = true;
  scene.background = new THREE.Color(0x172b3d);
  scene.fog = new THREE.Fog(0x172b3d, 30, 64);
  addStarfield(scene, 320, 70);
  currentPodLights = [];
  podStations = [];
  podInventoryObjects = [];
  podNearby = null;
  podNetRunning = false;
  interactables = [];

  scene.add(new THREE.HemisphereLight(0xd9f1fb, 0x526a78, 2.0));
  scene.add(new THREE.AmbientLight(0xb8d1df, 0.58));
  const ceiling = new THREE.PointLight(0xf0fbff, 3.2, 22);
  ceiling.position.set(0, 3.55, 0.8); scene.add(ceiling);
  const warm = new THREE.PointLight(0xffc58e, 1.25, 13);
  warm.position.set(-2.7, 2.1, 1.0); scene.add(warm);
  const workLight = new THREE.PointLight(0x9beaf0, 1.8, 9);
  workLight.position.set(2.8, 2.15, -0.2); scene.add(workLight);

  const wallMat = itemMaterial(0x465f70, 0.66, 0.38);
  const darkMat = itemMaterial(0x263c4d, 0.56, 0.55);
  const floorMat = itemMaterial(0x526a78, 0.42, 0.68);
  const trimMat = itemMaterial(0x8da3ad, 0.74, 0.32);
  addBox(scene, [0, -0.2, 0], [8, 0.4, 13], floorMat);
  addBox(scene, [0, 4, 0], [8, 0.25, 13], darkMat);
  addBox(scene, [-4, 1.9, 0], [0.25, 4, 13], wallMat);
  addBox(scene, [4, 1.9, 0], [0.25, 4, 13], wallMat);
  addBox(scene, [0, 1.9, 6.4], [8, 4, 0.25], wallMat);
  addBox(scene, [0, 1.9, -6.4], [8, 4, 0.25], wallMat);
  addBox(scene, [0, 3.84, 0.75], [2.7, 0.055, 0.55], new THREE.MeshBasicMaterial({ color: 0xd8f3fb }));

  const windowRim = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.18, 16, 64), trimMat);
  windowRim.position.set(0, 2.1, -6.12); scene.add(windowRim);
  const windowGlass = new THREE.Mesh(new THREE.CircleGeometry(1.52, 64), new THREE.MeshBasicMaterial({ color: 0x315c7a, transparent: true, opacity: 0.5, depthWrite: false }));
  windowGlass.position.set(0, 2.1, -6.16); scene.add(windowGlass);
  const planet = new THREE.Mesh(new THREE.SphereGeometry(1.03, 32, 32), new THREE.MeshStandardMaterial({ color: 0x7da9bf, emissive: 0x294a67, emissiveIntensity: 0.55, roughness: 0.92 }));
  planet.position.set(-0.55, 2.4, -7.05); scene.add(planet);
  const planetLight = new THREE.PointLight(0x8fc5ec, 0.95, 5);
  planetLight.position.set(-0.3, 2.3, -6.55); scene.add(planetLight);
  for (let i = 0; i < 5; i++) {
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), new THREE.MeshBasicMaterial({ color: 0xf0ffff }));
    star.position.set(random(-1.3, 1.3), random(1.1, 3.1), -7); scene.add(star);
  }

  createPodStation('net', [0, 0, -4.35]);
  podNetLight = new THREE.PointLight(0x8de7e7, 1.8, 5);
  podNetLight.position.set(0, 1.8, -4.3); scene.add(podNetLight);
  createPodStation('repair', [3.15, 0, -0.4]);
  createPodStation('sleep', [-2.9, 0, -0.95]);
  createPodStation('counter', [2.6, 0, 4.15]);
  addBox(scene, [-3.68, 2.1, -1.2], [0.08, 2.8, 0.08], new THREE.MeshBasicMaterial({ color: 0xffd2a5 }));
  addBox(scene, [3.68, 2.1, 2.9], [0.08, 2.8, 0.08], new THREE.MeshBasicMaterial({ color: 0x8de7e7 }));

  if (state.companion) {
    createCharacterSprite('silver', [-2.15, 1.55]);
    podStations.push({ type: 'silver', position: new THREE.Vector3(-2.15, 0, 1.55) });
  }

  addCeilingLight(scene, 0, -3.0, 0xc9f3ff, 2.1, 11, 3.86);
  addCeilingLight(scene, -2.4, 0.8, 0xffd4b5, 1.7, 8, 3.86);
  addCeilingLight(scene, 2.45, 2.8, 0xd2f4ff, 1.8, 8, 3.86);
  addCeilingLight(scene, 0, 4.8, 0xffdfc5, 1.7, 8, 3.86);

  camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 80);
  camera.position.set(0, 1.65, 5.55);
  playerYaw = 0;
  playerPitch = -0.08;
  camera.rotation.set(playerPitch, playerYaw, 0, 'YXZ');
  renderPodInventory();
}

function updateSurvival(delta) {
  if (state.phase !== 'survival' || state.paused) return;
  if (document.querySelector('.modal-screen:not(.hidden)')) return;

  const direction = new THREE.Vector3();
  const forward = new THREE.Vector3(-Math.sin(playerYaw), 0, -Math.cos(playerYaw));
  const right = new THREE.Vector3(Math.cos(playerYaw), 0, -Math.sin(playerYaw));
  if (keys.KeyW || keys.ArrowUp) direction.add(forward);
  if (keys.KeyS || keys.ArrowDown) direction.sub(forward);
  if (keys.KeyD || keys.ArrowRight) direction.add(right);
  if (keys.KeyA || keys.ArrowLeft) direction.sub(right);
  if (direction.lengthSq() > 0) {
    direction.normalize().multiplyScalar(3.15 * delta);
    camera.position.x = clamp(camera.position.x + direction.x, -3.25, 3.25);
    camera.position.z = clamp(camera.position.z + direction.z, -5.55, 5.55);
  }

  let nearest = null;
  let nearestDistance = 1.9;
  for (const station of podStations) {
    const distance = Math.hypot(camera.position.x - station.position.x, camera.position.z - station.position.z);
    if (distance < nearestDistance) {
      nearest = { kind: 'station', data: station };
      nearestDistance = distance;
    }
  }
  for (const object of podInventoryObjects) {
    const distance = Math.hypot(camera.position.x - object.position.x, camera.position.z - object.position.z);
    if (distance < nearestDistance) {
      nearest = { kind: 'item', data: object };
      nearestDistance = distance;
    }
  }
  podNearby = nearest;
  const hint = $('podInteractionHint');
  if (!hint) return;
  if (!nearest) { hint.classList.add('hidden'); return; }

  let label = '';
  if (nearest.kind === 'item') label = 'USAR · ' + ITEM_DATA[nearest.data.id].name.toUpperCase();
  else {
    const labels = {
      net: 'USAR LA RED  ·  SHIFT + E: BATERÍA',
      repair: 'REPARAR EL CASCO',
      sleep: 'DESCANSAR',
      silver: 'HABLAR CON SILVER',
      counter: 'ALMACENAMIENTO'
    };
    label = labels[nearest.data.type] || 'INTERACTUAR';
  }
  hint.querySelector('span').textContent = label;
  hint.classList.remove('hidden');
}

function interactPod() {
  if (state.phase !== 'survival' || state.paused || !podNearby) return;
  const target = podNearby;
  if (target.kind === 'item') { useItem(target.data.uid); return; }
  switch (target.data.type) {
    case 'net': usePodNet(Boolean(keys.ShiftLeft || keys.ShiftRight)); break;
    case 'repair': repairPodAtStation(); break;
    case 'sleep': sleep(); break;
    case 'silver': talkToSilver(); break;
    case 'counter': showSurvivalToast('Tus objetos están aquí, a la vista y al alcance.'); break;
  }
}

function usePodNet(useBattery = false) {
  if (podNetRunning) return;
  if (state.energy < 1) { showSurvivalToast('Necesitas 1 de energía para lanzar la red.'); return; }
  const batteryEntry = state.inventory.find((entry) => entry.id === 'battery');
  if (useBattery && !batteryEntry) {
    showSurvivalToast('No tienes una batería. Pulsa E para lanzar la red sin refuerzo.');
    return;
  }
  if (!consumeEnergy(1)) return;
  if (useBattery && batteryEntry) removeInventoryEntry(batteryEntry.uid);
  podNetRunning = true;
  if (podNetLight) podNetLight.intensity = 4.2;
  showSurvivalToast(useBattery ? 'La red sale con energía auxiliar…' : 'La red se despliega fuera de la cápsula…', 1800);
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
        for (let count = 0; count < Math.round(weight); count++) table.push(id);
      }
      resultId = pick(table);
    }
    addStorageItem(resultId, amount);
    podNetRunning = false;
    if (podNetLight) podNetLight.intensity = 1.8;
    showSurvivalToast(note + ' Encontraste: ' + ITEM_DATA[resultId].name + (amount > 1 ? ' × ' + amount : '') + '.');
    playSound('reward');
    saveGame();
  }, 1700);
}

function repairPodAtStation() {
  if (state.hull >= 100) { showSurvivalToast('El casco no necesita reparaciones.'); return; }
  if (!consumeEnergy(1)) return;
  changeHull(100 - state.hull);
  playSound('repair');
  showSurvivalToast('Aseguraste el panel y sellaste la cápsula por completo.');
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
  for (const modal of ['eventModal', 'dialogModal', 'pauseModal']) hideModal(modal);
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
    const nextX = clamp(camera.position.x + direction.x, -6.35, 6.35);
    const nextZ = clamp(camera.position.z + direction.z, -9.25, 9.25);
    if (!rescuePositionBlocked(nextX, camera.position.z)) camera.position.x = nextX;
    if (!rescuePositionBlocked(camera.position.x, nextZ)) camera.position.z = nextZ;
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
  renderHand();
}

function renderStorage() {
  const count = $('storageCount');
  if (count) count.textContent = state.inventory.length + ' OBJETOS';
  renderPodInventory();
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
  if (entry) useItem(uid);
}

function itemActionLabel(id) {
  return ITEM_DATA[id]?.name || 'Objeto';
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
    removeInventoryEntry(uid);
    state.energy = Math.min(state.maxEnergy, state.energy + 1);
    showSurvivalToast('Comiste algo. +1 energía.');
    playSound('success');
  } else if (id === 'pill') {
    if (state.hull >= 100) { showSurvivalToast('No necesitas usarla ahora.'); return; }
    removeInventoryEntry(uid); changeHull(20);
    showSurvivalToast('El estabilizador hizo efecto. +20% integridad.');
    playSound('success');
  } else if (id === 'flashlight') {
    state.flashlightOn = true;
    removeInventoryEntry(uid);
    showSurvivalToast('Linterna encendida. Puede servir durante un evento nocturno.');
    playSound('click');
  } else if (id === 'computer') {
    if (state.computerBroken) { showSurvivalToast('La computadora está averiada.'); return; }
    showSurvivalToast('La computadora está lista. Silver puede usarla para mejorar la red.');
  } else if (id === 'battery') {
    showSurvivalToast('Acércate al mecanismo de la red y pulsa SHIFT + E para conectarla.');
  } else if (id === 'duct_tape') {
    if (state.hull >= 100) { showSurvivalToast('El casco no tiene fisuras que sellar.'); return; }
    removeInventoryEntry(uid); changeHull(12);
    showSurvivalToast('La cinta contuvo una pequeña fisura. +12% integridad.');
    playSound('repair');
  } else if (id === 'energy_drink') {
    removeInventoryEntry(uid);
    state.energy = state.maxEnergy;
    showSurvivalToast('¡Energía restaurada al máximo!');
    playSound('success');
  } else if (id === 'data_core' || id === 'star_fragment') {
    if (state.energy >= state.maxEnergy) { showSurvivalToast('Tu energía ya está completa.'); return; }
    removeInventoryEntry(uid);
    state.energy = Math.min(state.maxEnergy, state.energy + 1);
    showSurvivalToast('Carga recuperada. +1 energía.');
    playSound('success');
  } else if (id === 'medkit') {
    if (state.hull >= 100) { showSurvivalToast('No necesitas el kit médico ahora.'); return; }
    removeInventoryEntry(uid); changeHull(35);
    showSurvivalToast('El kit estabilizó el casco. +35% integridad.');
    playSound('success');
  }
  syncHud();
  saveGame();
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
  const canUseSilverEvents = state.companion && eventLibrary.silver.length > 0;
  const category = canUseSilverEvents && Math.random() < 0.45 ? 'silver' : 'rest';
  const pool = eventLibrary[category].filter((event) => {
    const needsCompanion = String(event['event requires companion'] || 'no').toLowerCase() === 'yes';
    return !needsCompanion || state.companion;
  });
  if (!pool.length) {
    finishNight('Descansaste sin problema.');
    return;
  }
  const weights = pool.map((event) => Math.max(1, Number(event['event weight'] || 1)));
  let roll = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  let chosen = pool[0];
  for (let index = 0; index < pool.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) {
      chosen = pool[index];
      break;
    }
  }
  showDataEvent(chosen, category);
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
    renderer.render(scene, camera);
  } else if (state.phase === 'cinematic') {
    updateCinematic(now);
    if (cine) renderer.render(cine.scene, cine.camera);
  } else if (state.phase === 'survival') {
    updateSurvival(delta);
    renderer.render(scene, camera);
  } else if (state.phase === 'gameover') {
    renderer.render(scene, camera);
  }
}

function bindEvents() {
  $('startButton').addEventListener('click', startNewGame);
  $('continueButton').addEventListener('click', continueGame);
  $('retryButton').addEventListener('click', () => {
    deleteSave();
    $('gameOverScreen').classList.add('hidden');
    $('titleScreen').classList.remove('hidden');
    state.phase = 'title';
    buildMenuScene();
  });
  $('soundButton').addEventListener('click', () => {
    state.muted = !state.muted;
    $('soundButton').textContent = state.muted ? '×' : '♫';
    if (ambienceOsc) ambienceOsc.gain.gain.value = state.muted ? 0 : 0.018;
    if (!state.muted) playSound('click');
  });
  $('pauseButton').addEventListener('click', openPause);
  $('resumeButton').addEventListener('click', closePause);
  $('resetButton').addEventListener('click', () => {
    deleteSave();
    hideModal('pauseModal');
    state.paused = false;
    startNewGame();
  });
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
    if (document.querySelector('.modal-screen:not(.hidden)')) return;
    if ((state.phase === 'rescue' || state.phase === 'survival') && !state.paused) {
      keys[event.code] = true;
      if (event.code === 'KeyE') {
        if (state.phase === 'rescue') interact();
        else interactPod();
      }
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
