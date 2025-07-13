// Terrain elevation service using Google Elevation API
interface ElevationResult {
  elevation: number
  location: { lat: number; lng: number }
  resolution: number
}

interface ElevationResponse {
  results: ElevationResult[]
  status: string
}

/**
 * Query terrain elevation for a single coordinate using Google Elevation API
 */
export async function getElevationForLocation(
  lat: number,
  lng: number,
  apiKey: string
): Promise<number> {
  const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${apiKey}`
  
  try {
    const response = await fetch(url)
    const data: ElevationResponse = await response.json()
    
    if (data.status === 'OK' && data.results.length > 0) {
      return data.results[0].elevation
    } else {
      console.warn('Elevation API failed:', data.status)
      return 0 // Fallback to sea level
    }
  } catch (error) {
    console.error('Failed to fetch elevation:', error)
    return 0 // Fallback to sea level
  }
}

/**
 * Query terrain elevation for multiple coordinates using Google Elevation API
 */
export async function getElevationForLocations(
  coordinates: Array<{ lat: number; lng: number }>,
  apiKey: string
): Promise<number[]> {
  if (coordinates.length === 0) return []
  
  // Build locations parameter (lat,lng|lat,lng|...)
  const locations = coordinates.map(coord => `${coord.lat},${coord.lng}`).join('|')
  const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${encodeURIComponent(locations)}&key=${apiKey}`
  
  try {
    const response = await fetch(url)
    const data: ElevationResponse = await response.json()
    
    if (data.status === 'OK') {
      return data.results.map(result => result.elevation)
    } else {
      console.warn('Elevation API failed:', data.status)
      return coordinates.map(() => 0) // Fallback to sea level
    }
  } catch (error) {
    console.error('Failed to fetch elevation:', error)
    return coordinates.map(() => 0) // Fallback to sea level
  }
}

/**
 * Calculate the minimum elevation along a path to ensure walls go below terrain
 */
export async function getMinElevationForPath(
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
  
  const elevations = await getElevationForLocations(samplePoints, apiKey)
  return Math.min(...elevations)
} 