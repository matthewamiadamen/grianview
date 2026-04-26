'use client';

import { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import SunCalc from 'suncalc';

const BELFAST_LAT = 54.597;
const BELFAST_LNG = -5.930;
const LAT_M = 111320;

// ── Coordinate helpers ────────────────────────────────────────────────

function project(coords: [number, number][], centLat: number, centLng: number): [number, number][] {
  const lngM = LAT_M * Math.cos(centLat * Math.PI / 180);
  return coords.map(([lng, lat]) => [
    (lng - centLng) * lngM,
    (lat - centLat) * LAT_M,
  ]);
}

function getBBox(pts: [number, number][]) {
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

function polyArea(pts: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  return Math.abs(a) / 2;
}

// ── Geometry builders ─────────────────────────────────────────────────


// All roof functions take half-dimensions centred at origin so walls + roof always align

function makeGabledRoof(hw: number, hd: number, wallH: number, slopeRad: number, ridgeAlongX: boolean): THREE.BufferGeometry {
  let verts: number[], faces: number[];
  if (ridgeAlongX) {
    // Ridge E-W: slopes face N and S — typical terrace facing street
    const ridgeH = wallH + hd * Math.tan(slopeRad);
    verts = [
      -hw, ridgeH, 0,    hw, ridgeH, 0,    // 0,1 ridge
      -hw, wallH, -hd,   hw, wallH, -hd,   // 2,3 front (south) eave
      -hw, wallH,  hd,   hw, wallH,  hd,   // 4,5 back (north) eave
    ];
    faces = [0,3,2, 0,1,3,  0,4,5, 0,5,1,  0,2,4,  1,5,3];
  } else {
    // Ridge N-S: slopes face E and W
    const ridgeH = wallH + hw * Math.tan(slopeRad);
    verts = [
      0, ridgeH, -hd,    0, ridgeH,  hd,   // 0,1 ridge
      -hw, wallH, -hd,   hw, wallH, -hd,   // 2,3 south eave
      -hw, wallH,  hd,   hw, wallH,  hd,   // 4,5 north eave
    ];
    faces = [0,2,3,  1,5,4,  0,4,2, 0,1,4,  0,3,5, 0,5,1];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(faces);
  geo.computeVertexNormals();
  return geo;
}

function makeHipRoof(hw: number, hd: number, wallH: number, slopeRad: number): THREE.BufferGeometry {
  const apexH = wallH + Math.min(hw, hd) * Math.tan(slopeRad);
  const verts = [
    -hw, wallH, -hd,   hw, wallH, -hd,
     hw, wallH,  hd,  -hw, wallH,  hd,
      0, apexH,    0,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex([0,1,4, 1,2,4, 2,3,4, 3,0,4]);
  geo.computeVertexNormals();
  return geo;
}

function buildRoof(w: number, d: number, wallH: number, slopeDeg: number): THREE.BufferGeometry {
  const hw = w / 2, hd = d / 2;
  const slopeRad = Math.max(slopeDeg, 18) * Math.PI / 180;
  const ar = w / d;
  if (slopeDeg < 4) {
    const geo = new THREE.PlaneGeometry(w, d);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, wallH, 0);
    return geo;
  }
  if (ar > 0.88 && ar < 1.12) return makeHipRoof(hw, hd, wallH, slopeRad);
  return makeGabledRoof(hw, hd, wallH, slopeRad, w > d);
}

function getSunDirection(date: Date): { dir: THREE.Vector3; isDaylight: boolean } {
  const pos = SunCalc.getPosition(date, BELFAST_LAT, BELFAST_LNG);
  const az = (pos.azimuth * 180 / Math.PI + 180 + 360) % 360;
  const alt = pos.altitude * 180 / Math.PI;
  const azRad = az * Math.PI / 180;
  const altRad = alt * Math.PI / 180;
  return {
    dir: new THREE.Vector3(
      Math.sin(azRad) * Math.cos(altRad),
      Math.sin(altRad),
      Math.cos(azRad) * Math.cos(altRad),
    ).normalize(),
    isDaylight: alt > 1,
  };
}

// ── Main component ────────────────────────────────────────────────────

interface BuildingRendererProps {
  polygon: GeoJSON.Polygon;
  centroid: { lat: number; lng: number };
  aspectDeg: number;
  slopeDeg: number;
  height?: number;
}

export default function BuildingRenderer({ polygon, centroid, aspectDeg, slopeDeg, height = 220 }: BuildingRendererProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const sunSphereRef = useRef<THREE.Mesh | null>(null);
  const frameRef = useRef<number>(0);

  const { wallGeo, roofGeo, size, wallH, w, d } = useMemo(() => {
    const coords = polygon.coordinates[0] as [number, number][];
    const pts = project(coords.slice(0, -1), centroid.lat, centroid.lng);
    const bb = getBBox(pts);
    const w = bb.maxX - bb.minX;
    const d = bb.maxZ - bb.minZ;
    const size = Math.max(w, d);
    const wallH = 5.5;

    // Box walls — always align perfectly with roof
    const wallGeo = new THREE.BoxGeometry(w, wallH, d);
    wallGeo.translate(0, wallH / 2, 0);

    const roofGeo = buildRoof(w, d, wallH, slopeDeg);
    return { wallGeo, roofGeo, size, wallH, w, d };
  }, [polygon, centroid, slopeDeg]);

  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;

    const W = container.clientWidth, H = height;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0xf4f3f0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 200);
    const dist = size * 2.5;
    camera.position.set(dist * 0.5, size * 0.9 + wallH * 0.4, dist * 0.95);
    camera.lookAt(0, wallH * 0.5, 0);

    // Clean, neutral lighting — no warm tones
    const ambient = new THREE.AmbientLight(0xffffff, 0.80);
    scene.add(ambient);

    // Fill from camera side — ensures no face is fully black
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(dist * 0.5, size * 0.9 + wallH * 0.4, dist * 0.95);
    scene.add(fill);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 80;
    sunLight.shadow.camera.left = -20;
    sunLight.shadow.camera.right = 20;
    sunLight.shadow.camera.top = 20;
    sunLight.shadow.camera.bottom = -20;
    sunLight.shadow.bias = -0.001;
    scene.add(sunLight);
    scene.add(sunLight.target);
    sunLightRef.current = sunLight;

    // Sun sphere
    const sunSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
    );
    scene.add(sunSphere);
    sunSphereRef.current = sunSphere;

    // Walls
    // Walls — clean light grey, architectural massing style
    const wallMesh = new THREE.Mesh(wallGeo, new THREE.MeshLambertMaterial({ color: 0xe8e7e3 }));
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    scene.add(wallMesh);

    // Roof — one step darker so it reads as distinct
    const roofMesh = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({
      color: 0xc8c5bf,
      side: THREE.DoubleSide,
    }));
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    scene.add(roofMesh);

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 5, size * 5),
      new THREE.MeshLambertMaterial({ color: 0xeeecea })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    // Animate — update sun every frame but only recompute direction every ~60s
    let lastSunUpdate = 0;
    let sunDir = getSunDirection(new Date());

    const animate = (time: number) => {
      frameRef.current = requestAnimationFrame(animate);
      if (time - lastSunUpdate > 60000) {
        sunDir = getSunDirection(new Date());
        lastSunUpdate = time;
      }
      const { dir, isDaylight } = sunDir;
      const sunDist = 28;
      sunLight.position.copy(dir.clone().multiplyScalar(sunDist));
      sunLight.target.position.set(0, 0, 0);
      sunLight.target.updateMatrixWorld();
      sunLight.intensity = isDaylight ? 1.4 : 0;
      sunSphere.position.copy(dir.clone().multiplyScalar(22));
      sunSphere.visible = isDaylight;
      renderer.render(scene, camera);
    };
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [wallGeo, roofGeo, size, wallH]);

  return (
    <div
      ref={canvasRef}
      className="w-full border-b border-border-default overflow-hidden"
      style={{ height, background: '#f4f3f0' }}
    />
  );
}
