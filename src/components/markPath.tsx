import React from 'react'

type MarkPathProps = {
  position: [number, number, number]
}

const MarkPath: React.FC<MarkPathProps> = ({ position }) => {
  return (
    <mesh position={position}>
      <boxGeometry args={[0.2, 0.2, 0.2]} />
      <meshStandardMaterial color="red" />
    </mesh>
  )
}

export default MarkPath
