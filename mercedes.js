/* =============================================
   Mercedes-Benz CL63 AMG (W216) — Sürüş Simülatörü v3
   Manuel Vites | V8 M156 | Akıcı Fizik | Gece Sürüşü
   ============================================= */

// ============== SAHNE ==============
const S = new THREE.Scene();
const C = new THREE.PerspectiveCamera(78, window.innerWidth/window.innerHeight, 0.05, 500);
const R = new THREE.WebGLRenderer({antialias:true});
let cockpitGroup, camPivot;
let aynaSolCam, aynaSagCam, aynaOrtaCam;
let farIsigi, farYay, far2;
let tuslar = {}, fareKilitli = false;
let hiz = 0, devir = 700, kmSaat = 0;
let vitesIdx = 1, vitesAdi = 'N';  // 0=R, 1=N, 2-8=1-7
let direksiyonAci = 0, rotY = 0, rotX = 0.15;
let motorSes, sesCtx;
let sinyalSol = false, sinyalSag = false, sinyalTimer = 0;
let farAcik = false, farTusBloque = false;
let gearTimer = 0, gearLastVites = 1;
let lastTime = 0, delta = 0;
let yolSegments = [], yolCizgileri = [], kenarCizgileri = [];
let digerArabalar = [];
let agaclar = [], direkler = [];

const YOL_G = 14;
const YOL_L = 500;
const SEG = 10;
const SEG_N = Math.ceil(YOL_L / SEG) + 15;

const VITES = ['R','N','1','2','3','4','5','6','7'];

// CL63 7G-TRONIC oranları
const ORAN = [0, 0, 0.082, 0.145, 0.225, 0.33, 0.47, 0.65, 0.88];

// ============== BAŞLAT ==============
function baslat() {
  document.getElementById('uyari').style.display = 'none';
  S.background = new THREE.Color(0x080818);
  S.fog = new THREE.FogExp2(0x080818, 0.004);

  R.setSize(window.innerWidth, window.innerHeight);
  R.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  R.shadowMap.enabled = true;
  R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.toneMapping = THREE.ACESFilmicToneMapping;
  R.toneMappingExposure = 1.0;
  document.body.appendChild(R.domElement);

  // Kamera pivot
  camPivot = new THREE.Group();
  camPivot.position.set(0, 0, 0);
  S.add(camPivot);
  C.position.set(0, 1.25, 0);
  C.rotation.set(0, Math.PI, 0);
  camPivot.add(C);

  // Işıklar
  const amb = new THREE.AmbientLight(0x1a2a44, 0.2);
  S.add(amb);
  const ay = new THREE.DirectionalLight(0x7799ff, 0.25);
  ay.position.set(20, 40, 10);
  ay.castShadow = true;
  ay.shadow.mapSize.set(1024, 1024);
  ay.shadow.camera.near = 1;
  ay.shadow.camera.far = 100;
  ay.shadow.camera.left = -30;
  ay.shadow.camera.right = 30;
  ay.shadow.camera.top = 30;
  ay.shadow.camera.bottom = -30;
  S.add(ay);
  S.add(new THREE.AmbientLight(0x334466, 0.1));

  // Dünya
  yolOlustur();
  yolKenari();
  arabaIciniOlustur();
  digerArabalariOlustur();
  yildizlar();
  motorSesiBaslat();
  kontroller();
  aynaKameraOlustur();

  window.addEventListener('resize', () => {
    C.aspect = window.innerWidth/window.innerHeight;
    C.updateProjectionMatrix();
    R.setSize(window.innerWidth, window.innerHeight);
  });

  lastTime = performance.now();
  loop();
}

// ============== AYNALAR ==============
function aynaKameraOlustur() {
  aynaSolCam = new THREE.PerspectiveCamera(45, 1.75, 0.1, 200);
  aynaSagCam = new THREE.PerspectiveCamera(45, 1.75, 0.1, 200);
  aynaOrtaCam = new THREE.PerspectiveCamera(30, 2.0, 0.1, 200);
  camPivot.add(aynaSolCam);
  camPivot.add(aynaSagCam);
  camPivot.add(aynaOrtaCam);
}

