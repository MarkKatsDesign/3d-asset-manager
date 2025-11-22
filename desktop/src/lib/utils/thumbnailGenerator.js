import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Generate a thumbnail for a 3D model
 * @param {number} assetId - The asset ID
 * @param {number} width - Thumbnail width
 * @param {number} height - Thumbnail height
 * @returns {Promise<string>} Base64 encoded JPEG image
 */
export async function generateThumbnail(assetId, width = 400, height = 400) {
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
    renderer.setClearColor(0x1a1a2e, 1);

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    // Create camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

    // Add enhanced lighting for better visibility
    // Hemisphere light for natural ambient lighting (sky + ground)
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    scene.add(hemisphereLight);

    // Ambient light for overall base illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    // Key light (main light from front-top-right)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(5, 8, 5);
    scene.add(keyLight);

    // Fill light (softer light from front-left to fill shadows)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-5, 3, 5);
    scene.add(fillLight);

    // Back light (rim light from behind to separate model from background)
    const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
    backLight.position.set(0, 3, -5);
    scene.add(backLight);

    // Load the model
    const loader = new GLTFLoader();

    return new Promise((resolve, reject) => {
      loader.load(
        blobUrl,
        (gltf) => {
          const model = gltf.scene;

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

          // Get the image data
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

          // Cleanup
          URL.revokeObjectURL(blobUrl);
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
        },
        undefined,
        (error) => {
          console.error('Error loading model for thumbnail:', error);
          URL.revokeObjectURL(blobUrl);
          renderer.dispose();
          reject(error);
        }
      );
    });
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    throw error;
  }
}
