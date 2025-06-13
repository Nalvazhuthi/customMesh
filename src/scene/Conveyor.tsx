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
import { Material } from "./Material";
// import Labels from "./Lables";
import { Leva, useControls } from "leva";

function generateRoundedPath(points: Vector3[], radius: number): CurvePath<Vector3> {
  const path = new CurvePath<Vector3>();
  let last = points[0].clone();
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1], curr = points[i], next = points[i + 1];
    const v1 = curr.clone().sub(prev).normalize();
    const v2 = next.clone().sub(curr).normalize();
    const angle = v1.angleTo(v2);
    const dist = Math.min(radius, curr.distanceTo(prev) * 0.45, curr.distanceTo(next) * 0.45);

    if (angle < 0.01 || dist < 0.001) {
      path.add(new LineCurve3(last, curr.clone()));
      last = curr.clone();
      continue;
    }

    const p1 = curr.clone().sub(v1.multiplyScalar(dist));
    const p2 = curr.clone().add(v2.multiplyScalar(dist));
    path.add(new LineCurve3(last, p1));
    path.add(new QuadraticBezierCurve3(p1, curr.clone(), p2));
    last = p2;
  }

  path.add(new LineCurve3(last, points[points.length - 1].clone()));
  return path;
}

type ConveyorProps = {
  path: Vector3[];
  width?: number;
  height?: number;
  thickness?: number;
  bendRadius?: number;
};

