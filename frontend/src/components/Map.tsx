import React, { Component } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

interface Building {
  id: number;
  name: string;
  height: number;
  building_type: string;
  address: string;
  geometry: any;
}

interface MapProps {
  buildings: Building[];
  highlightedBuilding?: Building;
  highlightedBuildings?: Building[]; // For multi-building highlighting
  onBuildingClick: (building: Building) => void;
}

class Map extends Component<MapProps> {
  private mount: HTMLDivElement | null = null;
  private scene: THREE.Scene | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private buildingsGroup: THREE.Group | null = null;
  private raycaster: THREE.Raycaster | null = null;
  private mouse: THREE.Vector2 | null = null;
  private frameId: number | null = null;

  // Geographic bounds (Makkah city area) - expanded for better coverage
  private bounds = {
    minLng: 39.6,
    maxLng: 40.0,
    minLat: 21.2,
    maxLat: 21.6
  };

  // Tile settings
  private tileSize = 256;
  private zoomLevel = 13;
  private baseTiles: THREE.Mesh[] = [];

  constructor(props: MapProps) {
    super(props);
    
    // Bind methods
    this.animate = this.animate.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.initializeOrbits = this.initializeOrbits.bind(this);
    this.addBuildings = this.addBuildings.bind(this);
    this.lon2tile = this.lon2tile.bind(this);
    this.lat2tile = this.lat2tile.bind(this);
  }

  componentDidMount() {
    this.initializeMap();
  }

  componentDidUpdate(prevProps: MapProps) {
    if (prevProps.buildings !== this.props.buildings || 
        prevProps.highlightedBuilding !== this.props.highlightedBuilding ||
        prevProps.highlightedBuildings !== this.props.highlightedBuildings) {
      this.updateBuildings();
    }
  }

  componentWillUnmount() {
    this.cleanup();
  }

  cleanup() {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }
    if (this.mount && this.renderer) {
      this.mount.removeChild(this.renderer.domElement);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    window.removeEventListener('resize', this.handleResize.bind(this));
  }

  initializeMap() {
    if (!this.mount) return;

    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;

    // Initialize scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);

    // Initialize camera
    this.camera = new THREE.PerspectiveCamera(60, width / height, 1, 10000);
    this.camera.position.set(0, 1500, 1500);
    this.camera.lookAt(0, 0, 0);

    // Initialize renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.mount.appendChild(this.renderer.domElement);

    // Initialize controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.initializeOrbits();

    // Initialize raycaster and mouse
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Add lighting
    this.initializeLights();

    // Create basemap with OSM tiles
    this.createOSMBasemap();

    // Add buildings group
    this.buildingsGroup = new THREE.Group();
    this.buildingsGroup.name = 'buildings';
    this.scene.add(this.buildingsGroup);

    // Add buildings
    this.addBuildings();

    // Auto-fit view on initial load
    setTimeout(() => {
      this.fitBuildingsToView();
    }, 200);

    // Start animation loop
    this.animate();

    // Handle window resize
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  handleResize() {
    if (!this.mount || !this.camera || !this.renderer) return;
    
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  initializeOrbits() {
    if (!this.controls) return;

    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 10; // Allow much closer zoom
    this.controls.maxDistance = 5000; // Allow much further zoom
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minPolarAngle = 0.1;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.controls.enableRotate = true;
    
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  initializeLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene!.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(200, 400, 200);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 1000;
    directionalLight.shadow.camera.left = -500;
    directionalLight.shadow.camera.right = 500;
    directionalLight.shadow.camera.top = 500;
    directionalLight.shadow.camera.bottom = -500;
    this.scene!.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x87ceeb, 0.4);
    fillLight.position.set(-200, 200, -200);
    this.scene!.add(fillLight);
  }

  lon2tile(lon: number, zoom: number) {
    return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
  }

  lat2tile(lat: number, zoom: number) {
    return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  }

  createOSMBasemap() {
    if (!this.scene) return;

    const minTileX = this.lon2tile(this.bounds.minLng, this.zoomLevel);
    const maxTileX = this.lon2tile(this.bounds.maxLng, this.zoomLevel);
    const minTileY = this.lat2tile(this.bounds.maxLat, this.zoomLevel);
    const maxTileY = this.lat2tile(this.bounds.minLat, this.zoomLevel);

    const numTilesX = maxTileX - minTileX + 1;
    const numTilesY = maxTileY - minTileY + 1;
    const tileWorldSize = 100;

    const groundGeometry = new THREE.PlaneGeometry(
      numTilesX * tileWorldSize, 
      numTilesY * tileWorldSize
    );
    
    const groundMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x1a1a1a,
      side: THREE.DoubleSide
    });
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const textureLoader = new THREE.TextureLoader();
    let tilesLoaded = 0;
    const totalTiles = numTilesX * numTilesY;

