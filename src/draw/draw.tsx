import React, { useState, useRef, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Line, CameraControls } from "@react-three/drei";
import * as THREE from "three";
import MarkPath from "../components/markPath";
import RayCasterPlane from "../components/rayCasterPlane";
import Conveyor from "../components/conveyer";
import { Physics } from "@react-three/rapier";
import CameraHandler from "../components/camerahandler";
import { Material } from "../components/material";
import { Bloom, EffectComposer } from "@react-three/postprocessing";

// Define types for our conveyor segments and paths
type ConveyorSegment = {
  leftStart: THREE.Vector3;
  rightStart: THREE.Vector3;
  leftEnd: THREE.Vector3;
  rightEnd: THREE.Vector3;
};

type ConveyorPath = THREE.Vector3[];

// Collision detection utilities
const checkConveyorCollision = (
  path1: ConveyorPath,
  path2: ConveyorPath,
  width: number = 1
): boolean => {
  if (path1.length < 2 || path2.length < 2) return false;

  const createSegments = (path: ConveyorPath): ConveyorSegment[] => {
    const segments: ConveyorSegment[] = [];
    for (let i = 1; i < path.length; i++) {
      const start = path[i - 1];
      const end = path[i];
      const direction = new THREE.Vector3().subVectors(end, start).normalize();
      const normal = new THREE.Vector3()
        .crossVectors(new THREE.Vector3(0, 1, 0), direction)
        .normalize();
      const halfWidth = width / 2;

      segments.push({
        leftStart: start.clone().add(normal.clone().multiplyScalar(-halfWidth)),
        rightStart: start.clone().add(normal.clone().multiplyScalar(halfWidth)),
        leftEnd: end.clone().add(normal.clone().multiplyScalar(-halfWidth)),
        rightEnd: end.clone().add(normal.clone().multiplyScalar(halfWidth)),
      });
    }
    return segments;
  };

  const segments1 = createSegments(path1);
  const segments2 = createSegments(path2);

  return segments1.some((seg1) =>
    segments2.some((seg2) => checkSegmentCollision(seg1, seg2))
  );
};

const checkSegmentCollision = (
  seg1: ConveyorSegment,
  seg2: ConveyorSegment
): boolean => {
  const box1 = new THREE.Box3().setFromPoints([
    seg1.leftStart,
    seg1.rightStart,
    seg1.leftEnd,
    seg1.rightEnd,
  ]);
  const box2 = new THREE.Box3().setFromPoints([
    seg2.leftStart,
    seg2.rightStart,
    seg2.leftEnd,
    seg2.rightEnd,
  ]);
  return (
    box1.intersectsBox(box2) &&
    polygonsIntersect(
      [seg1.leftStart, seg1.rightStart, seg1.rightEnd, seg1.leftEnd],
      [seg2.leftStart, seg2.rightStart, seg2.rightEnd, seg2.leftEnd]
    )
  );
};

const polygonsIntersect = (
  poly1: THREE.Vector3[],
  poly2: THREE.Vector3[]
): boolean => {
  const to2D = (p: THREE.Vector3) => new THREE.Vector2(p.x, p.z);
  const poly1_2d = poly1.map(to2D);
  const poly2_2d = poly2.map(to2D);

  const edgesIntersect = poly1_2d.some((p1: THREE.Vector2, i: number) => {
    const p2 = poly1_2d[(i + 1) % poly1_2d.length];
    return poly2_2d.some((p3: THREE.Vector2, j: number) => {
      const p4 = poly2_2d[(j + 1) % poly2_2d.length];
      return lineSegmentsIntersect(p1, p2, p3, p4);
    });
  });

  return (
    edgesIntersect ||
    pointInPolygon(poly1_2d[0], poly2_2d) ||
    pointInPolygon(poly2_2d[0], poly1_2d)
  );
};

