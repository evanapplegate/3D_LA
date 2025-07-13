import type { TilesRenderer as TilesRendererImpl } from '3d-tiles-renderer'
import {
  GLTFExtensionsPlugin,
  GoogleCloudAuthPlugin,
  TileCompressionPlugin,
  TilesFadePlugin,
  UpdateOnChangePlugin
} from '3d-tiles-renderer/plugins'
import {
  TilesAttributionOverlay,
  TilesPlugin,
  TilesRenderer
} from '3d-tiles-renderer/r3f'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useState, type FC, type ReactNode, type Ref } from 'react'
import { mergeRefs } from 'react-merge-refs'
import { DRACOLoader } from 'three-stdlib'

import { radians } from '@takram/three-geospatial'

import { TileCreasedNormalsPlugin } from '../plugins/TileCreasedNormalsPlugin'
import { googleMapsApiKeyAtom, needsApiKeyAtom } from './states'

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/')

export interface GlobeProps {
  ref?: Ref<TilesRendererImpl>
  children?: ReactNode
}
export const Globe: FC<GlobeProps> = ({ ref, children }) => {
  const inputApiKey = useAtomValue(googleMapsApiKeyAtom)
  const apiKey =
    inputApiKey !== ''
      ? inputApiKey
      : import.meta.env.STORYBOOK_GOOGLE_MAP_API_KEY

  // Debug logging for API key
  console.log('🔍 Globe API Key Debug:')
  console.log('  inputApiKey:', inputApiKey)
  console.log('  env STORYBOOK_GOOGLE_MAP_API_KEY:', import.meta.env.STORYBOOK_GOOGLE_MAP_API_KEY)
  console.log('  final apiKey:', apiKey)
  
  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    console.error('❌ ERROR: Google Maps API key is missing!')
    console.error('   Please set STORYBOOK_GOOGLE_MAP_API_KEY in your .env file')
    console.error('   Expected location: three-geospatial/.env')
    console.error('   Format: STORYBOOK_GOOGLE_MAP_API_KEY=your_api_key_here')
  } else {
    console.log('✅ API key found, length:', apiKey.length)
  }

  const [tiles, setTiles] = useState<TilesRendererImpl | null>(null)
  const setNeedsApiKey = useSetAtom(needsApiKeyAtom)
  useEffect(() => {
    if (tiles == null) {
      return
    }
    const callback = (): void => {
      setNeedsApiKey(true)
    }
    tiles.addEventListener('load-error', callback)
    return () => {
      tiles.removeEventListener('load-error', callback)
    }
  }, [tiles, setNeedsApiKey])

  return (
    <TilesRenderer
      ref={mergeRefs([ref, setTiles])}
      // Reconstruct tiles when API key changes.
      key={apiKey}
      // The root URL sometimes becomes null without specifying the URL.
      url={`https://tile.googleapis.com/v1/3dtiles/root.json?key=${apiKey}`}
    >
      <TilesPlugin
        plugin={GoogleCloudAuthPlugin}
        args={{
          apiToken: apiKey,
          autoRefreshToken: true
        }}
      />
      <TilesPlugin plugin={GLTFExtensionsPlugin} dracoLoader={dracoLoader} />
      <TilesPlugin plugin={TileCompressionPlugin} />
      <TilesPlugin plugin={UpdateOnChangePlugin} />
      <TilesPlugin plugin={TilesFadePlugin} />
      <TilesPlugin
        plugin={TileCreasedNormalsPlugin}
        args={{ creaseAngle: radians(30) }}
      />
      {children}
      <TilesAttributionOverlay />
    </TilesRenderer>
  )
}
