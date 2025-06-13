import { useGLTF } from "@react-three/drei";
import { Mesh, Color } from "three";
import * as THREE from "three";
import { useControls } from "leva";

type GLTFResult = {
  nodes: {
    Cube: Mesh;
    Icosphere: Mesh;
  };
  materials: {
    replace: THREE.Material;
    emission: THREE.Material;
  };
};

export function Material(props: any) {
  const { nodes, materials } = useGLTF(
    "/assets/box.glb"
  ) as unknown as GLTFResult;

  // Leva controls for material parameters
  const {
    transmission,
    roughness,
    thickness,
    ior,
    clearcoat,
    clearcoatRoughness,
    reflectivity,
    attenuationColor,
    attenuationDistance,
  } = useControls("Material", {
    transmission: { value: 1, min: 0, max: 1, step: 0.01 },
    roughness: { value: 0, min: 0, max: 1, step: 0.01 },
    thickness: { value: 0.5, min: 0, max: 1, step: 0.01 },
    ior: { value: 1.5, min: 1, max: 2.5, step: 0.01 },
    clearcoat: { value: 1, min: 0, max: 1, step: 0.01 },
    clearcoatRoughness: { value: 0, min: 0, max: 1, step: 0.01 },
    reflectivity: { value: 1, min: 0, max: 1, step: 0.01 },
    attenuationColor: { value: "#ffffff", label: "Attenuation Color" },
    attenuationDistance: { value: 0.1, min: 0.01, max: 10, step: 0.01 },
  });

  return (
    <group {...props} dispose={null}>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Cube.geometry}
        position={[0, 1, 0]}
        scale={0.25}
      >
        <meshPhysicalMaterial
          transparent
          transmission={transmission}
          roughness={roughness}
          thickness={thickness}
          ior={ior}
          clearcoat={clearcoat}
          clearcoatRoughness={clearcoatRoughness}
          reflectivity={reflectivity}
          attenuationColor={new Color(attenuationColor)}
          attenuationDistance={attenuationDistance}
        />
      </mesh>

      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Icosphere.geometry}
        material={materials.emission}
        position={[0, 1, 0]}
        scale={0.1}
      />
    </group>
  );
}

useGLTF.preload("/assets/box.glb");
