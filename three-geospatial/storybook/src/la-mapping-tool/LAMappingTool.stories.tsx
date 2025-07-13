import type { Meta, StoryFn } from '@storybook/react'
import React from 'react'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import LAMappingTool, { useLAMappingTool, ModelLoadingDialog, PositioningControls } from './LAMappingTool'
import './LAMappingTool.css'

const meta: Meta<typeof LAMappingTool> = {
  title: 'LA Mapping Tool',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
# LA Interactive Mapping Tool

A comprehensive 3D mapping tool for the Los Angeles area that allows users to:

## Features

- **3D Navigation**: Scroll and zoom around the LA area freely
- **Model Loading**: Add 3D models in two ways:
  - **Blender Export**: Upload raw geometry files (.glb, .gltf, .obj, .fbx) without textures
  - **Preset Houses**: Choose from curated web-compatible house models
- **Interactive Positioning**: Click on models to open positioning controls
- **Precise Controls**: Adjust model properties including:
  - Geographic coordinates (latitude/longitude)
  - Elevation (-50 to +50 feet off ground)
  - 3D rotation (X, Y, Z axes in degrees)
  - Scale/size
- **Atmospheric Rendering**: Models render under the same lighting as the terrain
- **Real-time Updates**: Changes reflect immediately in the 3D view

## Usage

1. Click "Add Model" to load a 3D object
2. Choose between Blender upload or preset house
3. Your model appears as a ghostly placeholder in the scene
4. Click the model to open positioning controls
5. Adjust coordinates, elevation, rotation, and scale
6. The model updates in real-time with consistent lighting

## Technical Details

- Built on three-geospatial framework
- Uses WGS84 coordinate system for precise geographic placement
- Integrates with existing atmosphere and cloud rendering
- Supports multiple simultaneous models
- Responsive design for desktop and mobile

Perfect for architectural visualization, urban planning, or creative projects in the LA area.
        `
      }
    }
  },
  argTypes: {
    // No args needed for this component
  }
}

export default meta

// LA coordinates for proper camera positioning
const LA_CAMERA_POSITION = [4529893.894855564, 2615333.425024031, 3638042.815326614] as const
const LA_CAMERA_ROTATION = [0.6423512931563148, -0.2928348796035058, -0.8344824769956042] as const

export const Default: StoryFn = () => {
  const {
    models,
    showModelDialog,
    showPositioningControls,
    selectedModel,
    handleModelLoad,
    handleModelClick,
    handleUpdateModel,
    handleDeleteModel,
    setShowModelDialog,
    setShowPositioningControls
  } = useLAMappingTool()

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {/* UI Toolbar */}
      <div className="toolbar">
        <button 
          className="add-model-btn"
          onClick={() => setShowModelDialog(true)}
        >
          Add Model
        </button>
        
        <div className="model-list">
          <h3>Models ({models.length})</h3>
          {models.map(model => (
            <div key={model.id} className="model-item">
              <span>{model.name}</span>
              <button onClick={() => handleModelClick(model)}>Edit</button>
              <button onClick={() => handleDeleteModel(model.id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas
        gl={{
          depth: false,
          toneMappingExposure: 10
        }}
        camera={{
          near: 1,
          far: 4e5,
          position: LA_CAMERA_POSITION,
          rotation: LA_CAMERA_ROTATION
        }}
      >
        <EffectComposer multisampling={0} enableNormalPass>
          <LAMappingTool models={models} onModelClick={handleModelClick} />
          <ToneMapping mode={ToneMappingMode.AGX} />
        </EffectComposer>
      </Canvas>

      {/* Modals */}
      {showModelDialog && (
        <ModelLoadingDialog
          onModelLoad={handleModelLoad}
          onClose={() => setShowModelDialog(false)}
        />
      )}

      {showPositioningControls && selectedModel && (
        <PositioningControls
          model={selectedModel}
          onUpdateModel={handleUpdateModel}
          onClose={() => setShowPositioningControls(false)}
        />
      )}
    </div>
  )
}

export const WithInitialModels: StoryFn = () => {
  const {
    models,
    showModelDialog,
    showPositioningControls,
    selectedModel,
    handleModelLoad,
    handleModelClick,
    handleUpdateModel,
    handleDeleteModel,
    setShowModelDialog,
    setShowPositioningControls
  } = useLAMappingTool()

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {/* UI Toolbar */}
      <div className="toolbar">
        <button 
          className="add-model-btn"
          onClick={() => setShowModelDialog(true)}
        >
          Add Model
        </button>
        
        <div className="model-list">
          <h3>Models ({models.length})</h3>
          {models.map(model => (
            <div key={model.id} className="model-item">
              <span>{model.name}</span>
              <button onClick={() => handleModelClick(model)}>Edit</button>
              <button onClick={() => handleDeleteModel(model.id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas
        gl={{
          depth: false,
          toneMappingExposure: 10
        }}
        camera={{
          near: 1,
          far: 4e5,
          position: LA_CAMERA_POSITION,
          rotation: LA_CAMERA_ROTATION
        }}
      >
        <EffectComposer multisampling={0} enableNormalPass>
          <LAMappingTool models={models} onModelClick={handleModelClick} />
          <ToneMapping mode={ToneMappingMode.AGX} />
        </EffectComposer>
      </Canvas>

      {/* Modals */}
      {showModelDialog && (
        <ModelLoadingDialog
          onModelLoad={handleModelLoad}
          onClose={() => setShowModelDialog(false)}
        />
      )}

      {showPositioningControls && selectedModel && (
        <PositioningControls
          model={selectedModel}
          onUpdateModel={handleUpdateModel}
          onClose={() => setShowPositioningControls(false)}
        />
      )}
    </div>
  )
} 