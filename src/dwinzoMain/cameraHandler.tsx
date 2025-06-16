import { useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import * as THREE from 'three';

interface CameraHandlerProps {
    conveyorPaths: THREE.Vector3[][];
    cameraTargets: THREE.Vector3[];
    isPlaying?: boolean;
    onReachTarget: (target: THREE.Vector3) => void;
    cameraControlsRef: React.RefObject<CameraControls | null>;
}

const CameraHandler = ({
    conveyorPaths,
    cameraTargets,
    isPlaying,
    onReachTarget,
    cameraControlsRef
}: CameraHandlerProps) => {
    const { camera, gl } = useThree();
    const [scrollProgress, setScrollProgress] = useState(0);
    const isoOffset = new THREE.Vector3(10, 10, 10); // Isometric offset for camera position
    const [currentTargetIndex, setCurrentTargetIndex] = useState(0);
    const [lookAtPosition, setLookAtPosition] = useState<THREE.Vector3>(new THREE.Vector3());

    // Get interpolated position based on scroll progress
    const getPathPosition = (progress: number): THREE.Vector3 => {
        if (!conveyorPaths[0] || conveyorPaths[0].length < 2) return new THREE.Vector3();

        const path = conveyorPaths[0];
        const maxIndex = path.length - 1;
        const clampedProgress = Math.max(0, Math.min(1, progress));
        const rawIndex = clampedProgress * maxIndex;
        const indexA = Math.floor(rawIndex);
        const indexB = Math.min(path.length - 1, indexA + 1);
        const t = rawIndex - indexA;

        return new THREE.Vector3().lerpVectors(path[indexA], path[indexB], t);
    };

    // Handle scroll input
    useEffect(() => {
        const handleWheel = (event: WheelEvent) => {
            if (cameraControlsRef?.current) {
                cameraControlsRef.current.enabled = false;
            }
            setScrollProgress((prev) =>
                Math.max(0, Math.min(1, prev + event.deltaY * 0.001))
            );
        };

        gl.domElement.addEventListener('wheel', handleWheel);
        return () => {
            gl.domElement.removeEventListener('wheel', handleWheel);
        };
    }, [gl.domElement, cameraControlsRef]);

    // Reset camera and state when play starts
    useEffect(() => {
        if (isPlaying && conveyorPaths[0] && conveyorPaths[0].length > 0) {
            const startPoint = conveyorPaths[0][0];

            camera.position.set(
                startPoint.x + isoOffset.x,
                startPoint.y + isoOffset.y,
                startPoint.z + isoOffset.z
            );

            camera.lookAt(startPoint);

            setScrollProgress(0);
            setCurrentTargetIndex(0);
        }
    }, [isPlaying]);

    // Animation loop for camera movement
    useFrame(() => {
        if (!isPlaying) return;

        const position = getPathPosition(scrollProgress);

        // Set camera position with isometric offset
        camera.position.set(
            position.x + isoOffset.x,
            position.y + isoOffset.y,
            position.z + isoOffset.z
        );

        // Check if we're near any camera target
        let target = position.clone(); // default look-at point is current path position

        for (let i = currentTargetIndex; i < cameraTargets.length; i++) {
            const camTarget = cameraTargets[i];
            if (position.distanceTo(camTarget) < 1) {
                setCurrentTargetIndex(i + 1);
                onReachTarget(camTarget);
            }
        }

        // If there's an active target, look at it instead of the path
        if (currentTargetIndex < cameraTargets.length) {
            target = cameraTargets[currentTargetIndex].clone();
        }

        // Smooth lerp to avoid sudden camera jumps
        setLookAtPosition((prev) => prev.lerp(target, 0.1));
        camera.lookAt(lookAtPosition);
    });

    return <CameraControls ref={cameraControlsRef} />;
};

export default CameraHandler;


