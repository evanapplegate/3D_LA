import type { Meta, StoryFn } from '@storybook/react-vite'

import { ManhattanCubeStory } from './Manhattan-Cube-Story'

export default {
  title: 'atmosphere/Manhattan Cube',
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta

export const ManhattanWith200ftCube: StoryFn = () => (
  <ManhattanCubeStory
    longitude={-73.9709}
    latitude={40.7589}
    heading={-155}
    pitch={-35}
    distance={3000}
    exposure={60}
    dayOfYear={1}
    timeOfDay={7.6}
  />
) 