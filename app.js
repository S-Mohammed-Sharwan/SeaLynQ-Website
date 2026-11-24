import * as THREE from 'three';

const container = document.querySelector('#ocean-scene');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;
let scene;
let camera;
let clock;
let frameId = 0;
let visible = true;
const boats = [];

function makeBoat(name, x, z, scale = 1, color = 0x1aa6b0) {
  const boat = new THREE.Group();
  boat.name = name;
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-1.1, -0.22); hullShape.lineTo(1.02, -0.22); hullShape.lineTo(.76, .18); hullShape.lineTo(-.68, .18); hullShape.lineTo(-1.1, -.22);
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: .38, bevelEnabled: true, bevelSegments: 2, bevelSize: .045, bevelThickness: .045 }), new THREE.MeshStandardMaterial({ color: 0x183126, metalness: .28, roughness: .42 }));
  hull.rotation.x = Math.PI / 2; hull.position.y = .34;
  boat.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.28, .085, .32), new THREE.MeshStandardMaterial({ color: 0x427d55, metalness: .22, roughness: .45 }));
  deck.position.set(-.03, .48, 0); boat.add(deck);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(.46, .42, .3), new THREE.MeshStandardMaterial({ color: 0xe3eddf, metalness: .16, roughness: .36 }));
  cabin.position.set(-.22, .7, 0); boat.add(cabin);
  const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(.53, .065, .34), new THREE.MeshStandardMaterial({ color: 0x284633, roughness: .4 }));
  cabinRoof.position.set(-.22, .945, 0); boat.add(cabinRoof);
  const windowMat = new THREE.MeshBasicMaterial({ color: 0x87c8a0 });
  const window = new THREE.Mesh(new THREE.BoxGeometry(.26, .12, .012), windowMat); window.position.set(-.22, .76, .156); boat.add(window);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.012, .018, .5, 6), new THREE.MeshStandardMaterial({ color: 0x91bbc0, metalness: .4, roughness: .35 }));
  mast.position.set(.38, .78, 0); boat.add(mast);
  const node = new THREE.Mesh(new THREE.SphereGeometry(.045, 12, 10), new THREE.MeshBasicMaterial({ color, emissive: color }));
  node.position.set(.38, 1.04, 0); boat.add(node);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 10), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .14 }));
  glow.position.copy(node.position); boat.add(glow);
  boat.position.set(x, 0, z); boat.scale.setScalar(scale);
  boat.userData.baseY = 0;
  scene.add(boat); boats.push(boat);
  return boat;
}

function makeGateway(x, z) {
  const group = new THREE.Group(); group.name = 'Coastal gateway'; group.position.set(x, 0, z);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.19, .28, .65, 6), new THREE.MeshStandardMaterial({ color: 0x385d43, roughness: .65 })); base.position.y = .34; group.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.035, .05, 1.45, 8), new THREE.MeshStandardMaterial({ color: 0xb9cbb2, metalness: .25, roughness: .5 })); pole.position.y = 1.36; group.add(pole);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(.29, 18, 12, 0, Math.PI * 2, 0, Math.PI * .55), new THREE.MeshStandardMaterial({ color: 0xb5d9b9, emissive: 0x436a48, metalness: .25, roughness: .3, side: THREE.DoubleSide }));
  dish.position.set(.12, 1.9, 0); dish.rotation.z = -.5; group.add(dish);
  const beacon = new THREE.PointLight(0xb5e3b4, 1.2, 3); beacon.position.y = 2.2; group.add(beacon);
  scene.add(group); boats.push(group); return group;
}

