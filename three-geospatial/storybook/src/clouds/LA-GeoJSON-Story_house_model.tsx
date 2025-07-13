import { Line, Sphere } from '@react-three/drei'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { SMAA, ToneMapping } from '@react-three/postprocessing'
import type { GlobeControls as GlobeControlsImpl } from '3d-tiles-renderer'
import { GlobeControls } from '3d-tiles-renderer/r3f'
import {
  EffectMaterial,
  type EffectComposer as EffectComposerImpl
} from 'postprocessing'
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FC
} from 'react'
import { FileLoader, Vector3, Group, MeshBasicMaterial, BoxGeometry, Mesh } from 'three'

import {
  AerialPerspective,
  Atmosphere,
  type AtmosphereApi
} from '@takram/three-atmosphere/r3f'
import type { CloudsEffect } from '@takram/three-clouds'
import { Clouds } from '@takram/three-clouds/r3f'
import { Geodetic, PointOfView, radians } from '@takram/three-geospatial'
import {
  Depth,
  Dithering,
  LensFlare,
  Normal
} from '@takram/three-geospatial-effects/r3f'
import { EastNorthUpFrame } from '@takram/three-geospatial/r3f'

import { EffectComposer } from '../helpers/EffectComposer'
import { Globe } from '../helpers/Globe'
import { GoogleMapsAPIKeyPrompt } from '../helpers/GoogleMapsAPIKeyPrompt'
import { HaldLUT } from '../helpers/HaldLUT'
import { Stats } from '../helpers/Stats'
import { useColorGradingControls } from '../helpers/useColorGradingControls'
import { useControls } from '../helpers/useControls'
import { useGoogleMapsAPIKeyControls } from '../helpers/useGoogleMapsAPIKeyControls'
import { useKeyboardControl } from '../helpers/useKeyboardControl'
import {
  useLocalDateControls,
  type LocalDateControlsParams
} from '../helpers/useLocalDateControls'
import { usePovControls } from '../helpers/usePovControls'
import { useToneMappingControls } from '../helpers/useToneMappingControls'
import { useCloudsControls } from './helpers/useCloudsControls'
import { useAtomValue } from 'jotai'
import { googleMapsApiKeyAtom } from '../helpers/states'
import { createPrimitiveHouse } from '../la-mapping-tool/createPrimitiveHouse'
import { elevationService } from '../helpers/elevationService'

// Function to get minimum elevation for a path
async function getMinElevationForPath(
  coordinates: Array<{ lat: number; lng: number }>,
  apiKey: string,
  samples: number = 10
): Promise<number> {
  if (!apiKey || coordinates.length === 0) return 0
  
  try {
    const elevations = await elevationService.getElevationsForPath(
      coordinates,
      apiKey,
      samples
    )
    
    return Math.min(...elevations.map(e => e.elevation))
  } catch (error) {
    console.error('Error getting elevation for path:', error)
    return 0
  }
}

// Function to get elevation for a single point
async function getElevationForPoint(
  lat: number,
  lng: number,
  apiKey: string
): Promise<number> {
  if (!apiKey) return 0
  
  try {
    const elevations = await elevationService.getElevationsForPath(
      [{ lat, lng }],
      apiKey,
      1
    )
    
    return elevations[0]?.elevation || 0
  } catch (error) {
    console.error('Error getting elevation for point:', error)
    return 0
  }
}

// Interface for house models
interface HouseModel {
  id: string
  name: string
  position: { lat: number; lng: number; elevation: number }
  rotation: { x: number; y: number; z: number }
  scale: number
}

interface SceneProps extends LocalDateControlsParams {
  exposure?: number
  longitude?: number
  latitude?: number
  heading?: number
  pitch?: number
  distance?: number
  coverage?: number
}

interface GeoJSONFeature {
  type: string
  properties: {
    KmlName: string
    fid: number
  }
  geometry: {
    type: string
    coordinates: [number, number]
  }
}

interface GeoJSONData {
  type: string
  features: GeoJSONFeature[]
}

interface BoundaryFeature {
  type: string
  properties: any
  geometry: {
    type: 'LineString' | 'Polygon' | 'MultiLineString' | 'MultiPolygon'
    coordinates: number[][] | number[][][]
  }
}

interface BoundaryGeoJSONData {
  type: string
  features: BoundaryFeature[]
}

