import React, { useMemo, useRef, useEffect, useState } from "react";
import { useGLTF } from "@react-three/drei";
import {
    Vector3,
    CurvePath,
    Box3,
    Matrix4,
    Color,
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

    // Constants
    const MATERIAL_GAP_WORLD = 1.5;
    const divisions = 1000; // Increased resolution
    const beltHalfWidth = width * 0.45;
    const railOffset = width * 0.45;
    const yOffset = legHeight || height;

    // Generate path with curvature data
    const { path: centerPath, curvatures } = useMemo(() =>
        generateRoundedPath(path, bendRadius),
        [path, bendRadius]
    );

    const conveyorLength = useMemo(() => centerPath.getLength(), [centerPath]);
    const NUM_MATERIALS = Math.ceil(conveyorLength / MATERIAL_GAP_WORLD);

    // Material positions
    const [materialOffsets] = useState(() =>
        Array.from({ length: NUM_MATERIALS }, (_, i) => (i * MATERIAL_GAP_WORLD) / conveyorLength)
    );

    // Leva controls
    const controls = useControls("Conveyor Controls", {
        beltColor: "#454545",
        stripeColor: "#ccc",
        stripeWidth: { value: 0.15, min: 0.1, max: 1.5, step: 0.01 },
        gapWidth: { value: 0.15, min: 0.1, max: 1.5, step: 0.01 },
        railColor: "#454545",
        railThickness: { value: 0.025, min: 0.005, max: 0.1, step: 0.005 },
        beltSpeed: { value: 1.2 , min: 0, max: 5, step: 0.01 },
        fogNear: { value: 10, min: 1, max: 50, step: 1 },
        fogFar: { value: 15, min: 1, max: 100, step: 1 },
        curvatureCompensation: { value: 0.3, min: 0, max: 1, step: 0.01 },
    });

    // Shader uniforms
    const uniforms = useMemo(
        () => ({
            uColor: { value: new Color(controls.beltColor) },
            uStripeColor: { value: new Color(controls.stripeColor) },
            uTime: { value: 0 },
            uSpeed: { value: controls.beltSpeed },
            uStripeWidth: { value: controls.stripeWidth },
            uGapWidth: { value: controls.gapWidth },
            uConveyorLength: { value: conveyorLength },
            uCurvatureFactor: { value: controls.curvatureCompensation },
            fogColor: { value: new Color("white") },
            fogNear: { value: controls.fogNear },
            fogFar: { value: controls.fogFar },
        }),
        [controls, conveyorLength]
    );

    useEffect(() => {
        uniforms.uColor.value.set(controls.beltColor);
        uniforms.uStripeColor.value.set(controls.stripeColor);
        uniforms.uStripeWidth.value = controls.stripeWidth;
        uniforms.uGapWidth.value = controls.gapWidth;
        uniforms.uSpeed.value = controls.beltSpeed;
        uniforms.uCurvatureFactor.value = controls.curvatureCompensation;
        uniforms.fogNear.value = controls.fogNear;
        uniforms.fogFar.value = controls.fogFar;
    }, [controls]);

    // Calculate leg height
    useEffect(() => {
        if (legScene) {
            const box = new Box3().setFromObject(legScene);
            setLegHeight(box.getSize(new Vector3()).y);
        }
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
                    object={legScene?.clone()}
                    position={pt
                        .clone()
                        .add(normal.clone().multiplyScalar(-railOffset))
                        .toArray()}
                />,
                <primitive
                    key={`r-${i}`}
                    object={legScene?.clone()}
                    position={pt
                        .clone()
                        .add(normal.clone().multiplyScalar(railOffset))
                        .toArray()}
                />
            );
        }
        return supportElements;
    }, [centerPath, legScene, railOffset]);

    // Belt material with improved bend handling
    const beltMaterial = useMemo(
        () =>
            new ShaderMaterial({
                uniforms: { ...uniforms },
                vertexShader: `
          attribute float pathPosition;
          attribute float curvature;
          varying float vPathPosition;
          varying float vCurvature;
          
          void main() {
              vPathPosition = pathPosition;
              vCurvature = curvature;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
                fragmentShader: `
          precision mediump float;

          uniform vec3 uColor;
          uniform vec3 uStripeColor;
          uniform float uStripeWidth;
          uniform float uGapWidth;
          uniform float uTime;
          uniform float uSpeed;
          uniform float uConveyorLength;
          uniform float uCurvatureFactor;

          varying float vPathPosition;
          varying float vCurvature;

          void main() {
              float adjustedPosition = vPathPosition + (vCurvature * uCurvatureFactor * vPathPosition);
              
              float totalPatternWidth = uStripeWidth + uGapWidth;
              float movingPosition = mod((adjustedPosition * uConveyorLength - uTime * uSpeed), totalPatternWidth);
              
              // Smooth transition between stripe and gap
              float stripe = smoothstep(0.0, 1.0, step(movingPosition, uStripeWidth));
              
              vec3 finalColor = mix(uColor, uStripeColor, stripe);
              gl_FragColor = vec4(finalColor, 1.0);
          }
        `,
                depthWrite: true,
                transparent: false,

            }),
        [uniforms]
    );

    // Generate belt geometry with curvature data
    const belt = useMemo(() => {
        const left: Vector3[] = [];
        const right: Vector3[] = [];
        const segmentLengths: number[] = [0];
        let totalLength = 0;

        for (let i = 0; i <= divisions; i++) {
            const t = i / divisions;
            const pt = centerPath.getPoint(t);
            const tangent = centerPath.getTangent(t).normalize();
            const normal = new Vector3().crossVectors(new Vector3(0, 1, 0), tangent).normalize();

            left.push(pt.clone().add(normal.clone().multiplyScalar(-beltHalfWidth)).setY(yOffset));
            right.push(pt.clone().add(normal.clone().multiplyScalar(beltHalfWidth)).setY(yOffset));

            if (i > 0) {
                totalLength += pt.distanceTo(centerPath.getPoint((i - 1) / divisions));
                segmentLengths.push(totalLength);
            }
        }

        const vertices: number[] = [];
        const pathPos: number[] = [];
        const curvaturesAttr: number[] = [];

        for (let i = 0; i < divisions; i++) {
            const p1 = left[i],
                p2 = right[i],
                p3 = left[i + 1],
                p4 = right[i + 1];

            const d1 = segmentLengths[i] / totalLength;
            const d2 = segmentLengths[i + 1] / totalLength;

            const c1 = i < curvatures.length ? curvatures[i] : 0;
            const c2 = i + 1 < curvatures.length ? curvatures[i + 1] : 0;

            // Triangle 1
            vertices.push(...p1.toArray(), ...p3.toArray(), ...p2.toArray());
            pathPos.push(d1, d2, d1);
            curvaturesAttr.push(c1, c2, c1);

            // Triangle 2
            vertices.push(...p3.toArray(), ...p4.toArray(), ...p2.toArray());
            pathPos.push(d2, d2, d1);
            curvaturesAttr.push(c2, c2, c1);
        }

        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
        geometry.setAttribute("pathPosition", new BufferAttribute(new Float32Array(pathPos), 1));
        geometry.setAttribute("curvature", new BufferAttribute(new Float32Array(curvaturesAttr), 1));
        geometry.computeVertexNormals();

        return <mesh geometry={geometry} material={beltMaterial} />;
    }, [centerPath, beltHalfWidth, yOffset, beltMaterial, curvatures]);

    // Animation frame
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
            {/* Side Rails */}
            {sideRails.map((rail, i) => (
                <mesh key={i}>
                    <tubeGeometry args={[rail, divisions, controls.railThickness, 8, false]} />
                    <meshBasicMaterial color={controls.railColor} />
                </mesh>
            ))}

            {/* Support Legs */}
            {supports}

            {/* Conveyor Belt */}
            {belt}

            {/* Materials on Belt */}
            {materialOffsets.map((_, i) => (
                <mesh key={i} ref={(el) => el && (materialRefs.current[i] = el)}>
                    <Material />
                </mesh>
            ))}
        </group>
    );
};

export default React.memo(Conveyor);