function aynalariRender() {
  const x = camPivot.position.x;
  // Sol ayna
  aynaSolCam.position.set(-0.5 + x, 1.3, 0);
  aynaSolCam.lookAt(-20 + x, 1, -10);
  // Sağ ayna
  aynaSagCam.position.set(0.5 + x, 1.3, 0);
  aynaSagCam.lookAt(20 + x, 1, -10);
  // Orta ayna
  aynaOrtaCam.position.set(0 + x, 1.35, 0);
  aynaOrtaCam.lookAt(0 + x, 1, -30);

  [aynaSolCam, aynaSagCam, aynaOrtaCam].forEach((cam, i) => {
    R.setViewport(0, 0, i < 2 ? 140 : 110, i < 2 ? 80 : 55);
    R.setScissor(0, 0, i < 2 ? 140 : 110, i < 2 ? 80 : 55);
    R.setScissorTest(true);
    R.render(S, cam);
  });
  R.setViewport(0, 0, R.domElement.width, R.domElement.height);
  R.setScissorTest(false);
}

// ============== YOL ==============
function yolOlustur() {
  const zemin = new THREE.Mesh(new THREE.PlaneGeometry(200, YOL_L),
    new THREE.MeshLambertMaterial({color: 0x182818}));
  zemin.rotation.x = -Math.PI/2;
  zemin.position.set(0, -0.05, -YOL_L/2);
  zemin.receiveShadow = true;
  S.add(zemin);

  for (let i = 0; i < SEG_N; i++) {
    const z = i * SEG;
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(YOL_G, SEG),
      new THREE.MeshLambertMaterial({color: i%2===0 ? 0x2a2a2a : 0x323232}));
    seg.rotation.x = -Math.PI/2;
    seg.position.set(0, 0.01, -z);
    seg.receiveShadow = true;
    S.add(seg);
    yolSegments.push(seg);

    if (i % 2 === 0) {
      const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 3),
        new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.6}));
      cl.rotation.x = -Math.PI/2;
      cl.position.set(0, 0.02, -z + SEG/2);
      S.add(cl);
      yolCizgileri.push(cl);
    }

    [-1, 1].forEach(s => {
      const k = new THREE.Mesh(new THREE.PlaneGeometry(0.1, SEG),
        new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.4}));
      k.rotation.x = -Math.PI/2;
      k.position.set(s * (YOL_G/2 - 0.15), 0.015, -z);
      S.add(k);
      kenarCizgileri.push(k);
    });
  }
}

function yolKenari() {
  // Ağaçlar
  for (let i = 0; i < 70; i++) {
    const z = -(Math.random() * YOL_L * 0.9 + 5);
    const side = Math.random() > 0.5 ? 1 : -1;
    const x = side * (YOL_G/2 + 3 + Math.random() * 10);
    const govde = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 1.3 + Math.random()),
      new THREE.MeshLambertMaterial({color: 0x3a2510}));
    govde.position.set(x, 0.65, z);
    govde.castShadow = true;
    S.add(govde);
    const yap = new THREE.Mesh(new THREE.SphereGeometry(1.0 + Math.random() * 0.8, 5, 5),
      new THREE.MeshLambertMaterial({color: [0x1a4a1a,0x1a3a1a,0x225522,0x1a5533][Math.floor(Math.random()*4)]}));
    yap.position.set(x + (Math.random()-0.5)*0.5, 1.6 + Math.random() * 0.8, z);
    yap.castShadow = true;
    S.add(yap);
    agaclar.push({govde, yap});
  }

  // Lambalar
  for (let i = 0; i < 60; i++) {
    const z = -(i * 8 + 3);
    [-1, 1].forEach(s => {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 2.8),
        new THREE.MeshLambertMaterial({color: 0x444444}));
      d.position.set(s * (YOL_G/2 + 1.6), 1.4, z);
      S.add(d);
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6),
        new THREE.MeshBasicMaterial({color: 0xffdd88}));
      l.position.set(s * (YOL_G/2 + 1.6), 2.8, z);
      S.add(l);
      direkler.push({d, l, z});
    });
  }

  // Bariyerler
  for (let i = 0; i < 80; i++) {
    const z = -(i * 5 + 2);
    [-1, 1].forEach(s => {
      S.add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.7),
        new THREE.MeshLambertMaterial({color: 0x666666})).translate(s*(YOL_G/2+0.7), 0.25, z));
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.12),
        new THREE.MeshBasicMaterial({color: s===-1?0xff0000:0xffffff, transparent:true, opacity:0.6}));
      r.position.set(s*(YOL_G/2+0.9), 0.3, z);
      S.add(r);
    });
  }
}

