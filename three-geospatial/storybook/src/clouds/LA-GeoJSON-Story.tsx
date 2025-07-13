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
import { FileLoader, Vector3 } from 'three'

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

// Inline elevation service to avoid import issues
async function getMinElevationForPath(
  coordinates: Array<{ lat: number; lng: number }>,
  apiKey: string,
  samples: number = 10
): Promise<number> {
  if (coordinates.length < 2) return 0
  
  // Sample points along the path
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
  
  // Build locations parameter (lat,lng|lat,lng|...)
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
      return 0 // Fallback to sea level
    }
  } catch (error) {
    console.error('Failed to fetch elevation:', error)
    return 0 // Fallback to sea level
  }
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

const jsonLoader = new FileLoader().setResponseType('json')

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
  const groupRef = useRef<any>(null)
  const [terrainElevation, setTerrainElevation] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  
  // Fetch terrain elevation when coordinates change
  useEffect(() => {
    if (coordinates.length < 2 || !apiKey) return
    
    setIsLoading(true)
    const coordsForAPI = coordinates.map(([lng, lat]) => ({ lat, lng }))
    
    getMinElevationForPath(coordsForAPI, apiKey, 10)
      .then((minElevation: number) => {
        setTerrainElevation(minElevation)
        console.log(`Auto terrain elevation: ${minElevation}m`)
      })
      .finally(() => setIsLoading(false))
  }, [coordinates, apiKey])
  
  // Animate the curtain with a subtle glow pulse
  useFrame((state) => {
    if (groupRef.current) {
      const time = state.clock.elapsedTime
      const intensity = 0.5 + Math.sin(time * 2) * 0.3
      groupRef.current.children.forEach((child: any) => {
        if (child.material) {
          child.material.emissiveIntensity = intensity
        }
      })
    }
  })

  // Create curtain segments with automatic terrain positioning
  const segments = useMemo(() => {
    const segs = []
    
    // Create vertical curtains for each line segment
    for (let i = 0; i < coordinates.length - 1; i++) {
      const [lng1, lat1] = coordinates[i]
      const [lng2, lat2] = coordinates[i + 1]
      
      // Calculate center point for this segment
      const centerLng = (lng1 + lng2) / 2
      const centerLat = (lat1 + lat2) / 2
      
      // Calculate approximate distance for local positioning
      const dlng = lng2 - lng1
      const dlat = lat2 - lat1
      
      // Convert to local meters (rough approximation)
      const meterPerDegree = 111320 // meters per degree at equator
      const localX = dlng * meterPerDegree * Math.cos(radians(centerLat))
      const localY = dlat * meterPerDegree
      
      // Position wall: top at desired altitude, bottom extends below terrain
      const wallTop = wallTopAltitude - terrainElevation
      const wallBottom = -wallDepth  // Extends down to ensure no clipping
      
      // Create line points for vertical curtain
      const points = [
        new Vector3(-localX/2, -localY/2, wallBottom),  // Bottom start (below terrain)
        new Vector3(-localX/2, -localY/2, wallTop),     // Top start (at altitude)
        new Vector3(localX/2, localY/2, wallTop),       // Top end (at altitude)
        new Vector3(localX/2, localY/2, wallBottom),    // Bottom end (below terrain)
        new Vector3(-localX/2, -localY/2, wallBottom)   // Back to start
      ]
      
      segs.push({
        points,
        centerLng,
        centerLat,
        id: i
      })
    }
    
    return segs
  }, [coordinates, wallTopAltitude, wallDepth, terrainElevation])

  if (isLoading) {
    return null // Hide while loading elevation data
  }

  return (
    <group ref={groupRef}>
      {segments.map((segment) => (
        <EastNorthUpFrame
          key={segment.id}
          longitude={radians(segment.centerLng)}
          latitude={radians(segment.centerLat)}
          height={terrainElevation} // Position at actual terrain height
        >
          <Line
            points={segment.points}
            color={color}
            lineWidth={thickness}
            transparent
            opacity={0.7}
          />
        </EastNorthUpFrame>
      ))}
    </group>
  )
}

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

  // Orb controls
  const { showOrbs, orbHeight, orbScale } = useControls('glowing orbs', {
    showOrbs: true,
    orbHeight: { value: 500, min: 10, max: 2000, step: 10 }, // Start at 500m height
    orbScale: { value: 1, min: 0.1, max: 5, step: 0.1 }
  })

  // Boundary controls with automatic terrain elevation
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
    
    return boundaryData.features.map((feature, index) => {
      let coordinates: number[][]
      
      // Handle different geometry types
      if (feature.geometry.type === 'LineString') {
        coordinates = feature.geometry.coordinates as number[][]
      } else if (feature.geometry.type === 'Polygon') {
        coordinates = (feature.geometry.coordinates as number[][][])[0] // Use outer ring
      } else if (feature.geometry.type === 'MultiLineString') {
        coordinates = (feature.geometry.coordinates as number[][][])[0] // Use first line
      } else if (feature.geometry.type === 'MultiPolygon') {
        const multiPolygonCoords = feature.geometry.coordinates as unknown as number[][][][]
        coordinates = multiPolygonCoords[0][0] // Use first polygon's outer ring
      } else {
        return null
      }
      
      // Calculate center point for positioning
      const centroid = coordinates.reduce(
        (acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]],
        [0, 0]
      ).map(sum => sum / coordinates.length)
      
      return {
        coordinates,
        centroid,
        id: index
      }
    }).filter(Boolean)
  }, [boundaryData])

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

  const [clouds, setClouds] = useState<CloudsEffect | null>(null)
  const [{ enabled, toneMapping }, cloudsProps] = useCloudsControls(clouds, {
    coverage
  })

  // Set all cloud layers to altitude 3400m
  useEffect(() => {
    if (clouds?.cloudLayers) {
      clouds.cloudLayers.forEach(layer => {
        if (layer) {
          layer.altitude = 3400
        }
      })
    }
  }, [clouds])

  useKeyboardControl()

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
          // Effects are order-dependant; we need to reconstruct the nodes.
          key={JSON.stringify([
            correctGeometricError,
            lensFlare,
            normal,
            depth,
            lut,
            enabled,
            toneMappingMode
          ])}
        >
          {!normal && !depth && (
            <>
              {enabled && (
                <Clouds
                  ref={setClouds}
                  shadow-farScale={0.25}
                  {...cloudsProps}
                />
              )}
              <AerialPerspective
                sky
                sunLight
                skyLight
                correctGeometricError={correctGeometricError}
                albedoScale={2 / Math.PI}
              />
            </>
          )}
          {toneMapping && (
            <>
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
            </>
          )}
        </Fragment>
      </EffectComposer>
    </Atmosphere>
  )
}

export const Story: FC<SceneProps> = props => {
  useGoogleMapsAPIKeyControls()
  return (
    <>
      <Canvas gl={{ depth: false }}>
        <Stats />
        <Scene {...props} />
      </Canvas>
      <GoogleMapsAPIKeyPrompt />
    </>
  )
}

export default Story