import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Vector3, Euler, Object3D, Group, MeshBasicMaterial, BoxGeometry, Mesh } from 'three'
import { 
  Atmosphere, 
  AerialPerspective, 
  Sky, 
  Stars 
} from '@takram/three-atmosphere/r3f'
import { Clouds } from '@takram/three-clouds/r3f'
import { Globe } from '../helpers/Globe'
import { Geodetic, PointOfView, radians } from '@takram/three-geospatial'
import { createPrimitiveHouse, exportHouseAsGLB, downloadGLB } from './createPrimitiveHouse'
import './LAMappingTool.css'

// LA Points data for reference markers
const LA_POINTS = [
  { name: "Los Angeles", lat: 34.0549076, lng: -118.242643 },
  { name: "Santa Monica", lat: 34.0118828, lng: -118.4915504 },
  { name: "Pasadena", lat: 34.1476527, lng: -118.144302 },
  { name: "Burbank", lat: 34.1819029, lng: -118.307926 },
  { name: "Santa Barbara", lat: 34.420285, lng: -119.698935 },
  { name: "Culver City", lat: 34.0211416, lng: -118.396800 },
  { name: "Marina del Rey", lat: 33.9804613, lng: -118.439165 },
  { name: "Hawthorne", lat: 33.9164032, lng: -118.352575 },
  { name: "Torrance", lat: 33.8369217, lng: -118.3407451 },
  { name: "Long Beach", lat: 33.7700504, lng: -118.1937395 }
]

// LA area coordinate bounds
const LA_BOUNDS = {
  center: { lat: 34.0549, lng: -118.2427 },
  north: 34.8,
  south: 33.0,
  east: -116.5,
  west: -119.5
}

interface Model3D {
  id: string
  name: string
  position: { lat: number; lng: number; elevation: number }
  rotation: { x: number; y: number; z: number }
  scale: number
  mesh?: Object3D
  type: 'blender' | 'preset' | 'primitive'
  glbPath?: string
}

interface ModelLoadingProps {
  onModelLoad: (model: Model3D) => void
  onClose: () => void
}

