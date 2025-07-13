import { Canvas } from '@react-three/fiber'
import type { StoryFn } from '@storybook/react'
import { Scene } from './LA-GeoJSON-Story_house_model'

import { GoogleMapsAPIKeyPrompt } from '../helpers/GoogleMapsAPIKeyPrompt'
import { Stats } from '../helpers/Stats'

export default {
  title: 'Clouds / LA GeoJSON Integration_house_model',
  component: Scene,
  parameters: {
    layout: 'fullscreen'
  }
} as const

export const Default: StoryFn = () => {
  return (
    <>
      <Stats />
      <GoogleMapsAPIKeyPrompt />
      <Canvas
        gl={{
          depth: false,
          toneMappingExposure: 10
        }}
        camera={{
          near: 1,
          far: 4e5
        }}
      >
        <Scene />
      </Canvas>
    </>
  )
}

export const WithHousesAndOrbs: StoryFn = () => {
  return (
    <>
      <Stats />
      <GoogleMapsAPIKeyPrompt />
      <Canvas
        gl={{
          depth: false,
          toneMappingExposure: 10
        }}
        camera={{
          near: 1,
          far: 4e5
        }}
      >
        <Scene 
          exposure={15}
          longitude={-118.242643}
          latitude={34.0549076}
          heading={-110}
          pitch={-25}
          distance={15000}
          coverage={0.4}
        />
      </Canvas>
    </>
  )
} 