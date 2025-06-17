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
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0);
  const [lookAtPosition, setLookAtPosition] = useState<THREE.Vector3>(new THREE.Vector3());

  const isoOffset = new THREE.Vector3(10, 10, 10); // isometric angle

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

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (cameraControlsRef?.current) {
        // cameraControlsRef.current.enabled = false;
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

  useEffect(() => {
    if (isPlaying && conveyorPaths[0]?.length > 0) {
      const start = conveyorPaths[0][0];
      const isoPos = new THREE.Vector3().copy(start).add(isoOffset);
      camera.position.copy(isoPos);
      camera.lookAt(start);

      setScrollProgress(0);
      setCurrentTargetIndex(0);
      setLookAtPosition(start.clone());
    }
  }, [isPlaying]);

  useFrame(() => {
    if (!isPlaying) return;

    const position = getPathPosition(scrollProgress);
    const isoPos = new THREE.Vector3().copy(position).add(isoOffset);
    camera.position.copy(isoPos);

    let target = position.clone();

    for (let i = currentTargetIndex; i < cameraTargets.length; i++) {
      const camTarget = cameraTargets[i];
      if (position.distanceTo(camTarget) < 1) {
        setCurrentTargetIndex(i + 1);
        onReachTarget(camTarget);
      }
    }

    if (currentTargetIndex < cameraTargets.length) {
      target = cameraTargets[currentTargetIndex];
    }

    setLookAtPosition(prev => prev.lerp(target, 0.1));
    camera.lookAt(lookAtPosition);
  });

  return <CameraControls ref={cameraControlsRef} />;
};

export default CameraHandler;
