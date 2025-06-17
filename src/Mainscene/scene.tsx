import { CameraControls, TransformControls, useGLTF } from '@react-three/drei';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import React, { memo, Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type ModelType = {
    id: string;
    path: string;
    position: THREE.Vector3;
    rotation: THREE.Vector3;
    vehiclePath?: THREE.Vector3[]; // Add this line
};

type GLTFModelProps = {
    id: string;
    path: string;
    position: THREE.Vector3;
    rotation: THREE.Vector3;
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
        rotation,
        isSelected,
        onClick,
        onUpdatePosition,
        cameraControlsRef,
    }: GLTFModelProps) => {
        const { scene } = useGLTF(path);
        const ref = useRef<THREE.Group>(null);
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
                    <group
                        ref={ref}
                        position={position}
                        rotation={new THREE.Euler(rotation.x, rotation.y, rotation.z)}
                        onClick={(e: ThreeEvent<MouseEvent>) => {
                            e.stopPropagation();
                            console.log('id: ', id);
                            if (id === 'amr_console_vehicle') {
                                console.log('amr console vehicle clicked');
                            }
                            onClick();
                        }}
                    >
                        <primitive object={model} dispose={null} />
                    </group>
                )}
                {isSelected && ref.current && (
                    <TransformControls
                        object={ref.current}
                        mode="translate"
                        onMouseDown={() => setDragging(true)}
                        onMouseUp={() => setDragging(false)}
                    />
                )}
            </>
        );
    }
);

// Scene Component
const Scene = ({
    vehiclePaths,
    models,
    setModels,
    selectedId,
    setSelectedId,
    cameraControlsRef,
    setDrawMode
}: {
    vehiclePaths: any;
    setDrawMode: any;
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

    const handleSelectModel = (id: string, path: string) => {
        setSelectedId(id);
        const splitPath = path.split("/");
        const modelName = splitPath[splitPath.length - 1];

        if (modelName === "amr.glb") {
            // Find the model in the models array
            const model = models.find(m => m.id === id);
            if (model) {
                // If this AMR already has a path, you could do something with it here
                console.log('AMR vehicle path:', model.vehiclePath);
                console.log("vehiclePaths", vehiclePaths);
                // You might want to set the draw mode to vehicle here
                setDrawMode('vehicle');
            }
        }
    }

    return (
        <>
            {models.map((model) => (
                <Suspense fallback={null} key={model.id}>
                    <GLTFModel
                        id={model.id}
                        path={model.path}
                        position={model.position}
                        rotation={model.rotation}
                        onClick={() => handleSelectModel(model.id, model.path)}
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


// store the Draw Vehicle Path for that model amr