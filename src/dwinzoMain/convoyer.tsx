import React, { useMemo, useRef, useEffect, useState } from "react";
import { useGLTF } from "@react-three/drei";
import {
  Vector3,
  CurvePath,
  LineCurve3,
  QuadraticBezierCurve3,
  Box3,
  Matrix4,
  Color,
  DoubleSide,
  BufferGeometry,
  BufferAttribute,
  Mesh,
  ShaderMaterial,
} from "three";
import { useFrame } from "@react-three/fiber";
import { useControls } from "leva";
import { Material } from "../scene/Material";

// Helper function to generate rounded path with curvature data
function generateRoundedPath(points: Vector3[], radius: number) {
  const path = new CurvePath<Vector3>();
  const curvatures: number[] = [0];
  let last = points[0].clone();
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const v1 = curr.clone().sub(prev).normalize();
    const v2 = next.clone().sub(curr).normalize();
    const angle = v1.angleTo(v2);
    const dist = Math.min(radius, curr.distanceTo(prev) * 0.45, curr.distanceTo(next) * 0.45);
    if (angle < 0.01 || dist < 0.001) {
      path.add(new LineCurve3(last, curr.clone()));
      curvatures.push(0);
      last = curr.clone();
      continue;
    }
    const p1 = curr.clone().sub(v1.multiplyScalar(dist));
    const p2 = curr.clone().add(v2.multiplyScalar(dist));
    path.add(new LineCurve3(last, p1));
    path.add(new QuadraticBezierCurve3(p1, curr.clone(), p2));
    // Improved curvature calculation
    const curvature = 1 / dist;
    curvatures.push(curvature);
    last = p2;
  }
  path.add(new LineCurve3(last, points[points.length - 1].clone()));
  curvatures.push(0);
  return { path, curvatures };
}

type ConveyorProps = {
  path: Vector3[];
  width?: number;
  height?: number;
  bendRadius?: number;
};

