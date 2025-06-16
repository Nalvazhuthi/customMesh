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
