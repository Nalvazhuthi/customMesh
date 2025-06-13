import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import Conveyor from "./Conveyor";
import { useState } from "react";
import CameraHandler from "./CameraHandler";

type ConveyorPath = THREE.Vector3[];

const Scene = () => {
    const initialConveyors: ConveyorPath[] = [
        [
            new THREE.Vector3(20, 0, 0),
            new THREE.Vector3(6, 0, 0),
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -4),
            new THREE.Vector3(3, 0, -4),
            new THREE.Vector3(3, 0, -7),
            new THREE.Vector3(3, 0, -9),
            new THREE.Vector3(5, 0, -9),
            new THREE.Vector3(5, 0, -13),
            new THREE.Vector3(5, 0, -20),
            new THREE.Vector3(0, 0, -20),
            new THREE.Vector3(0, 0, -30),
        ],
        [
            new THREE.Vector3(-20, 0, 0),
            new THREE.Vector3(-7, 0, 0),
            new THREE.Vector3(-3, 0, 0),
            new THREE.Vector3(-3, 0, 5),
            new THREE.Vector3(1, 0, 5),
            new THREE.Vector3(1, 0, 8),
            new THREE.Vector3(1, 0, 9),
            new THREE.Vector3(5, 0, 9),
            new THREE.Vector3(5, 0, 20),
            new THREE.Vector3(0, 0, 20),
            new THREE.Vector3(0, 0, 30),
        ],
    ];
    const [conveyors, setConveyors] = useState<ConveyorPath[]>(initialConveyors);

    return (
        <Canvas camera={{ position: [0, 5, -20] }}>

            <ambientLight intensity={0.2} />

            <EffectComposer>
                <Bloom
                    intensity={1.0} // The bloom intensity.
                    width={300} // render width
                    height={300} // render height
                    kernelSize={5} // blur kernel size
                    luminanceThreshold={0.15} // luminance threshold. Raise this value to mask out darker elements in the scene.
                    luminanceSmoothing={0.025} // smoothness of the luminance threshold. Range is [0, 1]
                />
            </EffectComposer>

            {conveyors.map((path, idx) => (
                <Conveyor key={`conveyor-${idx}`} path={path} />
            ))}

            {/* <fog attach="fog" color="black" near={20} far={500} /> */}
            <fog attach="fog" args={["white", 10, 15]} />

            <CameraHandler />

        </Canvas>
    );
};

export default Scene;