function initOcean() {
  if (!container || !window.WebGLRenderingContext) { container?.classList.add('scene-fallback'); return; }
  try {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x496d50, .0045);
    camera = new THREE.PerspectiveCamera(40, 1, .1, 250);
    camera.position.set(0, 20, 27); camera.lookAt(0, .3, 0);
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 720 ? 1.35 : 1.7));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xeaf3df, 0x2a402e, 1.9));
    const key = new THREE.DirectionalLight(0xf5f7e9, 2.8); key.position.set(-7, 12, 8); scene.add(key);
    const blueFill = new THREE.PointLight(0xb4d9a7, 22, 50); blueFill.position.set(7, 7, -4); scene.add(blueFill);

    const waterGeometry = new THREE.PlaneGeometry(200, 200, 190, 190);
    const waterMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uDeep: { value: new THREE.Color('#456848') }, uLight: { value: new THREE.Color('#9cbd91') } },
      vertexShader: `uniform float uTime; varying vec2 vUv; varying float vWave; void main(){vUv=uv; vec3 p=position; float w=sin(p.x*.16+uTime*.48)*.2+sin(p.y*.21-uTime*.37)*.13+sin((p.x+p.y)*.09+uTime*.22)*.11; p.z+=w; vWave=w; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
      fragmentShader: `uniform vec3 uDeep; uniform vec3 uLight; uniform float uTime; varying vec2 vUv; varying float vWave; void main(){float bands=sin(vUv.y*800.0+sin(vUv.x*35.0+uTime)*2.0)*.5+.5; float glint=smoothstep(.81,.99,bands)*.24; float crest=smoothstep(-.04,.3,vWave)*.18; vec3 col=mix(uDeep,uLight,clamp(.2+crest+glint,0.0,.78)); float edge=pow(1.0-abs(vUv.x-.5)*2.0,1.4); col=mix(uDeep*.86,col,edge); gl_FragColor=vec4(col,.92);}`,
      transparent: true,
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial); water.rotation.x = -Math.PI / 2; water.position.y = -.06; scene.add(water);

    const boatA = makeBoat('Boat A', -4.5, 1.6, 1.55, 0xb5e7bb);
    const boatB = makeBoat('Boat B', -.15, -.7, 1.12, 0x8fc89b);
    const boatC = makeBoat('Boat C', 3.5, -3.1, .92, 0x8fc89b);
    const gateway = makeGateway(7.6, -5.8);
    boatA.rotation.y = .28; boatB.rotation.y = -.3; boatC.rotation.y = .24;

    const paths = [[boatA.position, boatB.position], [boatB.position, boatC.position], [boatC.position, gateway.position]];
    const curves = [];
    paths.forEach((pair, i) => {
      const start = new THREE.Vector3(pair[0].x, .56 + i * .03, pair[0].z);
      const end = new THREE.Vector3(pair[1].x, .56 + i * .03, pair[1].z);
      const mid = new THREE.Vector3((start.x + end.x) / 2, .85 + i * .05, (start.z + end.z) / 2);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end); curves.push(curve);
      const line = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, .012, 5, false), new THREE.MeshBasicMaterial({ color: 0xa5d9a6, transparent: true, opacity: .7 })); scene.add(line);
      const halo = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, .043, 5, false), new THREE.MeshBasicMaterial({ color: 0x91ca96, transparent: true, opacity: .11 })); scene.add(halo);
    });
    const packets = curves.map((curve, i) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(.075 - i * .008, 12, 10), new THREE.MeshBasicMaterial({ color: 0xf0ffed }));
      const halo = new THREE.PointLight(0xb5e7bb, 1.1, 2.2); mesh.add(halo); scene.add(mesh); return { mesh, curve, offset: i * .32 };
    });
    const markers = boats.slice(0, 3).map((boat) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(.42, .435, 44), new THREE.MeshBasicMaterial({ color: 0xb2dfb2, transparent: true, opacity: .45, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(boat.position.x, .055, boat.position.z); scene.add(ring); return ring;
    });

    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    renderer.domElement.addEventListener('click', (event) => {
      const rect = renderer.domElement.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      const hit = hits.find((item) => item.object.parent?.name?.startsWith('Boat') || item.object.name === 'Coastal gateway');
      if (hit) { const group = hit.object.parent?.name ? hit.object.parent : hit.object; if (group.name) showNode(group.name); }
    });
    renderer.domElement.style.cursor = 'crosshair';
    clock = new THREE.Clock();
    function resize() { if (!container || !renderer) return; const w = container.clientWidth; const h = container.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible && !reduceMotion) animate(); });
    function animate() {
      if (!visible || !renderer) return;
      frameId = requestAnimationFrame(animate);
      const t = reduceMotion ? 0 : clock.getElapsedTime();
      waterMaterial.uniforms.uTime.value = t;
      boats.forEach((boat, i) => { boat.position.y = Math.sin(t * .8 + i * 1.6) * .045; boat.rotation.z = Math.sin(t * .6 + i * 1.4) * .012; });
      packets.forEach(({ mesh, curve, offset }) => { const p = (t * .12 + offset) % 1; mesh.position.copy(curve.getPoint(p)); mesh.visible = !reduceMotion; });
      markers.forEach((ring, i) => { ring.material.opacity = .24 + (Math.sin(t * 1.6 + i) + 1) * .09; ring.scale.setScalar(1 + (Math.sin(t * 1.6 + i) + 1) * .06); });
      camera.position.x = Math.sin(t * .09) * .45; camera.lookAt(0, .25, 0);
      renderer.render(scene, camera);
    }
    animate();
  } catch (error) {
    console.warn('SeaLynQ 3D scene could not start; showing the ocean fallback.', error);
    container.classList.add('scene-fallback');
  }
}

function showNode(name) {
  const status = document.querySelector('.hud-left strong');
  if (status) status.innerHTML = '<span class="live-dot"></span> ' + name.toUpperCase() + ' · DEMO';
  const count = document.querySelector('#node-count'); if (count) count.innerHTML = '04 <span>BOATS + SHORE</span>';
}

const topbar = document.querySelector('.topbar');
addEventListener('scroll', () => topbar?.classList.toggle('scrolled', scrollY > 40), { passive: true });
const menuToggle = document.querySelector('.menu-toggle');
menuToggle?.addEventListener('click', () => {
  const nav = document.querySelector('.desktop-nav'); const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(open)); menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); nav?.classList.toggle('open', open);
});
document.querySelectorAll('.desktop-nav a').forEach((link) => link.addEventListener('click', () => { document.querySelector('.desktop-nav')?.classList.remove('open'); menuToggle?.setAttribute('aria-expanded', 'false'); }));

const flowCopy = [
  'A boat creates a short message, such as a position update, using the SeaLynQ device and app.',
  'A nearby participating boat receives the packet over a low-power LoRa radio link.',
  'Another boat may relay that packet onward, extending the path across the water.',
  'A coastal gateway can receive the packet and connect it to an internet backhaul.',
  'The message may then reach its intended recipient on shore.'
];
let flowIndex = 0;
function selectFlow(index) {
  flowIndex = (index + flowCopy.length) % flowCopy.length;
  document.querySelectorAll('.flow-node').forEach((node, i) => node.classList.toggle('active', i === flowIndex));
  document.querySelector('#flow-step').textContent = `STEP 0${flowIndex + 1}`;
  document.querySelector('#flow-description').textContent = flowCopy[flowIndex];
}
document.querySelectorAll('.flow-node').forEach((node) => node.addEventListener('click', () => selectFlow(Number(node.dataset.step))));
document.querySelector('#flow-prev')?.addEventListener('click', () => selectFlow(flowIndex - 1));
document.querySelector('#flow-next')?.addEventListener('click', () => selectFlow(flowIndex + 1));
const appScreenContent = {
  Home: ['Recent messages', 'Check-in shared', 'Network update'],
  Messages: ['Messages', 'Check-in shared', 'Relay confirmed'],
  Map: ['Location sharing', 'Last position', 'Shared with crew'],
  Device: ['Device status', 'Radio connected', 'Power status']
};
document.querySelectorAll('.app-tab').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('.app-tab').forEach((item) => { const active = item === tab; item.classList.toggle('selected', active); item.setAttribute('aria-selected', String(active)); });
  const state = appScreenContent[tab.dataset.app];
  document.querySelector('#app-screen-label').textContent = state[0];
  document.querySelectorAll('.app-recent article strong').forEach((item, index) => { item.textContent = state[index + 1]; });
}));

document.querySelector('#contact-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const message = `SeaLynQ enquiry\nName: ${values.get('name')}\nEmail: ${values.get('email')}\nCategory: ${values.get('category')}\n\n${values.get('message')}`;
  const hint = document.querySelector('#form-hint');
  try {
    await navigator.clipboard.writeText(message);
    hint.textContent = 'Enquiry copied. Share it with the SeaLynQ team.';
  } catch {
    const helper = document.createElement('textarea'); helper.value = message; helper.style.position = 'fixed'; helper.style.opacity = '0'; document.body.appendChild(helper); helper.select();
    const copied = document.execCommand('copy'); helper.remove();
    hint.textContent = copied ? 'Enquiry copied. Share it with the SeaLynQ team.' : 'Copy was unavailable. Please select and copy your enquiry details.';
  }
});

const startButton = document.querySelector('#start-demo');
const pauseButton = document.querySelector('#pause-demo');
const resetButton = document.querySelector('#reset-demo');
const packet = document.querySelector('#packet');
const title = document.querySelector('#demo-status-title');
const copy = document.querySelector('#demo-status-copy');
const relayRows = [...document.querySelectorAll('.relay-row')];
let demoTimers = []; let demoPaused = false; let demoStep = 0;
function clearDemoTimers() { demoTimers.forEach(clearTimeout); demoTimers = []; }
function updateDemoStep(step) {
  demoStep = step;
  relayRows.forEach((row, i) => { row.classList.toggle('active', i === step); row.classList.toggle('done', i < step); row.querySelector('.relay-state').textContent = i < step ? 'DONE' : i === step ? 'IN PROGRESS' : 'WAITING'; });
}
function startDemo() {
  clearDemoTimers(); demoPaused = false; pauseButton.textContent = 'Ⅱ'; pauseButton.setAttribute('aria-label', 'Pause simulation');
  document.querySelector('#map-success').classList.remove('visible'); packet.classList.remove('travel'); void packet.offsetWidth; packet.classList.add('travel');
  title.textContent = 'Message in transit'; copy.textContent = 'A simulated position update is relaying toward the coastal gateway.'; startButton.innerHTML = '<span>↻</span> Run again';
  updateDemoStep(0); document.querySelector('.demo-clock').textContent = new Date().toLocaleTimeString('en-GB', { hour12: false });
  scheduleDemoProgress(0);
}
function scheduleDemoProgress(fromStep) {
  const stages = [{ step: 1, delay: fromStep === 0 ? 950 : 0 }, { step: 2, delay: fromStep < 2 ? 1300 : 0 }, { step: 3, delay: fromStep < 3 ? 1250 : 0 }];
  let elapsed = 0;
  stages.filter(({ step }) => step > fromStep).forEach(({ step, delay }) => {
    elapsed += delay;
    demoTimers.push(setTimeout(() => {
      updateDemoStep(step);
      if (step === 3) { title.textContent = 'Gateway received'; copy.textContent = 'The simulated packet reached shore. No live devices or network are connected.'; document.querySelector('#map-success').classList.add('visible'); }
    }, elapsed));
  });
}
startButton?.addEventListener('click', startDemo);
pauseButton?.addEventListener('click', () => {
  if (!demoPaused) { clearDemoTimers(); packet.style.animationPlayState = 'paused'; title.textContent = 'Simulation paused'; copy.textContent = 'The visualized message path is paused. Resume to continue the demo.'; pauseButton.textContent = '▶'; pauseButton.setAttribute('aria-label', 'Resume simulation'); demoPaused = true; }
  else { packet.style.animationPlayState = 'running'; demoPaused = false; title.textContent = 'Message in transit'; copy.textContent = 'A simulated position update is relaying toward the coastal gateway.'; pauseButton.textContent = 'Ⅱ'; pauseButton.setAttribute('aria-label', 'Pause simulation'); scheduleDemoProgress(demoStep); }
});
resetButton?.addEventListener('click', () => {
  clearDemoTimers(); demoPaused = false; packet.classList.remove('travel'); packet.style.animationPlayState = 'running'; document.querySelector('#map-success').classList.remove('visible'); title.textContent = 'Network at rest'; copy.textContent = 'Start the simulation to see a small message travel across participating nodes.'; startButton.innerHTML = '<span>▶</span> Start network'; pauseButton.textContent = 'Ⅱ'; pauseButton.setAttribute('aria-label', 'Pause simulation'); document.querySelector('.demo-clock').textContent = '00:00:00'; updateDemoStep(0);
});

initOcean();

