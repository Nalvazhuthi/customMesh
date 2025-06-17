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
import CameraPathHandler from './cameraPathHandler';
import { useControls } from 'leva';


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
    rotation: THREE.Vector3;
};

// Main Scene
const LandingScene = () => {

    const initialPath = [
        {
            "x": -7.572614605838736,
            "y": 9.266932307971994e-16,
            "z": -4.1734552889050285
        },
        {
            "x": -7.572614605838736,
            "y": -1.2052158276056684e-15,
            "z": 5.427809552105912
        },
        {
            "x": 0.04645771263356477,
            "y": -1.256794221847114e-15,
            "z": 5.427809552105912
        },
        {
            "x": 0.04645771263356477,
            "y": 1.781514684555345e-15,
            "z": -0.02322886951851932
        },
        {
            "x": -3.6391894620940666,
            "y": -5.3297731866193286e-17,
            "z": -0.02322886951851932
        },
        {
            "x": -3.6391894620940666,
            "y": 8.957461345385912e-16,
            "z": -4.034081957726562
        },
        {
            "x": 4.227655948018431,
            "y": 8.957461345385912e-16,
            "z": -4.034081957726562
        },
        {
            "x": 4.227655948018431,
            "y": -1.1811459094729615e-15,
            "z": 5.319408277772615
        },
        {
            "x": 10.282640842089634,
            "y": -1.1605145506581508e-15,
            "z": 5.319408277772615
        }
    ];
    // Initial state setup
    const initialModelsData = [
        {
            id: "b0aed40a-f8c1-4e30-b6ec-aa4731c6c0ef",
            path: "/models/armbot.glb",
            position: { x: -9.446406915583562, y: 0, z: -3.59122080177313 },
            rotation: { x: 0, y: Math.PI, z: 0 }
        },
        {
            id: "e9f61d57-714a-4541-964f-22a9399259db",
            path: "/models/armbot.glb",
            position: { x: -4.910032894487931, y: 0, z: -0.6964224752601509 },
            rotation: { x: 0, y: Math.PI, z: 0 }
        },
        {
            id: "f8554834-d1b3-4062-afb8-2c3fb799931c",
            path: "/models/armbot.glb",
            position: { x: -2.5069028549687555, y: 0, z: -2.5611027035754006 },
            rotation: { x: 0, y: 0, z: 0 }
        },
        {
            id: "64890ad0-1918-464a-8ada-44f1df33f253",
            path: "/models/edm.glb",
            position: { x: -3.5502168759690558, y: 0, z: 8.054354605555346 },
            rotation: { x: 0, y: Math.PI, z: 0 }
        },
        {
            id: "db9942da-575f-4bb4-889a-3eceb9346558",
            path: "/models/cnc.glb",
            position: { x: 6.3352095790228145, y: 0, z: 0.18696000717918393 },
            rotation: { x: 0, y: Math.PI, z: 0 }
        },
        {
            id: "8daf0f58-94a0-465d-ae1f-3a00aebade9d",
            path: "/models/amr.glb",
            position: { x: 7.200256816800632, y: 0, z: 7.844868264258275 },
            rotation: { x: 0, y: 0, z: 0 }
        },
        {
            id: "03565574-471a-47c3-bb1b-fcd42761d78a",
            path: "/models/armbot.glb",
            position: { x: 9.529805878362478, y: 0, z: 3.780254141996655 },
            rotation: { x: 0, y: Math.PI * 0.5, z: 0 }
        }
    ];

    const { offsetX, offsetY, offsetZ, moveSpeed } = useControls('Camera Offset', {
        offsetX: { value: 1.3, min: -5, max: 5, step: 0.1 },
        offsetY: { value: 4, min: -10, max: 10, step: 0.1 },
        offsetZ: { value: 3.5, min: -5, max: 5, step: 0.1 },
        moveSpeed: { value: 0.05, min: 0.005, max: 1, step: 0.001 },

    });

    // Convert to THREE.Vector3[]
    const convertedPath = initialPath.map(point => new THREE.Vector3(point.x, point.y, point.z));
    const [conveyorPaths, setConveyorPaths] = useState<THREE.Vector3[][]>([convertedPath]);
    const [cameraPath, setCameraPath] = useState<THREE.Vector3[]>(convertedPath);
    const createVector3 = (obj: { x: number; y: number; z: number }) => new THREE.Vector3(obj.x, obj.y, obj.z);

    // const [models, setModels] = useState<ModelType[]>([]);
    const [models, setModels] = useState<ModelType[]>(
        initialModelsData.map(model => ({
            ...model,
            position: createVector3(model.position),
            rotation: createVector3(model.rotation),
        }))
    );
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [drawMode, setDrawMode] = useState<'conveyor' | 'vehicle' | 'camera'>('conveyor');
    const [vehiclePaths, setVehiclePaths] = useState<THREE.Vector3[][]>([]);
    const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null);
    const [cameraTargets, setCameraTargets] = useState<THREE.Vector3[]>([]);
    const [activeCameraTarget, setActiveCameraTarget] = useState<number | null>(null);
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);
    const cameraControlsRef = useRef<CameraControls>(null);

    const [isPlaying, setIsPlaying] = useState(false);

    const handleAddModel = (name: string) => {
        const asset = ASSET_LIST.find((a) => a.name === name);
        if (!asset) return;

        const position = new THREE.Vector3(0, 0, 0);
        const rotation = new THREE.Vector3(0, 0, 0);

        setModels((prev) => [
            ...prev,
            { id: uuidv4(), path: asset.path, position, rotation },
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
            setCameraPath(prev => [...prev, snapped]);
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
        // if (cameraControlsRef.current) cameraControlsRef.current.enabled = false;
        setCameraTargets(prev => {
            const updated = [...prev];
            updated[index] = snapped;
            return updated;
        });
    }, [getSnappedPoint]);

    const handleCameraTargetDragStart = useCallback(() => {
        // if (cameraControlsRef.current) cameraControlsRef.current.enabled = false;
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
                <button onClick={() => setIsPlaying(true)}>Play Camera Path</button>

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
                        setDrawMode={setDrawMode}
                        vehiclePaths={vehiclePaths}
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
                    {cameraPath.length >= 2 && (
                        <Line points={cameraPath} color="orange" lineWidth={2} />
                    )}

                    <CameraPathHandler
                        cameraPath={cameraPath}
                        cameraTargets={cameraTargets}
                        isPlaying={isPlaying}
                        onEnd={() => setIsPlaying(false)}
                        cameraControlsRef={cameraControlsRef}
                        offset={new THREE.Vector3(offsetX, offsetY, offsetZ)}
                        moveSpeed={moveSpeed}
                    />


                    <axesHelper />
                </Canvas>
            </div>
        </div>
    );
};

export default LandingScene;
