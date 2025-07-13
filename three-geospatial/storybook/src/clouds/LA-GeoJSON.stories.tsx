import type { Meta, StoryFn } from '@storybook/react-vite'

import { Story } from './LA-GeoJSON-Story'

export default {
  title: 'clouds/LA GeoJSON Integration',
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta

export const LosAngeles: StoryFn = () => (
  <Story
    dayOfYear={180}
    timeOfDay={14.5}
    exposure={15}
    longitude={-118.242643}
    latitude={34.0549076}
    heading={-110}
    pitch={-25}
    distance={15000}
    coverage={0.4}
  />
) 