    for (let x = minTileX; x <= maxTileX; x++) {
      for (let y = minTileY; y <= maxTileY; y++) {
        const tileUrl = `https://tile.openstreetmap.org/${this.zoomLevel}/${x}/${y}.png`;
        
        textureLoader.load(
          tileUrl,
          (texture) => {
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            
            const tileGeometry = new THREE.PlaneGeometry(tileWorldSize, tileWorldSize);
            const tileMaterial = new THREE.MeshLambertMaterial({ 
              map: texture,
              side: THREE.DoubleSide,
              transparent: false,
              opacity: 1.0
            });
            
            const tileMesh = new THREE.Mesh(tileGeometry, tileMaterial);
            tileMesh.rotation.x = -Math.PI / 2;
            
            const posX = (x - minTileX) * tileWorldSize - (numTilesX * tileWorldSize) / 2 + tileWorldSize / 2;
            const posZ = (y - minTileY) * tileWorldSize - (numTilesY * tileWorldSize) / 2 + tileWorldSize / 2;
            
            tileMesh.position.set(posX, 0.05, posZ);
            tileMesh.receiveShadow = true;
            
            this.scene!.add(tileMesh);
            this.baseTiles.push(tileMesh);
            
            tilesLoaded++;
            if (tilesLoaded === totalTiles) {
              console.log('All OSM tiles loaded successfully');
            }
          },
          undefined,
          (error) => {
            console.warn(`Failed to load OSM tile: ${x}, ${y}`, error);
            tilesLoaded++;
          }
        );
      }
    }
  }

  geoToScene(lng: number, lat: number) {
    const x = ((lng - this.bounds.minLng) / (this.bounds.maxLng - this.bounds.minLng)) * 1000 - 500;
    const z = ((lat - this.bounds.minLat) / (this.bounds.maxLat - this.bounds.minLat)) * 1000 - 500;
    return { x, z };
  }

  addBuildings() {
    if (!this.buildingsGroup || !this.props.buildings.length) return;

    this.buildingsGroup.clear();

    console.log('Adding', this.props.buildings.length, 'buildings');

    this.props.buildings.forEach((building, index) => {
      try {
        const geometry = typeof building.geometry === 'string' 
          ? JSON.parse(building.geometry) 
          : building.geometry;

        if (geometry.type === 'Polygon' && geometry.coordinates) {
          const coords = geometry.coordinates[0];
          
          const centerLng = coords.reduce((sum: number, coord: number[]) => sum + coord[0], 0) / coords.length;
          const centerLat = coords.reduce((sum: number, coord: number[]) => sum + coord[1], 0) / coords.length;
          const centerPos = this.geoToScene(centerLng, centerLat);
          
          const shape = new THREE.Shape();
          
          for (let i = 0; i < coords.length; i++) {
            const [lng, lat] = coords[i];
            const pointPos = this.geoToScene(lng, lat);
            
            const relX = pointPos.x - centerPos.x;
            const relZ = pointPos.z - centerPos.z;
            
            if (i === 0) {
              shape.moveTo(relX, relZ);
            } else {
              shape.lineTo(relX, relZ);
            }
          }

          const buildingHeight = typeof building.height === 'string' ? parseFloat(building.height) : building.height || 20;
          
          // Calculate building footprint size to determine appropriate scaling
          let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
          for (let i = 0; i < coords.length; i++) {
            const [lng, lat] = coords[i];
            const pointPos = this.geoToScene(lng, lat);
            const relX = pointPos.x - centerPos.x;
            const relZ = pointPos.z - centerPos.z;
            
            minX = Math.min(minX, relX);
            maxX = Math.max(maxX, relX);
            minZ = Math.min(minZ, relZ);
            maxZ = Math.max(maxZ, relZ);
          }
          
          const footprintWidth = maxX - minX;
          const footprintDepth = maxZ - minZ;
          const footprintSize = Math.max(footprintWidth, footprintDepth);
          
          // Adjust height scaling based on footprint size to make buildings look realistic
          let heightScale = 1.0; // More realistic height scaling
          if (footprintSize < 5) {
            // Very small footprints - reduce height to avoid pole-like appearance
            heightScale = 0.3;
          } else if (footprintSize < 15) {
            // Small footprints
            heightScale = 0.5;
          } else if (footprintSize < 30) {
            // Medium footprints
            heightScale = 0.7;
          } else {
            // Large footprints - can have taller buildings
            heightScale = 1.0;
          }
          
          const scaledHeight = buildingHeight * heightScale;
          
          const extrudeSettings = {
            depth: scaledHeight,
            bevelEnabled: false
          };

          const buildingGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          buildingGeometry.rotateX(-Math.PI / 2);
          
                     // Check if this building is highlighted (single or multi)
           const isHighlighted = (this.props.highlightedBuilding && this.props.highlightedBuilding.id === building.id) ||
                                (this.props.highlightedBuildings && this.props.highlightedBuildings.some(b => b.id === building.id));
          
                     const buildingMaterial = new THREE.MeshLambertMaterial({ 
             color: isHighlighted ? 0x3b82f6 : 0x6b7280, // Blue if highlighted, grey otherwise
             transparent: true,
             opacity: isHighlighted ? 0.9 : 0.8,
             side: THREE.DoubleSide
           });
           

          
          const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
          
          buildingMesh.position.set(centerPos.x, 0, centerPos.z);
          buildingMesh.castShadow = true;
          buildingMesh.receiveShadow = true;
          buildingMesh.userData = { 
            buildingId: building.id, 
            building,
            centerX: centerPos.x,
            centerZ: centerPos.z,
            height: scaledHeight,
            isHighlighted
          };
          
          // Add glow effect for highlighted buildings
          if (isHighlighted) {
            const glowGeometry = buildingGeometry.clone();
            const glowMaterial = new THREE.MeshBasicMaterial({
              color: 0x3b82f6,
              transparent: true,
              opacity: 0.3,
              side: THREE.DoubleSide
            });
            const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
            glowMesh.position.set(centerPos.x, 0, centerPos.z);
            glowMesh.scale.set(1.05, 1.05, 1.05);
            this.buildingsGroup!.add(glowMesh);
          }
          
          this.buildingsGroup!.add(buildingMesh);
        }
      } catch (error) {
        console.error('Error processing building geometry:', error, building);
      }
    });
    
    console.log('Buildings added to scene');
  }

     updateBuildings() {
     this.addBuildings();

     // Handle different highlighting scenarios
     if (this.props.highlightedBuildings && this.props.highlightedBuildings.length > 0) {
       // Multi-building highlighting - fit all highlighted buildings to view
       setTimeout(() => {
         this.fitHighlightedBuildingsToView();
       }, 100);
     } else if (this.props.highlightedBuilding) {
       // Single building highlighting - zoom to specific building
       setTimeout(() => {
         this.flyToBuilding(this.props.highlightedBuilding!);
       }, 100);
     } else {
       // No highlighting - fit all buildings to view
       setTimeout(() => {
         this.fitBuildingsToView();
       }, 100);
     }
   }

  flyToBuilding(building: Building) {
    try {
      const geometry = typeof building.geometry === 'string' 
        ? JSON.parse(building.geometry) 
        : building.geometry;
      
      if (geometry.type === 'Polygon' && geometry.coordinates) {
        const coords = geometry.coordinates[0];
        
        const centerLng = coords.reduce((sum: number, coord: number[]) => sum + coord[0], 0) / coords.length;
        const centerLat = coords.reduce((sum: number, coord: number[]) => sum + coord[1], 0) / coords.length;
        
        const centerPos = this.geoToScene(centerLng, centerLat);
        const buildingHeight = typeof building.height === 'string' 
          ? parseFloat(building.height) 
          : building.height || 20;
        
        // Calculate footprint size for height scaling
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (let i = 0; i < coords.length; i++) {
          const [lng, lat] = coords[i];
          const pointPos = this.geoToScene(lng, lat);
          const relX = pointPos.x - centerPos.x;
          const relZ = pointPos.z - centerPos.z;
          
          minX = Math.min(minX, relX);
          maxX = Math.max(maxX, relX);
          minZ = Math.min(minZ, relZ);
          maxZ = Math.max(maxZ, relZ);
        }
        
        const footprintWidth = maxX - minX;
        const footprintDepth = maxZ - minZ;
        const footprintSize = Math.max(footprintWidth, footprintDepth);
        
        // Use same height scaling logic as in addBuildings
        let heightScale = 1.0;
        if (footprintSize < 5) {
          heightScale = 0.3;
        } else if (footprintSize < 15) {
          heightScale = 0.5;
        } else if (footprintSize < 30) {
          heightScale = 0.7;
        } else {
          heightScale = 1.0;
        }
        
        const scaledHeight = buildingHeight * heightScale;
        
                 if (this.camera && this.controls) {
           // Calculate optimal distance based on building size and height
           const buildingSize = Math.max(footprintSize, scaledHeight);
           const distance = Math.max(buildingSize * 2.5, 30); // Better viewing distance
           
           // Position camera at a better angle for building viewing
           const angle = Math.PI / 4; // 45 degrees - optimal viewing angle
           const cameraPosition = new THREE.Vector3(
             centerPos.x - distance * Math.cos(angle), 
             scaledHeight + distance * Math.sin(angle), 
             centerPos.z + distance * Math.sin(angle)
           );
           
           // Set camera position directly for immediate response
           this.camera.position.copy(cameraPosition);
           
           // Set controls target to building center
           this.controls.target.set(centerPos.x, scaledHeight / 2, centerPos.z);
           
           // Update controls immediately
           this.controls.update();
          
          console.log(`Flying to building: ${building.name} at (${centerPos.x.toFixed(2)}, ${centerPos.z.toFixed(2)})`);
        }
      }
    } catch (error) {
      console.error('Error flying to building:', error);
    }
  }

     // Auto-fit all buildings in view
   fitBuildingsToView() {
     if (!this.buildingsGroup || !this.camera || !this.controls || !this.props.buildings.length) return;

     // Calculate bounding box of all buildings
     let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = 0;
     
     this.props.buildings.forEach(building => {
       try {
         const geometry = typeof building.geometry === 'string' 
           ? JSON.parse(building.geometry) 
           : building.geometry;
         
         if (geometry.type === 'Polygon' && geometry.coordinates) {
           const coords = geometry.coordinates[0];
           const centerLng = coords.reduce((sum: number, coord: number[]) => sum + coord[0], 0) / coords.length;
           const centerLat = coords.reduce((sum: number, coord: number[]) => sum + coord[1], 0) / coords.length;
           const centerPos = this.geoToScene(centerLng, centerLat);
           
           minX = Math.min(minX, centerPos.x);
           maxX = Math.max(maxX, centerPos.x);
           minZ = Math.min(minZ, centerPos.z);
           maxZ = Math.max(maxZ, centerPos.z);
           
           const buildingHeight = typeof building.height === 'string' 
             ? parseFloat(building.height) 
             : building.height || 20;
           maxY = Math.max(maxY, buildingHeight);
         }
       } catch (error) {
         console.error('Error processing building for fit view:', error);
       }
     });

     if (minX === Infinity) return; // No valid buildings found

     // Calculate center and size
     const centerX = (minX + maxX) / 2;
     const centerZ = (minZ + maxZ) / 2;
     const sizeX = maxX - minX;
     const sizeZ = maxZ - minZ;
     const maxSize = Math.max(sizeX, sizeZ, maxY);

     // Calculate optimal camera distance - MUCH closer zoom
     const distance = Math.max(maxSize * 0.3, 50); // Much closer zoom - reduced from 0.8 to 0.3
     
     // Position camera
     this.camera.position.set(centerX, distance, centerZ + distance);
     this.controls.target.set(centerX, 0, centerZ);
     this.controls.update();
     
     console.log(`Fitted view to ${this.props.buildings.length} buildings`);
   }

   // Fit highlighted buildings to view (for multi-building queries)
   fitHighlightedBuildingsToView() {
     if (!this.buildingsGroup || !this.camera || !this.controls || !this.props.highlightedBuildings?.length) return;

     // Calculate bounding box of highlighted buildings only
     let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = 0;
     
     this.props.highlightedBuildings.forEach(building => {
       try {
         const geometry = typeof building.geometry === 'string' 
           ? JSON.parse(building.geometry) 
           : building.geometry;
         
         if (geometry.type === 'Polygon' && geometry.coordinates) {
           const coords = geometry.coordinates[0];
           const centerLng = coords.reduce((sum: number, coord: number[]) => sum + coord[0], 0) / coords.length;
           const centerLat = coords.reduce((sum: number, coord: number[]) => sum + coord[1], 0) / coords.length;
           const centerPos = this.geoToScene(centerLng, centerLat);
           
           minX = Math.min(minX, centerPos.x);
           maxX = Math.max(maxX, centerPos.x);
           minZ = Math.min(minZ, centerPos.z);
           maxZ = Math.max(maxZ, centerPos.z);
           
           const buildingHeight = typeof building.height === 'string' 
             ? parseFloat(building.height) 
             : building.height || 20;
           maxY = Math.max(maxY, buildingHeight);
         }
       } catch (error) {
         console.error('Error processing highlighted building for fit view:', error);
       }
     });

     if (minX === Infinity) return; // No valid buildings found

     // Calculate center and size
     const centerX = (minX + maxX) / 2;
     const centerZ = (minZ + maxZ) / 2;
     const sizeX = maxX - minX;
     const sizeZ = maxZ - minZ;
     const maxSize = Math.max(sizeX, sizeZ, maxY);

     // Calculate optimal camera distance for highlighted buildings
     const distance = Math.max(maxSize * 0.8, 100); // Good view of highlighted buildings
     
     // Position camera
     this.camera.position.set(centerX, distance, centerZ + distance);
     this.controls.target.set(centerX, 0, centerZ);
     this.controls.update();
     
     console.log(`Fitted view to ${this.props.highlightedBuildings.length} highlighted buildings`);
   }

  // Calculate screen position of a building for info panel positioning
  getBuildingScreenPosition(building: Building) {
    if (!this.camera || !this.mount) return null;

    try {
      const geometry = typeof building.geometry === 'string' 
        ? JSON.parse(building.geometry) 
        : building.geometry;
      
      if (geometry.type === 'Polygon' && geometry.coordinates) {
        const coords = geometry.coordinates[0];
        const centerLng = coords.reduce((sum: number, coord: number[]) => sum + coord[0], 0) / coords.length;
        const centerLat = coords.reduce((sum: number, coord: number[]) => sum + coord[1], 0) / coords.length;
        const centerPos = this.geoToScene(centerLng, centerLat);
        
        const buildingHeight = typeof building.height === 'string' 
          ? parseFloat(building.height) 
          : building.height || 20;
        
        // Calculate footprint size for height scaling
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (let i = 0; i < coords.length; i++) {
          const [lng, lat] = coords[i];
          const pointPos = this.geoToScene(lng, lat);
          const relX = pointPos.x - centerPos.x;
          const relZ = pointPos.z - centerPos.z;
          
          minX = Math.min(minX, relX);
          maxX = Math.max(maxX, relX);
          minZ = Math.min(minZ, relZ);
          maxZ = Math.max(maxZ, relZ);
        }
        
        const footprintWidth = maxX - minX;
        const footprintDepth = maxZ - minZ;
        const footprintSize = Math.max(footprintWidth, footprintDepth);
        
        // Use same height scaling logic
        let heightScale = 1.0;
        if (footprintSize < 5) {
          heightScale = 0.3;
        } else if (footprintSize < 15) {
          heightScale = 0.5;
        } else if (footprintSize < 30) {
          heightScale = 0.7;
        } else {
          heightScale = 1.0;
        }
        
        const scaledHeight = buildingHeight * heightScale;
        
        // Create a 3D point at the top of the building
        const buildingTop = new THREE.Vector3(centerPos.x, scaledHeight, centerPos.z);
        
        // Project the 3D point to screen coordinates
        buildingTop.project(this.camera);
        
        const rect = this.mount.getBoundingClientRect();
        const x = (buildingTop.x * 0.5 + 0.5) * rect.width;
        const y = (buildingTop.y * -0.5 + 0.5) * rect.height;
        
        return { x, y };
      }
    } catch (error) {
      console.error('Error calculating building screen position:', error);
    }
    
    return null;
  }

  onMouseDown(event: React.MouseEvent) {
    if (!this.mount || !this.camera || !this.buildingsGroup || !this.raycaster || !this.mouse) return;

    const rect = this.mount.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.buildingsGroup.children, true);

    if (intersects.length > 0) {
      const clickedObject = intersects[0].object;
      const buildingId = parseInt(clickedObject.userData.buildingId);
      const building = this.props.buildings.find(b => b.id === buildingId);
      if (building) {
        this.props.onBuildingClick(building);
        this.flyToBuilding(building);
      }
    }
  }

  animate() {
    this.frameId = window.requestAnimationFrame(this.animate);
    
    if (this.controls) {
      this.controls.update();
    }
    
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  render() {
    return (
      <div className="h-full w-full relative">
        <div
          ref={mount => {
            this.mount = mount;
          }}
          onClick={this.onMouseDown}
          className="h-full w-full"
        />

                 {/* Anchored Building Info Card - Only show when single building is highlighted */}
         {this.props.highlightedBuilding && !this.props.highlightedBuildings && (() => {
           const screenPos = this.getBuildingScreenPosition(this.props.highlightedBuilding);
           if (!screenPos) return null;
           
           // Calculate optimal position to avoid covering buildings
           const rect = this.mount?.getBoundingClientRect();
           if (!rect) return null;
           
           // Check if building is in top half of screen
           const isInTopHalf = screenPos.y < rect.height / 2;
           
           // Position info panel above or below building based on screen position
           const panelTop = isInTopHalf 
             ? screenPos.y - 160 // Above building
             : screenPos.y + 30;  // Below building
           
           // Ensure panel stays within screen bounds
           const panelHeight = 180; // Approximate height of the panel
           const finalTop = Math.max(20, Math.min(panelTop, rect.height - panelHeight - 20));
           
           return (
             <div 
               className="absolute z-20 animate-fade-in pointer-events-none"
               style={{
                 left: `${screenPos.x}px`,
                 top: `${finalTop}px`,
                 transform: 'translateX(-50%)'
               }}
             >
               <div className="bg-gradient-to-br from-blue-600/95 to-blue-800/95 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-blue-400/30 max-w-xs animate-glow pointer-events-auto">
                 <div className="flex items-center space-x-2 mb-3">
                   <div className="w-2 h-2 bg-blue-400 rounded-full status-indicator"></div>
                   <h3 className="text-white font-bold text-sm truncate">
                     {this.props.highlightedBuilding.name || `Building ${this.props.highlightedBuilding.id}`}
                   </h3>
                 </div>
                 
                 <div className="space-y-2">
                   <div className="flex items-center space-x-2">
                     <svg className="w-3 h-3 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                     </svg>
                     <span className="text-blue-100 text-xs">
                       Height: {this.props.highlightedBuilding.height}m
                     </span>
                   </div>
                   
                   <div className="flex items-center space-x-2">
                     <svg className="w-3 h-3 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                     </svg>
                     <span className="text-blue-100 text-xs capitalize">
                       {this.props.highlightedBuilding.building_type || 'Unknown'}
                     </span>
                   </div>
                   
                   {this.props.highlightedBuilding.address && (
                     <div className="flex items-start space-x-2">
                       <svg className="w-3 h-3 text-blue-300 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                       </svg>
                       <span className="text-blue-100 text-xs leading-relaxed">
                         {this.props.highlightedBuilding.address}
                       </span>
                     </div>
                   )}
                 </div>
                 
                 <div className="mt-3 pt-2 border-t border-blue-400/30">
                   <div className="flex items-center justify-between">
                     <span className="text-blue-200 text-xs">Makkah City</span>
                     <div className="flex space-x-1">
                       <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                       <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                       <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                     </div>
                   </div>
                 </div>
               </div>
             </div>
           );
         })()}

        {/* Map controls */}
        <div className="absolute top-4 left-4 z-10">
          <div className="glass-morphism rounded-2xl p-3 shadow-2xl">
            <div className="flex flex-col space-y-3">
              <button 
                className="map-button p-3 bg-white/10 text-white rounded-xl hover:bg-white/20 backdrop-blur-sm"
                onClick={() => {
                  if (this.camera && this.controls) {
                    this.camera.position.set(0, 1500, 1500);
                    this.controls.target.set(0, 0, 0);
                    this.controls.update();
                  }
                }}
                title="Reset View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </button>
              <button 
                className="map-button p-3 bg-white/10 text-white rounded-xl hover:bg-white/20 backdrop-blur-sm"
                onClick={() => {
                  this.fitBuildingsToView();
                }}
                title="Fit All Buildings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button 
                className="map-button p-3 bg-white/10 text-white rounded-xl hover:bg-white/20 backdrop-blur-sm"
                onClick={() => {
                  if (this.camera && this.controls) {
                    this.camera.position.set(0, 800, 0);
                    this.controls.target.set(0, 0, 0);
                    this.controls.update();
                  }
                }}
                title="Top View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Floating Stats Panel */}
        <div className="absolute top-4 right-4 z-10">
          <div className="stats-panel rounded-2xl p-4 shadow-2xl">
            <div className="text-white">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-2 h-2 bg-green-400 rounded-full status-indicator"></div>
                <span className="font-bold text-sm">3D Makkah</span>
              </div>
              <div className="text-white/80 text-xs">
                {this.props.buildings.length} Buildings
              </div>
              <div className="text-white/60 text-xs mt-1">
                Click to explore
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default Map;