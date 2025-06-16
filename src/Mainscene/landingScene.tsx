import { useState, useRef, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Line, CameraControls } from '@react-three/drei';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import Scene from './scene';
import RayCasterPlane from '../components/rayCasterPlane';
import CameraTarget from '../dwinzoMain/CameraTarget';
import MeshVehicle from './meshVehicle';
import MeshConvoyer from "../components/meshConvoyer";
import CameraHandler from '../dwinzoMain/cameraHandler';


// Constants
const SNAP_POINT_THRESHOLD = 0.5;
const SNAP_LINE_THRESHOLD = 0.3;
const SNAP_AXIS_OFFSET = 0.5;

// Asset list
const ASSET_LIST = [
    { name: 'amr', path: '/models/amr.glb' }, // vehicle
    { name: 'armbot', path: '/models/armbot.glb' },
    { name: 'cmm', path: '/models/cmm.glb' },
    { name: 'cnc', path: '/models/cnc.glb' },
    { name: 'edm', path: '/models/edm.glb' },
    { name: 'truck', path: '/models/truck.glb' },
    { name: 'turning', path: '/models/turning.glb' },
];

// Types
type ModelType = {
    id: string;
    path: string;
    position: THREE.Vector3;
};

// Main Scene
const LandingScene = () => {

    const [conveyorPaths, setConveyorPaths] = useState<THREE.Vector3[][]>([[]]);
    const [models, setModels] = useState<ModelType[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [drawMode, setDrawMode] = useState<'conveyor' | 'vehicle' | 'camera'>('conveyor');
    const [vehiclePaths, setVehiclePaths] = useState<THREE.Vector3[][]>([]);
    const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null);
    const [cameraTargets, setCameraTargets] = useState<THREE.Vector3[]>([]);
    const [activeCameraTarget, setActiveCameraTarget] = useState<number | null>(null);
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);

    const cameraControlsRef = useRef<CameraControls>(null);

    const handleAddModel = (name: string) => {
        const asset = ASSET_LIST.find((a) => a.name === name);
        if (!asset) return;

        const position = new THREE.Vector3(0, 0, 0);

        setModels((prev) => [
            ...prev,
            { id: uuidv4(), path: asset.path, position },
        ]);
    };

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
        const lastPoint = currentLine.length > 0 ? currentLine[currentLine.length - 1] : null;
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
            if (updated.length === 0) {
                // Start new path if none exists
                updated.push([snapped]);
            } else {
                const current = updated[updated.length - 1];
                updated[updated.length - 1] = [...current, snapped];
            }
            return updated;
        });
    }, [drawMode, getSnappedPoint]);


    const handleFinishDraw = useCallback(() => {
        if (drawMode === 'conveyor') {
            setConveyorPaths(prev => [...prev, []]);
            console.log('conveyorPaths: ', conveyorPaths);


        } else if (drawMode === 'vehicle') {
            setVehiclePaths(prev => [...prev, []]);
            console.log(vehiclePaths);
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
        <div className="content-container" style={{}}>
            <div
                className='assets'
                style={{ position: 'absolute', top: "60px", left: 0, zIndex: 1, background: 'white', padding: '0.5rem', display: "flex", gap: "10px" }}
            >
                {ASSET_LIST.map((asset, index) => (
                    <div
                        className='asset'
                        key={`${asset.name}-${index}`}
                        style={{ cursor: 'pointer', marginBottom: '0.5rem' }}
                        onClick={() => handleAddModel(asset.name)}
                    >
                        {asset.name}
                    </div>
                ))}
            </div>
            <div style={{ position: 'absolute', zIndex: 1, padding: 10 }}>
                <button onClick={handleFinishDraw}>Finish Draw</button>
                <button onClick={() => setDrawMode('conveyor')}>Conveyor Mode</button>
                <button onClick={() => setDrawMode('vehicle')}>Vehicle Mode</button>
                <button onClick={() => setDrawMode('camera')}>Camera Target</button>
                <div>Current Mode: <strong>{drawMode}</strong></div>
                {drawMode === 'camera' && (
                    <div>
                        <small>Click to place camera targets. Click and drag to move them.</small><br />
                        <small>Press DELETE to remove selected target.</small>
                    </div>
                )}
            </div>

            <div className="scene" style={{ width: '100%', height: '100%' }}>
                <Canvas camera={{ position: [0, 10, 0], fov: 75 }}>
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

                    <Scene
                        models={models}
                        selectedId={selectedId}
                        setSelectedId={setSelectedId}
                        setModels={setModels}
                        cameraControlsRef={cameraControlsRef}
                    />
        
                    <CameraHandler
                        conveyorPaths={conveyorPaths}
                        cameraTargets={cameraTargets}
                        onReachTarget={handleReachTarget}
                        cameraControlsRef={cameraControlsRef}
                    />
                    {/* <OrbitControls /> */}
                    <axesHelper />
                </Canvas>
            </div>
        </div>
    );
};

export default LandingScene;




import { CameraControls, TransformControls, useGLTF } from '@react-three/drei';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import React, { memo, Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type ModelType = {
    id: string;
    path: string;
    position: THREE.Vector3;
};

type GLTFModelProps = {
    id: string;
    path: string;
    position: THREE.Vector3;
    isSelected: boolean;
    onClick: () => void;
    onUpdatePosition: (id: string, pos: THREE.Vector3) => void;
    cameraControlsRef: React.RefObject<CameraControls | null>;
};

const GLTFModel = memo(
    ({
        id,
        path,
        position,
        isSelected,
        onClick,
        onUpdatePosition,
        cameraControlsRef,
    }: GLTFModelProps) => {
        const { scene } = useGLTF(path);
        const ref = useRef<THREE.Object3D>(null);
        const [model, setModel] = useState<THREE.Object3D | null>(null);
        const [dragging, setDragging] = useState(false);

        // Clone model once loaded
        useEffect(() => {
            const cloned = scene.clone(true);
            setModel(cloned);
        }, [scene]);

        // Update model position in parent
        useFrame(() => {
            if (isSelected && ref.current) {
                onUpdatePosition(id, ref.current.position.clone());
            }
        });

        // Enable/Disable camera controls on drag
        useEffect(() => {
            if (cameraControlsRef.current) {
                cameraControlsRef.current.enabled = !dragging;
            }

            return () => {
                if (cameraControlsRef.current) {
                    cameraControlsRef.current.enabled = true;
                }
            };
        }, [dragging, cameraControlsRef]);

        return (
            <>
                {model && (
                    <primitive
                        object={model}
                        position={position}
                        ref={ref}
                        onClick={(e: ThreeEvent<MouseEvent>) => {
                            e.stopPropagation();
                            onClick();
                        }}
                        dispose={null}
                    />
                )}
                {isSelected && ref.current && (
                    <TransformControls
                        object={ref.current}
                        mode="translate"
                        onMouseDown={(e) => setDragging(true)}
                        onMouseUp={() => setDragging(false)}
                    />
                )}
            </>
        );
    }
);

// Scene Component
const Scene = ({
    models,
    setModels,
    selectedId,
    setSelectedId,
    cameraControlsRef,
}: {
    models: ModelType[];
    selectedId: string | null;
    setSelectedId: (id: string | null) => void;
    setModels: React.Dispatch<React.SetStateAction<ModelType[]>>;
    cameraControlsRef: React.RefObject<CameraControls | null>;
}) => {
    const handleUpdatePosition = (id: string, pos: THREE.Vector3) => {
        setModels((prev) =>
            prev.map((model) =>
                model.id === id ? { ...model, position: pos } : model
            )
        );
    };

    return (
        <>
            {/* Models */}
            {models.map((model) => (
                <Suspense fallback={null} key={model.id}>
                    <GLTFModel
                        id={model.id}
                        path={model.path}
                        position={model.position}
                        onClick={() => setSelectedId(model.id)}
                        isSelected={selectedId === model.id}
                        onUpdatePosition={handleUpdatePosition}
                        cameraControlsRef={cameraControlsRef}
                    />
                </Suspense>
            ))}
        </>
    );
};

export default Scene;