function yildizlar() {
  const p = [];
  for (let i = 0; i < 3000; i++)
    p.push((Math.random()-0.5)*800, Math.random()*400+50, (Math.random()-0.5)*800);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  S.add(new THREE.Points(g, new THREE.PointsMaterial({color:0xffffff,size:0.18,transparent:true,opacity:0.6})));
}

// ============== MERCEDES CL63 İÇ MEKAN ==============
function arabaIciniOlustur() {
  cockpitGroup = new THREE.Group();

  // Malzemeler
  const siyah = new THREE.MeshLambertMaterial({color: 0x0a0a0a});
  const koyu = new THREE.MeshLambertMaterial({color: 0x111111});
  const deri = new THREE.MeshLambertMaterial({color: 0x1a0a05});
  const deri2 = new THREE.MeshLambertMaterial({color: 0x201008});
  const camMat = new THREE.MeshPhysicalMaterial({color: 0x88ccff, transparent: true, opacity: 0.1,
    roughness: 0.05, metalness: 0, side: THREE.DoubleSide});

  // Dashboard
  const dash = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.12, 0.75), koyu);
  dash.position.set(0, 0.15, -0.35);
  cockpitGroup.add(dash);
  const torp = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.04, 0.4), siyah);
  torp.position.set(0, 0.45, -0.35);
  cockpitGroup.add(torp);

  // Koltuklar
  [-1, 1].forEach(s => {
    const alt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.15, 0.5), deri);
    alt.position.set(s*0.28, -0.2, 0.1);
    cockpitGroup.add(alt);
    const sirt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.06), deri2);
    sirt.position.set(s*0.28, 0.08, 0.38);
    cockpitGroup.add(sirt);
    const bas = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.13, 0.04), deri);
    bas.position.set(s*0.28, 0.38, 0.35);
    cockpitGroup.add(bas);
    // Dikiş çizgileri
    const diki = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.005, 0.01),
      new THREE.MeshBasicMaterial({color: 0x444444, transparent: true, opacity: 0.3}));
    diki.position.set(s*0.28, 0.1, 0.1);
    cockpitGroup.add(diki);
  });

  // Direksiyon
  const dir = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 24),
    new THREE.MeshLambertMaterial({color: 0x0a0a0a}));
  dir.position.set(-0.45, 0.12, -0.55);
  dir.rotation.set(0.4, 0, 0.1);
  cockpitGroup.add(dir);
  const icDir = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 20),
    new THREE.MeshLambertMaterial({color: 0x1a1a1a}));
  icDir.position.copy(dir.position);
  icDir.rotation.copy(dir.rotation);
  cockpitGroup.add(icDir);
  const gobek = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16),
    new THREE.MeshLambertMaterial({color: 0x222222}));
  gobek.position.set(-0.45, 0.14, -0.52);
  cockpitGroup.add(gobek);
  const amblem = new THREE.Mesh(new THREE.CircleGeometry(0.03, 3),
    new THREE.MeshBasicMaterial({color: 0xaaaaaa}));
  amblem.position.set(-0.45, 0.15, -0.51);
  cockpitGroup.add(amblem);
  // Direksiyon kumanda kolları
  const kolDir = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.02, 0.1), new THREE.MeshLambertMaterial({color: 0x333}));
  kolDir.position.set(-0.45, 0.08, -0.52);
  cockpitGroup.add(kolDir);

  // Göstergeler
  [-0.7, 0.7].forEach((x, i) => {
    const renk = i === 0 ? 0x00ff88 : 0xff8800;
    const c = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.11, 20),
      new THREE.MeshBasicMaterial({color: renk, transparent: true, opacity: 0.5, side: THREE.DoubleSide}));
    c.position.set(x, 0.24, -0.37);
    c.rotation.x = -0.2;
    cockpitGroup.add(c);
    // İbre
    for (let j = 0; j < 5; j++) {
      const ib = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.04, 0.003),
        new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.3}));
      ib.position.set(x + Math.cos(j/5*Math.PI*2)*0.08, 0.24 + Math.sin(j/5*Math.PI*2)*0.04, -0.36);
      cockpitGroup.add(ib);
    }
  });

  // COMAND ekranı
  const ekran = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.01),
    new THREE.MeshBasicMaterial({color: 0x001a33, transparent: true, opacity: 0.85}));
  ekran.position.set(0, 0.28, -0.38);
  cockpitGroup.add(ekran);
  const ekP = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.02),
    new THREE.MeshBasicMaterial({color: 0x004488, transparent: true, opacity: 0.2}));
  ekP.position.set(0, 0.28, -0.37);
  cockpitGroup.add(ekP);

  // Orta konsol
  const konsol = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.32), koyu);
  konsol.position.set(0, -0.02, -0.15);
  cockpitGroup.add(konsol);
  // Vites topuzu (AMG)
  const vKolu = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.1, 6),
    new THREE.MeshLambertMaterial({color: 0x222}));
  vKolu.position.set(0, 0.03, -0.1);
  cockpitGroup.add(vKolu);
  const vTop = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8),
    new THREE.MeshLambertMaterial({color: 0x333}));
  vTop.position.set(0, 0.08, -0.1);
  cockpitGroup.add(vTop);
  const amg = new THREE.Mesh(new THREE.CircleGeometry(0.014, 3),
    new THREE.MeshBasicMaterial({color: 0xff0000}));
  amg.position.set(0, 0.085, -0.09);
  cockpitGroup.add(amg);

  // Kapı iç kaplamaları
  [-1, 1].forEach(s => {
    const kapi = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.6), koyu);
    kapi.position.set(s*1.05, 0.15, 0.05);
    cockpitGroup.add(kapi);
    // Kol dayama
    const kolD = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.2), deri);
    kolD.position.set(s*1.05, 0.25, 0.1);
    cockpitGroup.add(kolD);
    // Kapı kolu
    const kKol = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.02, 0.07),
      new THREE.MeshLambertMaterial({color: 0x555}));
    kKol.position.set(s*1.05, 0.2, 0.05);
    cockpitGroup.add(kKol);
    // Burmester hoparlör
    for (let j = -0.1; j <= 0.1; j += 0.1) {
      const hop = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.005, 0.04),
        new THREE.MeshBasicMaterial({color: 0x888888, transparent: true, opacity: 0.25}));
      hop.position.set(s*1.05, 0.05, j);
      cockpitGroup.add(hop);
    }
  });

  // Ön cam
  const onCam = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.01, 0.75), camMat);
  onCam.position.set(0, 0.65, -0.85);
  onCam.rotation.x = 0.12;
  cockpitGroup.add(onCam);

  // A sütunları
  [-1, 1].forEach(s => {
    const sut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.06), siyah);
    sut.position.set(s*1.05, 0.4, -0.7);
    cockpitGroup.add(sut);
    const sutK = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.015), new THREE.MeshLambertMaterial({color:0x222}));
    sutK.position.set(s*1.05, 0.4, -0.68);
    cockpitGroup.add(sutK);
  });

  // Yan camlar
  [-1, 1].forEach(s => {
    const yCam = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.3, 0.7), camMat);
    yCam.position.set(s*1.08, 0.35, 0);
    cockpitGroup.add(yCam);
    const yCer = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.7), siyah);
    yCer.position.set(s*1.08, 0.5, 0);
    cockpitGroup.add(yCer);
  });

  // Tavan
  const tavan = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.015, 0.7), siyah);
  tavan.position.set(0, 0.72, -0.1);
  cockpitGroup.add(tavan);

  // İç aydınlatma (ortam ışığı)
  const icIsik = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.002, 0.2),
    new THREE.MeshBasicMaterial({color: 0x00ff88, transparent: true, opacity: 0.15}));
  icIsik.position.set(0, 0.7, 0.1);
  cockpitGroup.add(icIsik);

  // Farlar (ışık konileri)
  farYay = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3, 16, 1, true),
    new THREE.MeshBasicMaterial({color: 0xffeeaa, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false}));
  farYay.position.set(0, 0.1, -2.5);
  farYay.rotation.x = Math.PI/2;
  cockpitGroup.add(farYay);

  farIsigi = new THREE.SpotLight(0xffeecc, 0, 30, Math.PI/5, 0.4, 1.5);
  farIsigi.position.set(0, 0.5, -2);
  farIsigi.target.position.set(0, -1, -25);
  cockpitGroup.add(farIsigi);
  cockpitGroup.add(farIsigi.target);

  far2 = new THREE.SpotLight(0xffeecc, 0, 30, Math.PI/5, 0.4, 1.5);
  far2.position.set(0.5, 0.3, -2);
  far2.target.position.set(3, -1, -25);
  cockpitGroup.add(far2);
  cockpitGroup.add(far2.target);

  S.add(cockpitGroup);
}

