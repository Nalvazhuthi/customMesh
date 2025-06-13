import React from "react";
import { useGLTF } from "@react-three/drei";
import { MeshPhysicalMaterial, Mesh } from "three";
import * as THREE from "three";

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
  const { nodes, materials } = useGLTF("/box.glb") as unknown as GLTFResult;

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
          transparent={true}
          transmission={1} // Enable real transparency like glass
          roughness={0}
          thickness={0.5}
          ior={1.5}
          clearcoat={1}
          clearcoatRoughness={0}
          reflectivity={1}
          attenuationColor={new THREE.Color(0xffffff)}
          attenuationDistance={0.1}
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

useGLTF.preload("/box.glb");