export const ModelLoadingDialog: React.FC<ModelLoadingProps> = ({ onModelLoad, onClose }) => {
  const [modelName, setModelName] = useState('')
  const [modelType, setModelType] = useState<'blender' | 'preset' | 'primitive'>('primitive')
  const [isGenerating, setIsGenerating] = useState(false)

  const handleLoadModel = async () => {
    if (!modelName.trim()) return

    if (modelType === 'primitive') {
      setIsGenerating(true)
      try {
        // Generate and download GLB file
        const blob = await exportHouseAsGLB()
        downloadGLB(blob, `${modelName}-house.glb`)
        
        // Create model with primitive house geometry
        const newModel: Model3D = {
          id: Date.now().toString(),
          name: modelName,
          position: { lat: 34.0549, lng: -118.2427, elevation: 0 }, // Default to LA center
          rotation: { x: 0, y: 0, z: 0 },
          scale: 1,
          type: 'primitive'
        }
        
        onModelLoad(newModel)
        onClose()
      } catch (error) {
        console.error('Error generating house:', error)
      } finally {
        setIsGenerating(false)
      }
    } else {
      // Handle other model types (blender, preset)
      const newModel: Model3D = {
        id: Date.now().toString(),
        name: modelName,
        position: { lat: 34.0549, lng: -118.2427, elevation: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1,
        type: modelType
      }
      
      onModelLoad(newModel)
      onClose()
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>🏠 Add 3D Model</h2>
        
        <div className="form-group">
          <label>Model Name:</label>
          <input
            type="text"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="Enter model name"
          />
        </div>

        <div className="form-group">
          <label>Model Type:</label>
          <select 
            value={modelType} 
            onChange={(e) => setModelType(e.target.value as 'blender' | 'preset' | 'primitive')}
          >
            <option value="primitive">🏠 Primitive House (Generated)</option>
            <option value="blender">📁 Blender Model (Upload GLB)</option>
            <option value="preset">🎁 Preset House</option>
          </select>
        </div>

        {modelType === 'primitive' && (
          <div className="info-box">
            <p>🎨 This will generate a simple house with:</p>
            <ul>
              <li>Brown cube base</li>
              <li>Cone roof</li>
              <li>Door and window</li>
              <li>Downloads as GLB file</li>
            </ul>
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button 
            onClick={handleLoadModel} 
            disabled={!modelName.trim() || isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Load Model'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface PositioningControlsProps {
  model: Model3D
  onUpdateModel: (model: Model3D) => void
  onClose: () => void
}

export const PositioningControls: React.FC<PositioningControlsProps> = ({ model, onUpdateModel, onClose }) => {
  const [position, setPosition] = useState(model.position)
  const [rotation, setRotation] = useState(model.rotation)
  const [scale, setScale] = useState(model.scale)

  const handleUpdate = (field: string, value: number) => {
    const updatedModel = { ...model }
    
    if (field.startsWith('pos_')) {
      const posField = field.replace('pos_', '') as keyof typeof position
      const newPosition = { ...position, [posField]: value }
      setPosition(newPosition)
      updatedModel.position = newPosition
    } else if (field.startsWith('rot_')) {
      const rotField = field.replace('rot_', '') as keyof typeof rotation
      const newRotation = { ...rotation, [rotField]: value }
      setRotation(newRotation)
      updatedModel.rotation = newRotation
    } else if (field === 'scale') {
      setScale(value)
      updatedModel.scale = value
    }
    
    onUpdateModel(updatedModel)
  }

  return (
    <div className="positioning-controls">
      <div className="controls-content">
        <h3>Position & Rotate: {model.name}</h3>
        
        <div className="control-group">
          <h4>Position</h4>
          <label>
            Latitude:
            <input
              type="number"
              value={position.lat}
              onChange={(e) => handleUpdate('pos_lat', parseFloat(e.target.value))}
              step="0.001"
              min={LA_BOUNDS.south}
              max={LA_BOUNDS.north}
            />
          </label>
          <label>
            Longitude:
            <input
              type="number"
              value={position.lng}
              onChange={(e) => handleUpdate('pos_lng', parseFloat(e.target.value))}
              step="0.001"
              min={LA_BOUNDS.west}
              max={LA_BOUNDS.east}
            />
          </label>
          <label>
            Elevation (ft):
            <input
              type="range"
              value={position.elevation}
              onChange={(e) => handleUpdate('pos_elevation', parseFloat(e.target.value))}
              min="-50"
              max="50"
              step="1"
            />
            <span>{position.elevation}ft</span>
          </label>
        </div>

        <div className="control-group">
          <h4>Rotation (degrees)</h4>
          <label>
            X-axis:
            <input
              type="range"
              value={rotation.x}
              onChange={(e) => handleUpdate('rot_x', parseFloat(e.target.value))}
              min="0"
              max="360"
              step="1"
            />
            <span>{rotation.x}°</span>
          </label>
          <label>
            Y-axis:
            <input
              type="range"
              value={rotation.y}
              onChange={(e) => handleUpdate('rot_y', parseFloat(e.target.value))}
              min="0"
              max="360"
              step="1"
            />
            <span>{rotation.y}°</span>
          </label>
          <label>
            Z-axis:
            <input
              type="range"
              value={rotation.z}
              onChange={(e) => handleUpdate('rot_z', parseFloat(e.target.value))}
              min="0"
              max="360"
              step="1"
            />
            <span>{rotation.z}°</span>
          </label>
        </div>

        <div className="control-group">
          <h4>Scale</h4>
          <label>
            Size:
            <input
              type="range"
              value={scale}
              onChange={(e) => handleUpdate('scale', parseFloat(e.target.value))}
              min="0.1"
              max="5"
              step="0.1"
            />
            <span>{scale}x</span>
          </label>
        </div>

        <div className="dialog-actions">
          <button onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

const Model3DComponent: React.FC<{ model: Model3D; onClick: () => void }> = ({ model, onClick }) => {
  const group = useRef<Group>(null)
  const [houseGeometry, setHouseGeometry] = useState<Group | null>(null)

  // Convert lat/lng to 3D coordinates
  const geodetic = new Geodetic(model.position.lng, model.position.lat, model.position.elevation * 0.3048) // ft to meters
  const worldPosition = geodetic.toECEF()

  // Create house geometry when model type is primitive
  useEffect(() => {
    if (model.type === 'primitive') {
      const house = createPrimitiveHouse()
      setHouseGeometry(house)
    }
  }, [model.type])

  useFrame(() => {
    if (group.current) {
      group.current.position.set(worldPosition.x, worldPosition.y, worldPosition.z)
      group.current.rotation.set(
        (model.rotation.x * Math.PI) / 180,
        (model.rotation.y * Math.PI) / 180,
        (model.rotation.z * Math.PI) / 180
      )
      group.current.scale.setScalar(model.scale)
    }
  })

  // Render different content based on model type
  const renderModel = () => {
    if (model.type === 'primitive' && houseGeometry) {
      return <primitive object={houseGeometry.clone()} />
    }
    
    if (model.glbPath) {
      // For GLB files (when implemented)
      try {
        const { scene } = useGLTF(model.glbPath)
        return <primitive object={scene.clone()} />
      } catch (error) {
        console.warn('Failed to load GLB:', error)
      }
    }
    
    // Fallback: Create a placeholder mesh (box)
    const geometry = new BoxGeometry(10, 10, 10)
    const material = new MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.7 })
    return <mesh geometry={geometry} material={material} />
  }

  return (
    <group ref={group} onClick={onClick}>
      {renderModel()}
    </group>
  )
}

const LAPointMarker: React.FC<{ point: { name: string; lat: number; lng: number } }> = ({ point }) => {
  const group = useRef<Group>(null)
  
  // Convert lat/lng to 3D coordinates
  const geodetic = new Geodetic(radians(point.lng), radians(point.lat), 0)
  const worldPosition = geodetic.toECEF()

  useFrame(() => {
    if (group.current) {
      group.current.position.set(worldPosition.x, worldPosition.y, worldPosition.z)
    }
  })

  // Create a small marker sphere
  const geometry = new BoxGeometry(5, 5, 5)
  const material = new MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.8 })

  return (
    <group ref={group}>
      <mesh geometry={geometry} material={material} />
    </group>
  )
}

const LAScene: React.FC<{
  models: Model3D[]
  onModelClick: (model: Model3D) => void
}> = ({ models, onModelClick }) => {
  const atmosphereRef = useRef<any>(null)
  const { camera } = useThree()

  // Set initial camera position to LA area
  useEffect(() => {
    const pov = new PointOfView()
    const target = new Geodetic(radians(LA_BOUNDS.center.lng), radians(LA_BOUNDS.center.lat), 0).toECEF()
    pov.distance = 10000 // 10km distance
    pov.heading = radians(-90)
    pov.pitch = radians(-45)
    pov.decompose(target, camera.position, camera.quaternion, camera.up)
  }, [camera])

  useFrame(() => {
    if (atmosphereRef.current) {
      atmosphereRef.current.updateByDate(new Date())
    }
  })

  return (
    <Atmosphere ref={atmosphereRef} correctAltitude={true}>
      <Sky />
      <Stars data="atmosphere/stars.bin" />
      <Globe>
        <OrbitControls 
          enableDamping
          dampingFactor={0.05}
          target={[0, 0, 0]}
          minDistance={100}
          maxDistance={50000}
        />
        
        {models.map(model => (
          <Model3DComponent
            key={model.id}
            model={model}
            onClick={() => onModelClick(model)}
          />
        ))}
        
        {LA_POINTS.map(point => (
          <LAPointMarker key={point.name} point={point} />
        ))}
      </Globe>
    </Atmosphere>
  )
}

// 3D Scene component that only renders Three.js elements
const LAMappingTool: React.FC<{
  models?: Model3D[]
  onModelClick?: (model: Model3D) => void
}> = ({ models = [], onModelClick = () => {} }) => {
  return (
    <LAScene
      models={models}
      onModelClick={onModelClick}
    />
  )
}

// Hook for managing tool state
export const useLAMappingTool = () => {
  const [models, setModels] = useState<Model3D[]>([])
  const [showModelDialog, setShowModelDialog] = useState(false)
  const [showPositioningControls, setShowPositioningControls] = useState(false)
  const [selectedModel, setSelectedModel] = useState<Model3D | null>(null)

  const handleModelLoad = useCallback((model: Model3D) => {
    setModels(prev => [...prev, model])
    setShowModelDialog(false)
  }, [])

  const handleModelClick = useCallback((model: Model3D) => {
    setSelectedModel(model)
    setShowPositioningControls(true)
  }, [])

  const handleUpdateModel = useCallback((updatedModel: Model3D) => {
    setModels(prev => prev.map(m => m.id === updatedModel.id ? updatedModel : m))
    setSelectedModel(updatedModel)
  }, [])

  const handleDeleteModel = useCallback((modelId: string) => {
    setModels(prev => prev.filter(m => m.id !== modelId))
    if (selectedModel?.id === modelId) {
      setSelectedModel(null)
      setShowPositioningControls(false)
    }
  }, [selectedModel])

  return {
    models,
    showModelDialog,
    showPositioningControls,
    selectedModel,
    handleModelLoad,
    handleModelClick,
    handleUpdateModel,
    handleDeleteModel,
    setShowModelDialog,
    setShowPositioningControls
  }
}

export default LAMappingTool 