import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

/**
 * Create a bright studio-style environment map
 * @returns {THREE.DataTexture} Environment texture
 */
function createStudioEnvironment() {
  const width = 512;
  const height = 256;
  const size = width * height;
  const data = new Uint8Array(4 * size);

  // Create a bright, multi-directional studio lighting environment
  for (let i = 0; i < size; i++) {
    const stride = i * 4;
    const x = (i % width) / width;
    const y = Math.floor(i / width) / height;

    // Convert to spherical coordinates
    const theta = x * Math.PI * 2; // 0 to 2π
    const phi = y * Math.PI; // 0 to π

    // Create a bright gradient with multiple light sources
    // Top hemisphere: very bright (studio ceiling lights)
    const topBrightness = Math.max(0, 1 - phi / (Math.PI * 0.6));

    // Key light (from front-right-top)
    const keyAngle = Math.cos(theta - Math.PI * 0.25) * Math.sin(phi - Math.PI * 0.3);
    const keyLight = Math.max(0, keyAngle) * 0.8;

    // Fill lights (from sides)
    const fillLight1 = Math.max(0, Math.cos(theta + Math.PI * 0.5) * Math.sin(phi)) * 0.4;
    const fillLight2 = Math.max(0, Math.cos(theta - Math.PI * 0.5) * Math.sin(phi)) * 0.4;

    // Combine all light sources
    let brightness = (topBrightness * 0.9 + keyLight + fillLight1 + fillLight2);
    brightness = Math.min(1, brightness + 0.3); // Add ambient + clamp

    // Very bright, neutral color (slight warm tint)
    const r = Math.floor(brightness * 255);
    const g = Math.floor(brightness * 252);
    const b = Math.floor(brightness * 248);

    data[stride] = r;
    data[stride + 1] = g;
    data[stride + 2] = b;
    data[stride + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, width, height);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generate a thumbnail for a 3D model
 * @param {number} assetId - The asset ID
 * @param {string} filePath - The file path to determine format (optional)
 * @param {number} width - Thumbnail width
 * @param {number} height - Thumbnail height
 * @returns {Promise<string>} Base64 encoded JPEG image
 */
export async function generateThumbnail(assetId, filePath = '', width = 400, height = 400) {
  try {
    // Read the model file
    const modelData = await window.electronAPI.readModelFile(assetId);
    if (!modelData) {
      throw new Error('Failed to read model file');
    }

    // Create a blob URL
    const blob = new Blob([modelData]);
    const blobUrl = URL.createObjectURL(blob);

    // Create off-screen renderer
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0); // Transparent background
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.8; // Increase exposure for brighter thumbnails

    // Create scene
    const scene = new THREE.Scene();
    scene.background = null; // No background for transparency

    // Create camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

    // PMREM Generator for environment map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // Create a bright studio-like HDRI environment
    const envMapTexture = createStudioEnvironment();
    envMapTexture.mapping = THREE.EquirectangularReflectionMapping;

    // Generate PMREM environment map
    const envMap = pmremGenerator.fromEquirectangular(envMapTexture).texture;
    scene.environment = envMap;

    // Dispose the temporary texture
    envMapTexture.dispose();

    // Add supplementary lights for extra brightness and definition
    // Reduced intensity since environment map provides base lighting
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(5, 8, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-5, 3, 5);
    scene.add(fillLight);

    // Determine file extension
    const extension = filePath ? filePath.toLowerCase().substring(filePath.lastIndexOf('.')) : '.glb';
    console.log(`Loading thumbnail with extension: ${extension}`);

    // Load the model based on file extension
    return new Promise((resolve, reject) => {
      const onLoad = (loadedModel) => {
        // Handle different loader return types
        let model;
        if (loadedModel.scene) {
          // GLTF/GLB returns { scene, ... }
          model = loadedModel.scene;
        } else {
          // OBJ, FBX, STL return the model directly
          model = loadedModel;
        }

          // Center and frame the model
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2 / maxDim;

          // Create a group to center the model
          const modelGroup = new THREE.Group();
          modelGroup.add(model);
          model.position.set(-center.x, -center.y, -center.z);
          modelGroup.scale.setScalar(scale);

          scene.add(modelGroup);

          // Smart camera positioning based on model bounds
          // Calculate bounding sphere for optimal framing
          const boundingBox = new THREE.Box3().setFromObject(modelGroup);
          const boundingSphere = new THREE.Sphere();
          boundingBox.getBoundingSphere(boundingSphere);

          // Calculate optimal camera distance based on model size and FOV
          const fov = camera.fov * (Math.PI / 180); // Convert to radians
          const cameraDistance = Math.abs(boundingSphere.radius / Math.sin(fov / 2)) * 1.3; // 1.3 for padding

          // Position camera at a nice angle (slightly elevated, 45-degree view)
          const cameraOffset = new THREE.Vector3(
            cameraDistance * 0.7,  // X: slight right
            cameraDistance * 0.5,  // Y: elevated
            cameraDistance * 0.7   // Z: distance from front
          );

          camera.position.copy(boundingSphere.center).add(cameraOffset);
          camera.lookAt(boundingSphere.center);

          // Render the scene
          renderer.render(scene, camera);

          // Get the image data as PNG to preserve transparency
          const dataUrl = canvas.toDataURL('image/png');

          // Cleanup
          URL.revokeObjectURL(blobUrl);
          pmremGenerator.dispose();
          renderer.dispose();
          scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(material => material.dispose());
              } else {
                object.material.dispose();
              }
            }
          });

          resolve(dataUrl);
      };

      const onError = (error) => {
        console.error('Error loading model for thumbnail:', error);
        URL.revokeObjectURL(blobUrl);
        pmremGenerator.dispose();
        renderer.dispose();
        reject(error);
      };

      // Select appropriate loader based on file extension
      if (extension === '.glb' || extension === '.gltf') {
        const loader = new GLTFLoader();
        loader.load(blobUrl, onLoad, undefined, onError);
      } else if (extension === '.obj') {
        const loader = new OBJLoader();
        loader.load(blobUrl, onLoad, undefined, onError);
      } else if (extension === '.fbx') {
        const loader = new FBXLoader();
        loader.load(blobUrl, onLoad, undefined, onError);
      } else if (extension === '.stl') {
        const loader = new STLLoader();
        loader.load(
          blobUrl,
          (geometry) => {
            // STL returns geometry, need to create mesh
            const material = new THREE.MeshStandardMaterial({
              color: 0xaaaaaa,
              roughness: 0.5,
              metalness: 0.5
            });
            const mesh = new THREE.Mesh(geometry, material);
            onLoad(mesh);
          },
          undefined,
          onError
        );
      } else {
        reject(new Error(`Unsupported file format: ${extension}`));
      }
    });
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    throw error;
  }
}
