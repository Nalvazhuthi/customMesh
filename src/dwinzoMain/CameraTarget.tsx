import * as THREE from "three";
import { Sphere } from "@react-three/drei";
import { useEffect, useRef } from "react";
import { ThreeEvent, useThree } from "@react-three/fiber";

type CameraTargetProps = {
    position: THREE.Vector3;
    index: number;
    isActive: boolean;
    isCtrlPressed: boolean;
    onDrag: (index: number, newPosition: THREE.Vector3) => void;
    onDragStart: () => void;
    onDragEnd: () => void;
    onSelect: (index: number) => void;
    onDeselect: () => void;
    onDelete: (index: number) => void;
};

const CameraTarget = ({
    position,
    index,
    isActive,
    isCtrlPressed,
    onDrag,
    onDragStart,
    onDragEnd,
    onSelect,
    onDeselect,
    onDelete,
}: CameraTargetProps) => {
    const sphereRef = useRef<THREE.Mesh>(null);
    const isDragging = useRef(false);

    const { camera, gl } = useThree();
    const raycaster = useRef(new THREE.Raycaster());
    const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)); // y = 0 plane
    const pointer = useRef(new THREE.Vector2());

    const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        isDragging.current = true;

        onSelect(index);
        onDragStart();

        // Capture pointer to handle drag outside element
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
        if (isDragging.current) {
            isDragging.current = false;
            onDragEnd();
            onDeselect();

            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        }
    };

    const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
        if (!isDragging.current) return;

        // Convert pointer to normalized device coordinates
        pointer.current.x = (e.clientX / gl.domElement.clientWidth) * 2 - 1;
        pointer.current.y = -(e.clientY / gl.domElement.clientHeight) * 2 + 1;

        // Update raycaster
        raycaster.current.setFromCamera(pointer.current, camera);

        // Intersect with the ground plane
        const intersectionPoint = new THREE.Vector3();
        if (raycaster.current.ray.intersectPlane(plane.current, intersectionPoint)) {
            const newPosition = intersectionPoint;

            // Optional axis lock when Ctrl is held
            if (isCtrlPressed) {
                newPosition.x = position.x;
                newPosition.z = position.z;
            }

            onDrag(index, newPosition);
        }
    };

    // Handle delete key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Delete" && isActive) {
                onDelete(index);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isActive, index, onDelete]);

    return (
        <group>
            <Sphere
                ref={sphereRef}
                position={position}
                args={[0.5, 16, 16]}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onPointerMove={handlePointerMove}
            >
                <meshStandardMaterial
                    color={isActive ? "hotpink" : "yellow"}
                    emissive={isActive ? "hotpink" : "yellow"}
                    emissiveIntensity={0.5}
                />
            </Sphere>
        </group>
    );
};

export default CameraTarget;
