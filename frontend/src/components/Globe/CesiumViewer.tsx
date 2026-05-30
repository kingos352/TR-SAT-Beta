import React, { useEffect, useRef } from 'react';
import {
  Viewer,
  Ion,
  Cartesian2,
  Cartesian3,
  Color,
  LabelStyle,
  VerticalOrigin,
  ArcType,
  HeadingPitchRange,
  SceneTransforms,
  PointPrimitiveCollection,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Camera,
  Rectangle,
  createWorldTerrainAsync,
  EllipsoidTerrainProvider,
  IonImageryProvider,
  HeightReference,
  ArcGisMapServerImageryProvider,
  PolylineDashMaterialProperty,
} from 'cesium';

import { useConsoleStore } from '../../store/useConsoleStore';
import { cartesianFromGeodetic, groundTrackCartesian } from '../../utils/cesiumCoordinates';
import { API_BASE_URL } from '../../api/client';
import 'cesium/Source/Widgets/widgets.css';

// ── 3D Model helpers ─────────────────────────────────────────────
function getModelUri(noradId: number, objectType: string): string {
  if (noradId === 25544) return '/models/iss.glb';
  const t = objectType.toUpperCase();
  if (t === 'ROCKET BODY' || t === 'ROCKET_BODY') return '/models/rocket_body.glb';
  if (t === 'DEBRIS') return '/models/debris.glb';
  return '/models/satellite.glb';
}

// Reduce Cartesian3 array size for polyline rendering. The point cap comes
// from the user-tunable graphics settings store; visual quality is
// indistinguishable above ~500 points from orbital altitude.
function downsampleForRender<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr;
  const result: T[] = new Array(maxPoints);
  const step = (arr.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    result[i] = arr[Math.round(i * step)];
  }
  return result;
}

