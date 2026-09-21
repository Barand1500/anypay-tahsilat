import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  SphereGeometry,
  MeshBasicMaterial,
  Color,
  Mesh,
  Group,
  InstancedMesh,
  Matrix4,
  Raycaster,
  Vector2,
  TubeGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  Vector3,
  CanvasTexture,
  SRGBColorSpace,
  type Object3D,
} from 'three';
import { geoEquirectangular, geoPath } from 'd3-geo';

type Rgba = { r: number; g: number; b: number; a: number };

function parseColorToRgba(input: string): Rgba {
  if (!input || input.trim() === '') return { r: 0, g: 0, b: 0, a: 0 };
  const str = input.trim();
  const rgbaMatch = str.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i,
  );
  if (rgbaMatch) {
    const r = Math.max(0, Math.min(255, parseFloat(rgbaMatch[1]))) / 255;
    const g = Math.max(0, Math.min(255, parseFloat(rgbaMatch[2]))) / 255;
    const b = Math.max(0, Math.min(255, parseFloat(rgbaMatch[3]))) / 255;
    const a =
      rgbaMatch[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(rgbaMatch[4]))) : 1;
    return { r, g, b, a };
  }
  const hex = str.replace(/^#/, '');
  if (hex.length === 8) {
    return {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
      a: parseInt(hex.slice(6, 8), 16) / 255,
    };
  }
  if (hex.length === 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
      a: 1,
    };
  }
  if (hex.length === 4) {
    return {
      r: parseInt(hex[0] + hex[0], 16) / 255,
      g: parseInt(hex[1] + hex[1], 16) / 255,
      b: parseInt(hex[2] + hex[2], 16) / 255,
      a: parseInt(hex[3] + hex[3], 16) / 255,
    };
  }
  if (hex.length === 3) {
    return {
      r: parseInt(hex[0] + hex[0], 16) / 255,
      g: parseInt(hex[1] + hex[1], 16) / 255,
      b: parseInt(hex[2] + hex[2], 16) / 255,
      a: 1,
    };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

function mapLinear(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  if (inMax === inMin) return outMin;
  const t = (value - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

function mapSpeedUiToInternal(ui: number) {
  if (ui === 0) return 0;
  return mapLinear(Math.max(0, Math.min(10, ui)), 0, 10, 0, 0.9);
}
function mapDensityUiToSpacing(ui: number) {
  return mapLinear(Math.max(1, Math.min(10, ui)), 1, 10, 24, 8);
}
function mapScaleUiToMultiplier(ui: number) {
  return mapLinear(Math.max(1, Math.min(20, ui)), 1, 20, 0.2, 2);
}
function mapDotSizeUiToMultiplier(ui: number) {
  return mapLinear(Math.max(1, Math.min(10, ui)), 1, 10, 0.1, 0.5);
}
function mapMarkerDotSizeUiToMultiplier(ui: number) {
  return mapLinear(Math.max(0, Math.min(100, ui)), 0, 100, 0.1, 2.5);
}
function normalizeSmoothing(ui: number) {
  return Math.max(0, Math.min(1, ui / 10));
}
function mapDragSpeedUiToSensitivity(ui: number) {
  return mapLinear(Math.max(0, Math.min(10, ui)), 0, 10, 0.001, 0.02);
}
function mapDetailToStepSize(ui: number) {
  return mapLinear(Math.max(1, Math.min(10, ui)), 1, 10, 10, 1);
}

function simplifyRing(ring: number[][], detail: number): number[][] {
  if (ring.length < 2) return ring;
  if (detail >= 10) return ring;
  const stepSize = Math.max(1, Math.floor(mapDetailToStepSize(detail)));
  const simplified: number[][] = [];
  simplified.push(ring[0]);
  for (let i = stepSize; i < ring.length - 1; i += stepSize) {
    simplified.push(ring[Math.min(i, ring.length - 1)]);
  }
  const lastPoint = ring[ring.length - 1];
  const firstPoint = ring[0];
  const isClosed =
    Math.abs(lastPoint[0] - firstPoint[0]) < 1e-4 &&
    Math.abs(lastPoint[1] - firstPoint[1]) < 1e-4;
  if (!isClosed) simplified.push(lastPoint);
  return simplified.length >= 2 ? simplified : ring;
}

function latLngToPosition(lat: number, lng: number) {
  const latRad = lat * (Math.PI / 180);
  const lngRad = lng * (Math.PI / 180);
  return {
    x: Math.cos(latRad) * Math.sin(lngRad),
    y: Math.sin(latRad),
    z: Math.cos(latRad) * Math.cos(lngRad),
  };
}

export type GlobeMarker = { lat: number; lng: number };

export type GlobeProps = {
  speed?: number;
  smoothing?: number;
  dots?: { color: string; size: number; density: number; allDots: boolean };
  fill?: 'dots' | 'solid';
  fillColor?: string;
  scale?: number;
  stopOnHover?: boolean;
  markerConfig?: { markers: GlobeMarker[]; color: string; size: number };
  direction?: 'left' | 'right';
  initialLatitude?: number;
  initialLongitude?: number;
  oceanColor?: string;
  outlineColor?: string;
  showOutline?: boolean;
  graticuleColor?: string;
  showGrid?: boolean;
  outlineWidth?: number;
  dragSpeed?: number;
  detail?: number;
  style?: CSSProperties;
};

/** Originkit Globe — three.js nokta küre, sürükle / momentum / hover durdur */
export default function Globe({
  speed = 2,
  smoothing = 8,
  dots = { color: '#ffffff', size: 5, density: 8, allDots: false },
  fill = 'dots',
  fillColor = '#ffffff',
  scale = 8,
  stopOnHover = true,
  markerConfig = { markers: [], color: '#00f7ff', size: 40 },
  direction = 'left',
  initialLatitude = 23,
  initialLongitude = -23,
  oceanColor = '#000000',
  outlineColor = '#ffffff',
  showOutline = true,
  graticuleColor = '#D4D4D4',
  showGrid = true,
  outlineWidth = 1,
  dragSpeed = 5,
  detail = 5,
  style,
}: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const dotColor = dots.color;
  const dotSize = dots.size;
  const density = dots.density;
  const allDots = dots.allDots;
  const gridWidth = 1;
  const smoothingN = normalizeSmoothing(smoothing);

  const baseRotationSpeed = mapSpeedUiToInternal(speed);
  const rotationSpeed = direction === 'left' ? -baseRotationSpeed : baseRotationSpeed;
  const dotSpacing = mapDensityUiToSpacing(density);
  const dotSizeMultiplier = mapDotSizeUiToMultiplier(dotSize);
  const markerRadiusMultiplier = mapMarkerDotSizeUiToMultiplier(markerConfig.size);
  const scaleMultiplier = mapScaleUiToMultiplier(scale);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const containerWidth = container.clientWidth || container.offsetWidth || 800;
    const containerHeight = container.clientHeight || container.offsetHeight || 600;

    const scene = new Scene();
    const camera = new PerspectiveCamera(50, containerWidth / containerHeight, 0.1, 1e3);
    const baseRadius = 1;
    const globeRadius = baseRadius * scaleMultiplier;
    const cameraDistance = 2.5 / scaleMultiplier;
    camera.position.set(0, 0, cameraDistance);
    camera.lookAt(0, 0, 0);

    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerWidth, containerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.opacity = '0';
    canvas.style.visibility = 'hidden';
    canvas.style.cursor = 'grab';
    container.appendChild(canvas);

    const oceanRgba = parseColorToRgba(oceanColor);
    const outlineRgba = parseColorToRgba(outlineColor);
    const dotRgba = parseColorToRgba(dotColor);
    const graticuleRgba = parseColorToRgba(graticuleColor);
    const fillRgba = parseColorToRgba(fillColor);
    const resolvedMarkerColor = markerConfig.color;

    const oceanGeometry = new SphereGeometry(globeRadius, 64, 64);
    const oceanMaterial = new MeshBasicMaterial({
      color: new Color(oceanColor || 0x000000),
      transparent: oceanRgba.a < 1 || oceanRgba.a === 0,
      opacity: oceanRgba.a,
    });
    const oceanMesh = new Mesh(oceanGeometry, oceanMaterial);

    const continentOutlineGroup = new Group();
    const graticuleGroup = new Group();

    if (showGrid && graticuleColor && graticuleRgba.a > 0) {
      const graticuleMaterial = new MeshBasicMaterial({
        color: new Color(graticuleColor),
        transparent: graticuleRgba.a < 1 || graticuleRgba.a === 0,
        opacity: graticuleRgba.a,
      });
      const gridSpacing = 15;
      for (let lat = -90; lat <= 90; lat += gridSpacing) {
        const points: Vector3[] = [];
        for (let i = 0; i <= 64; i++) {
          const lng = (i / 64) * 360 - 180;
          const pos = latLngToPosition(lat, lng);
          points.push(
            new Vector3(pos.x * globeRadius, pos.y * globeRadius, pos.z * globeRadius),
          );
        }
        if (points.length >= 2) {
          const curve = new CatmullRomCurve3(points);
          const tubeGeometry = new TubeGeometry(curve, points.length * 2, (gridWidth / 10) * 0.01, 8, false);
          graticuleGroup.add(new Mesh(tubeGeometry, graticuleMaterial));
        }
      }
      for (let lng = -180; lng < 180; lng += gridSpacing) {
        const points: Vector3[] = [];
        for (let i = 0; i <= 64; i++) {
          const lat = (i / 64) * 180 - 90;
          const pos = latLngToPosition(lat, lng);
          points.push(
            new Vector3(pos.x * globeRadius, pos.y * globeRadius, pos.z * globeRadius),
          );
        }
        if (points.length >= 2) {
          const curve = new CatmullRomCurve3(points);
          const tubeGeometry = new TubeGeometry(curve, points.length * 2, (gridWidth / 10) * 0.01, 8, false);
          graticuleGroup.add(new Mesh(tubeGeometry, graticuleMaterial));
        }
      }
    }

    let dotInstances: InstancedMesh | Mesh | null = null;
    let markerMeshes: Object3D[] = [];

    const globeGroup = new Group();
    const initialLongitudeRad = (initialLongitude * Math.PI) / 180;
    const initialLatitudeRad = (initialLatitude * Math.PI) / 180;
    globeGroup.rotation.y = initialLongitudeRad;
    globeGroup.rotation.x = initialLatitudeRad;
    scene.add(globeGroup);
    globeGroup.add(oceanMesh);
    if (showGrid && graticuleColor && graticuleRgba.a > 0) globeGroup.add(graticuleGroup);
    globeGroup.add(continentOutlineGroup);

    const updateMarkers = () => {
      markerMeshes.forEach((obj) => {
        globeGroup.remove(obj);
        obj.traverse((child) => {
          const m = child as Mesh;
          if (m.geometry) m.geometry.dispose();
          if (m.material) {
            const mat = m.material;
            if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
            else mat.dispose();
          }
        });
      });
      markerMeshes = [];
      if (!markerConfig.markers?.length) return;

      const s = 0.012 * markerRadiusMultiplier;
      const pinColor = new Color(resolvedMarkerColor || '#FF3B5C');
      const headMat = new MeshBasicMaterial({ color: pinColor });
      const needleMat = new MeshBasicMaterial({ color: new Color('#f0f0f0') });

      markerConfig.markers.forEach((marker) => {
        if (!marker || typeof marker.lat !== 'number' || typeof marker.lng !== 'number') return;
        const pos = latLngToPosition(marker.lat, marker.lng);
        const outward = new Vector3(pos.x, pos.y, pos.z).normalize();

        // Toplu iğne — uç yüzeyde, yuvarlak baş dışarıda
        const pin = new Group();

        const tip = new Mesh(new ConeGeometry(s * 0.4, s * 1.65, 14), headMat.clone());
        tip.rotation.x = Math.PI;
        tip.position.y = s * 0.82;
        pin.add(tip);

        const head = new Mesh(new SphereGeometry(s * 0.55, 16, 16), headMat.clone());
        head.position.y = s * 1.85;
        pin.add(head);

        const stem = new Mesh(new ConeGeometry(s * 0.11, s * 0.6, 6), needleMat.clone());
        stem.rotation.x = Math.PI;
        stem.position.y = s * 0.25;
        pin.add(stem);

        pin.position.set(pos.x * globeRadius, pos.y * globeRadius, pos.z * globeRadius);
        pin.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), outward);
        globeGroup.add(pin);
        markerMeshes.push(pin);
      });
    };

    const loadWorldData = async () => {
      try {
        const response = await fetch(
          'https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/50m/physical/ne_50m_land.json',
        );
        if (!response.ok) throw new Error('Failed to load land data');
        const landFeatures = await response.json();

        while (continentOutlineGroup.children.length > 0) {
          continentOutlineGroup.remove(continentOutlineGroup.children[0]);
        }

        if (showOutline && outlineColor && outlineRgba.a > 0) {
          const outlineMaterial = new MeshBasicMaterial({
            color: new Color(outlineColor),
            transparent: outlineRgba.a < 1,
            opacity: outlineRgba.a,
            depthTest: true,
            depthWrite: true,
          });

          const processRing = (ring: number[][]) => {
            if (ring.length < 2) return;
            const simplifiedRing = simplifyRing(ring, detail);
            const points: Vector3[] = [];
            simplifiedRing.forEach((coord) => {
              const [lng, lat] = coord;
              const pos = latLngToPosition(lat, lng);
              points.push(
                new Vector3(pos.x * globeRadius, pos.y * globeRadius, pos.z * globeRadius),
              );
            });
            if (points.length > 0 && points[0].distanceTo(points[points.length - 1]) > 0.001) {
              points.push(points[0].clone());
            }
            if (points.length >= 2) {
              const curve = new CatmullRomCurve3(points);
              const tubeGeometry = new TubeGeometry(
                curve,
                points.length * 2,
                (outlineWidth / 10) * 0.01,
                8,
                false,
              );
              continentOutlineGroup.add(new Mesh(tubeGeometry, outlineMaterial));
            }
          };

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          landFeatures.features.forEach((feature: any) => {
            const featureType =
              feature.properties?.featurecla || feature.properties?.type || '';
            const featureName = feature.properties?.name || '';
            if (
              /graticule|grid|line/i.test(featureType) ||
              /graticule|grid|line/i.test(featureName)
            ) {
              return;
            }
            const geometry = feature.geometry;
            if (!geometry?.coordinates) return;
            if (geometry.type === 'Polygon' && geometry.coordinates.length > 0) {
              processRing(geometry.coordinates[0]);
            } else if (geometry.type === 'MultiPolygon') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              geometry.coordinates.forEach((polygon: any) => {
                if (polygon.length > 0) processRing(polygon[0]);
              });
            }
          });
        }

        const bitmapWidth = 2048;
        const bitmapHeight = 1024;
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = bitmapWidth;
        offscreenCanvas.height = bitmapHeight;
        const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Canvas not supported');
        const projection = geoEquirectangular().fitSize([bitmapWidth, bitmapHeight], {
          type: 'Sphere',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        const pathGenerator = geoPath().projection(projection).context(ctx);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, bitmapWidth, bitmapHeight);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        landFeatures.features.forEach((feature: any) => {
          pathGenerator(feature);
        });
        ctx.fill();
        const imageData = ctx.getImageData(0, 0, bitmapWidth, bitmapHeight);
        const pixels = imageData.data;
        const isOnLand = (lng: number, lat: number) => {
          const x = Math.round(((lng + 180) / 360) * bitmapWidth) % bitmapWidth;
          const y = Math.round(((90 - lat) / 180) * bitmapHeight);
          const clampedY = Math.max(0, Math.min(bitmapHeight - 1, y));
          const idx = (clampedY * bitmapWidth + x) * 4;
          return pixels[idx] > 128;
        };

        if (fill === 'solid') {
          const texW = 1024;
          const texH = 512;
          const fillCanvas = document.createElement('canvas');
          fillCanvas.width = texW;
          fillCanvas.height = texH;
          const fctx = fillCanvas.getContext('2d')!;
          const img = fctx.createImageData(texW, texH);
          const data = img.data;
          const fr = Math.round(fillRgba.r * 255);
          const fg = Math.round(fillRgba.g * 255);
          const fb = Math.round(fillRgba.b * 255);
          const fa = Math.round((fillRgba.a || 1) * 255);
          for (let ty = 0; ty < texH; ty++) {
            for (let tx = 0; tx < texW; tx++) {
              const u = tx / texW;
              const v = ty / texH;
              let lng = (u - 0.25) * 360;
              lng = ((((lng + 180) % 360) + 360) % 360) - 180;
              const lat = (v - 0.5) * 180;
              const onLand = allDots || isOnLand(lng, lat);
              const idx = (ty * texW + tx) * 4;
              if (onLand) {
                data[idx] = fr;
                data[idx + 1] = fg;
                data[idx + 2] = fb;
                data[idx + 3] = fa;
              } else {
                data[idx + 3] = 0;
              }
            }
          }
          fctx.putImageData(img, 0, 0);
          const fillTexture = new CanvasTexture(fillCanvas);
          fillTexture.flipY = false;
          fillTexture.needsUpdate = true;
          const fillGeometry = new SphereGeometry(globeRadius * 1.002, 64, 64);
          const fillMaterial = new MeshBasicMaterial({ map: fillTexture, transparent: true });
          dotInstances = new Mesh(fillGeometry, fillMaterial);
          globeGroup.add(dotInstances);
        } else {
          const dotCoordinates: number[][] = [];
          const baseStep = dotSpacing * 0.08;
          for (let lat = -90; lat <= 90; lat += baseStep) {
            const latRad = (Math.abs(lat) * Math.PI) / 180;
            const cosLat = Math.cos(latRad);
            const lngStep = cosLat > 0.01 ? baseStep / Math.max(0.3, cosLat) : 360;
            for (let lng = -180; lng < 180; lng += lngStep) {
              if (allDots || isOnLand(lng, lat)) dotCoordinates.push([lng, lat]);
            }
          }

          if (dotCoordinates.length > 0) {
            const dotGeometry = new SphereGeometry(0.01 * dotSizeMultiplier, 4, 4);
            const dotMaterial = new MeshBasicMaterial({
              color: new Color(dotColor || '#999'),
              transparent: dotRgba.a < 1 || dotRgba.a === 0,
              opacity: dotRgba.a,
            });
            const instanced = new InstancedMesh(dotGeometry, dotMaterial, dotCoordinates.length);
            const matrix = new Matrix4();
            for (let i = 0; i < dotCoordinates.length; i++) {
              const [lng, lat] = dotCoordinates[i];
              const pos = latLngToPosition(lat, lng);
              matrix.makeScale(1, 1, 1);
              matrix.setPosition(pos.x * globeRadius, pos.y * globeRadius, pos.z * globeRadius);
              instanced.setMatrixAt(i, matrix);
            }
            instanced.instanceMatrix.needsUpdate = true;
            dotInstances = instanced;
            globeGroup.add(dotInstances);
          }
        }

        updateMarkers();
        renderer.render(scene, camera);
        canvas.style.opacity = '1';
        canvas.style.visibility = 'visible';
      } catch {
        setError('Dünya verisi yüklenemedi');
      }
    };

    const rotation = { x: initialLongitudeRad, y: initialLatitudeRad };
    const targetRotation = { x: initialLongitudeRad, y: initialLatitudeRad };
    const velocity = { x: 0, y: 0 };
    let isDragging = false;
    let isHovering = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let animationFrameId: number | null = null;
    const lerpFactor = smoothingN === 0 ? 1 : mapLinear(smoothingN, 0, 1, 0.4, 0.03);
    const velocityDecay = mapLinear(smoothingN, 0, 1, 0.7, 0.96);

    const animate = () => {
      let needsRender = false;
      const threshold = 0.01;
      if (!isDragging && rotationSpeed !== 0 && (!stopOnHover || !isHovering)) {
        targetRotation.x += rotationSpeed * 0.01;
      }
      if (!isDragging && smoothingN > 0) {
        if (Math.abs(velocity.x) > threshold || Math.abs(velocity.y) > threshold) {
          targetRotation.x += velocity.x;
          targetRotation.y += velocity.y;
          targetRotation.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetRotation.y));
          velocity.x *= velocityDecay;
          velocity.y *= velocityDecay;
        } else {
          velocity.x = 0;
          velocity.y = 0;
        }
      }
      const dx = targetRotation.x - rotation.x;
      const dy = targetRotation.y - rotation.y;
      if (
        Math.abs(dx) > threshold ||
        Math.abs(dy) > threshold ||
        rotationSpeed !== 0 ||
        isDragging
      ) {
        rotation.x += dx * lerpFactor;
        rotation.y += dy * lerpFactor;
        rotation.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotation.y));
        needsRender = true;
      }
      if (needsRender || rotationSpeed !== 0 || isDragging) {
        globeGroup.rotation.y = rotation.x;
        globeGroup.rotation.x = rotation.y;
        renderer.render(scene, camera);
      }
      const hasVelocity = Math.abs(velocity.x) > threshold || Math.abs(velocity.y) > threshold;
      const hasLerpDelta = Math.abs(dx) > threshold || Math.abs(dy) > threshold;
      if (isDragging || rotationSpeed !== 0 || hasVelocity || hasLerpDelta) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        animationFrameId = null;
      }
    };

    const startAnimation = () => {
      if (animationFrameId === null) animationFrameId = requestAnimationFrame(animate);
    };
    if (rotationSpeed !== 0) startAnimation();

    const handleMouseDown = (event: MouseEvent) => {
      isDragging = true;
      canvas.style.cursor = 'grabbing';
      velocity.x = 0;
      velocity.y = 0;
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      startAnimation();
      const handleMouseMoveDrag = (moveEvent: MouseEvent) => {
        const sensitivity = mapDragSpeedUiToSensitivity(dragSpeed);
        const dx = moveEvent.clientX - lastMouseX;
        const dy = moveEvent.clientY - lastMouseY;
        targetRotation.x += dx * sensitivity;
        targetRotation.y += dy * sensitivity;
        targetRotation.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetRotation.y));
        velocity.x = dx * sensitivity * 0.3;
        velocity.y = dy * sensitivity * 0.3;
        lastMouseX = moveEvent.clientX;
        lastMouseY = moveEvent.clientY;
      };
      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMoveDrag);
        document.removeEventListener('mouseup', handleMouseUp);
        isDragging = false;
        canvas.style.cursor = 'grab';
      };
      document.addEventListener('mousemove', handleMouseMoveDrag);
      document.addEventListener('mouseup', handleMouseUp);
    };
    canvas.addEventListener('mousedown', handleMouseDown);

    const raycaster = new Raycaster();
    const mouse = new Vector2();
    const handleMouseMove = (event: MouseEvent) => {
      if (!stopOnHover) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      isHovering = raycaster.intersectObject(oceanMesh).length > 0;
    };
    canvas.addEventListener('mousemove', handleMouseMove);

    const resizeObserver = new ResizeObserver(() => {
      const newWidth = container.clientWidth || container.offsetWidth || 800;
      const newHeight = container.clientHeight || container.offsetHeight || 600;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
      camera.position.set(0, 0, 2.5 / scaleMultiplier);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    });
    resizeObserver.observe(container);

    void loadWorldData();

    return () => {
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      resizeObserver.disconnect();
      renderer.dispose();
      if (canvas.parentNode === container) container.removeChild(canvas);
    };
  }, [
    speed,
    smoothing,
    fill,
    fillColor,
    allDots,
    density,
    dotSize,
    dotColor,
    scale,
    stopOnHover,
    markerConfig,
    direction,
    initialLatitude,
    initialLongitude,
    oceanColor,
    outlineColor,
    showOutline,
    graticuleColor,
    showGrid,
    outlineWidth,
    dragSpeed,
    detail,
    rotationSpeed,
    dotSpacing,
    dotSizeMultiplier,
    markerRadiusMultiplier,
    scaleMultiplier,
  ]);

  const containerStyle: CSSProperties = {
    ...style,
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (error) {
    return (
      <div style={containerStyle}>
        <p className="px-4 text-center text-sm text-white/70">{error}</p>
      </div>
    );
  }

  return <div ref={containerRef} style={containerStyle} />;
}
