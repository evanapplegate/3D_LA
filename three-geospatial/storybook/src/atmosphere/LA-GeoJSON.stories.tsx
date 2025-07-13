import type { Meta, StoryFn } from '@storybook/react-vite'

import { LAGeoJSONStory } from './LA-GeoJSON-Story'

export default {
  title: 'atmosphere/LA GeoJSON Orbs',
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta

export const LosAngelesGlowingOrbs: StoryFn = () => (
  <LAGeoJSONStory
    longitude={-118.242643}
    latitude={34.0549076}
    heading={-110}
    pitch={-25}
    distance={15000}
    exposure={30}
    dayOfYear={180}
    timeOfDay={14}
  />
) 