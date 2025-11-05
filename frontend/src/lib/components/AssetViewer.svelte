<script>
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import { pb } from '../pocketbase';

  export let asset;
  export let onClose;

  let container;
  let scene, camera, renderer, controls;
  let animationId;
  let loading = true;
  let error = null;

  onMount(() => {
    initScene();
    loadModel();

    // Handle window resize
    window.addEventListener('resize', handleResize);
  });

  onDestroy(() => {
    cleanup();
    window.removeEventListener('resize', handleResize);
  });

  function initScene() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e); // Lighter background for better visibility
    scene.fog = new THREE.Fog(0x1a1a2e, 10, 50);

    // Camera
    camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(3, 3, 3);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2; // Slightly brighter exposure
    container.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI;

    // Lights - Enhanced lighting setup for better model visibility

    // Hemisphere light for natural ambient lighting
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
    scene.add(hemisphereLight);

    // Main directional light (key light) - brighter and from the front-top
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Fill light from the opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    // Back light (rim light) for edge definition
    const backLight = new THREE.DirectionalLight(0xffffff, 0.8);
    backLight.position.set(0, 5, -10);
    scene.add(backLight);

    // Accent point lights for visual interest (softer colors)
    const pointLight1 = new THREE.PointLight(0x6366f1, 0.3);
    pointLight1.position.set(-8, 3, -8);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xa855f7, 0.3);
    pointLight2.position.set(8, 3, 8);
    scene.add(pointLight2);

    // Grid helper
    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Start animation loop
    animate();
  }

  function loadModel() {
    const loader = new GLTFLoader();
    const modelUrl = pb.files.getUrl(asset, asset.file);

    loader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;

        // Center and scale model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxDim;

        model.position.sub(center);
        model.scale.setScalar(scale);

        // Enable shadows
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        scene.add(model);

        // Adjust camera
        camera.position.set(3, 3, 3);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();

        loading = false;
      },
      (progress) => {
        // Progress callback
        const percentComplete = (progress.loaded / progress.total) * 100;
        console.log(`Loading: ${percentComplete.toFixed(2)}%`);
      },
      (err) => {
        console.error('Error loading model:', err);
        error = 'Failed to load 3D model. Please check the file format.';
        loading = false;
      }
    );
  }

  function animate() {
    animationId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  function handleResize() {
    if (!container || !camera || !renderer) return;

    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }

    if (renderer) {
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    }

    if (scene) {
      scene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    }
  }

  function handleDownload() {
    const url = pb.files.getUrl(asset, asset.file);
    window.open(url, '_blank');
  }

  function handleOverlayKeydown(e) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<!-- Modal Overlay -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
  on:click={onClose}
  on:keydown={handleOverlayKeydown}
  role="button"
  tabindex="0"
  aria-label="Close viewer modal"
>
  <!-- Modal Content -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="glass-modal w-full max-w-6xl h-[90vh] flex flex-col animate-slide-up"
    on:click|stopPropagation
    on:keydown|stopPropagation
    role="dialog"
    aria-modal="true"
    aria-labelledby="viewer-title"
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-6 border-b border-white/10">
      <div class="flex-1">
        <h2 id="viewer-title" class="text-2xl font-bold gradient-text">{asset.name}</h2>
        {#if asset.description}
          <p class="text-white/60 mt-1">{asset.description}</p>
        {/if}
      </div>
      <div class="flex items-center space-x-2">
        <button
          on:click={handleDownload}
          class="glass-button p-3"
          title="Download"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
        <button
          on:click={onClose}
          class="glass-button p-3"
          title="Close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 3D Viewer -->
    <div class="flex-1 relative">
      <div bind:this={container} class="w-full h-full">
        {#if loading}
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-center">
              <div class="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p class="text-white/60">Loading 3D model...</p>
            </div>
          </div>
        {/if}

        {#if error}
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="glass-card p-8 text-center max-w-md">
              <svg class="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-red-400 font-semibold mb-2">Error Loading Model</p>
              <p class="text-white/60 text-sm">{error}</p>
            </div>
          </div>
        {/if}
      </div>

      <!-- Controls Info -->
      {#if !loading && !error}
        <div class="absolute bottom-4 left-4 glass-card px-4 py-2 text-sm text-white/70">
          <p>Left click + drag to rotate</p>
          <p>Right click + drag to pan</p>
          <p>Scroll to zoom</p>
        </div>
      {/if}
    </div>

    <!-- Footer with metadata -->
    <div class="p-6 border-t border-white/10">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <div class="flex items-center space-x-2">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-sm font-bold">
              {asset.expand?.user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p class="text-sm font-medium">{asset.expand?.user?.name || 'Unknown'}</p>
              <p class="text-xs text-white/50">{new Date(asset.created).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {#if asset.tags && asset.tags.length > 0}
          <div class="flex flex-wrap gap-2">
            {#each asset.tags as tag}
              <span class="px-3 py-1 bg-white/10 rounded-full text-sm font-medium">
                {tag}
              </span>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