export const CesiumViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const prevActiveNoradIdRef = useRef<number | null>(null);

  // PERF: Narrow selectors — each subscribes only to its specific state slice,
  // preventing re-renders when unrelated state (panel visibility, UI settings) changes.
  const activeObject = useConsoleStore(s => s.activeObject);
  const activeState = useConsoleStore(s => s.activeState);
  const activeEphemeris = useConsoleStore(s => s.activeEphemeris);
  const observer = useConsoleStore(s => s.observer);
  const showOrbitPath = useConsoleStore(s => s.showOrbitPath);
  const showGroundTrack = useConsoleStore(s => s.showGroundTrack);
  const showObserver = useConsoleStore(s => s.showObserver);
  const followActiveObject = useConsoleStore(s => s.followActiveObject);
  const addLog = useConsoleStore(s => s.addLog);
  const liveObjectStates = useConsoleStore(s => s.liveObjectStates);
  const liveTrackingEnabled = useConsoleStore(s => s.liveTrackingEnabled);
  const selectedObjects = useConsoleStore(s => s.selectedObjects);
  const activeConjunctionResult = useConsoleStore(s => s.activeConjunctionResult);
  const catalogLayerEnabled = useConsoleStore(s => s.catalogLayerEnabled);
  const catalogLayerObjects = useConsoleStore(s => s.catalogLayerObjects);
  const enableEarthLighting = useConsoleStore(s => s.enableEarthLighting);
  const enableEarthRotation = useConsoleStore(s => s.enableEarthRotation);
  const replayEnabled = useConsoleStore(s => s.replayEnabled);
  const replayIndex = useConsoleStore(s => s.replayIndex);
  const replayEphemeris = useConsoleStore(s => s.replayEphemeris);
  const setCesiumDiagnostics = useConsoleStore(s => s.setCesiumDiagnostics);
  const graphics = useConsoleStore(s => s.graphics);

  const pointsRef = useRef<PointPrimitiveCollection | null>(null);

  // PERF: Refs for ephemeris data used by hover handler — avoids re-registering
  // the ScreenSpaceEventHandler every time ephemeris arrays change.
  const activeEphemerisRef = useRef(activeEphemeris);
  const replayEphemerisRef = useRef(replayEphemeris);
  const hoverHandlerRef = useRef<ScreenSpaceEventHandler | null>(null);

  // Keep ephemeris refs in sync with latest state
  useEffect(() => { activeEphemerisRef.current = activeEphemeris; }, [activeEphemeris]);
  useEffect(() => { replayEphemerisRef.current = replayEphemeris; }, [replayEphemeris]);

  // --- 1. Mount Cesium Globe Viewer ---
  useEffect(() => {
    let active = true;

    const initCesium = async () => {
      let token = import.meta.env.VITE_CESIUM_ION_TOKEN || '';
      
      if (!token || token.trim().length === 0) {
        try {
          const resp = await fetch(`${API_BASE_URL}/api/v1/config/current`);
          if (resp.ok) {
            const data = await resp.json();
            token = data.cesium_token || '';
          }
        } catch (e) {
          console.error("Failed to fetch cesium token from backend", e);
        }
      }

      if (!active) return;

      if (token && token.trim().length > 0) {
        Ion.defaultAccessToken = token;
        addLog('System: Cesium Ion credentials applied successfully.');
      } else {
        addLog('Warning: Cesium Ion token missing. Initializing fallback globe view.');
      }

      if (containerRef.current && !viewerRef.current) {
        if (observer) {
          Camera.DEFAULT_VIEW_RECTANGLE = Rectangle.fromDegrees(
            observer.longitude_deg - 15,
            observer.latitude_deg - 15,
            observer.longitude_deg + 15,
            observer.latitude_deg + 15
          );
        }

        try {
          const useIon = token && token.trim().length > 0;

          const viewerOptions: any = {
            animation: false,
            timeline: false,
            baseLayerPicker: false,
            geocoder: false,
            homeButton: true,
            infoBox: false,
            sceneModePicker: true,
            selectionIndicator: false,
            navigationHelpButton: false,
            fullscreenButton: false,
            creditContainer: document.createElement('div'),
            contextOptions: { webgl: { antialias: false } },
          };

          // Viewer is created before async Ion calls so we can apply quality settings immediately.
          const viewer = new Viewer(containerRef.current, viewerOptions);

          viewer.scene.globe.enableLighting = false;
          viewer.scene.highDynamicRange = false;
          viewer.scene.requestRenderMode = false;   // continuous render — RTX 4060
          viewer.scene.globe.preloadSiblings = true;

          const g = useConsoleStore.getState().graphics;
          viewer.resolutionScale = g.resolutionScale;
          viewer.scene.postProcessStages.fxaa.enabled = g.fxaa;
          if (viewer.scene.msaaSamples !== undefined) viewer.scene.msaaSamples = g.msaaSamples;
          viewer.scene.globe.maximumScreenSpaceError = g.maximumScreenSpaceError;
          viewer.scene.globe.tileCacheSize = g.tileCacheSize;
          if (viewer.scene.skyBox) viewer.scene.skyBox.show = g.showSkyBox;
          if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = g.showSkyAtmosphere;
          if (viewer.scene.sun) viewer.scene.sun.show = g.showSun;
          if (viewer.scene.moon) viewer.scene.moon.show = g.showMoon;
          viewer.scene.globe.showGroundAtmosphere = g.showGroundAtmosphere;
          viewer.scene.fog.enabled = g.enableFog;
          viewer.scene.globe.depthTestAgainstTerrain = g.depthTestAgainstTerrain;

          viewerRef.current = viewer;
          addLog('System: 3D Visualization engine mounted.');

          // --- Base imagery: try Ion assets in order, fall back to ArcGIS ---
          let imageryLabel = 'ArcGIS';
          if (useIon) {
            setCesiumDiagnostics({ token: 'Configured', terrain: 'Loading...', imagery: 'Loading...' });
            // Try common free-tier Ion World Imagery asset IDs
            const ionImageryAssets = [3845, 2, 3954010];
            let ionImageryLoaded = false;
            for (const assetId of ionImageryAssets) {
              if (!active) return;
              try {
                const ionProvider = await IonImageryProvider.fromAssetId(assetId);
                if (!active) return;
                viewer.imageryLayers.removeAll();
                viewer.imageryLayers.addImageryProvider(ionProvider);
                imageryLabel = 'Ion Imagery';
                ionImageryLoaded = true;
                addLog(`System: Cesium Ion imagery loaded (asset ${assetId}).`);
                break;
              } catch { /* try next */ }
            }
            if (!ionImageryLoaded) {
              // ArcGIS fallback
              try {
                const arcProvider = await ArcGisMapServerImageryProvider.fromUrl(
                  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
                  { enablePickFeatures: false, maximumLevel: 13 }
                );
                if (!active) return;
                viewer.imageryLayers.removeAll();
                viewer.imageryLayers.addImageryProvider(arcProvider);
                addLog('Warning: Ion imagery unavailable — using ArcGIS fallback.');
              } catch { addLog('Warning: All imagery providers failed.'); }
            }
          } else {
            const arcProvider = await ArcGisMapServerImageryProvider.fromUrl(
              'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
              { enablePickFeatures: false, maximumLevel: 13 }
            );
            if (!active) return;
            viewer.imageryLayers.removeAll();
            viewer.imageryLayers.addImageryProvider(arcProvider);
            addLog('Warning: Cesium Ion token missing — using ArcGIS imagery.');
          }

          // --- Terrain: Ion World Terrain, fallback to flat earth ---
          if (!active) return;
          let terrainLabel = 'Flat Earth';
          if (useIon) {
            try {
              const terrain = await createWorldTerrainAsync({
                requestVertexNormals: true,
                requestWaterMask: false,
              });
              if (!active) return;
              viewer.terrainProvider = terrain;
              terrainLabel = 'Ion Terrain';
              addLog('System: Cesium Ion terrain loaded.');
            } catch {
              if (!active) return;
              viewer.terrainProvider = new EllipsoidTerrainProvider();
              addLog('Warning: Ion terrain unavailable — using flat earth.');
            }
          } else {
            viewer.terrainProvider = new EllipsoidTerrainProvider();
          }

          setCesiumDiagnostics({
            token: useIon ? 'Configured' : 'Missing',
            terrain: terrainLabel,
            imagery: imageryLabel,
          });
        } catch (err) {
          console.error('Failed to initialize Cesium Viewer:', err);
          addLog('CRITICAL: Failed to mount 3D Visualization engine.');
        }
      }
    };

    initCesium();

    return () => {
      active = false;
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy();
        } catch (e) {
          // Ignore destruction exceptions
        }
        viewerRef.current = null;
        pointsRef.current = null;
      }
    };
  }, [addLog]);

  // --- 1b. Listen for fly-to-ECI events from UserSatellitePanel ---
  useEffect(() => {
    const handler = (e: Event) => {
      const viewer = viewerRef.current;
      if (!viewer) return;
      const { x, y, z } = (e as CustomEvent).detail as { x: number; y: number; z: number; name: string };
      // ECI (km) → Cesium world coords (metres)
      const dest = new Cartesian3(x * 1000, y * 1000, z * 1000);
      viewer.camera.flyTo({
        destination: dest,
        orientation: { heading: 0, pitch: -Math.PI / 6, roll: 0 },
        duration: 2.5,
        easingFunction: (t: number) => t * (2 - t),
      });
    };
    window.addEventListener('trsat:flyToEci', handler);
    return () => window.removeEventListener('trsat:flyToEci', handler);
  }, []);

  // --- 2. Update Ground Station in place ---
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // A) Ground Observer Station Entity
    const obsId = 'active-observer-station';
    const existingObs = viewer.entities.getById(obsId);
    
    if (showObserver && observer) {
      try {
        // Update Cesium Default Home View to point to the Ground Station
        Camera.DEFAULT_VIEW_RECTANGLE = Rectangle.fromDegrees(
          observer.longitude_deg - 15, // West
          observer.latitude_deg - 15,  // South
          observer.longitude_deg + 15, // East
          observer.latitude_deg + 15   // North
        );

        // Use elevation=0 so the position is always on the reference ellipsoid.
        // HeightReference.CLAMP_TO_GROUND then pins the marker to the terrain
        // surface in 3D mode. In 2D/Columbus mode a non-zero altitude component
        // is applied before the flat projection, shifting the marker off its
        // correct lon/lat — forcing 0 here fixes that misalignment.
        const obsPos = Cartesian3.fromDegrees(
          observer.longitude_deg,
          observer.latitude_deg,
          0
        );
        
        if (existingObs) {
          existingObs.position = obsPos as any;
          if (existingObs.label) {
            existingObs.label.text = observer.name as any;
          }
        } else {
          viewer.entities.add({
            id: obsId,
            position: obsPos,
            point: {
              pixelSize: 10,
              color: Color.fromCssColorString('#7C5CFF'),
              outlineColor: Color.WHITE,
              outlineWidth: 1.5,
              heightReference: HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
            label: {
              text: observer.name,
              font: '40px Inter, sans-serif',
              scale: 0.3,
              fillColor: Color.WHITE,
              outlineColor: Color.BLACK,
              outlineWidth: 3,
              style: LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: VerticalOrigin.BOTTOM,
              pixelOffset: new Cartesian2(0, -9),
              heightReference: HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
          });
        }
      } catch (err) {
        console.error('Error drawing observer station:', err);
      }
    } else {
      if (existingObs) {
        viewer.entities.remove(existingObs);
      }
    }
    viewer.scene.requestRender();
  }, [
    observer,
    showObserver
  ]);

  // --- 2.5 Camera Lock Follow Control (Only triggers on active target focus or lock-follow toggle changes) ---
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (followActiveObject && activeObject) {
      const isReplay = replayEnabled && replayEphemeris && replayEphemeris.length > 0;
      const targetId = isReplay ? 'replay-satellite' : `live-object-${activeObject.norad_id}`;
      const targetEntity = viewer.entities.getById(targetId);
      if (targetEntity && viewer.trackedEntity !== targetEntity) {
        viewer.trackedEntity = targetEntity;
      }
    } else {
      if (viewer.trackedEntity) {
        viewer.trackedEntity = undefined;
      }
    }
  }, [followActiveObject, activeObject, activeState, replayEnabled, replayEphemeris]);

  // --- 2.8 Earth Lighting & Rotation Controls ---
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.scene.globe.enableLighting = enableEarthLighting;
    viewer.clock.shouldAnimate = enableEarthRotation;
    if (enableEarthRotation) {
      viewer.clock.multiplier = 1.0; // 1x real-time speed
    }
    viewer.scene.requestRender();
  }, [enableEarthLighting, enableEarthRotation]);

  // --- 2.9 Graphics Quality — applies user-tunable visual settings every time
  // they change. Most properties are live-mutable on the viewer; resolution and
  // MSAA take effect on the next frame Cesium paints.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.resolutionScale = graphics.resolutionScale;
    viewer.scene.postProcessStages.fxaa.enabled = graphics.fxaa;
    if (viewer.scene.msaaSamples !== undefined) {
      viewer.scene.msaaSamples = graphics.msaaSamples;
    }
    viewer.scene.globe.maximumScreenSpaceError = graphics.maximumScreenSpaceError;
    viewer.scene.globe.tileCacheSize = graphics.tileCacheSize;

    if (viewer.scene.skyBox) viewer.scene.skyBox.show = graphics.showSkyBox;
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = graphics.showSkyAtmosphere;
    if (viewer.scene.sun) viewer.scene.sun.show = graphics.showSun;
    if (viewer.scene.moon) viewer.scene.moon.show = graphics.showMoon;
    viewer.scene.globe.showGroundAtmosphere = graphics.showGroundAtmosphere;
    viewer.scene.fog.enabled = graphics.enableFog;
    viewer.scene.globe.depthTestAgainstTerrain = graphics.depthTestAgainstTerrain;

    viewer.scene.requestRender();
  }, [graphics]);

  // --- 3. Update Static Orbit Paths (Only re-drawn on explicit Ephemeris changes) ---
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Orbit Path Polyline (Cyan)
    const orbitId = 'active-orbit-path';
    const existingOrbit = viewer.entities.getById(orbitId);
    if (existingOrbit) {
      viewer.entities.remove(existingOrbit);
    }

    if (showOrbitPath && activeEphemeris && activeEphemeris.length > 0) {
      try {
        const renderEphemeris = downsampleForRender(activeEphemeris, graphics.polylinePoints);
        const orbitPositions = renderEphemeris.map(state =>
          cartesianFromGeodetic(state.latitude_deg, state.longitude_deg, state.altitude_km)
        );

        const orbitEntity = viewer.entities.add({
          id: orbitId,
          polyline: {
            positions: orbitPositions,
            width: 1.8,
            material: Color.CYAN.withAlpha(0.55),
            arcType: ArcType.NONE
          }
        });

        // Fly camera to frame the full orbit on first draw
        viewer.flyTo(orbitEntity, { duration: 1.5 });
      } catch (err) {
        console.error('Error drawing orbit path:', err);
      }
    }

    // Ground Track Polyline (Amber)
    const trackId = 'active-ground-track';
    const existingTrack = viewer.entities.getById(trackId);
    if (existingTrack) {
      viewer.entities.remove(existingTrack);
    }

    if (showGroundTrack && activeEphemeris && activeEphemeris.length > 0) {
      try {
        const trackPositions = downsampleForRender(activeEphemeris, graphics.polylinePoints).map(state =>
          groundTrackCartesian(state.latitude_deg, state.longitude_deg, 2000)
        );

        viewer.entities.add({
          id: trackId,
          polyline: {
            positions: trackPositions,
            width: 1.6,
            material: new PolylineDashMaterialProperty({
              color: Color.ORANGE.withAlpha(0.75),
              dashLength: 16.0,
            }),
            arcType: ArcType.GEODESIC
          }
        });
      } catch (err) {
        console.error('Error drawing ground track:', err);
      }
    }
    viewer.scene.requestRender();
  }, [activeEphemeris, showOrbitPath, showGroundTrack, graphics.polylinePoints]);

  // --- 4. Manage Selected Satellite Markers from Live Telemetry Frame ---
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const activeNoradId = activeObject?.norad_id;
    const objectsToRender = new Map<number, any>();
    
    selectedObjects.forEach(obj => {
      objectsToRender.set(obj.norad_id, obj);
    });
    if (activeObject) {
      objectsToRender.set(activeObject.norad_id, activeObject);
    }

    const currentIdsToKeep = new Set(objectsToRender.keys());

    objectsToRender.forEach((obj, noradId) => {
      const entityId = `live-object-${noradId}`;
      const existing = viewer.entities.getById(entityId);
      const isActive = noradId === activeNoradId;
      
      let state = liveObjectStates[noradId];
      if (isActive && activeState) {
        state = activeState;
      }

      let isConjunctionTarget = false;
      let isPrimary = false;
      let isSecondary = false;

      if (activeConjunctionResult) {
        if (noradId === activeConjunctionResult.primary_norad_id) {
          isConjunctionTarget = true;
          isPrimary = true;
        } else if (noradId === activeConjunctionResult.secondary_norad_id) {
          isConjunctionTarget = true;
          isSecondary = true;
        }
      }

      if (state) {
        const pos = cartesianFromGeodetic(
          state.latitude_deg,
          state.longitude_deg,
          state.altitude_km
        );

        const isReplayMode = isActive && replayEnabled && replayEphemeris && replayEphemeris.length > 0;
        const alpha = isReplayMode ? 0.3 : 1.0;

        const modelUri = getModelUri(noradId, obj.object_type ?? '');
        // Selected object uses a crisp WHITE accent (not red — red is reserved
        // for risk/warning). Conjunction primary/secondary keep cyan/magenta.
        const silhouetteColor = isActive
          ? Color.WHITE
          : isPrimary   ? Color.CYAN
          : isSecondary ? Color.MAGENTA
          : Color.TRANSPARENT;
        const silhouetteSize = (isActive || isConjunctionTarget) ? 2.0 : 0.0;
        const labelText = isActive
          ? `${obj.name} (NORAD: ${obj.norad_id})`
          : isConjunctionTarget ? `[CONJ] ${obj.name}`
          : obj.name;
        const labelFill = isConjunctionTarget && !isActive
          ? (isPrimary ? Color.CYAN.withAlpha(alpha) : Color.MAGENTA.withAlpha(alpha))
          : Color.WHITE.withAlpha(alpha);

        if (existing) {
          existing.position = pos as any;
          if (existing.label) {
            existing.label.text = labelText as any;
            existing.label.font = (isActive ? '40px "Share Tech Mono", monospace' : '30px "Share Tech Mono", monospace') as any;
            existing.label.scale = 0.3 as any;
            existing.label.fillColor = labelFill as any;
            existing.label.outlineColor = Color.BLACK.withAlpha(alpha) as any;
            existing.label.outlineWidth = (isActive ? 3 : 2) as any;
          }
          if (existing.model) {
            existing.model.silhouetteColor = silhouetteColor as any;
            existing.model.silhouetteSize  = silhouetteSize as any;
          }
        } else {
          try {
            viewer.entities.add({
              id: entityId,
              position: pos,
              // Point marker — always visible as fallback if GLB fails to load
              point: {
                pixelSize: isActive ? 14 : 10,
                color: isActive ? Color.WHITE : isConjunctionTarget
                  ? (isPrimary ? Color.CYAN : Color.MAGENTA)
                  : Color.CYAN.withAlpha(0.9),
                outlineColor: Color.BLACK.withAlpha(0.6),
                outlineWidth: 1.5,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
              model: {
                uri: modelUri,
                minimumPixelSize: isActive ? 90 : 72,
                scale: 1.0,
                silhouetteColor,
                silhouetteSize,
              },
              label: {
                text: labelText,
                font: isActive ? '40px Inter, sans-serif' : '30px Inter, sans-serif',
                scale: 0.3,
                fillColor: labelFill,
                outlineColor: Color.BLACK.withAlpha(alpha),
                outlineWidth: isActive ? 3.0 : 2.0,
                style: LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: VerticalOrigin.BOTTOM,
                pixelOffset: isActive ? new Cartesian2(0, -20) : new Cartesian2(0, -12),
                disableDepthTestDistance: Number.POSITIVE_INFINITY
              }
            });
          } catch (err) {
            console.error(`Failed to add live entity for NORAD ${noradId}:`, err);
          }
        }
      } else {
        if (existing) {
          viewer.entities.remove(existing);
        }
      }
    });

    const toRemove: any[] = [];
    for (let i = 0; i < viewer.entities.values.length; i++) {
      const ent = viewer.entities.values[i];
      if (ent.id.startsWith('live-object-')) {
        const idStr = ent.id.substring('live-object-'.length);
        const noradId = parseInt(idStr, 10);
        if (!currentIdsToKeep.has(noradId)) {
          toRemove.push(ent);
        }
      }
    }
    toRemove.forEach(ent => viewer.entities.remove(ent));

    viewer.scene.requestRender();
  }, [selectedObjects, liveObjectStates, liveTrackingEnabled, activeObject, activeState, activeConjunctionResult, replayEnabled, replayEphemeris]);

  // --- 4.5. Render Replay Mode Entities ---
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const replaySatId = 'replay-satellite';
    const replayOrbitId = 'replay-orbit-path';
    const replayTrackId = 'replay-ground-track';
    const replayPointId = 'replay-current-ground-point';

    const existingSat = viewer.entities.getById(replaySatId);
    const existingOrbit = viewer.entities.getById(replayOrbitId);
    const existingTrack = viewer.entities.getById(replayTrackId);
    const existingPoint = viewer.entities.getById(replayPointId);

    if (replayEnabled && replayEphemeris && replayEphemeris.length > 0 && activeObject) {
      const state = replayEphemeris[replayIndex];
      if (!state) return;

      const pos = cartesianFromGeodetic(state.latitude_deg, state.longitude_deg, state.altitude_km);
      const groundPos = groundTrackCartesian(state.latitude_deg, state.longitude_deg, 2000);

      // Replay Satellite — 3D model with yellow silhouette
      if (existingSat) {
        existingSat.position = pos as any;
      } else {
        viewer.entities.add({
          id: replaySatId,
          position: pos,
          model: {
            uri: getModelUri(activeObject.norad_id, activeObject.object_type ?? ''),
            minimumPixelSize: 30,
            maximumScale: 20000,
            scale: 1.0,
            silhouetteColor: Color.YELLOW,
            silhouetteSize: 3.0,
          },
          label: {
            text: `[REPLAY] ${activeObject.name}`,
            font: '44px Inter, sans-serif',
            scale: 0.3,
            fillColor: Color.YELLOW,
            outlineColor: Color.BLACK,
            outlineWidth: 4,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.BOTTOM,
            pixelOffset: new Cartesian2(0, -20),
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        });
      }

      // Replay Orbit Path
      if (!existingOrbit) {
        const renderReplay = downsampleForRender(replayEphemeris, graphics.polylinePoints);
        const orbitPositions = renderReplay.map(s =>
          cartesianFromGeodetic(s.latitude_deg, s.longitude_deg, s.altitude_km)
        );
        viewer.entities.add({
          id: replayOrbitId,
          polyline: {
            positions: orbitPositions,
            width: 3,
            material: Color.YELLOW.withAlpha(0.5),
            arcType: ArcType.NONE
          }
        });
      }

      // Replay Ground Track
      if (!existingTrack) {
        const trackPositions = downsampleForRender(replayEphemeris, graphics.polylinePoints).map(s =>
          groundTrackCartesian(s.latitude_deg, s.longitude_deg, 2000)
        );
        viewer.entities.add({
          id: replayTrackId,
          polyline: {
            positions: trackPositions,
            width: 2.5,
            material: Color.YELLOW.withAlpha(0.3),
            arcType: ArcType.GEODESIC
          }
        });
      }

      // Replay Ground Point
      if (existingPoint) {
        existingPoint.position = groundPos as any;
      } else {
        viewer.entities.add({
          id: replayPointId,
          position: groundPos,
          point: {
            pixelSize: 8,
            color: Color.YELLOW.withAlpha(0.8),
            outlineColor: Color.BLACK,
            outlineWidth: 1,
          }
        });
      }
    } else {
      if (existingSat) viewer.entities.remove(existingSat);
      if (existingOrbit) viewer.entities.remove(existingOrbit);
      if (existingTrack) viewer.entities.remove(existingTrack);
      if (existingPoint) viewer.entities.remove(existingPoint);
    }
    viewer.scene.requestRender();
  }, [replayEnabled, replayIndex, replayEphemeris, activeObject]);

  // --- 5. Camera Fly-To Active Satellite (On Focus Change Only) ---
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (activeObject) {
      const currentNorad = activeObject.norad_id;
      if (prevActiveNoradIdRef.current !== currentNorad) {
        prevActiveNoradIdRef.current = currentNorad;
        
        setTimeout(() => {
          const satEntity = viewer.entities.getById(`live-object-${currentNorad}`);
          if (satEntity) {
            viewer.flyTo(satEntity, {
              duration: 2.0,
              offset: new HeadingPitchRange(0, -Math.PI / 4, 1500000)
            });
          }
        }, 150);
      }
    } else {
      prevActiveNoradIdRef.current = null;
    }
  }, [activeObject]); // Only trigger when activeObject changes, preventing ticks from snapping camera

  // --- 6. Render Catalog Snapshot Layer ---
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (!pointsRef.current) {
      pointsRef.current = viewer.scene.primitives.add(new PointPrimitiveCollection());
    }

    const points = pointsRef.current!;
    points.removeAll();

    if (catalogLayerEnabled && catalogLayerObjects && catalogLayerObjects.length > 0) {
      catalogLayerObjects.forEach(obj => {
        const lon = Number(obj.longitude_deg);
        const lat = Number(obj.latitude_deg);
        const alt = Number(obj.altitude_km);
        if (!isFinite(lon) || !isFinite(lat) || !isFinite(alt)) return;

        const pos = Cartesian3.fromDegrees(lon, lat, alt * 1000);

        let color = Color.WHITE;
        if (obj.object_type === 'PAYLOAD') color = Color.CYAN;
        else if (obj.object_type === 'ROCKET_BODY') color = Color.ORANGE;
        else if (obj.object_type === 'DEBRIS') color = Color.fromCssColorString('#8FA6C1').withAlpha(0.7);

        points.add({
          position: pos,
          color: color,
          pixelSize: 4,
          id: `catalog-layer-obj-${obj.norad_id}`
        });
      });
    }
    viewer.scene.requestRender();
  }, [catalogLayerEnabled, catalogLayerObjects]);

  // --- Hover interaction for Ephemeris Ghost ---
  // PERF: Register handler ONCE on mount, read ephemeris from refs to avoid
  // destroying/recreating ScreenSpaceEventHandler on every ephemeris update.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    // Avoid duplicate registration
    if (hoverHandlerRef.current) return;

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    hoverHandlerRef.current = handler;
    const ghostId = 'ephemeris-hover-ghost';

    handler.setInputAction((movement: any) => {
      const pickedObject = viewer.scene.pick(movement.endPosition);
      if (pickedObject && pickedObject.id && (pickedObject.id.id === 'replay-orbit-path' || pickedObject.id.id === 'active-orbit-path')) {
        
        // Read from refs — always up-to-date, no stale closures
        const ephemeris = pickedObject.id.id === 'replay-orbit-path' ? replayEphemerisRef.current : activeEphemerisRef.current;
        if (!ephemeris || ephemeris.length === 0) return;

        // Find closest point in 2D, using 3D distance to camera to disambiguate crossings and back-of-earth
        let minCamDist = Infinity;
        let closestState = null;
        let closestPos3D = null;
        
        for (let i = 0; i < ephemeris.length; i++) {
          const state = ephemeris[i];
          const pos3D = cartesianFromGeodetic(state.latitude_deg, state.longitude_deg, state.altitude_km);
          const pos2D = SceneTransforms.worldToWindowCoordinates(viewer.scene, pos3D);
          if (pos2D) {
            const dist = Cartesian2.distance(pos2D, movement.endPosition);
            if (dist < 30) {
              const camDist = Cartesian3.distance(viewer.camera.position, pos3D);
              if (camDist < minCamDist) {
                minCamDist = camDist;
                closestState = state;
                closestPos3D = pos3D;
              }
            }
          }
        }

        if (closestState) {
          const existingGhost = viewer.entities.getById(ghostId);
          const timeStr = new Date(closestState.timestamp_utc).toISOString().substring(11, 19);
          const text = `T: ${timeStr}\nAlt: ${closestState.altitude_km.toFixed(1)} km`;

          if (existingGhost) {
            existingGhost.position = closestPos3D as any;
            if (existingGhost.label) {
              existingGhost.label.text = text as any;
              existingGhost.label.font = '40px "Share Tech Mono", monospace' as any;
              existingGhost.label.scale = 0.3 as any;
            }
          } else {
            viewer.entities.add({
              id: ghostId,
              position: closestPos3D as any,
              point: {
                pixelSize: 8,
                color: Color.CYAN,
                outlineColor: Color.WHITE,
                outlineWidth: 2,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
              },
              label: {
                text: text,
                font: '40px Inter, sans-serif',
                scale: 0.3,
                fillColor: Color.CYAN,
                outlineColor: Color.BLACK,
                outlineWidth: 3,
                style: LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: VerticalOrigin.BOTTOM,
                pixelOffset: new Cartesian2(0, -10),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                backgroundColor: new Color(0, 0, 0, 0.7),
                showBackground: true,
              }
            });
          }
        } else {
          const existingGhost = viewer.entities.getById(ghostId);
          if (existingGhost) viewer.entities.remove(existingGhost);
        }
        viewer.scene.requestRender();

      } else {
        const existingGhost = viewer.entities.getById(ghostId);
        if (existingGhost) {
          viewer.entities.remove(existingGhost);
          viewer.scene.requestRender();
        }
      }
    }, ScreenSpaceEventType.MOUSE_MOVE);

    return () => {
      if (hoverHandlerRef.current && !hoverHandlerRef.current.isDestroyed()) {
        hoverHandlerRef.current.destroy();
      }
      hoverHandlerRef.current = null;
      const existingGhost = viewerRef.current?.entities.getById(ghostId);
      if (existingGhost && viewerRef.current) viewerRef.current.entities.remove(existingGhost);
    };
  }, []); // PERF: Empty deps — register once, reads from refs

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default CesiumViewer;