// ============== DİĞER ARABALAR ==============
function digerArabalariOlustur() {
  for (let i = 0; i < 25; i++) {
    const g = new THREE.Group();
    const renk = new THREE.Color().setHSL(Math.random(), 0.6, 0.35 + Math.random() * 0.35);
    const govde = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.28, 1.7),
      new THREE.MeshLambertMaterial({color: renk}));
    govde.position.y = 0.18; govde.castShadow = true; g.add(govde);
    const kabin = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.15, 0.6),
      new THREE.MeshBasicMaterial({color: 0x4488cc, transparent: true, opacity: 0.35}));
    kabin.position.set(0, 0.35, -0.08); g.add(kabin);
    [-1, 1].forEach(s => [-1, 1].forEach(t => {
      const tek = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.035, 6),
        new THREE.MeshLambertMaterial({color: 0x111}));
      tek.rotation.x = Math.PI/2;
      tek.position.set(s*0.32, 0.04, t*0.6); g.add(tek);
    }));
    [-1, 1].forEach(s => {
      const fl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.02),
        new THREE.MeshBasicMaterial({color: 0xffffcc}));
      fl.position.set(s*0.22, 0.16, 0.86); g.add(fl);
      const sl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.02),
        new THREE.MeshBasicMaterial({color: 0xff0000}));
      sl.position.set(s*0.22, 0.16, -0.86); g.add(sl);
    });
    g.position.set((Math.random()-0.5)*(YOL_G-2.5), 0, -(Math.random()*YOL_L*0.85+15));
    g.userData = {hiz: 0.03 + Math.random() * 0.09};
    S.add(g); digerArabalar.push(g);
  }
}

