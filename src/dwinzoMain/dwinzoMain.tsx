import { Canvas } from "@react-three/fiber";
import { useEffect, useState, useRef, useCallback } from "react";
import { Line, CameraControls } from "@react-three/drei";
import * as THREE from "three";
import CameraHandler from "./cameraHandler";
import RayCasterPlane from "../components/rayCasterPlane";
import MeshConvoyer from "../components/meshConvoyer";
import MeshVehicle from "./meshVehicle";
import CameraTarget from "./CameraTarget";

const SNAP_POINT_THRESHOLD = 0.5;
const SNAP_LINE_THRESHOLD = 0.5;
const SNAP_AXIS_OFFSET = 0.3;

const DwinzoMain = () => {
    const [drawMode, setDrawMode] = useState<'conveyor' | 'vehicle' | 'camera'>('conveyor');
    const [conveyorPaths, setConveyorPaths] = useState<THREE.Vector3[][]>([[]]);
    const [vehiclePaths, setVehiclePaths] = useState<THREE.Vector3[][]>([[]]);
    const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null);
    const [cameraTargets, setCameraTargets] = useState<THREE.Vector3[]>([]);
    const [activeCameraTarget, setActiveCameraTarget] = useState<number | null>(null);
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const cameraControlsRef = useRef<CameraControls>(null);

    const closestPointOnLineSegment = useCallback((a: THREE.Vector3, b: THREE.Vector3, p: THREE.Vector3): THREE.Vector3 => {
        const ab = b.clone().sub(a);
        const t = p.clone().sub(a).dot(ab) / ab.lengthSq();
        const clampedT = Math.max(0, Math.min(1, t));
        return a.clone().add(ab.multiplyScalar(clampedT));
    }, []);

    const getSnappedPoint = useCallback((hover: THREE.Vector3): THREE.Vector3 => {
        if (!hover) return hover;
        const paths = drawMode === 'conveyor' ? conveyorPaths : vehiclePaths;
        const currentLine = paths[paths.length - 1] || [];
        const lastPoint = currentLine?.[currentLine.length - 1];
        let snapped = hover.clone();

        const allPoints = [...conveyorPaths.flat(), ...vehiclePaths.flat(), ...cameraTargets];

        for (const p of allPoints) {
            if (p.distanceTo(hover) < SNAP_POINT_THRESHOLD) {
                return p.clone();
            }
        }

        for (const set of [...conveyorPaths, ...vehiclePaths]) {
            for (let i = 0; i < set.length - 1; i++) {
                const a = set[i];
                const b = set[i + 1];
                const closest = closestPointOnLineSegment(a, b, hover);
                if (closest.distanceTo(hover) < SNAP_LINE_THRESHOLD) {
                    return closest;
                }
            }
        }

        if (lastPoint) {
            const dx = Math.abs(hover.x - lastPoint.x);
            const dz = Math.abs(hover.z - lastPoint.z);
            if (dx < SNAP_AXIS_OFFSET) snapped.x = lastPoint.x;
            else if (dz < SNAP_AXIS_OFFSET) snapped.z = lastPoint.z;
        }

        return snapped;
    }, [conveyorPaths, vehiclePaths, cameraTargets, drawMode, closestPointOnLineSegment]);

    const handleClick = useCallback((point: THREE.Vector3) => {
        const snapped = getSnappedPoint(point);
        if (drawMode === 'camera') {
            setCameraTargets(prev => [...prev, snapped]);
            return;
        }

        const updater = drawMode === 'conveyor' ? setConveyorPaths : setVehiclePaths;
        updater(prev => {
            const updated = [...prev];
            const current = updated[updated.length - 1] || [];
            updated[updated.length - 1] = [...current, snapped];
            return updated;
        });
    }, [drawMode, getSnappedPoint]);

    const handleFinishDraw = useCallback(() => {
        if (drawMode === 'conveyor') {
            setConveyorPaths(prev => [...prev, []]);
            console.log(conveyorPaths);
        } else if (drawMode === 'vehicle') {
            setVehiclePaths(prev => [...prev, []]);
        }
        setHoverPoint(null);
        setActiveCameraTarget(null);
    }, [drawMode]);

    const handleHover = useCallback((point: THREE.Vector3) => {
        if (activeCameraTarget !== null) return;
        setHoverPoint(getSnappedPoint(point));
    }, [activeCameraTarget, getSnappedPoint]);

    const handleCameraTargetDrag = useCallback((index: number, position: THREE.Vector3) => {
        const snapped = getSnappedPoint(position);
        if (cameraControlsRef.current) cameraControlsRef.current.enabled = false;
        setCameraTargets(prev => {
            const updated = [...prev];
            updated[index] = snapped;
            return updated;
        });
    }, [getSnappedPoint]);

    const handleCameraTargetDragStart = useCallback(() => {
        if (cameraControlsRef.current) cameraControlsRef.current.enabled = false;
    }, []);

    const handleCameraTargetDragEnd = useCallback(() => {
        if (cameraControlsRef.current) cameraControlsRef.current.enabled = true;
    }, []);

    const handleCameraTargetClick = useCallback((index: number) => {
        setActiveCameraTarget(index);
    }, []);

    const handleDeleteCameraTarget = useCallback((index: number) => {
        setCameraTargets(prev => prev.filter((_, i) => i !== index));
        if (activeCameraTarget === index) setActiveCameraTarget(null);
    }, [activeCameraTarget]);

    const handleReachTarget = useCallback((target: THREE.Vector3) => {
        // No-op for now
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Control') setIsCtrlPressed(true);
            if (e.key === 'Enter' || e.key === 'Escape') handleFinishDraw();
            if (e.key === 'Delete' && activeCameraTarget !== null) handleDeleteCameraTarget(activeCameraTarget);
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control') setIsCtrlPressed(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [activeCameraTarget, handleDeleteCameraTarget, handleFinishDraw]);

    const paths = drawMode === 'conveyor' ? conveyorPaths : vehiclePaths;
    const currentLine = paths[paths.length - 1] || [];
    const previewLine = currentLine.length > 0 && hoverPoint ? [...currentLine, hoverPoint] : null;

    return (
        <>
            <div style={{ position: 'absolute', zIndex: 1, padding: 10 }}>
                <button onClick={handleFinishDraw}>Finish Draw</button>
                <button onClick={() => setDrawMode('conveyor')}>Conveyor Mode</button>
                <button onClick={() => setDrawMode('vehicle')}>Vehicle Mode</button>
                <button onClick={() => setDrawMode('camera')}>Camera Target</button>
                <button onClick={() => setIsPlaying(p => !p)}>Play</button>
                <div>Current Mode: <strong>{drawMode}</strong></div>
                {drawMode === 'camera' && (
                    <div>
                        <small>Click to place camera targets. Click and drag to move them.</small><br />
                        <small>Press DELETE to remove selected target.</small>
                    </div>
                )}
            </div>

            <Canvas camera={{ position: [0, 20, 0], fov: 75 }}>
                <ambientLight intensity={0.5} />
                <directionalLight castShadow position={[10, 20, 10]} />
                <pointLight position={[10, 10, 10]} />

                {conveyorPaths.map((points, idx) =>
                    points.length >= 2 && (
                        <group key={`conveyor-${idx}`}>
                            <Line points={points} color="blue" lineWidth={2} />
                            <MeshConvoyer path={points} />
                        </group>
                    )
                )}

                {vehiclePaths.map((points, idx) =>
                    points.length >= 2 && (
                        <group key={`vehicle-${idx}`}>
                            <Line points={points} color="green" lineWidth={2} />
                            <MeshVehicle path={points} />
                        </group>
                    )
                )}

                {previewLine && (
                    <Line
                        points={previewLine}
                        color="red"
                        lineWidth={1}
                        dashed
                        dashSize={0.5}
                        gapSize={0.2}
                    />
                )}

                {cameraTargets.map((position, index) => (
                    <CameraTarget
                        key={`camera-target-${index}`}
                        position={position}
                        index={index}
                        isActive={activeCameraTarget === index}
                        isCtrlPressed={isCtrlPressed}
                        onDrag={handleCameraTargetDrag}
                        onDragStart={handleCameraTargetDragStart}
                        onDragEnd={handleCameraTargetDragEnd}
                        onSelect={handleCameraTargetClick}
                        onDeselect={() => setActiveCameraTarget(null)}
                        onDelete={handleDeleteCameraTarget}
                    />
                ))}

                <RayCasterPlane
                    onClick={handleClick}
                    onMove={handleHover}
                    disabled={activeCameraTarget !== null}
                />

                <CameraHandler
                    conveyorPaths={conveyorPaths}
                    cameraTargets={cameraTargets}
                    isPlaying={isPlaying}
                    onReachTarget={handleReachTarget}
                    cameraControlsRef={cameraControlsRef}
                />
                <axesHelper />
            </Canvas>
        </>
    );
};

export default DwinzoMain;
