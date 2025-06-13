import React, { useRef, useState } from "react";
import { Mesh, Vector2, Vector3 } from "three";
import { ThreeEvent } from "@react-three/fiber";

type RayCasterPlaneProps = {
  onClick?: (point: Vector3) => void;
  onMove?: (point: Vector3) => void;
  disabled?: boolean;
};

const RayCasterPlane: React.FC<RayCasterPlaneProps> = ({
  onClick,
  onMove,
  disabled = false
}) => {
  const planeRef = useRef<Mesh>(null);
  const [downPos, setDownPos] = useState<Vector2 | null>(null);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (disabled || e.button !== 0) return; // Only left mouse button
    setDownPos(new Vector2(e.clientX, e.clientY));
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (disabled || e.button !== 0 || !downPos) return;

    const upPos = new Vector2(e.clientX, e.clientY);
    const distance = downPos.distanceTo(upPos);

    if (distance < 2) {
      onClick?.(e.point.clone());
    }

    setDownPos(null);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (disabled) return;
    onMove?.(e.point.clone());
  };

  return (
    <mesh
      ref={planeRef}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
    >
      <planeGeometry args={[10000, 10000]} />
      <meshStandardMaterial visible={false} />
    </mesh>
  );
};

export default RayCasterPlane;