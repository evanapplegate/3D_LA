import { Line, Sphere, Plane } from '@react-three/drei'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { SMAA, ToneMapping } from '@react-three/postprocessing'
import { CameraTransition, GlobeControls } from '3d-tiles-renderer/r3f'
import {
  EffectMaterial,
  type EffectComposer as EffectComposerImpl
} from 'postprocessing'
import { Fragment, useLayoutEffect, useMemo, useRef, type FC } from 'react'
import { FileLoader, Vector3, BufferGeometry, BufferAttribute } from 'three'

import {
  AerialPerspective,
  Atmosphere,
  Sky,
  Stars,
  type AtmosphereApi
} from '@takram/three-atmosphere/r3f'
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
import {
  useLocalDateControls,
  type LocalDateControlsParams
} from '../helpers/useLocalDateControls'
import { useToneMappingControls } from '../helpers/useToneMappingControls'
import { useAtomValue } from 'jotai'
import { googleMapsApiKeyAtom } from '../helpers/states'
import { useState, useEffect } from 'react'

// Inline elevation service
async function getMinElevationForPath(
  coordinates: Array<{ lat: number; lng: number }>,
  apiKey: string,
  samples: number = 10
): Promise<number> {
  if (coordinates.length < 2) return 0
  
  const samplePoints: Array<{ lat: number; lng: number }> = []
  
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1)
    const segmentIndex = Math.floor(t * (coordinates.length - 1))
    const localT = (t * (coordinates.length - 1)) - segmentIndex
    
    if (segmentIndex >= coordinates.length - 1) {
      samplePoints.push(coordinates[coordinates.length - 1])
    } else {
      const start = coordinates[segmentIndex]
      const end = coordinates[segmentIndex + 1]
      
      samplePoints.push({
        lat: start.lat + (end.lat - start.lat) * localT,
        lng: start.lng + (end.lng - start.lng) * localT
      })
    }
  }
  
  const locations = samplePoints.map(coord => `${coord.lat},${coord.lng}`).join('|')
  const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${encodeURIComponent(locations)}&key=${apiKey}`
  
  try {
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.status === 'OK') {
      const elevations = data.results.map((result: any) => result.elevation)
      return Math.min(...elevations)
    } else {
      console.warn('Elevation API failed:', data.status)
      return 0
    }
  } catch (error) {
    console.error('Failed to fetch elevation:', error)
    return 0
  }
}

interface SceneProps extends LocalDateControlsParams {
  exposure?: number
  longitude?: number
  latitude?: number
  heading?: number
  pitch?: number
  distance?: number
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

const jsonLoader = new FileLoader().setResponseType('json')

const GlowingOrb: FC<{ position: Vector3; name: string; index: number }> = ({ position, name, index }) => {
  const meshRef = useRef<any>(null)
  
  // Animate the orbs with a subtle pulse
  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.elapsedTime
      const pulseSpeed = 1 + index * 0.1 // Vary speed slightly per orb
      const scale = 1 + Math.sin(time * pulseSpeed) * 0.2
      meshRef.current.scale.setScalar(scale)
    }
  })

  return (
    <Sphere
      ref={meshRef}
      args={[100, 16, 16]} // 100m radius sphere
      position={position}
    >
      <meshStandardMaterial
        color={`hsl(${(index * 137.5) % 360}, 70%, 60%)`}
        emissive={`hsl(${(index * 137.5) % 360}, 70%, 50%)`}
        emissiveIntensity={0.8}
        transparent
        opacity={0.9}
      />
    </Sphere>
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
  const meshRef = useRef<any>(null)
  const [terrainElevation, setTerrainElevation] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  
  // Fetch terrain elevation when coordinates change
  useEffect(() => {
    if (coordinates.length < 2 || !apiKey) return
    
    setIsLoading(true)
    const coordsForAPI = coordinates.map(([lng, lat]) => ({ lat, lng }))
    
    getMinElevationForPath(coordsForAPI, apiKey, 10)
      .then((minElevation: number) => {
        // Add aggressive safety offset - Google 3D tiles have higher resolution
        const safeElevation = minElevation - 300 // 300m below API elevation for safety
        setTerrainElevation(safeElevation)
        console.log(`API elevation: ${minElevation}m, using safe: ${safeElevation}m`)
      })
      .catch(error => {
        console.error('Elevation API failed:', error)
        setTerrainElevation(-500) // Deep fallback
      })
      .finally(() => setIsLoading(false))
  }, [coordinates, apiKey])
  
  // Animate the curtain with a subtle glow pulse
  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.elapsedTime
      const intensity = 0.3 + Math.sin(time * 2) * 0.2
      meshRef.current.material.emissiveIntensity = intensity
    }
  })

  // Create wall geometry that extends DOWN from top altitude
  const wallGeometry = useMemo(() => {
    if (coordinates.length < 3) return null
    
    const firstLng = coordinates[0][0]
    const firstLat = coordinates[0][1]
    const meterPerDegree = 111320
    
    // Convert coordinates to local positions
    const localPoints = coordinates.map(([lng, lat]) => {
      const localX = (lng - firstLng) * meterPerDegree * Math.cos(radians(firstLat))
      const localY = (lat - firstLat) * meterPerDegree
      return new Vector3(localX, localY, 0)
    })
    
    // Create vertices - wall extends DOWN from top (Z=0) to bottom (Z=-wallDepth)
    const vertices = []
    const indices = []
    
    for (let i = 0; i < localPoints.length; i++) {
      const point = localPoints[i]
      // Top vertex (at wall top altitude)
      vertices.push(point.x, point.y, 0)
      // Bottom vertex (extends down below terrain)
      vertices.push(point.x, point.y, -wallDepth)
    }
    
    // Create triangular faces for the wall
    const numPoints = localPoints.length
    
    for (let i = 0; i < numPoints; i++) {
      const nextI = (i + 1) % numPoints
      
      const topI = i * 2
      const bottomI = i * 2 + 1
      const topNext = nextI * 2
      const bottomNext = nextI * 2 + 1
      
      // Create two triangles for each wall segment
      indices.push(topI, topNext, bottomI)
      indices.push(topNext, bottomNext, bottomI)
    }
    
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    
    return geometry
  }, [coordinates, wallDepth])

  // Calculate centroid for positioning
  const centroid = useMemo(() => {
    if (coordinates.length === 0) return [0, 0]
    
    const sum = coordinates.reduce(
      (acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]],
      [0, 0]
    )
    return [sum[0] / coordinates.length, sum[1] / coordinates.length]
  }, [coordinates])

  if (isLoading || !wallGeometry) return null

  return (
    <EastNorthUpFrame
      longitude={radians(centroid[0])}
      latitude={radians(centroid[1])}
      height={terrainElevation + wallTopAltitude} // Position at terrain + wall height
    >
      <mesh ref={meshRef} geometry={wallGeometry}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          transparent
          opacity={0.7}
          side={2}
        />
      </mesh>
    </EastNorthUpFrame>
  )
}



const Scene: FC<SceneProps> = ({
  exposure = 30,
  longitude = -118.242643,
  latitude = 34.0549076,
  heading = -110,
  pitch = -25,
  distance = 15000,
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
  const motionDate = useLocalDateControls({ longitude, ...localDate })
  const { correctAltitude, correctGeometricError } = useControls('atmosphere', {
    correctAltitude: true,
    correctGeometricError: true
  })
  const {
    enable: enabled,
    sun,
    sky,
    transmittance,
    inscatter
  } = useControls('aerial perspective', {
    enable: true,
    sun: true,
    sky: true,
    transmittance: true,
    inscatter: true
  })

  // Orb controls
  const { showOrbs, orbHeight, orbScale } = useControls('glowing orbs', {
    showOrbs: true,
    orbHeight: { value: 500, min: 10, max: 2000, step: 10 }, // Start at 500m height
    orbScale: { value: 1, min: 0.1, max: 5, step: 0.1 }
  })

  // Boundary controls with automatic terrain elevation
  const { showBoundary, wallTopAltitude, wallDepth, boundaryColor, lineThickness } = useControls('auto boundary walls', {
    showBoundary: true,
    wallTopAltitude: { value: 800, min: 200, max: 2000, step: 50 }, // Wall top altitude
    wallDepth: { value: 1500, min: 500, max: 3000, step: 100 }, // Deep walls to avoid clipping
    boundaryColor: '#00ffff',
    lineThickness: { value: 8, min: 1, max: 50, step: 1 }
  })

  // Get API key for elevation service
  const apiKey = useAtomValue(googleMapsApiKeyAtom) || 
    import.meta.env.STORYBOOK_GOOGLE_MAP_API_KEY || ''

  // Load GeoJSON data
  const geoJsonData = useLoader(jsonLoader, 'public/my_points.geojson') as unknown as GeoJSONData
  const boundaryData = useLoader(jsonLoader, 'public/fs_bound.geojson') as unknown as BoundaryGeoJSONData

  // Convert GeoJSON coordinates to 3D positions
  const orbPositions = useMemo(() => {
    if (!geoJsonData?.features) return []
    
    return geoJsonData.features.map(feature => {
      const [lng, lat] = feature.geometry.coordinates
      return {
        position: new Vector3(0, 0, orbHeight), // Position relative to surface (Z is up)
        longitude: lng,
        latitude: lat,
        name: feature.properties.KmlName,
        id: feature.properties.fid
      }
    })
  }, [geoJsonData, orbHeight])

  // Process boundary data
  const boundaryLines = useMemo(() => {
    if (!boundaryData?.features) return []
    
    const allBoundaries: any[] = []
    
    boundaryData.features.forEach((feature, featureIndex) => {
      // Handle different geometry types
      if (feature.geometry.type === 'LineString') {
        const coordinates = feature.geometry.coordinates as number[][]
        allBoundaries.push({
          coordinates,
          id: `feature-${featureIndex}-line`
        })
      } else if (feature.geometry.type === 'Polygon') {
        const coordinates = (feature.geometry.coordinates as number[][][])[0] // Use outer ring
        allBoundaries.push({
          coordinates,
          id: `feature-${featureIndex}-polygon`
        })
      } else if (feature.geometry.type === 'MultiLineString') {
        const multiLineCoords = feature.geometry.coordinates as number[][][]
        multiLineCoords.forEach((lineCoords, lineIndex) => {
          allBoundaries.push({
            coordinates: lineCoords,
            id: `feature-${featureIndex}-multiline-${lineIndex}`
          })
        })
      } else if (feature.geometry.type === 'MultiPolygon') {
        const multiPolygonCoords = feature.geometry.coordinates as unknown as number[][][][]
        multiPolygonCoords.forEach((polygonCoords, polygonIndex) => {
          const coordinates = polygonCoords[0] // Use outer ring of each polygon
          allBoundaries.push({
            coordinates,
            id: `feature-${featureIndex}-multipolygon-${polygonIndex}`
          })
        })
      }
    })
    
    return allBoundaries
  }, [boundaryData])

  const camera = useThree(({ camera }) => camera)
  useLayoutEffect(() => {
    // Check the camera position to see if we've already moved it to globe surface
    if (camera.position.length() > 10) {
      return
    }

    new PointOfView(distance, radians(heading), radians(pitch)).decompose(
      new Geodetic(radians(longitude), radians(latitude)).toECEF(),
      camera.position,
      camera.quaternion,
      camera.up
    )
  }, [longitude, latitude, heading, pitch, distance, camera])

  // Effects must know the camera near/far changed by GlobeControls.
  const composerRef = useRef<EffectComposerImpl>(null)
  useFrame(() => {
    const composer = composerRef.current
    if (composer != null) {
      composer.passes.forEach(pass => {
        if (pass.fullscreenMaterial instanceof EffectMaterial) {
          pass.fullscreenMaterial.adoptCameraSettings(camera)
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
      <Sky />
      <Stars data='atmosphere/stars.bin' />
      <Globe>
        <GlobeControls enableDamping />
      </Globe>
      
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

      {/* Glowing boundary curtains */}
      {showBoundary && boundaryLines.map((boundary) => {
        if (!boundary || !boundary.coordinates) return null
        return (
          <AutoElevationCurtain
            key={boundary.id}
            coordinates={boundary.coordinates}
            wallTopAltitude={wallTopAltitude}
            wallDepth={wallDepth}
            color={boundaryColor}
            thickness={lineThickness}
            apiKey={apiKey}
          />
        )
      })}
      
      <EffectComposer ref={composerRef} multisampling={0}>
        <Fragment
          // Effects are order-dependant; we need to reconstruct the nodes.
          key={JSON.stringify([
            enabled,
            sun,
            sky,
            transmittance,
            inscatter,
            correctGeometricError,
            lensFlare,
            normal,
            depth,
            lut
          ])}
        >
          {enabled && !normal && !depth && (
            <AerialPerspective
              sunLight={sun}
              skyLight={sky}
              transmittance={transmittance}
              inscatter={inscatter}
              correctGeometricError={correctGeometricError}
              albedoScale={2 / Math.PI}
            />
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
      <CameraTransition mode={orthographic ? 'orthographic' : 'perspective'} />
    </Atmosphere>
  )
}

export const LAGeoJSONStory: FC<SceneProps> = props => {
  useGoogleMapsAPIKeyControls()
  return (
    <>
      <Canvas gl={{ depth: false }} frameloop='demand'>
        <Stats />
        <Scene {...props} />
      </Canvas>
      <GoogleMapsAPIKeyPrompt />
    </>
  )
}

export default LAGeoJSONStory 