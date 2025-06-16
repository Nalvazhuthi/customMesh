import React, { useMemo, useRef, useEffect, useState } from "react";
import { useGLTF } from "@react-three/drei";
import {
    Vector3,
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
import { generateRoundedPath } from "../dwinzoMain/function/generateRoundedPath";

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

    const MATERIAL_GAP_WORLD = 1.5;
    const divisions = 500;
    const beltHalfWidth = width * 0.45;
    const railOffset = width * 0.45;
    const yOffset = legHeight || height;

    const { path: centerPath, curvatures } = useMemo(() =>
        generateRoundedPath(path, bendRadius), [path, bendRadius]);
    const conveyorLength = useMemo(() => centerPath.getLength(), [centerPath]);
    const NUM_MATERIALS = Math.ceil(conveyorLength / MATERIAL_GAP_WORLD);

    const [materialOffsets] = useState(() =>
        Array.from({ length: NUM_MATERIALS }, (_, i) => (i * MATERIAL_GAP_WORLD) / conveyorLength)
    );

    const controls = useControls("Conveyor Controls", {
        beltColor: "#454545",
        stripeColor: "#ccc",
        stripeWidth: { value: 0.15, min: 0.1, max: 1.5, step: 0.01 },
        gapWidth: { value: 0.15, min: 0.1, max: 1.5, step: 0.01 },
        railColor: "#454545",
        railThickness: { value: 0.025, min: 0.005, max: 0.1, step: 0.005 },
        beltSpeed: { value: 1, min: 0, max: 5, step: 0.01 },
    });

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
    }), []);

    useEffect(() => {
        uniforms.uColor.value.set(controls.beltColor);
        uniforms.uStripeColor.value.set(controls.stripeColor);
        uniforms.uSpeed.value = controls.beltSpeed;
        uniforms.uStripeWidth.value = controls.stripeWidth;
        uniforms.uGapWidth.value = controls.gapWidth;
        uniforms.uConveyorLength.value = conveyorLength;
    }, [controls, conveyorLength]);

    useEffect(() => {
        const box = new Box3().setFromObject(legScene);
        setLegHeight(box.getSize(new Vector3()).y);
    }, [legScene]);

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

    const beltMaterial = useMemo(() => new ShaderMaterial({
        uniforms,
        vertexShader: `
          attribute float pathPosition;
          varying float vPathPosition;
          void main() {
            vPathPosition = pathPosition;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform vec3 uStripeColor;
          uniform float uStripeWidth;
          uniform float uTime;
          uniform float uSpeed;
          varying float vPathPosition;
          void main() {
            float stripe = smoothstep(
              0.5 - uStripeWidth * 0.5,
              0.5 + uStripeWidth * 0.5,
              fract(vPathPosition / 0.005 - uTime * uSpeed)
            );
            vec3 color = mix(uColor, uStripeColor, stripe);
            gl_FragColor = vec4(color, 1.0);
          }
        `,
        side: DoubleSide,
    }), [uniforms]);

    const belt = useMemo(() => {
        const left: Vector3[] = [];
        const right: Vector3[] = [];
        const segmentLengths: number[] = [0];

        for (let i = 0; i <= divisions; i++) {
            const t = i / divisions;
            const pt = centerPath.getPoint(t);
            const tangent = centerPath.getTangent(t).normalize();
            const normal = new Vector3().crossVectors(new Vector3(0, 1, 0), tangent).normalize();

            left.push(pt.clone().add(normal.clone().multiplyScalar(-beltHalfWidth)).setY(yOffset));
            right.push(pt.clone().add(normal.clone().multiplyScalar(beltHalfWidth)).setY(yOffset));

            if (i > 0) {
                segmentLengths.push(
                    segmentLengths[i - 1] + pt.distanceTo(centerPath.getPoint((i - 1) / divisions))
                );
            }
        }

        const totalLength = segmentLengths[segmentLengths.length - 1];
        const vertices: number[] = [];
        const uvs: number[] = [];
        const pathPos: number[] = [];

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

        return <mesh geometry={geometry} material={beltMaterial} />;
    }, [centerPath, beltHalfWidth, yOffset, beltMaterial]);

    useFrame(({ clock }) => {
        const time = clock.getElapsedTime();
        uniforms.uTime.value = time;

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
            {sideRails.map((rail, i) => (
                <mesh key={i}>
                    <tubeGeometry args={[rail, divisions, controls.railThickness, 8, false]} />
                    <meshBasicMaterial color={controls.railColor} />
                </mesh>
            ))}

            {supports}
            {belt}

            {materialOffsets.map((_, i) => (
                <mesh key={i} ref={(el) => el && (materialRefs.current[i] = el)}>
                    <Material />
                </mesh>
            ))}
        </group>
    );
};

export default React.memo(Conveyor);


// user need to control stripeWidth gapWidth maintain oly user given stripe width and gap 