const Conveyor: React.FC<ConveyorProps> = ({
  path,
  width = 1,
  height = 0.3,
  bendRadius = 0.8,
}) => {
  const { scene: legScene } = useGLTF("./assets/conveyor_leg.glb");
  const [legHeight, setLegHeight] = useState(0);

  const cubeRef = useRef<Mesh>(null);
  const shaderRef = useRef<ShaderMaterial>(null);
  const materialRefs = useRef<Mesh[]>([]);

  const stripeLength = 0.005;
  const divisions = 1000;
  const beltHalfWidth = width * 0.45;
  const railOffset = width * 0.45;
  const yOffset = legHeight || height;

  const [materialOffsets] = useState(() =>
    Array.from({ length: Math.floor(Math.random() * 4) + 1 }, () => Math.random())
  );

  const {
    beltColor,
    stripeColor,
    stripeThickness,
    railColor,
    railThickness,
    beltSpeed,
    fogNear,
    fogFar,
  } = useControls("Conveyor Controls", {
    beltColor: { value: "#454545" },
    stripeColor: { value: "#1a1a1a" },
    stripeThickness: { value: 0.04, min: 0.001, max: 0.2, step: 0.001 },
    railColor: { value: "#454545" },
    railThickness: { value: 0.025, min: 0.005, max: 0.1, step: 0.005 },
    beltSpeed: { value: 1.2, min: 0, max: 5, step: 0.01 },
    fogNear: { value: 10, min: 1, max: 50, step: 1 },
    fogFar: { value: 15, min: 1, max: 100, step: 1 },
    stripeCount: { value: 50, min: 1, max: 200, step: 1 },

  });

  const uniforms = useRef({
    uColor: { value: new Color(beltColor) },
    uStripeColor: { value: new Color(stripeColor) },
    uTime: { value: 0 },
    uSpeed: { value: beltSpeed },
    uStripeThickness: { value: stripeThickness },
    fogColor: { value: new Color("white") },
    fogNear: { value: fogNear },
    fogFar: { value: fogFar },
  }).current;

  useEffect(() => {
    uniforms.uColor.value.set(beltColor);
    uniforms.uStripeColor.value.set(stripeColor);
    uniforms.uSpeed.value = beltSpeed;
    uniforms.uStripeThickness.value = stripeThickness;
    uniforms.fogNear.value = fogNear;
    uniforms.fogFar.value = fogFar;
  }, [beltColor, stripeColor, beltSpeed, stripeThickness, fogNear, fogFar]);

  useEffect(() => {
    const box = new Box3().setFromObject(legScene);
    setLegHeight(box.getSize(new Vector3()).y);
  }, [legScene]);

  const centerPath = useMemo(() => generateRoundedPath(path, bendRadius), [path, bendRadius]);

  const sideRails = useMemo(() => {
    const makeRail = (sign: number) =>
      generateRoundedPath(
        Array.from({ length: divisions + 1 }, (_, i) => {
          const t = i / divisions;
          const pt = centerPath.getPoint(t);
          const tangent = centerPath.getTangent(t);
          const normal = new Vector3().crossVectors(new Vector3(0, 1, 0), tangent).normalize();
          return pt.clone().add(normal.multiplyScalar(sign * railOffset)).setY(yOffset);
        }),
        bendRadius * 0.8
      );
    return [makeRail(-1), makeRail(1)];
  }, [centerPath, railOffset, yOffset, bendRadius]);

  const supports = useMemo(() => {
    const count = Math.floor(centerPath.getLength() / 1.0);
    return Array.from({ length: count + 1 }, (_, i) => {
      const t = i / count;
      const pt = centerPath.getPoint(t);
      const tangent = centerPath.getTangent(t);
      const normal = new Vector3().crossVectors(new Vector3(0, 1, 0), tangent).normalize();
      return [
        <primitive
          key={`l-${i}`}
          object={legScene.clone()}
          position={pt.clone().add(normal.clone().multiplyScalar(-railOffset)).toArray()}
        />,
        <primitive
          key={`r-${i}`}
          object={legScene.clone()}
          position={pt.clone().add(normal.clone().multiplyScalar(railOffset)).toArray()}
        />,
      ];
    }).flat();
  }, [centerPath, legScene, railOffset]);
  const beltMaterial = useMemo(() => {
    return new ShaderMaterial({
      uniforms,
      vertexShader: `
      varying vec2 vUv;
      varying float vPathPosition;
      attribute float pathPosition;

      void main() {
        vUv = uv;
        vPathPosition = pathPosition;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
      fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uStripeColor;
      uniform float uTime;
      uniform float uSpeed;
      uniform float uStripeThickness;

      varying vec2 vUv;
      varying float vPathPosition;

      void main() {
        float stripe = step(0.5 - uStripeThickness * 0.5, fract(vPathPosition * 50.0 - uTime * uSpeed));
        stripe *= step(fract(vPathPosition * 50.0 - uTime * uSpeed), 0.5 + uStripeThickness * 0.5);
        vec3 color = mix(uColor, uStripeColor, stripe);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
      side: DoubleSide,
    });
  }, []);
  const belt = useMemo(() => {
    const left: Vector3[] = [], right: Vector3[] = [];
    const segmentLengths: number[] = [0];
    let totalLength = 0;

    for (let i = 0; i <= divisions; i++) {
      const t = i / divisions;
      const pt = centerPath.getPoint(t);
      const tangent = centerPath.getTangent(t);
      const normal = new Vector3().crossVectors(new Vector3(0, 1, 0), tangent).normalize();
      left.push(pt.clone().add(normal.clone().multiplyScalar(-beltHalfWidth)).setY(yOffset));
      right.push(pt.clone().add(normal.clone().multiplyScalar(beltHalfWidth)).setY(yOffset));

      if (i > 0) {
        totalLength += pt.distanceTo(centerPath.getPoint((i - 1) / divisions));
        segmentLengths.push(totalLength);
      }
    }

    const vertices: number[] = [], uvs: number[] = [], pathPos: number[] = [];
    for (let i = 0; i < divisions; i++) {
      const p1 = left[i], p2 = right[i], p3 = left[i + 1], p4 = right[i + 1];
      const d1 = segmentLengths[i] / totalLength;
      const d2 = segmentLengths[i + 1] / totalLength;
      vertices.push(...p1.toArray(), ...p3.toArray(), ...p2.toArray());
      vertices.push(...p3.toArray(), ...p4.toArray(), ...p2.toArray());
      uvs.push(d1, 0, d2, 0, d1, 1, d2, 0, d2, 1, d1, 1);
      pathPos.push(d1, d2, d1, d2, d2, d1);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
    geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
    geometry.setAttribute("pathPosition", new BufferAttribute(new Float32Array(pathPos), 1));
    geometry.computeVertexNormals();


    return (
      <mesh geometry={geometry} material={beltMaterial} />

    );

  }, [centerPath, beltHalfWidth, yOffset, stripeLength, uniforms]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    uniforms.uTime.value = time;

    const t = (time * beltSpeed * stripeLength) % 1;
    const pos = centerPath.getPoint(t);
    const tangent = centerPath.getTangent(t).normalize();

    cubeRef.current?.position.copy(pos);
    cubeRef.current?.quaternion.setFromRotationMatrix(
      new Matrix4().lookAt(new Vector3(), tangent, new Vector3(0, 1, 0))
    );

    materialOffsets.forEach((offset, i) => {
      const mesh = materialRefs.current[i];
      if (mesh) {
        const t = (offset + time * beltSpeed * stripeLength) % 1;
        const matPos = centerPath.getPoint(t);
        const matTan = centerPath.getTangent(t).normalize();
        matPos.y -= 0.1;

        mesh.position.copy(matPos);
        mesh.quaternion.setFromRotationMatrix(
          new Matrix4().lookAt(new Vector3(), matTan, new Vector3(0, 1, 0))
        );
      }
    });
  });

  return (
    <group>
      {sideRails.map((rail, i) => (
        <mesh key={i}>
          <tubeGeometry args={[rail, divisions, railThickness, 8, false]} />
          <meshBasicMaterial color={railColor} />
        </mesh>
      ))}
      {supports}
      {belt}
      {materialOffsets.map((_, i) => (
        <mesh key={i} ref={(el) => (materialRefs.current[i] = el!)}>
          <Material />
        </mesh>
      ))}
      {/* <Labels /> */}
      {/* <Leva hidden /> */}
    </group>
  );
};

export default Conveyor;




// in belt addd stripe like structure which flow in convoyer direction make stripe thickness adjustable