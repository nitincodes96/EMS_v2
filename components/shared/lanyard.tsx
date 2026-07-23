'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, extend, useFrame, type ThreeElement, type ThreeEvent } from '@react-three/fiber';
import { useTexture, Environment, Lightformer } from '@react-three/drei';
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
  type RapierRigidBody,
  type RigidBodyProps
} from '@react-three/rapier';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import * as THREE from 'three';

import { normalizeUploadedAssetUrl } from '@/lib/upload-urls';

extend({ MeshLineGeometry, MeshLineMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    meshLineGeometry: ThreeElement<typeof MeshLineGeometry>;
    meshLineMaterial: ThreeElement<typeof MeshLineMaterial>;
  }
}

// 1x1 transparent pixel — lets useTexture be called unconditionally when a
// front/back image isn't supplied.
const BLANK_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Card dimensions (world units). Kept in sync with the physics collider below.
const CARD_W = 2.7;
const CARD_H = 3.8;
const CARD_D = 0.06;
// True corner radius of the card silhouette (~12% of the width).
const CARD_RADIUS = 0.32;
// Point (in card-local space) where the clip/rope attaches, just above the card's top edge.
const CLIP_TOP = CARD_H / 2 + 0.45;
const TEX_W = 640;
const TEX_H = Math.round((TEX_W * CARD_H) / CARD_W);

type CardTheme = 'dark' | 'light';

interface Palette {
  base: string;
  title: string;
  meta: string;
  ring: string;
  slotBg: string;
  slotText: string;
}

const PALETTES: Record<CardTheme, Palette> = {
  dark: {
    base: '#0f172a',
    title: '#ffffff',
    meta: '#94a3b8',
    ring: 'rgba(255,255,255,0.14)',
    slotBg: '#1e293b',
    slotText: '#e2e8f0'
  },
  light: {
    base: '#ffffff',
    title: '#0f172a',
    meta: '#64748b',
    ring: '#e2e8f0',
    slotBg: '#f1f5f9',
    slotText: '#475569'
  }
};