// ============== SES (V8 M156) ==============
function motorSesiBaslat() {
  try {
    sesCtx = new (window.AudioContext || window.webkitAudioContext)();

    // V8 ana ses (sawtooth + triangle karışımı)
    const osc1 = sesCtx.createOscillator();
    const gain1 = sesCtx.createGain();
    const filt1 = sesCtx.createBiquadFilter();
    osc1.type = 'sawtooth';
    filt1.type = 'lowpass';
    filt1.frequency.value = 120;
    filt1.Q.value = 4;
    gain1.gain.value = 0;
    osc1.connect(filt1); filt1.connect(gain1); gain1.connect(sesCtx.destination);
    osc1.start();

    // Sub-bass derinlik (M156'nın o gürültülü egzozu)
    const osc2 = sesCtx.createOscillator();
    const gain2 = sesCtx.createGain();
    osc2.type = 'sine';
    gain2.gain.value = 0;
    osc2.connect(gain2); gain2.connect(sesCtx.destination);
    osc2.start();

    // Harmonik+ (metalik egzoz)
    const osc3 = sesCtx.createOscillator();
    const gain3 = sesCtx.createGain();
    osc3.type = 'triangle';
    gain3.gain.value = 0;
    osc3.connect(gain3); gain3.connect(sesCtx.destination);
    osc3.start();

    // Gürültü (egzoz püskürtmesi - pat pat)
    const buf = sesCtx.createBuffer(1, sesCtx.sampleRate*2, sesCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(Math.random(), 2);
    const noise = sesCtx.createBufferSource();
    noise.buffer = buf; noise.loop = true;
    const gainN = sesCtx.createGain();
    gainN.gain.value = 0;
    noise.connect(gainN); gainN.connect(sesCtx.destination);
    noise.start();

    // VİTES GEÇİŞ SESİ
    const gearOsc = sesCtx.createOscillator();
    const gearGain = sesCtx.createGain();
    gearOsc.type = 'sine';
    gearGain.gain.value = 0;
    gearOsc.connect(gearGain); gearGain.connect(sesCtx.destination);
    gearOsc.start();
    const gearNoise = sesCtx.createBufferSource();
    const gBuf = sesCtx.createBuffer(1, sesCtx.sampleRate*0.3, sesCtx.sampleRate);
    const gD = gBuf.getChannelData(0);
    for (let i = 0; i < gD.length; i++) gD[i] = (Math.random()*2-1) * Math.pow(1 - i/gD.length, 2);
    gearNoise.buffer = gBuf;
    const gearNoiseGain = sesCtx.createGain();
    gearNoiseGain.gain.value = 0;
    gearNoise.connect(gearNoiseGain); gearNoiseGain.connect(sesCtx.destination);

    motorSes = { osc1, gain1, filt1, osc2, gain2, osc3, gain3, noise, gainN,
      gearOsc, gearGain, gearNoise, gearNoiseGain };
    sesCtx.resume();
  } catch(e) { motorSes = null; }
}

function motorSesiGuncelle(devirRpm, gaz) {
  if (!motorSes || !sesCtx) return;
  try {
    const d = devirRpm / 1000;
    const base = 28 + d * 28; // 28Hz rölanti, ~238Hz redline

    motorSes.osc1.frequency.setTargetAtTime(base, sesCtx.currentTime, 0.04);
    motorSes.filt1.frequency.setTargetAtTime(90 + d * 90 + gaz * 60, sesCtx.currentTime, 0.04);
    motorSes.gain1.gain.setTargetAtTime(Math.min(0.08, gaz * 0.035 + d * 0.006), sesCtx.currentTime, 0.04);

    motorSes.osc2.frequency.setTargetAtTime(base * 0.5, sesCtx.currentTime, 0.04);
    motorSes.gain2.gain.setTargetAtTime(Math.min(0.10, gaz * 0.05 + d * 0.004), sesCtx.currentTime, 0.04);

    motorSes.osc3.frequency.setTargetAtTime(base * 1.5, sesCtx.currentTime, 0.04);
    motorSes.gain3.gain.setTargetAtTime(Math.min(0.03, gaz * 0.01 + d * 0.003), sesCtx.currentTime, 0.04);

    motorSes.gainN.gain.setTargetAtTime(Math.min(0.015, gaz * 0.006 + d * 0.001), sesCtx.currentTime, 0.04);
  } catch(e) {}
}

function vitesSesiCal(yukselt) {
  if (!motorSes || !sesCtx) return;
  try {
    const t = sesCtx.currentTime;
    // Kısa vites geçiş sesi
    motorSes.gearOsc.frequency.setValueAtTime(yukselt ? 400 : 200, t);
    motorSes.gearOsc.frequency.exponentialRampToValueAtTime(yukselt ? 100 : 80, t + 0.08);
    motorSes.gearGain.gain.setValueAtTime(0.04, t);
    motorSes.gearGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    // Vites mekanik sesi
    motorSes.gearNoiseGain.gain.setValueAtTime(0.03, t);
    motorSes.gearNoiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    motorSes.gearNoise.start ? (motorSes.gearNoise.start(), motorSes.gearNoise.start = null) : 0;

    // Motor devir düşüş efekti (vites büyütünce)
    if (yukselt) {
      motorSes.osc1.frequency.setTargetAtTime(60, t, 0.02);
      motorSes.osc1.frequency.setTargetAtTime(28 + (devir/1000)*28, t + 0.1, 0.05);
    }
  } catch(e) {}
}

// ============== KONTROLLER ==============
function kontroller() {
  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    tuslar[k] = true;
    if ([' ','arrowup','arrowdown','arrowleft','arrowright','shift','control','f','r','q','e'].includes(k) || e.key === ' ')
      e.preventDefault();
  });
  document.addEventListener('keyup', (e) => {
    tuslar[e.key.toLowerCase()] = false;
  });

  document.getElementById('uyari').addEventListener('click', () => R.domElement.requestPointerLock());
  document.addEventListener('pointerlockchange', () => {
    fareKilitli = document.pointerLockElement === R.domElement;
    if (fareKilitli) document.getElementById('uyari').style.display = 'none';
  });
  document.addEventListener('mousemove', (e) => {
    if (!fareKilitli) return;
    rotY -= e.movementX * 0.0025;
    rotX -= e.movementY * 0.002;
    rotX = Math.max(-0.5, Math.min(0.65, rotX));
  });
  R.domElement.addEventListener('wheel', (e) => {
    if (!fareKilitli) return;
    C.fov += e.deltaY * 0.02;
    C.fov = Math.max(65, Math.min(95, C.fov));
    C.updateProjectionMatrix();
  });
}

