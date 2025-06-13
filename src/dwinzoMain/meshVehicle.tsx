import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useRef, useMemo } from "react";
import { generateRoundedPath } from "./function/generateRoundedPath";

interface MeshVehicleProps {
    path: THREE.Vector3[];
}


const MeshVehicle: React.FC<MeshVehicleProps> = ({ path }) => {
    const ref = useRef<THREE.Mesh>(null);
    // Generate smoothed path with rounding
    const { path: roundedPath } = useMemo(() => {
        if (path.length < 2) return { path: null, curvatures: [] };
        return generateRoundedPath(path, 5); // radius of rounding
    }, [path]);

    // Total length for normalization
    const pathLength = useMemo(() => roundedPath?.getLength() ?? 0, [roundedPath]);

    useFrame(({ clock }) => {
        if (!roundedPath || !ref.current || pathLength === 0) return;

        // Normalize time to travel entire path smoothly
        const speed = 5; // units per second
        const t = ((clock.getElapsedTime() * speed) % pathLength) / pathLength;

        const currentPos = roundedPath.getPointAt(t);
        const tangent = roundedPath.getTangentAt(t);

        if (!currentPos || !tangent) return;

        ref.current.position.copy(currentPos);

        // Face in direction of movement
        const axis = new THREE.Vector3(0, 0, 1); // forward
        const up = new THREE.Vector3(0, 1, 0);
        const m = new THREE.Matrix4().lookAt(
            new THREE.Vector3(0, 0, 0),
            tangent,
            up
        );
        const q = new THREE.Quaternion().setFromRotationMatrix(m);
        ref.current.quaternion.slerp(q, 0.2);
    });

    return (
        <mesh ref={ref}>
            
            <boxGeometry args={[1.25, 0.2, 2]} />
            <meshStandardMaterial color="orange" />
        </mesh>
    );
};

export default MeshVehicle;

