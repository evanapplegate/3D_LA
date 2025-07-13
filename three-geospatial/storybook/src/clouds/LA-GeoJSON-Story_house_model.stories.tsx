import type { StoryFn } from '@storybook/react'
import Story from './LA-GeoJSON-Story_house_model'

export default {
  title: 'Clouds / LA GeoJSON Integration_house_model',
  component: Story,
  parameters: {
    layout: 'fullscreen'
  }
} as const

export const Default: StoryFn = () => {
  return <Story />
}

export const WithHousesAndOrbs: StoryFn = () => {
  return (
    <Story 
      exposure={15}
      longitude={-118.242643}
      latitude={34.0549076}
      heading={-110}
      pitch={-25}
      distance={15000}
      coverage={0.4}
    />
  )
} 