const GlobeAndControls: FC = () => {
  const controls = useThree(
    ({ controls }) => controls as GlobeControlsImpl | null
  )
  useEffect(() => {
    if (controls != null) {
      const callback = (): void => {
        controls.adjustHeight = true
        controls.removeEventListener('start', callback)
      }
      controls.addEventListener('start', callback)
      return () => {
        controls.removeEventListener('start', callback)
      }
    }
  }, [controls])

  return (
    <Globe>
      <GlobeControls
        enableDamping
        adjustHeight={false}
        maxAltitude={Math.PI * 0.55}
      />
    </Globe>
  )
}

const GlowingOrb: FC<{ position: Vector3; name: string; index: number }> = ({ position, name, index }) => {
  const orbRef = useRef<any>(null)
  const [hovered, setHovered] = useState(false)
  
  useFrame((state) => {
    if (orbRef.current) {
      orbRef.current.rotation.y += 0.01
      // Gentle bobbing animation
      orbRef.current.position.y = position.y + Math.sin(state.clock.elapsedTime * 2 + index) * 0.5
    }
  })

  return (
    <group
      ref={orbRef}
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <Sphere args={[hovered ? 15 : 10, 16, 16]}>
        <meshBasicMaterial color={hovered ? '#ffaa00' : '#00aaff'} transparent opacity={0.8} />
      </Sphere>
      {hovered && (
        <mesh position={[0, 25, 0]}>
          <planeGeometry args={[40, 10]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  )
}

// House Model Component
const HouseModelComponent: FC<{ model: HouseModel; onClick?: () => void }> = ({ model, onClick }) => {
  const groupRef = useRef<Group>(null)
  const [houseGeometry, setHouseGeometry] = useState<Group | null>(null)
  
  // Convert lat/lng to 3D coordinates
  const geodetic = new Geodetic(model.position.lng, model.position.lat, model.position.elevation * 0.3048)
  const worldPosition = geodetic.toECEF()

  // Create house geometry
  useEffect(() => {
    const house = createPrimitiveHouse()
    setHouseGeometry(house)
  }, [])

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.set(worldPosition.x, worldPosition.y, worldPosition.z)
      groupRef.current.rotation.set(
        (model.rotation.x * Math.PI) / 180,
        (model.rotation.y * Math.PI) / 180,
        (model.rotation.z * Math.PI) / 180
      )
      groupRef.current.scale.setScalar(model.scale)
    }
  })

  return (
    <group ref={groupRef} onClick={onClick}>
      {houseGeometry ? (
        <primitive object={houseGeometry.clone()} />
      ) : (
        <mesh>
          <boxGeometry args={[10, 10, 10]} />
          <meshBasicMaterial color={0x00ff00} transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  )
}

const AutoElevationCurtain: FC<{ 
  coordinates: number[][]; 
  wallTopAltitude: number; 
  wallDepth: number; 
  color: string; 
  thickness: number;
  apiKey: string;
}> = ({ coordinates, wallTopAltitude, wallDepth, color, thickness, apiKey }) => {
  const [curtainGeometry, setCurtainGeometry] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const createCurtain = async () => {
      if (!coordinates || coordinates.length === 0 || !apiKey) return
      
      setLoading(true)
      
      try {
        // Sample points along the boundary
        const samplePoints = coordinates.reduce((acc, coord, index) => {
          if (index % 3 === 0) { // Sample every 3rd point to avoid too many API calls
            acc.push({ lat: coord[1], lng: coord[0] })
          }
          return acc
        }, [] as Array<{ lat: number; lng: number }>)
        
        const minElevation = await getMinElevationForPath(samplePoints, apiKey, 20)
        const baseAltitude = minElevation - wallDepth // Dig walls deep into terrain
        
        // Create curtain geometry
        const curtainPoints: Vector3[] = []
        const curtainVertices: number[] = []
        const curtainIndices: number[] = []
        
        coordinates.forEach((coord, index) => {
          const geodetic = new Geodetic(radians(coord[0]), radians(coord[1]), baseAltitude)
          const worldPos = geodetic.toECEF()
          
          // Bottom vertex
          curtainVertices.push(worldPos.x, worldPos.y, worldPos.z)
          
          // Top vertex  
          const topGeo = new Geodetic(radians(coord[0]), radians(coord[1]), wallTopAltitude)
          const topWorldPos = topGeo.toECEF()
          curtainVertices.push(topWorldPos.x, topWorldPos.y, topWorldPos.z)
          
          // Create triangles for the curtain
          if (index < coordinates.length - 1) {
            const base = index * 2
            // First triangle
            curtainIndices.push(base, base + 1, base + 2)
            // Second triangle
            curtainIndices.push(base + 1, base + 3, base + 2)
          }
        })
        
        setCurtainGeometry({
          vertices: new Float32Array(curtainVertices),
          indices: new Uint16Array(curtainIndices)
        })
        
      } catch (error) {
        console.error('Error creating curtain:', error)
      } finally {
        setLoading(false)
      }
    }
    
    createCurtain()
  }, [coordinates, wallTopAltitude, wallDepth, apiKey])

  if (loading || !curtainGeometry) {
    return null
  }

  return (
    <mesh>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={curtainGeometry.vertices}
          count={curtainGeometry.vertices.length / 3}
          itemSize={3}
        />
        <bufferAttribute
          attach="index"
          array={curtainGeometry.indices}
          count={curtainGeometry.indices.length}
          itemSize={1}
        />
      </bufferGeometry>
      <meshBasicMaterial color={color} transparent opacity={0.6} side={2} />
    </mesh>
  )
}

