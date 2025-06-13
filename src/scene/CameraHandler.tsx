import { useEffect, useRef } from "react";
import * as THREE from "three";
import { CameraControls } from "@react-three/drei";

const CameraHandler = () => {
  const cameraControlsRef = useRef<CameraControls>(null);
  const targetZ = useRef(-20);
  const currentZ = useRef(-20);
  const animationFrame = useRef<number | null>(null);

  const damping = 0.1;
  const scrollSpeed = 0.02;
  const zMin = -20;
  const zMax = 25;
  const scrollThreshold = 0.1;

  // Touch tracking
  const lastTouchDistance = useRef<number | null>(null);

  useEffect(() => {
    const controls = cameraControlsRef.current;
    if (!controls) return;

    controls.setLookAt(0, 5, -20, 0, 0, -20, false);

    const animate = () => {
      const controls = cameraControlsRef.current;
      if (!controls) return;

      const diff = targetZ.current - currentZ.current;
      const delta = diff * damping;
      currentZ.current += delta;

      const t = (currentZ.current - zMin) / (zMax - zMin);

      let pitch = THREE.MathUtils.degToRad(90);
      const startTiltZone = 0.15;
      const endTiltZone = 0.85;
      const tiltPitch = THREE.MathUtils.degToRad(30);

      if (t < startTiltZone) {
        const tiltT = THREE.MathUtils.clamp(t / startTiltZone, 0, 1);
        const easedTilt = THREE.MathUtils.smoothstep(tiltT, 0, 1);
        pitch = THREE.MathUtils.lerp(THREE.MathUtils.degToRad(90), tiltPitch, easedTilt);
      } else if (t > endTiltZone) {
        const tiltT = THREE.MathUtils.clamp((t - endTiltZone) / (1 - endTiltZone), 0, 1);
        const easeInOutCubic = (x: number) =>
          x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
        const easedTilt = easeInOutCubic(tiltT);
        pitch = THREE.MathUtils.lerp(tiltPitch, THREE.MathUtils.degToRad(90), easedTilt);
      } else {
        pitch = tiltPitch;
      }

      const radius = 5;
      const lookAt = new THREE.Vector3(0, 0, currentZ.current);
      const cameraY = radius * Math.sin(pitch);
      const cameraZ = currentZ.current + radius * Math.cos(pitch);

      controls.setLookAt(0, cameraY, cameraZ, lookAt.x, lookAt.y, lookAt.z, false);

      if (Math.abs(diff) > 0.001) {
        animationFrame.current = requestAnimationFrame(animate);
      } else {
        animationFrame.current = null;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      const canvasSection = document.querySelector(".canvas-section");
      if (!canvasSection?.contains(e.target as Node)) return;

      const delta = e.deltaY * scrollSpeed;
      const proposedTargetZ = targetZ.current + delta;

      const isAtMin = Math.abs(currentZ.current - zMin) < scrollThreshold;
      const isAtMax = Math.abs(currentZ.current - zMax) < scrollThreshold;
      const tryingToScrollPastMin = isAtMin && delta < 0;
      const tryingToScrollPastMax = isAtMax && delta > 0;
      const withinBounds = proposedTargetZ >= zMin && proposedTargetZ <= zMax;

      if (withinBounds) {
        e.preventDefault();
        targetZ.current = THREE.MathUtils.clamp(proposedTargetZ, zMin, zMax);
        if (animationFrame.current === null) {
          animate();
        }
      } else if (tryingToScrollPastMin || tryingToScrollPastMax) {
        return;
      } else {
        e.preventDefault();
        targetZ.current = THREE.MathUtils.clamp(proposedTargetZ, zMin, zMax);
        if (animationFrame.current === null) {
          animate();
        }
      }
    };

    // Touch handlers for pinch zoom
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].pageX - e.touches[1].pageX;
        const dy = e.touches[0].pageY - e.touches[1].pageY;
        lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy);
      } else {
        lastTouchDistance.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const canvasSection = document.querySelector(".canvas-section");
      if (!canvasSection?.contains(e.target as Node)) return;

      if (e.touches.length === 2 && lastTouchDistance.current !== null) {
        const dx = e.touches[0].pageX - e.touches[1].pageX;
        const dy = e.touches[0].pageY - e.touches[1].pageY;
        const newDistance = Math.sqrt(dx * dx + dy * dy);
        const deltaDistance = newDistance - lastTouchDistance.current;

        // Scale deltaDistance to targetZ change (you can tweak sensitivity)
        const delta = -deltaDistance * 0.05; // negative because pinch out = zoom out (camera back)

        const proposedTargetZ = targetZ.current + delta;
        const withinBounds = proposedTargetZ >= zMin && proposedTargetZ <= zMax;

        if (withinBounds) {
          e.preventDefault();
          targetZ.current = THREE.MathUtils.clamp(proposedTargetZ, zMin, zMax);
          if (animationFrame.current === null) {
            animate();
          }
        }

        lastTouchDistance.current = newDistance;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        lastTouchDistance.current = null;
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      if (animationFrame.current !== null) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, []);

  return (
    <CameraControls
      ref={cameraControlsRef}
      makeDefault
      minDistance={0}
      maxDistance={0}
      mouseButtons={{ left: 0, middle: 0, right: 0, wheel: 0 }}
      touches={{ one: 0, two: 0, three: 0 }}
      smoothTime={0.5}
    />
  );
};

export default CameraHandler;