const lineSegmentsIntersect = (
  a1: THREE.Vector2,
  a2: THREE.Vector2,
  b1: THREE.Vector2,
  b2: THREE.Vector2
): boolean => {
  const ccw = (A: THREE.Vector2, B: THREE.Vector2, C: THREE.Vector2) =>
    (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  return (
    ccw(a1, b1, b2) !== ccw(a2, b1, b2) && ccw(a1, a2, b1) !== ccw(a1, a2, b2)
  );
};

const pointInPolygon = (
  point: THREE.Vector2,
  polygon: THREE.Vector2[]
): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y;
    const xj = polygon[j].x,
      yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const Draw: React.FC = () => {
  const initialConveyors: ConveyorPath[] = [
    [
      new THREE.Vector3(-50, 0, 0),
      new THREE.Vector3(-3, 0, 0),
      new THREE.Vector3(-3, 0, 5),
      new THREE.Vector3(1, 0, 5),
      new THREE.Vector3(1, 0, 8),
      new THREE.Vector3(1, 0, 9),
      new THREE.Vector3(5, 0, 9),
      new THREE.Vector3(5, 0, 20),
      new THREE.Vector3(0, 0, 20),
      new THREE.Vector3(0, 0, 50),
    ],
    [
      new THREE.Vector3(50, 0, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -4),
      new THREE.Vector3(3, 0, -4),
      new THREE.Vector3(3, 0, -7),
      new THREE.Vector3(3, 0, -9),
      new THREE.Vector3(5, 0, -9),
      new THREE.Vector3(5, 0, -13),
      new THREE.Vector3(5, 0, -20),
      new THREE.Vector3(0, 0, -20),
      new THREE.Vector3(0, 0, -50),
      // new THREE.Vector3(0, 0, -20),
    ],
  ];

  const [conveyors, setConveyors] = useState<ConveyorPath[]>(initialConveyors);
  const [currentConveyor, setCurrentConveyor] = useState<ConveyorPath>([]);
  const [error, setError] = useState<string | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleClick = (point: THREE.Vector3) => {
    const newPath = [...currentConveyor, point.clone()];

    if (
      currentConveyor.length > 0 &&
      conveyors.some((c) => checkConveyorCollision(newPath.slice(-2), c))
    ) {
      setError("Conveyors cannot overlap!");
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = setTimeout(() => setError(null), 3000);
      return;
    }

    setCurrentConveyor(newPath);
  };

  const finishConveyor = () => {
    if (currentConveyor.length >= 2) {
      console.log("currentConveyor: ", currentConveyor);
      setConveyors([...conveyors, currentConveyor]);
      setCurrentConveyor([]);
    }
  };

  const clearAll = () => {
    setConveyors([]);
    setCurrentConveyor([]);
  };

  return (
    <div
      className="canvas-section"
      style={{ position: "relative", width: "100vw", height: "100vh" }}
    >
      <Canvas
        camera={{ position: [0, 5, -20] }}
        onCreated={({ gl, scene }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.NoToneMapping;

          // Set background to match fog
          scene.background = new THREE.Color("gray");

          // Fog starts at 20 units, ends at 100
          scene.fog = new THREE.Fog(0x3f3f3f, 2, 100);
        }}
      >
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

        <ambientLight intensity={1} />
        <pointLight position={[10, 10, 10]} />
        <RayCasterPlane onClick={handleClick} />
        {currentConveyor.map((pt, idx) => (
          <MarkPath
            key={`current-${idx}`}
            position={[pt.x, pt.y + 0.1, pt.z]}
          />
        ))}

        {currentConveyor.length >= 2 && (
          <Line
            points={currentConveyor.map((p) => [p.x, p.y + 0.1, p.z])}
            color="blue"
            lineWidth={2}
          />
        )}

        <Physics gravity={[0, -9.81, 0]}>
          {conveyors.map((path, idx) => (
            <Conveyor key={`conveyor-${idx}`} path={path} />
          ))}
          {currentConveyor.length >= 2 && <Conveyor path={currentConveyor} />}
        </Physics>

        {/* <OrbitControls ref={controlsRef} /> */}
        <CameraHandler />
        {/* <OrbitControls /> */}
        {/* <gridHelper args={[20, 20]} /> */}
      </Canvas>

      <div
        className="controls"
        style={{ position: "fixed", top: "20px", left: "20px" }}
      >
        <button onClick={finishConveyor} disabled={currentConveyor.length < 2}>
          Finish Conveyor
        </button>
        <button onClick={clearAll}>Clear All</button>
      </div>

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default Draw;
