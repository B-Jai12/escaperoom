import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { FxStore } from "./engine";
import { DOOR_WIDTH, DOOR_HEIGHT, DOOR_Z, DOOR_FRAME_THICK, DOOR_LEAF_THICK, makeMetalTexture, makePlateTexture } from "./engine";

type Props = {
  index: number;
  doorNumber?: number;
  x: number;
  fx: FxStore;
  onPick: (index: number) => void;
  onHover: (index: number) => void;
  onUnhover: (index: number) => void;
};

const BOLTS: { x: number; y: number; rz: number }[] = [
  { x: 0.0, y: DOOR_HEIGHT / 2 - 0.24, rz: Math.PI / 2 },
  { x: -0.5, y: -DOOR_HEIGHT / 2 + 0.26, rz: Math.PI / 2 },
  { x: DOOR_WIDTH / 2 - 0.06, y: 0.05, rz: 0 },
  { x: DOOR_WIDTH / 2 - 0.06, y: DOOR_HEIGHT / 2 - 0.42, rz: 0 },
];

export default function MechanicalDoor({ index, doorNumber, x, fx, onPick, onHover, onUnhover }: Props) {
  const actualDoorNum = doorNumber ?? (index + 1);
  const group = useRef<THREE.Group>(null!);
  const pivot = useRef<THREE.Group>(null!);
  const leafRef = useRef<THREE.Mesh>(null!);
  const leafMatRef = useRef<THREE.MeshStandardMaterial>(null!);
  const interiorGlowRef = useRef<THREE.MeshBasicMaterial>(null!);
  const beamRef = useRef<THREE.Mesh>(null!);
  const lampRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const lampLightRef = useRef<THREE.PointLight>(null!);
  const boltRefs = useRef<(THREE.Mesh | null)[]>([]);
  const fogRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const plateMatRef = useRef<THREE.MeshBasicMaterial>(null!);

  const metalTex = useMemo(() => makeMetalTexture(), []);
  const plateTex = useMemo(() => makePlateTexture(actualDoorNum - 1), [actualDoorNum]);

  const materials = useMemo(() => {
    // Richer, tactile materials with clear surface definition
    const frameMat = new THREE.MeshStandardMaterial({
      color: "#3a3631",
      roughness: 0.58,
      metalness: 0.38,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      map: metalTex,
      color: "#9c968e",
      roughness: 0.48,
      metalness: 0.32,
    });
    const innerPanelMat = new THREE.MeshStandardMaterial({
      color: "#282522",
      roughness: 0.7,
      metalness: 0.25,
    });
    const boltMat = new THREE.MeshStandardMaterial({
      color: "#858079",
      roughness: 0.32,
      metalness: 0.75,
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: "#060504", roughness: 0.9, metalness: 0 });
    return { frameMat, leafMat, innerPanelMat, boltMat, darkMat };
  }, [metalTex]);

  useFrame(({ clock }, dt) => {
    const d = fx.doors[index];
    const s = d.shake;
    const t = clock.getElapsedTime();
    const jx = Math.sin(t * 47) * 0.012 * s;
    const jy = Math.cos(t * 39) * 0.008 * s;
    const jz = Math.sin(t * 53 + 1.3) * 0.01 * s;
    const doorZ = DOOR_Z[index];
    group.current.position.set(x + jx, jy, doorZ + jz);
    group.current.rotation.z = Math.sin(t * 29) * 0.0016 * s;

    // hinge at the leaf's left edge
    pivot.current.rotation.y = d.rotationY;

    // interior room glow
    const glow = Math.max(d.interiorGlow, d.breachGlow);
    interiorGlowRef.current.opacity = 0.2 + glow * 0.8;

    // bolts retract
    boltRefs.current.forEach((b, i) => {
      if (!b) return;
      b.position.z = d.boltOut[i] * 0.16;
      b.visible = d.boltOut[i] < 1;
    });

    // lamps: 0 red / 1 amber / 2 green-gold
    lampRefs.current.forEach((m) => {
      if (!m) return;
      const col =
        d.lampLevel >= 2 ? new THREE.Color("#ffd494") : d.lampLevel >= 1 ? new THREE.Color("#ffb454") : new THREE.Color("#ff3020");
      m.color.lerp(col, Math.min(1, dt * 9));
      m.emissive.lerp(col, Math.min(1, dt * 9));
      const blinkAbout = d.lampLevel < 1 ? (Math.sin(t * 18) * 0.45 + 0.55) : 1;
      m.emissiveIntensity = blinkAbout * (1.2 + d.lampLevel * 0.8);
    });

    if (lampLightRef.current) {
      const col =
        d.lampLevel >= 2 ? new THREE.Color("#ffd494") : d.lampLevel >= 1 ? new THREE.Color("#ffb454") : new THREE.Color("#ff3020");
      lampLightRef.current.color.lerp(col, Math.min(1, dt * 9));
      const blinkAbout = d.lampLevel < 1 ? (Math.sin(t * 18) * 0.4 + 0.6) : 1;
      lampLightRef.current.intensity = blinkAbout * (1.0 + d.lampLevel * 0.8);
    }

    // scan beam - sweeps the door face
    if (beamRef.current) {
      beamRef.current.visible = d.scanOn;
      beamRef.current.position.y = DOOR_HEIGHT / 2 + d.beamY * (DOOR_HEIGHT / 2 - 0.35);
      (beamRef.current.material as THREE.MeshBasicMaterial).opacity = d.scanOn ? 1 : 0;
    }

    // escaping fog planes
    fogRefs.current.forEach((f, i) => {
      if (!f) return;
      f.opacity = d.fogEscape * (0.12 + 0.1 * i);
    });

    // hover highlight: brighten hovered door, subtle de-emphasis for others
    if (leafMatRef.current) {
      const isHovered = fx.hovered === index;
      const isOtherHovered = fx.hovered >= 0 && !isHovered && !fx.engaged;
      const brightness = isHovered ? 1.3 : isOtherHovered ? 0.68 : 1.0;
      const targetColor = new THREE.Color("#9c968e").multiplyScalar(brightness);
      leafMatRef.current.color.lerp(targetColor, Math.min(1, dt * 8));
    }

    // NODE plate
    if (plateMatRef.current) {
      const green = d.breachGlow > 0.5;
      const plateCol = green ? new THREE.Color("#70e090") : new THREE.Color("#ffbe76");
      plateMatRef.current.color.lerp(plateCol, Math.min(1, dt * 6));
      plateMatRef.current.opacity = green ? 1.0 : 0.85 + Math.sin(t * 2.2 + index) * 0.15;
    }
  });

  const leafX = DOOR_WIDTH / 2;
  const doorZ = DOOR_Z[index];

  return (
    <group
      ref={group}
      position={[x, 0, doorZ]}
      onClick={(e) => {
        e.stopPropagation();
        onPick(index);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (!fx.engaged) document.body.style.cursor = "pointer";
        onHover(index);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        if (!fx.engaged) document.body.style.cursor = "";
        onUnhover(index);
      }}
    >
      {/* FRAME */}
      <mesh material={materials.frameMat} position={[0, DOOR_HEIGHT / 2 + DOOR_FRAME_THICK / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[DOOR_WIDTH + DOOR_FRAME_THICK * 2, DOOR_FRAME_THICK, 0.34]} />
      </mesh>
      <mesh material={materials.frameMat} position={[0, -DOOR_FRAME_THICK / 2, 0]} receiveShadow>
        <boxGeometry args={[DOOR_WIDTH + DOOR_FRAME_THICK * 2, DOOR_FRAME_THICK, 0.34]} />
      </mesh>
      <mesh material={materials.frameMat} position={[-(DOOR_WIDTH / 2 + DOOR_FRAME_THICK / 2), DOOR_HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[DOOR_FRAME_THICK, DOOR_HEIGHT, 0.34]} />
      </mesh>
      <mesh material={materials.frameMat} position={[DOOR_WIDTH / 2 + DOOR_FRAME_THICK / 2, DOOR_HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[DOOR_FRAME_THICK, DOOR_HEIGHT, 0.34]} />
      </mesh>

      {/* Decorative frame bolts */}
      {[
        [-DOOR_WIDTH / 2 - 0.05, DOOR_HEIGHT - 0.16, 0.18],
        [DOOR_WIDTH / 2 + 0.05, DOOR_HEIGHT - 0.16, 0.18],
        [-DOOR_WIDTH / 2 - 0.05, 0.16, 0.18],
        [DOOR_WIDTH / 2 + 0.05, 0.16, 0.18],
      ].map(([bx, by, bz], i) => (
        <mesh key={`fb${i}`} material={materials.boltMat} position={[bx, by, bz]}>
          <cylinderGeometry args={[0.022, 0.022, 0.03, 10]} />
        </mesh>
      ))}

      {/* INTERIOR ROOM VOID */}
      <mesh material={materials.darkMat} position={[0, DOOR_HEIGHT / 2, -0.5]}>
        <planeGeometry args={[DOOR_WIDTH * 1.06, DOOR_HEIGHT * 1.16]} />
      </mesh>
      {/* Interior glow */}
      <mesh position={[0, DOOR_HEIGHT / 2, -0.47]}>
        <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT * 1.08]} />
        <meshBasicMaterial
          ref={interiorGlowRef}
          color="#ffc178"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* LEAF (pivot on left edge, swings inward) */}
      <group ref={pivot} position={[-DOOR_WIDTH / 2, DOOR_HEIGHT / 2, DOOR_LEAF_THICK / 2]}>
        <group position={[leafX, 0, 0]}>
          <mesh
            ref={(m) => {
              if (!m) return;
              leafRef.current = m;
              leafMatRef.current = m.material as THREE.MeshStandardMaterial;
            }}
            material={materials.leafMat}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[DOOR_WIDTH, DOOR_HEIGHT, DOOR_LEAF_THICK]} />
          </mesh>

          {/* NODE identification plate */}
          <mesh position={[DOOR_WIDTH / 2 - 0.42, DOOR_HEIGHT / 2 - 0.42, DOOR_LEAF_THICK / 2 + 0.035]}>
            <planeGeometry args={[0.26, 0.065]} />
            <meshBasicMaterial
              ref={(m) => {
                if (m) plateMatRef.current = m;
              }}
              map={plateTex}
              transparent
              toneMapped={false}
            />
          </mesh>

          {/* Recessed inner panel for depth */}
          <mesh material={materials.innerPanelMat} position={[0, 0, DOOR_LEAF_THICK / 2 + 0.012]} receiveShadow>
            <boxGeometry args={[DOOR_WIDTH - 0.24, DOOR_HEIGHT - 0.5, 0.03]} />
          </mesh>
          {/* Vertical seam / weld */}
          <mesh material={materials.frameMat} position={[-0.02, 0, DOOR_LEAF_THICK / 2 + 0.026]}>
            <boxGeometry args={[0.02, DOOR_HEIGHT - 0.2, 0.005]} />
          </mesh>

          {/* Scan beam */}
          <mesh ref={beamRef} position={[0, 0, DOOR_LEAF_THICK / 2 + 0.04]} visible={false}>
            <planeGeometry args={[DOOR_WIDTH - 0.1, 0.05]} />
            <meshBasicMaterial color="#ffc178" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      </group>

      {/* Mechanical locking bolts */}
      {BOLTS.map((b, i) => (
        <mesh
          key={`bolt${i}`}
          ref={(m) => {
            boltRefs.current[i] = m;
          }}
          material={materials.boltMat}
          position={[b.x, b.y, DOOR_LEAF_THICK / 2 + 0.04]}
          rotation={[0, 0, b.rz]}
          castShadow
        >
          <boxGeometry args={[0.06, 0.16, 0.04]} />
        </mesh>
      ))}

      {/* Status indicator lamp & practical downlight */}
      <mesh position={[0, DOOR_HEIGHT + 0.1, 0.05]}>
        <boxGeometry args={[0.28, 0.055, 0.04]} />
        <meshStandardMaterial
          ref={(m) => {
            if (m) lampRefs.current[0] = m;
          }}
          color="#ff3020"
          emissive="#ff3020"
          emissiveIntensity={1.4}
        />
      </mesh>
      <pointLight
        ref={lampLightRef}
        position={[0, DOOR_HEIGHT + 0.06, 0.14]}
        intensity={1.0}
        distance={2.2}
        color="#ff3020"
        decay={2}
      />

      {/* Escaping fog planes */}
      {[-0.2, 0.1, 0.35].map((fy, i) => (
        <mesh key={`fog${i}`} position={[0, fy + 0.4, 0.1]}>
          <planeGeometry args={[DOOR_WIDTH * 0.9, 0.3]} />
          <meshBasicMaterial
            ref={(m) => {
              fogRefs.current[i] = m;
            }}
            color="#ffc178"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}