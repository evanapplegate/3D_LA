import { 
  BoxGeometry, 
  ConeGeometry, 
  MeshStandardMaterial, 
  Mesh, 
  Group, 
  Scene 
} from 'three'
import { GLTFExporter } from 'three-stdlib'

export function createPrimitiveHouse(): Group {
  const houseGroup = new Group()
  
  // House base (cube)
  const houseGeometry = new BoxGeometry(4, 3, 4)
  const houseMaterial = new MeshStandardMaterial({ 
    color: 0x8B4513, // Brown
    roughness: 0.8,
    metalness: 0.1
  })
  const house = new Mesh(houseGeometry, houseMaterial)
  house.position.set(0, 1.5, 0) // Lift house so it sits on ground
  houseGroup.add(house)
  
  // Roof (cone)
  const roofGeometry = new ConeGeometry(3, 2, 4)
  const roofMaterial = new MeshStandardMaterial({ 
    color: 0x654321, // Dark brown
    roughness: 0.7,
    metalness: 0.2
  })
  const roof = new Mesh(roofGeometry, roofMaterial)
  roof.position.set(0, 4, 0) // Place on top of house
  roof.rotation.y = Math.PI / 4 // Rotate 45 degrees
  houseGroup.add(roof)
  
  // Door (small rectangle)
  const doorGeometry = new BoxGeometry(0.8, 1.5, 0.1)
  const doorMaterial = new MeshStandardMaterial({ 
    color: 0x4A4A4A, // Dark gray
    roughness: 0.9,
    metalness: 0.1
  })
  const door = new Mesh(doorGeometry, doorMaterial)
  door.position.set(0, 0.75, 2.05) // Front of house
  houseGroup.add(door)
  
  // Window (small cube)
  const windowGeometry = new BoxGeometry(0.6, 0.6, 0.1)
  const windowMaterial = new MeshStandardMaterial({ 
    color: 0x87CEEB, // Sky blue (glass)
    roughness: 0.1,
    metalness: 0.9,
    transparent: true,
    opacity: 0.7
  })
  const window = new Mesh(windowGeometry, windowMaterial)
  window.position.set(1.2, 2, 2.05) // Side of house
  houseGroup.add(window)
  
  houseGroup.name = 'PrimitiveHouse'
  return houseGroup
}

export async function exportHouseAsGLB(): Promise<Blob> {
  const scene = new Scene()
  const house = createPrimitiveHouse()
  scene.add(house)
  
  const exporter = new GLTFExporter()
  
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], { type: 'application/octet-stream' })
        resolve(blob)
      },
      (error) => reject(error),
      { binary: true }
    )
  })
}

export function downloadGLB(blob: Blob, filename: string = 'primitive-house.glb') {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
} 