import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CameraControls } from '@react-three/drei';

interface CameraPathHandlerProps {
    cameraPath: THREE.Vector3[];
    cameraTargets: THREE.Vector3[];
    isPlaying: boolean;
    onEnd: () => void;
    cameraControlsRef: any;
    offset?: THREE.Vector3;
    moveSpeed?: number;
}

const CameraPathHandler = ({
    cameraPath,
    cameraTargets,
    isPlaying,
    onEnd,
    cameraControlsRef,
    offset = new THREE.Vector3(0, 2, 0),
    moveSpeed = 0,
}: CameraPathHandlerProps) => {
    const timeRef = useRef(0);
    const currentPosition = useRef(new THREE.Vector3());
    const currentLookAt = useRef(new THREE.Vector3());
    const pathCurve = useRef<THREE.CatmullRomCurve3 | null>(null);
    const tangent = useRef(new THREE.Vector3());
    const normal = useRef(new THREE.Vector3());
    const binormal = useRef(new THREE.Vector3());

    // Create a smooth curve from the path points
    useEffect(() => {
        if (cameraPath.length >= 2) {
            pathCurve.current = new THREE.CatmullRomCurve3(cameraPath);
            pathCurve.current.curveType = 'centripetal';
            pathCurve.current.tension = 2; // Adjust for smoother turns
        } else {
            pathCurve.current = null;
        }
    }, [cameraPath]);

    useFrame((_, delta) => {
        if (!isPlaying || !pathCurve.current || !cameraControlsRef.current) return;

        // Update position along path
        timeRef.current += delta * moveSpeed;

        if (timeRef.current >= 1) {
            timeRef.current = 1;
            onEnd();
            return;
        }

        // Get current position and tangent on the curve
        const pathPosition = pathCurve.current.getPointAt(timeRef.current);
        tangent.current = pathCurve.current.getTangentAt(timeRef.current).normalize();
        
        // Calculate normal and binormal for camera orientation
        normal.current.set(0, 1, 0); // Up vector
        binormal.current = new THREE.Vector3().crossVectors(tangent.current, normal.current).normalize();
        
        // Calculate camera position with offset (opposite to flow direction)
        const cameraOffset = new THREE.Vector3()
            .addScaledVector(binormal.current, offset.x)
            .addScaledVector(normal.current, offset.y)
            .addScaledVector(tangent.current, -offset.z); // Negative for opposite direction
        
        const cameraPosition = pathPosition.clone().add(cameraOffset);
        
        // Calculate look-at point slightly ahead on the path
        const lookAheadT = Math.min(timeRef.current + 0.05, 1);
        const lookAtPoint = pathCurve.current.getPointAt(lookAheadT);
        
        // Smooth camera movement
        currentPosition.current.lerp(cameraPosition, 0.1);
        currentLookAt.current.lerp(lookAtPoint, 0.1);

        // Update camera controls
        cameraControlsRef.current.setLookAt(
            currentPosition.current.x,
            currentPosition.current.y,
            currentPosition.current.z,
            currentLookAt.current.x,
            currentLookAt.current.y,
            currentLookAt.current.z,
            true
        );
    });

    useEffect(() => {
        if (!isPlaying) {
            timeRef.current = 0;
            currentPosition.current = new THREE.Vector3();
            currentLookAt.current = new THREE.Vector3();
        }
    }, [isPlaying]);

    return null;
};

export default CameraPathHandler;