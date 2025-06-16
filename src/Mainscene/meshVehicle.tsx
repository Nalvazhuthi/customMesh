import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useRef, useMemo } from "react";
import { useControls, folder } from "leva";
import { generateRoundedPath } from "../dwinzoMain/function/generateRoundedPath";

interface MeshVehicleProps {
  path: THREE.Vector3[];
}

const MeshVehicle: React.FC<MeshVehicleProps> = ({ path }) => {
  const ref = useRef<THREE.Mesh>(null);

  // Leva control panel for speed and rounding radius
  const { speed, roundingRadius } = useControls({
    Vehicle: folder(
      {
        speed: { value: 5, min: 1, max: 20, step: 0.1 },
        roundingRadius: { value: 5, min: 0, max: 20, step: 0.1 },
      },
      { collapsed: false }
    ),
  });

  // Generate the rounded path only when path or radius changes
  const { path: roundedPath } = useMemo(() => {
    if (path.length < 2) return { path: null, curvatures: [] };
    return generateRoundedPath(path, roundingRadius);
  }, [path, roundingRadius]);

  const pathLength = useMemo(() => roundedPath?.getLength() ?? 0, [roundedPath]);

  useFrame(({ clock }) => {
    if (!roundedPath || !ref.current || pathLength === 0) return;

    const totalTime = pathLength / speed;
    const elapsedTime = clock.getElapsedTime();
    const cycleTime = elapsedTime % (2 * totalTime);

    const forward = cycleTime < totalTime;
    const t = (cycleTime % totalTime) / totalTime;
    const u = forward ? t : 1 - t;

    const currentPos = roundedPath.getPointAt(u);
    const tangent = roundedPath.getTangentAt(u);

    if (!currentPos || !tangent) return;

    ref.current.position.copy(currentPos);

    // Adjust facing direction based on movement direction
    const direction = forward ? tangent : tangent.clone().negate();
    const up = new THREE.Vector3(0, 1, 0);
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), direction, up);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);

    ref.current.quaternion.slerp(q, 0.2); // Smooth rotation
  });

  return (
    <mesh ref={ref}>
      <boxGeometry args={[1.25, 0.2, 2]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  );
};

export default MeshVehicle;