// ============== VİTES (MANUEL) ==============
function vitesGuncelle() {
  if (tuslar['r']) {
    if (vitesIdx !== 0) {
      vitesIdx = 0; vitesAdi = 'R'; gearTimer = 0.4;
      vitesSesiCal(false);
    } return;
  }

  // Manuel büyüt: Shift
  if (tuslar['shift'] && gearTimer <= 0 && vitesIdx >= 2 && vitesIdx < 8 && hiz > 3) {
    vitesIdx++; vitesAdi = VITES[vitesIdx];
    gearTimer = 0.4;
    devir = devir * 0.65;
    vitesSesiCal(true);
    tuslar['shift'] = false; // bir kere at, basılı tutunca tekrar atmasın
    return;
  }

  // Manuel küçült: Ctrl
  if (tuslar['control'] && gearTimer <= 0 && vitesIdx > 2) {
    vitesIdx--; vitesAdi = VITES[vitesIdx];
    gearTimer = 0.35;
    devir = Math.min(7000, devir * 1.35);
    vitesSesiCal(false);
    tuslar['control'] = false;
    return;
  }

  // R'den çık
  if (vitesIdx === 0 && !tuslar['r']) {
    vitesIdx = 1; vitesAdi = 'N'; gearTimer = 0.2;
    return;
  }

  // Hız sıfır -> N
  if (kmSaat < 1 && vitesIdx > 1 && !tuslar['shift'] && !tuslar['control']) {
    if (gearTimer <= 0.01) {
      vitesIdx = 1; vitesAdi = 'N'; gearTimer = 0;
    }
  }
}