const Conveyor: React.FC<ConveyorProps> = ({
  path,
  width = 1,
  height = -0.1,
  bendRadius = 0.8,
}) => {
  const { scene: legScene } = useGLTF("./assets/conveyor_leg.glb");
  const [legHeight, setLegHeight] = useState(0);
  const materialRefs = useRef<Mesh[]>([]);
  // Constants
  const MATERIAL_GAP_WORLD = 1.5;
  const divisions = 500;
  const beltHalfWidth = width * 0.45;
  const railOffset = width * 0.45;
  const yOffset = legHeight || height;

  // Generate path with curvature data
  const { path: centerPath, curvatures } = useMemo(() =>
    generateRoundedPath(path, bendRadius), [path, bendRadius]);
  const conveyorLength = useMemo(() => centerPath.getLength(), [centerPath]);
  const NUM_MATERIALS = Math.ceil(conveyorLength / MATERIAL_GAP_WORLD);

  // Material positions
  const [materialOffsets] = useState(() =>
    Array.from({ length: NUM_MATERIALS }, (_, i) => (i * MATERIAL_GAP_WORLD) / conveyorLength)
  );

  // Control panel settings
  const controls = useControls("Conveyor Controls", {
    beltColor: "#454545",
    stripeColor: "#ccc",
    stripeWidth: { value: 0.15, min: 0.1, max: 1.5, step: 0.01 },
    gapWidth: { value: 0.15, min: 0.1, max: 1.5, step: 0.01 },
    railColor: "#454545",
    railThickness: { value: 0.025, min: 0.005, max: 0.1, step: 0.005 },
    beltSpeed: { value: 1, min: 0, max: 5, step: 0.01 },
    fogNear: { value: 10, min: 1, max: 50, step: 1 },
    fogFar: { value: 15, min: 1, max: 100, step: 1 },
  });

  // Shader uniforms
  const uniforms = useMemo(() => ({
    uColor: { value: new Color(controls.beltColor) },
    uStripeColor: { value: new Color(controls.stripeColor) },
    uTime: { value: 0 },
    uSpeed: { value: controls.beltSpeed },
    uStripeWidth: { value: controls.stripeWidth },
    uGapWidth: { value: controls.gapWidth },
    uConveyorLength: { value: conveyorLength },
    uMaterialGap: { value: MATERIAL_GAP_WORLD },
    uBeltHalfWidth: { value: beltHalfWidth },
    fogColor: { value: new Color("white") },
    fogNear: { value: controls.fogNear },
    fogFar: { value: controls.fogFar },
  }), [controls, conveyorLength, beltHalfWidth]);

  // Calculate leg height
  useEffect(() => {
    const box = new Box3().setFromObject(legScene);
    setLegHeight(box.getSize(new Vector3()).y);
  }, [legScene]);

  // Generate side rails
  const sideRails = useMemo(() => {
    const makeRail = (sign: number) =>
      generateRoundedPath(
        Array.from({ length: divisions + 1 }, (_, i) => {
          const t = i / divisions;
          const pt = centerPath.getPoint(t);
          const tangent = centerPath.getTangent(t).normalize();
          const normal = new Vector3().crossVectors(new Vector3(0, 1, 0), tangent).normalize();
          return pt.clone().add(normal.multiplyScalar(sign * railOffset)).setY(yOffset);
        }),
        bendRadius * 0.8
      ).path;
    return [makeRail(-1), makeRail(1)];
  }, [centerPath, railOffset, yOffset, bendRadius]);

  // Generate supports
  const supports = useMemo(() => {
    const count = Math.floor(centerPath.getLength() / 1.0);
    const supportElements: any[] = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const pt = centerPath.getPoint(t);
      const tangent = centerPath.getTangent(t).normalize();
      const normal = new Vector3().crossVectors(new Vector3(0, 1, 0), tangent).normalize();
      supportElements.push(
        <primitive
          key={`l-${i}`}
          object={legScene.clone()}
          position={pt.clone().add(normal.clone().multiplyScalar(-railOffset)).toArray()}
        />,
        <primitive
          key={`r-${i}`}
          object={legScene.clone()}
          position={pt.clone().add(normal.clone().multiplyScalar(railOffset)).toArray()}
        />
      );
    }
    return supportElements;
  }, [centerPath, legScene, railOffset]);

  // Belt material with improved bend handling
  const beltMaterial = useMemo(() => new ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      varying float vPathPosition;
      varying float vCurvature;
      varying float vLateralPos;
      varying vec3 vNormal;
      attribute float pathPosition;
      attribute float curvature;
      attribute float lateralPos;
      void main() {
        vUv = uv;
        vPathPosition = pathPosition;
        vCurvature = curvature;
        vLateralPos = lateralPos;
        vNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uStripeColor;
      uniform float uTime;
      uniform float uSpeed;
      uniform float uStripeWidth;
      uniform float uGapWidth;
      uniform float uConveyorLength;
      uniform float uMaterialGap;
      uniform float uBeltHalfWidth;
      varying vec2 vUv;
      varying float vPathPosition;
      varying float vCurvature;
      varying float vLateralPos;
      varying vec3 vNormal;
      
      void main() {
        // Calculate base position along conveyor (world units)
        float basePosition = vPathPosition * uConveyorLength - uTime * uSpeed;
        
        // Calculate exact curvature compensation
        float effectiveRadius = abs(vCurvature) > 0.001 ? (1.0 / vCurvature) : 10000.0;
        float radiusAtPoint = effectiveRadius + vLateralPos * uBeltHalfWidth;
        
        // Calculate adjusted position with perfect curvature compensation
        float adjustedPosition = basePosition * (effectiveRadius / radiusAtPoint);
        
        // Calculate pattern position (stripe + gap = one cycle)
        float cycleLength = uStripeWidth + uGapWidth;
        float patternPos = mod(adjustedPosition, cycleLength);
        
        // Create sharp stripe pattern with anti-aliased edges
        float stripeEdge = 0.02; // Controls edge sharpness
        float stripe = smoothstep(0.0, stripeEdge, patternPos) -
                      smoothstep(uStripeWidth - stripeEdge, uStripeWidth, patternPos);
        
        // Final color with curvature-aware shading
        vec3 color = mix(uColor, uStripeColor, stripe);
        
        // Add subtle normal-based shading for depth
        float shading = 0.8 + 0.2 * dot(vNormal, vec3(0.0, 1.0, 0.0));
        color *= shading;
        
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: DoubleSide,
  }), [uniforms]);

  // Generate belt geometry with curvature data
  const belt = useMemo(() => {
    const left: Vector3[] = [];
    const right: Vector3[] = [];
    const segmentLengths: number[] = [0];
    const curvatureValues: number[] = [];
    const lateralPositions: number[] = [];
    let totalLength = 0;

    for (let i = 0; i <= divisions; i++) {
      const t = i / divisions;
      const pt = centerPath.getPoint(t);
      const tangent = centerPath.getTangent(t).normalize();
      const normal = new Vector3().crossVectors(new Vector3(0, 1, 0), tangent).normalize();

      // Calculate curvature at this point (interpolate between samples)
      const curvature = i < curvatures.length ? curvatures[i] : 0;

      left.push(pt.clone().add(normal.clone().multiplyScalar(-beltHalfWidth)).setY(yOffset));
      right.push(pt.clone().add(normal.clone().multiplyScalar(beltHalfWidth)).setY(yOffset));

      if (i > 0) {
        totalLength += pt.distanceTo(centerPath.getPoint((i - 1) / divisions));
        segmentLengths.push(totalLength);
      }
    }

    const vertices: number[] = [];
    const uvs: number[] = [];
    const pathPos: number[] = [];
    const curvaturesAttr: number[] = [];
    const lateralPos: number[] = [];

    for (let i = 0; i < divisions; i++) {
      const p1 = left[i], p2 = right[i], p3 = left[i + 1], p4 = right[i + 1];
      const d1 = segmentLengths[i] / totalLength;
      const d2 = segmentLengths[i + 1] / totalLength;
      const c1 = i < curvatures.length ? curvatures[i] : 0;
      const c2 = i + 1 < curvatures.length ? curvatures[i + 1] : 0;

      // Triangle 1
      vertices.push(...p1.toArray(), ...p3.toArray(), ...p2.toArray());
      // Triangle 2
      vertices.push(...p3.toArray(), ...p4.toArray(), ...p2.toArray());

      uvs.push(d1, 0, d2, 0, d1, 1, d2, 0, d2, 1, d1, 1);
      pathPos.push(d1, d2, d1, d2, d2, d1);

      // Curvature and lateral position attributes
      curvaturesAttr.push(c1, c2, c1, c2, c2, c1);
      lateralPos.push(-1.0, -1.0, 1.0, 1.0, 1.0, -1.0); // -1 for left, 1 for right
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
    geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
    geometry.setAttribute("pathPosition", new BufferAttribute(new Float32Array(pathPos), 1));
    geometry.setAttribute("curvature", new BufferAttribute(new Float32Array(curvaturesAttr), 1));
    geometry.setAttribute("lateralPos", new BufferAttribute(new Float32Array(lateralPos), 1));
    geometry.computeVertexNormals();

    return <mesh geometry={geometry} material={beltMaterial} />;
  }, [centerPath, beltHalfWidth, yOffset, beltMaterial, curvatures]);

  // Animation frame for synchronized movement
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    uniforms.uTime.value = time;

    // Update material positions
    materialOffsets.forEach((offset, i) => {
      const mesh = materialRefs.current[i];
      if (mesh) {
        const t = (offset + time * controls.beltSpeed / conveyorLength) % 1;
        const matPos = centerPath.getPoint(t);
        const matTan = centerPath.getTangent(t).normalize();
        matPos.y += height;
        mesh.position.copy(matPos);
        mesh.quaternion.setFromRotationMatrix(
          new Matrix4().lookAt(new Vector3(), matTan, new Vector3(0, 1, 0))
        );
      }
    });
  });

  return (
    <group>
      {/* Side rails */}
      {sideRails.map((rail, i) => (
        <mesh key={i}>
          <tubeGeometry args={[rail, divisions, controls.railThickness, 8, false]} />
          <meshBasicMaterial color={controls.railColor} />
        </mesh>
      ))}

      {/* Support legs */}
      {supports}

      {/* Conveyor belt with improved bend stripes */}
      {belt}

      {/* Materials on belt */}
      {materialOffsets.map((_, i) => (
        <mesh key={i} ref={(el) => el && (materialRefs.current[i] = el)}>
          <Material />
        </mesh>
      ))}
    </group>
  );
};

export default React.memo(Conveyor);