const jsonLoader = new FileLoader().setResponseType('json')

const Scene: FC<SceneProps> = ({
  exposure = 15,
  longitude = -118.242643,
  latitude = 34.0549076,
  heading = -110,
  pitch = -25,
  distance = 15000,
  coverage = 0.4,
  ...localDate
}) => {
  const { toneMappingMode } = useToneMappingControls({ exposure })
  const { orthographic } = useControls(
    'camera',
    { orthographic: false },
    { collapsed: true }
  )
  const lut = useColorGradingControls()
  const { lensFlare, normal, depth } = useControls(
    'effects',
    {
      lensFlare: true,
      depth: false,
      normal: false
    },
    { collapsed: true }
  )
  const camera = useThree(({ camera }) => camera)
  usePovControls(camera, { collapsed: true })
  const motionDate = useLocalDateControls({ longitude, ...localDate })
  const { correctAltitude, correctGeometricError } = useControls(
    'atmosphere',
    {
      correctAltitude: true,
      correctGeometricError: true
    },
    { collapsed: true }
  )

  // House model controls
  const { showHouses, houseScale, houseHeight } = useControls('house models', {
    showHouses: true,
    houseScale: { value: 1, min: 0.1, max: 5, step: 0.1 },
    houseHeight: { value: 50, min: 0, max: 200, step: 10 }
  })

  // Orb controls
  const { showOrbs, orbHeight, orbScale } = useControls('glowing orbs', {
    showOrbs: true,
    orbHeight: { value: 500, min: 10, max: 2000, step: 10 },
    orbScale: { value: 1, min: 0.1, max: 5, step: 0.1 }
  })

  // Boundary controls
  const { showBoundary, wallTopAltitude, wallDepth, boundaryColor, lineThickness } = useControls('auto boundary walls', {
    showBoundary: true,
    wallTopAltitude: { value: 500, min: 100, max: 2000, step: 50 },
    wallDepth: { value: 300, min: 50, max: 1000, step: 25 },
    boundaryColor: '#00ffff',
    lineThickness: { value: 8, min: 1, max: 50, step: 1 }
  })

  // Get API key for elevation service
  const apiKey = useAtomValue(googleMapsApiKeyAtom) || 
    import.meta.env.STORYBOOK_GOOGLE_MAP_API_KEY || ''

  // Load GeoJSON data
  const geoJsonData = useLoader(jsonLoader, 'public/my_points.geojson') as unknown as GeoJSONData
  const boundaryData = useLoader(jsonLoader, 'public/fs_bound.geojson') as unknown as BoundaryGeoJSONData

  // Process GeoJSON data for orbs
  const orbPositions = useMemo(() => {
    if (!geoJsonData?.features) return []
    
    return geoJsonData.features.map((feature, index) => {
      const [longitude, latitude] = feature.geometry.coordinates
      const position = new Vector3(0, orbHeight / 10, 0) // Convert to reasonable 3D scale
      
      return {
        id: `orb-${index}`,
        name: feature.properties.KmlName,
        longitude,
        latitude,
        position
      }
    })
  }, [geoJsonData, orbHeight])

  // Process GeoJSON data for house models
  const houseModels = useMemo(() => {
    if (!geoJsonData?.features || !showHouses) return []
    
    return geoJsonData.features.slice(0, 5).map((feature, index) => ({ // Limit to 5 houses
      id: `house-${index}`,
      name: `House ${feature.properties.KmlName}`,
      position: {
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
        elevation: houseHeight
      },
      rotation: { x: 0, y: Math.random() * 360, z: 0 }, // Random rotation
      scale: houseScale
    }))
  }, [geoJsonData, showHouses, houseHeight, houseScale])

  // Process boundary data
  const boundaryLines = useMemo(() => {
    if (!boundaryData?.features) return []
    
    return boundaryData.features.map((feature, index) => {
      let coordinates: number[][] = []
      
      if (feature.geometry.type === 'LineString') {
        coordinates = feature.geometry.coordinates as number[][]
      } else if (feature.geometry.type === 'Polygon') {
        coordinates = (feature.geometry.coordinates as number[][][])[0]
      }
      
      return {
        id: `boundary-${index}`,
        coordinates
      }
    })
  }, [boundaryData])

  const camera2 = useThree(({ camera }) => camera)
  const [clouds, setClouds] = useState<CloudsEffect | null>(null)

  const cloudsProps = useCloudsControls({
    coverage,
    clouds,
    collapsed: true
  })

  useLayoutEffect(() => {
    const geodetic = new Geodetic(
      radians(longitude),
      radians(latitude),
      0
    )
    const target = geodetic.toECEF()
    const pov = new PointOfView()
    pov.distance = distance
    pov.heading = radians(heading)
    pov.pitch = radians(pitch)
    pov.decompose(target, camera2.position, camera2.quaternion, camera2.up)
  }, [camera2, longitude, latitude, heading, pitch, distance])

  useKeyboardControl(camera2, {
    moveSpeed: 1000,
    turnSpeed: 0.5,
    enableDamping: true,
    dampingFactor: 0.05
  })

  const composerRef = useRef<EffectComposerImpl>(null)
  useFrame(() => {
    const composer = composerRef.current
    if (composer != null) {
      composer.passes.forEach(pass => {
        if (pass.fullscreenMaterial instanceof EffectMaterial) {
          pass.fullscreenMaterial.adoptCameraSettings(camera2)
        }
      })
    }
  })

  const atmosphereRef = useRef<AtmosphereApi>(null)
  useFrame(() => {
    atmosphereRef.current?.updateByDate(new Date(motionDate.get()))
  })

  return (
    <Atmosphere ref={atmosphereRef} correctAltitude={correctAltitude}>
      <GlobeAndControls />
      
      {/* Glowing orbs at each GeoJSON point */}
      {showOrbs && orbPositions.map((orb, index) => (
        <EastNorthUpFrame
          key={orb.id}
          longitude={radians(orb.longitude)}
          latitude={radians(orb.latitude)}
          height={0}
        >
          <group scale={orbScale}>
            <GlowingOrb
              position={orb.position}
              name={orb.name}
              index={index}
            />
          </group>
        </EastNorthUpFrame>
      ))}

      {/* House models at GeoJSON points */}
      {showHouses && houseModels.map((house) => (
        <EastNorthUpFrame
          key={house.id}
          longitude={radians(house.position.lng)}
          latitude={radians(house.position.lat)}
          height={house.position.elevation * 0.3048}
        >
          <HouseModelComponent
            model={house}
            onClick={() => console.log('House clicked:', house.name)}
          />
        </EastNorthUpFrame>
      ))}

      {/* Glowing boundary curtains */}
      {showBoundary && boundaryLines.length > 0 && boundaryLines[0] && (
        <AutoElevationCurtain
          coordinates={boundaryLines[0].coordinates}
          wallTopAltitude={wallTopAltitude}
          wallDepth={wallDepth}
          color={boundaryColor}
          thickness={lineThickness}
          apiKey={apiKey}
        />
      )}

      <EffectComposer ref={composerRef} multisampling={0}>
        <Fragment
          key={JSON.stringify([
            correctGeometricError,
            lensFlare,
            normal,
            depth,
            lut
          ])}
        >
          {!normal && !depth && (
            <>
              <Clouds ref={setClouds} shadow-farScale={0.25} {...cloudsProps} />
              <AerialPerspective
                sky
                sunLight
                skyLight
                correctGeometricError={correctGeometricError}
                albedoScale={2 / Math.PI}
              />
            </>
          )}
          {lensFlare && <LensFlare />}
          {depth && <Depth useTurbo />}
          {normal && <Normal />}
          {!normal && !depth && (
            <>
              <ToneMapping mode={toneMappingMode} />
              {lut != null && <HaldLUT path={lut} />}
              <SMAA />
              <Dithering />
            </>
          )}
        </Fragment>
      </EffectComposer>
    </Atmosphere>
  )
}

export default {
  title: 'Clouds / LA GeoJSON Integration_house_model',
  component: Scene,
  parameters: {
    layout: 'fullscreen'
  }
} as const

export { Scene } 