// ============== DÖNGÜ ==============
function loop() {
  requestAnimationFrame(loop);

  const now = performance.now();
  delta = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  if (gearTimer > 0) gearTimer -= delta;

  if (!fareKilitli) { R.render(S, C); return; }

  // ===== SÜRÜŞ =====
  const gaz = (tuslar['w'] || tuslar['arrowup']) ? 1 : 0;
  const fren = (tuslar['s'] || tuslar['arrowdown']) ? 1 : 0;
  const elFren = tuslar[' '] ? 1 : 0;

  vitesGuncelle();

  // Devir
  if (vitesIdx === 1) { // N
    devir += (700 + gaz * 3500 - devir) * delta * 2.5;
  } else if (vitesIdx === 0) { // R
    devir += (800 + gaz * 3800 - devir) * delta * 3;
    devir = Math.max(600, Math.min(6200, devir));
  } else {
    const yuk = 0.3 + gaz * 0.7;
    const hedef = 750 + yuk * 6200;
    devir += (hedef - devir) * delta * 3.5;
    devir = Math.max(600, Math.min(7500, devir));
    if (gearTimer > 0) devir *= 0.97;
  }

  // Hız
  if (vitesIdx === 1) {
    hiz *= 0.97;
  } else if (vitesIdx === 0) {
    hiz += (-gaz * 12 - hiz * 0.5) * delta;
    hiz = Math.max(-28, Math.min(0, hiz));
  } else {
    const v = Math.min(vitesIdx, 8);
    const oran = ORAN[v] || 0.08;
    const itme = gaz * oran * 135;
    const motorFren = (1 - gaz) * hiz * 0.12;
    const surt = hiz * 0.22;
    const hava = hiz * hiz * 0.0012;
    const frenK = fren * 20;
    const elF = elFren * 40;
    hiz += (itme - surt - hava - motorFren - frenK - elF) * delta;
    hiz = Math.max(0, Math.min(330, hiz));
  }

  kmSaat = Math.round(hiz * 3.6);

  // Direksiyon
  const hF = Math.min(1, hiz / 30);
  const dH = 0.12 + hF * 0.88;

  if (tuslar['a'] || tuslar['arrowleft']) direksiyonAci -= delta * 3.8 * dH;
  else if (tuslar['d'] || tuslar['arrowright']) direksiyonAci += delta * 3.8 * dH;
  else direksiyonAci *= 0.92;
  direksiyonAci = Math.max(-1, Math.min(1, direksiyonAci));

  // Dönüş
  rotY += direksiyonAci * delta * 1.3 * hF;
  camPivot.rotation.y = rotY;

  // Yanal
  camPivot.position.x += direksiyonAci * hiz * 0.025 * delta;
  camPivot.position.x *= 0.985;

  // İleri
  camPivot.position.z += -hiz * delta;

  // Sonsuz yol
  if (camPivot.position.z < -50) {
    const k = 200;
    camPivot.position.z += k;
    [...yolSegments, ...yolCizgileri, ...kenarCizgileri].forEach(o => o.position.z += k);
    agaclar.forEach(a => { a.govde.position.z += k; a.yaprak.position.z += k; });
    direkler.forEach(d => { d.d.position.z += k; d.l.position.z += k; });
    digerArabalar.forEach(a => a.position.z += k);
    yolSegments.forEach(s => { if (s.position.z > 50) s.position.z -= YOL_L; });
    yolCizgileri.concat(kenarCizgileri).forEach(c => { if (c.position.z > 50) c.position.z -= YOL_L; });
  }

  // Diğer arabalar
  digerArabalar.forEach(a => {
    a.position.z += 0.04 + a.userData.hiz;
    if (a.position.z > 10) a.position.z = -YOL_L - Math.random() * 60;
  });

  // Kamera
  const t = hiz > 8 ? Math.sin(now * hiz * 0.6) * 0.00025 * hiz * 0.2 : 0;
  const yT = hiz > 8 ? Math.cos(now * hiz * 0.8) * 0.00015 * hiz * 0.2 : 0;
  C.rotation.x = rotX + t;
  C.rotation.y = Math.PI + direksiyonAci * 0.07 + yT;
  C.rotation.z = -direksiyonAci * hiz * 0.00025 + t * 0.5;

  // SES
  motorSesiGuncelle(devir, gaz);

  // SİNYAL
  sinyalTimer += delta;
  if (tuslar['q'] && !tuslar['q_old']) { sinyalSol = !sinyalSol; sinyalSag = false; }
  if (tuslar['e'] && !tuslar['e_old']) { sinyalSag = !sinyalSag; sinyalSol = false; }
  tuslar['q_old'] = tuslar['q'];
  tuslar['e_old'] = tuslar['e'];
  const sy = Math.floor(sinyalTimer * 2) % 2 === 0;
  document.getElementById('sinyalSol').style.opacity = (sinyalSol && sy) ? '0.8' : '0';
  document.getElementById('sinyalSag').style.opacity = (sinyalSag && sy) ? '0.8' : '0';

  // FAR
  if (tuslar['f'] && !farTusBloque) { farAcik = !farAcik; farTusBloque = true; }
  if (!tuslar['f']) farTusBloque = false;
  if (farAcik) {
    farIsigi.intensity = 3; far2.intensity = 3;
    farYay.material.opacity = 0.2 + Math.sin(now*0.001)*0.02;
    document.getElementById('farIsigi').style.opacity = '1';
  } else {
    farIsigi.intensity = 0; far2.intensity = 0;
    farYay.material.opacity = 0;
    document.getElementById('farIsigi').style.opacity = '0';
  }

  // HUD
  document.getElementById('hizGosterge').innerHTML = `${kmSaat}<span id="hizBirim">KM/H</span>`;
  document.getElementById('devirSayi').textContent = Math.round(devir);
  document.getElementById('devirDolu').style.width = `${Math.min(100, devir/7500*100)}%`;
  document.getElementById('vitesHarfler').textContent = vitesAdi;
  document.getElementById('hizKm').textContent = kmSaat;
  document.getElementById('hizMph').textContent = Math.round(kmSaat * 0.621);
  document.getElementById('direksiyonGosterge').style.transform = `rotate(${direksiyonAci*35}deg)`;

  // AYNALAR
  aynalariRender();

  R.render(S, C);
}

window.addEventListener('load', baslat);
