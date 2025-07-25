import { useThree } from '@react-three/fiber'
import {
  createContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type FC,
  type ReactNode,
  type Ref
} from 'react'
import { Matrix4, Vector3 } from 'three'

import { Ellipsoid } from '@takram/three-geospatial'

import {
  getECIToECEFRotationMatrix,
  getMoonDirectionECI,
  getSunDirectionECI
} from '../celestialDirections'
import { PrecomputedTexturesGenerator } from '../PrecomputedTexturesGenerator'
import { PrecomputedTexturesLoader } from '../PrecomputedTexturesLoader'
import type {
  AtmosphereLightingMask,
  AtmosphereOverlay,
  AtmosphereShadow,
  AtmosphereShadowLength,
  PrecomputedTextures
} from '../types'

export interface AtmosphereTransientStates {
  sunDirection: Vector3
  moonDirection: Vector3
  rotationMatrix: Matrix4
  ellipsoidCenter: Vector3
  ellipsoidMatrix: Matrix4
  overlay: AtmosphereOverlay | null
  shadow: AtmosphereShadow | null
  shadowLength: AtmosphereShadowLength | null
  lightingMask: AtmosphereLightingMask | null
}

export interface AtmosphereContextValue {
  textures?: PrecomputedTextures | null
  ellipsoid?: Ellipsoid
  correctAltitude?: boolean
  transientStates?: AtmosphereTransientStates
}

export const AtmosphereContext =
  /*#__PURE__*/ createContext<AtmosphereContextValue>({})

export interface AtmosphereApi extends AtmosphereTransientStates {
  textures?: PrecomputedTextures
  updateByDate: (date: number | Date) => void
}

export interface AtmosphereProps {
  ref?: Ref<AtmosphereApi>
  textures?: PrecomputedTextures | string
  ellipsoid?: Ellipsoid
  correctAltitude?: boolean
  date?: number | Date
  children?: ReactNode
}

export const Atmosphere: FC<AtmosphereProps> = ({
  ref: forwardedRef,
  textures: texturesProp,
  ellipsoid = Ellipsoid.WGS84,
  correctAltitude = true,
  date,
  children
}) => {
  const transientStatesRef = useRef({
    sunDirection: new Vector3(),
    moonDirection: new Vector3(),
    rotationMatrix: new Matrix4(),
    ellipsoidCenter: new Vector3(),
    ellipsoidMatrix: new Matrix4(),
    overlay: null,
    shadow: null,
    shadowLength: null,
    lightingMask: null
  })

  const renderer = useThree(({ gl }) => gl)
  const loadedTextures = useMemo(
    () =>
      typeof texturesProp === 'string'
        ? new PrecomputedTexturesLoader().setType(renderer).load(texturesProp)
        : undefined,
    [texturesProp, renderer]
  )
  useEffect(() => {
    if (loadedTextures != null) {
      return () => {
        for (const texture of Object.values(loadedTextures) as Array<
          PrecomputedTextures[keyof PrecomputedTextures]
        >) {
          texture?.dispose()
        }
      }
    }
  }, [loadedTextures])

  const generator = useMemo(
    () =>
      texturesProp == null
        ? new PrecomputedTexturesGenerator(renderer)
        : undefined,
    [texturesProp, renderer]
  )
  useEffect(() => {
    if (generator != null) {
      generator.update().catch((error: unknown) => {
        console.error(error)
      })
      return () => {
        generator.dispose()
      }
    }
  }, [generator])

  const textures =
    generator?.textures ??
    (typeof texturesProp === 'string' ? loadedTextures : texturesProp)

  const context = useMemo(
    () => ({
      textures,
      ellipsoid,
      correctAltitude,
      transientStates: transientStatesRef.current
    }),
    [textures, ellipsoid, correctAltitude]
  )

  const updateByDate: AtmosphereApi['updateByDate'] = useMemo(() => {
    const { sunDirection, moonDirection, rotationMatrix } =
      transientStatesRef.current
    return date => {
      getECIToECEFRotationMatrix(date, rotationMatrix)
      getSunDirectionECI(date, sunDirection).applyMatrix4(rotationMatrix)
      getMoonDirectionECI(date, moonDirection).applyMatrix4(rotationMatrix)
    }
  }, [])

  const timestamp = date != null && !isNaN(+date) ? +date : undefined
  useEffect(() => {
    if (timestamp != null) {
      updateByDate(timestamp)
    }
  }, [timestamp, updateByDate])

  useImperativeHandle(
    forwardedRef,
    () => ({
      ...transientStatesRef.current,
      textures,
      updateByDate
    }),
    [textures, updateByDate]
  )

  return (
    <AtmosphereContext.Provider value={context}>
      {children}
    </AtmosphereContext.Provider>
  )
}
