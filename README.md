# 3D_LA

> **Based on [@takram-design-engineering/three-geospatial](https://github.com/takram-design-engineering/three-geospatial)**  
> This project builds upon the excellent geospatial rendering libraries developed by Takram Design Engineering.

A 3D geospatial visualization project featuring atmospheric rendering, volumetric clouds, and Los Angeles mapping tools built with Three.js and React.

## Features

- **Atmospheric Rendering**: Realistic sky simulation with Rayleigh and Mie scattering
- **Volumetric Clouds**: Real-time cloud rendering with dynamic weather systems
- **3D Tiles**: Google Maps 3D tiles integration for detailed city visualization
- **LA Mapping Tools**: Specialized tools for Los Angeles geographic data visualization
- **Storybook Examples**: Interactive component library and documentation

## Project Structure

```
3D_clouds_map/
├── three-geospatial/        # Main 3D geospatial library
│   ├── packages/
│   │   ├── atmosphere/      # Atmospheric rendering package
│   │   ├── clouds/          # Volumetric clouds package
│   │   ├── core/           # Core geospatial utilities
│   │   └── effects/        # Visual effects package
│   └── storybook/          # Component examples and documentation
├── fs_bound.geojson        # LA area boundary data
├── my_points.geojson       # Point data for LA mapping
└── *.qmd                   # Quarto documents
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Google Maps API key (for 3D tiles)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/evanapplegate/3D_LA.git
cd 3D_LA
```

2. Install dependencies:
```bash
cd three-geospatial
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Add your Google Maps API key to .env
```

### Running Storybook

```bash
pnpm storybook
```

Visit `http://localhost:6006` to explore the component library.

### Development

```bash
# Run tests
pnpm test

# Build packages
pnpm build

# Lint code
pnpm lint
```

## Key Components

### Atmosphere Package
- Real-time atmospheric scattering
- Sky rendering with accurate sun/moon positioning
- Aerial perspective effects

### Clouds Package
- Volumetric cloud rendering
- Weather simulation
- Dynamic cloud layers

### Core Package
- Ellipsoid geometry utilities
- Geospatial coordinate systems
- Tile coordinate management

## LA Mapping Tools

Specialized tools for Los Angeles geographic data visualization:
- GeoJSON data integration
- Elevation services
- Point-of-interest mapping
- Custom LA-specific visualizations

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

- Built on Three.js and React Three Fiber
- Atmospheric rendering based on Bruneton's work
- Uses Google Maps 3D tiles for city visualization 