# LA Interactive Mapping Tool 🌴

A comprehensive 3D mapping tool for the Los Angeles area that allows users to navigate a realistic 3D environment, place custom 3D models, and interact with them in real-time.

## 🚀 Features

### 3D Navigation
- **Free Camera Movement**: Scroll and zoom around the LA area freely
- **Orbit Controls**: Smooth camera controls with damping
- **Realistic Atmosphere**: Full atmospheric rendering with sky, clouds, and stars
- **Geographic Accuracy**: Uses WGS84 coordinate system for precise positioning

### Model Loading
- **Blender Export Support**: Upload raw geometry files (.glb, .gltf, .obj, .fbx)
- **Preset Houses**: Choose from curated web-compatible house models
- **No Texture Loading**: Raw geometry only for faster loading and consistent lighting

### Interactive Positioning
- **Click to Edit**: Click on any model to open positioning controls
- **Real-time Updates**: Changes reflect immediately in the 3D view
- **Precise Controls**: Fine-tune every aspect of model placement

### Advanced Controls
- **Geographic Coordinates**: Set exact latitude/longitude positions
- **Elevation Control**: Adjust height from -50 to +50 feet off ground
- **3D Rotation**: Rotate around X, Y, and Z axes independently
- **Scale Adjustment**: Resize models from 0.1x to 5x original size

### Visual Features
- **Consistent Lighting**: Models render under the same atmospheric lighting as terrain
- **Reference Markers**: LA area landmarks for easy navigation
- **Ghostly Preview**: Semi-transparent model previews during placement
- **Modern UI**: Clean, professional interface with smooth animations

## 🎯 Usage

### Getting Started
1. **Launch the Tool**: Open the LA Mapping Tool from Storybook
2. **Navigate**: Use mouse to orbit, pan, and zoom around the LA area
3. **Find Your Location**: Use the red reference markers to orient yourself

### Adding Models
1. **Click "Add Model"**: Opens the model loading dialog
2. **Choose Type**:
   - **Blender Model**: Upload your own 3D files
   - **Preset House**: Select from curated house models
3. **Name Your Model**: Give it a descriptive name
4. **Load**: Model appears as a green semi-transparent box

### Positioning Models
1. **Click the Model**: Opens positioning controls on the right
2. **Adjust Position**:
   - **Latitude/Longitude**: Set exact coordinates
   - **Elevation**: Use slider for height adjustment
3. **Rotate**: 
   - **X-axis**: Pitch (up/down rotation)
   - **Y-axis**: Yaw (left/right rotation)  
   - **Z-axis**: Roll (twist rotation)
4. **Scale**: Resize the model
5. **Click "Done"**: Finalize positioning

### Model Management
- **Edit**: Click "Edit" in toolbar to modify existing models
- **Delete**: Remove models you no longer need
- **Multiple Models**: Add as many as needed

## 🛠️ Technical Details

### Built On
- **three-geospatial**: Core 3D geospatial framework
- **React Three Fiber**: React bindings for Three.js
- **Three.js**: 3D graphics library
- **React**: UI framework

### Coordinate Systems
- **WGS84**: World Geodetic System 1984 for geographic coordinates
- **ECEF**: Earth-Centered Earth-Fixed for 3D positioning
- **Local ENU**: East-North-Up frame for model orientation

### Performance
- **Optimized Rendering**: Efficient 3D rendering with LOD
- **Responsive Design**: Works on desktop and mobile
- **Real-time Updates**: Smooth 60fps performance

### File Support
- **.glb/.gltf**: Preferred format for best performance
- **.obj**: Wavefront OBJ files
- **.fbx**: Autodesk FBX files
- **Raw Geometry**: Textures stripped for consistent lighting

## 🌍 LA Area Coverage

The tool covers the greater Los Angeles area including:
- Los Angeles City
- Santa Monica
- Pasadena  
- Burbank
- Santa Barbara
- Culver City
- Marina del Rey
- Hawthorne
- Torrance
- Long Beach

## 📱 User Interface

### Toolbar (Left)
- **Add Model Button**: Primary action for adding new models
- **Model List**: Shows all currently loaded models
- **Edit/Delete**: Quick actions for model management

### Positioning Controls (Right)
- **Position Controls**: Latitude, longitude, elevation
- **Rotation Controls**: X, Y, Z axis rotation sliders
- **Scale Control**: Model size adjustment
- **Done Button**: Close controls

### Visual Feedback
- **Model Labels**: Names appear above models
- **Location Markers**: Red markers for LA landmarks
- **Loading States**: Visual feedback during operations

## 🎨 Use Cases

### Architecture & Planning
- **Building Placement**: Visualize buildings in real locations
- **Urban Planning**: Test development scenarios
- **Shadow Studies**: See how structures affect lighting

### Entertainment
- **Film Pre-visualization**: Plan shots and scenes
- **Game Level Design**: Create realistic environments
- **Virtual Tourism**: Explore LA with custom elements

### Education
- **Geography Lessons**: Interactive LA exploration
- **Architecture Studies**: Real-world building placement
- **3D Modeling Practice**: Learn spatial relationships

### Professional
- **Real Estate**: Visualize property developments
- **Construction**: Plan building placement
- **Environmental Impact**: Assess visual changes

## 🔧 Development

### File Structure
```
la-mapping-tool/
├── LAMappingTool.tsx     # Main component
├── LAMappingTool.css     # Styling
├── LAMappingTool.stories.tsx # Storybook configuration
└── README.md             # This file
```

### Key Components
- **LAMappingTool**: Main container component
- **LAScene**: 3D scene with atmosphere and models
- **Model3DComponent**: Individual model renderer
- **LAPointMarker**: Reference point markers
- **ModelLoadingDialog**: Model upload interface
- **PositioningControls**: Model editing interface

### Integration
The tool seamlessly integrates with the existing three-geospatial ecosystem:
- Uses existing Globe component for base terrain
- Leverages Atmosphere system for realistic lighting
- Integrates with Clouds system for weather effects
- Utilizes core geospatial coordinate transformations

## 🤝 Contributing

The LA Mapping Tool is built to be extensible. Potential enhancements:
- **More File Formats**: Support additional 3D formats
- **Terrain Modification**: Allow ground elevation changes
- **Lighting Controls**: Custom time-of-day settings
- **Weather Effects**: Interactive weather systems
- **Collaboration**: Multi-user editing capabilities

## 📄 License

Part of the three-geospatial project. See main project license for details.

---

**Perfect for architectural visualization, urban planning, creative projects, or just exploring LA in 3D!** 🌟 