function initialsOf(text: string): string {
  return (
    text
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

// Centered text with manual letter-spacing (ctx.letterSpacing isn't universal).
function drawTracked(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number) {
  const chars = Array.from(text);
  const widths = chars.map(c => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  let x = cx - total / 2;
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += widths[i] + spacing;
  });
  ctx.textAlign = prevAlign;
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, w: number, h: number) {
  const iw = (img as HTMLImageElement).width;
  const ih = (img as HTMLImageElement).height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawImageContain(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, w: number, h: number) {
  const iw = (img as HTMLImageElement).width;
  const ih = (img as HTMLImageElement).height;
  if (!iw || !ih) return;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

// Rounded-rectangle path — used for the photo slot and the logo slot.
function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// Rounded-rectangle image slot: draws the image if present, otherwise a flat
// swatch with initials. Returns nothing; the caller strokes the border.
function drawSlot(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource | null,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  palette: Palette,
  fit: 'cover' | 'contain'
) {
  ctx.save();
  roundedRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.fillStyle = palette.slotBg;
  ctx.fillRect(x, y, w, h);
  if (img) {
    const draw = fit === 'contain' ? drawImageContain : drawImageCover;
    const inset = fit === 'contain' ? Math.min(w, h) * 0.16 : 0;
    draw(ctx, img, x + inset, y + inset, w - inset * 2, h - inset * 2);
  } else {
    ctx.fillStyle = palette.slotText;
    ctx.font = `600 ${Math.round(Math.min(w, h) * 0.3)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initialsOf(label), x + w / 2, y + h / 2);
  }
  ctx.restore();

  ctx.lineWidth = 4;
  ctx.strokeStyle = palette.ring;
  roundedRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
}

// Rounded-rectangle silhouette of the card itself, in world units.
function cardShape(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + w, y + h - r);
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + h);
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return shape;
}

// ShapeGeometry copies vertex x/y into uv, so remap them into 0..1.
function normalizeShapeUVs(geometry: THREE.BufferGeometry, w: number, h: number) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  }
  uv.needsUpdate = true;
}

interface LanyardProps {
  position?: [number, number, number];
  gravity?: [number, number, number];
  fov?: number;
  transparent?: boolean;
  frontImage?: string | null;
  frontTitle?: string | null;
  frontSubtitle?: string | null;
  backImage?: string | null;
  backTitle?: string | null;
  imageFit?: 'cover' | 'contain';
  theme?: CardTheme;
  strapColor?: string;
  lanyardWidth?: number;
  className?: string;
}

export default function Lanyard({
  position = [0, -0.2, 16.5],
  gravity = [0, -40, 0],
  fov = 22,
  transparent = true,
  frontImage = null,
  frontTitle = null,
  frontSubtitle = null,
  backImage = null,
  backTitle = null,
  imageFit = 'cover',
  theme = 'dark',
  strapColor = '#4f46e5',
  lanyardWidth = 1,
  className
}: LanyardProps) {
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = (): void => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={`h-full w-full ${className ?? ''}`}>
      <Canvas
        camera={{ position, fov }}
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ alpha: transparent }}
        style={{ touchAction: 'none' }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color(0x000000), transparent ? 0 : 1)}
      >
        <ambientLight intensity={Math.PI} />
        <Physics gravity={gravity} timeStep={isMobile ? 1 / 30 : 1 / 60}>
          <Band
            isMobile={isMobile}
            frontImage={frontImage}
            frontTitle={frontTitle}
            frontSubtitle={frontSubtitle}
            backImage={backImage}
            backTitle={backTitle}
            imageFit={imageFit}
            theme={theme}
            strapColor={strapColor}
            lanyardWidth={lanyardWidth}
          />
        </Physics>
        <Environment blur={0.75}>
          <Lightformer intensity={2} color="white" position={[0, -1, 5]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[-1, -1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[1, 1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={10} color="white" position={[-10, 0, 14]} rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
        </Environment>
      </Canvas>
    </div>
  );
}

interface BandProps {
  maxSpeed?: number;
  minSpeed?: number;
  isMobile?: boolean;
  frontImage?: string | null;
  frontTitle?: string | null;
  frontSubtitle?: string | null;
  backImage?: string | null;
  backTitle?: string | null;
  imageFit?: 'cover' | 'contain';
  theme?: CardTheme;
  strapColor?: string;
  lanyardWidth?: number;
}

type LanyardRigidBody = RapierRigidBody & {
  lerped?: THREE.Vector3;
};

function Band({
  maxSpeed = 50,
  minSpeed = 0,
  isMobile = false,
  frontImage = null,
  frontTitle = null,
  frontSubtitle = null,
  backImage = null,
  backTitle = null,
  imageFit = 'cover',
  theme = 'dark',
  strapColor = '#4f46e5',
  lanyardWidth = 1
}: BandProps) {
  const band = useRef<THREE.Mesh<InstanceType<typeof MeshLineGeometry>, InstanceType<typeof MeshLineMaterial>>>(null!);
  const fixed = useRef<RapierRigidBody>(null!);
  const j1 = useRef<LanyardRigidBody>(null!);
  const j2 = useRef<LanyardRigidBody>(null!);
  const j3 = useRef<RapierRigidBody>(null!);
  const card = useRef<RapierRigidBody>(null!);

  const vec = new THREE.Vector3();
  const ang = new THREE.Vector3();
  const rot = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const segmentProps: RigidBodyProps = {
    type: 'dynamic',
    canSleep: true,
    colliders: false,
    angularDamping: 4,
    linearDamping: 4
  };

  const getLerped = (body: LanyardRigidBody): THREE.Vector3 => {
    if (!body.lerped) {
      body.lerped = new THREE.Vector3().copy(body.translation());
    }
    return body.lerped;
  };

  const resolvedFrontImage = normalizeUploadedAssetUrl(frontImage) ?? frontImage;
  const resolvedBackImage = normalizeUploadedAssetUrl(backImage) ?? backImage;

  // useTexture must be called unconditionally; use a blank pixel when an image
  // isn't supplied for a given face, then fall back to a drawn placeholder below.
  const frontTex = useTexture(resolvedFrontImage || BLANK_PIXEL);
  const backTex = useTexture(resolvedBackImage || BLANK_PIXEL);

  const palette = PALETTES[theme];

  // Card body is an extruded rounded rectangle, so the corners are genuinely
  // curved (RoundedBoxGeometry clamps its radius to half the card's depth).
  // The two faces are flat cut-outs of the same silhouette, sitting just
  // outside the body so each can carry its own texture.
  const { bodyGeometry, faceGeometry } = useMemo(() => {
    const shape = cardShape(CARD_W, CARD_H, CARD_RADIUS);
    const body = new THREE.ExtrudeGeometry(shape, { depth: CARD_D, bevelEnabled: false, curveSegments: 24 });
    body.translate(0, 0, -CARD_D / 2);
    const face = new THREE.ShapeGeometry(shape, 24);
    normalizeShapeUVs(face, CARD_W, CARD_H);
    return { bodyGeometry: body, faceGeometry: face };
  }, []);

  const edgeMaterial = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: palette.base, roughness: 0.55, metalness: 0.05 }),
    [palette.base]
  );

  // FRONT — one large photo, username underneath. Nothing else.
  const frontMaterial = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = palette.base;
      ctx.fillRect(0, 0, TEX_W, TEX_H);

      const pad = Math.round(TEX_W * 0.072);
      const photoW = TEX_W - pad * 2;
      const photoH = Math.round(TEX_H * 0.765);
      drawSlot(
        ctx,
        frontImage && frontTex.image ? (frontTex.image as CanvasImageSource) : null,
        frontTitle || '?',
        pad,
        pad,
        photoW,
        photoH,
        photoW * 0.1,
        palette,
        imageFit
      );

      const cx = TEX_W / 2;
      let textY = pad + photoH + 68;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = palette.title;
      ctx.font = '700 40px system-ui, sans-serif';
      ctx.fillText(frontTitle || '', cx, textY);

      if (frontSubtitle) {
        textY += 34;
        ctx.fillStyle = palette.meta;
        ctx.font = '600 18px system-ui, sans-serif';
        drawTracked(ctx, frontSubtitle.toUpperCase(), cx, textY, 2.5);
      }
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 16;
    map.needsUpdate = true;
    // Unlit — the drawn canvas renders as-is, unaffected by scene lighting.
    return new THREE.MeshBasicMaterial({ map });
  }, [frontImage, frontTex, frontTitle, frontSubtitle, imageFit, palette]);

  // BACK — organisation logo in a rounded square, name underneath.
  const backMaterial = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = palette.base;
      ctx.fillRect(0, 0, TEX_W, TEX_H);

      const side = Math.round(TEX_W * 0.5);
      const x = (TEX_W - side) / 2;
      const y = Math.round(TEX_H * 0.28);
      drawSlot(
        ctx,
        backImage && backTex.image ? (backTex.image as CanvasImageSource) : null,
        backTitle || 'Org',
        x,
        y,
        side,
        side,
        side * 0.16,
        palette,
        'contain'
      );

      if (backTitle) {
        ctx.fillStyle = palette.title;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '700 30px system-ui, sans-serif';
        ctx.fillText(backTitle, TEX_W / 2, y + side + 78);
      }
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 16;
    map.needsUpdate = true;
    return new THREE.MeshBasicMaterial({ map });
  }, [backImage, backTex, backTitle, palette]);

  const metalMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.25, metalness: 0.9 }),
    []
  );

  const [curve] = useState(() => {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
    c.curveType = 'chordal';
    return c;
  });
  const [dragged, drag] = useState<false | THREE.Vector3>(false);
  const [hovered, hover] = useState(false);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 0.5]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 0.5]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 0.5]);
  useSphericalJoint(j3, card, [
    [0, 0, 0],
    [0, CLIP_TOP, 0]
  ]);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? 'grabbing' : 'grab';
      return () => {
        document.body.style.cursor = 'auto';
      };
    }
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged && typeof dragged !== 'boolean') {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach(ref => ref.current?.wakeUp());
      card.current?.setNextKinematicTranslation({
        x: vec.x - dragged.x,
        y: vec.y - dragged.y,
        z: vec.z - dragged.z
      });
    }
    if (fixed.current) {
      [j1, j2].forEach(ref => {
        const lerped = getLerped(ref.current);
        const clampedDistance = Math.max(0.1, Math.min(1, lerped.distanceTo(ref.current.translation())));
        lerped.lerp(ref.current.translation(), delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed)));
      });
      curve.points[0].copy(j3.current.translation());
      curve.points[1].copy(getLerped(j2.current));
      curve.points[2].copy(getLerped(j1.current));
      curve.points[3].copy(fixed.current.translation());
      band.current.geometry.setPoints(curve.getPoints(isMobile ? 16 : 32));
      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z }, true);
    }
  });

  return (
    <>
      <group position={[0, 3, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.3, 0, 0]} ref={j1} {...segmentProps} type="dynamic">
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[0.6, 0, 0]} ref={j2} {...segmentProps} type="dynamic">
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[0.9, 0, 0]} ref={j3} {...segmentProps} type="dynamic">
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.2, 0, 0]} ref={card} {...segmentProps} type={dragged ? 'kinematicPosition' : 'dynamic'}>
          <CuboidCollider args={[CARD_W / 2, CARD_H / 2, CARD_D / 2]} />
          <group
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e: ThreeEvent<PointerEvent>) => {
              (e.target as Element).releasePointerCapture(e.pointerId);
              drag(false);
            }}
            onPointerDown={(e: ThreeEvent<PointerEvent>) => {
              (e.target as Element).setPointerCapture(e.pointerId);
              drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation())));
            }}
          >
            <mesh geometry={bodyGeometry} material={edgeMaterial} castShadow receiveShadow />
            <mesh geometry={faceGeometry} material={frontMaterial} position={[0, 0, CARD_D / 2 + 0.002]} />
            <mesh
              geometry={faceGeometry}
              material={backMaterial}
              position={[0, 0, -CARD_D / 2 - 0.002]}
              rotation={[0, Math.PI, 0]}
            />
            {/* Grommet + clip connecting the card to the lanyard */}
            <mesh position={[0, CARD_H / 2, 0]} rotation={[Math.PI / 2, 0, 0]} material={metalMaterial}>
              <torusGeometry args={[0.09, 0.03, 8, 20]} />
            </mesh>
            <mesh position={[0, (CARD_H / 2 + CLIP_TOP) / 2, 0]} material={metalMaterial}>
              <boxGeometry args={[0.16, CLIP_TOP - CARD_H / 2, 0.05]} />
            </mesh>
          </group>
        </RigidBody>
      </group>
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial
          args={[{ resolution: new THREE.Vector2(1, 1) }]}
          color={strapColor}
          depthTest={false}
          resolution={isMobile ? [1000, 2000] : [1000, 1000]}
          repeat={[-4, 1]}
          lineWidth={lanyardWidth}
        />
      </mesh>
    </>
  );
}