import { Cartesian3 } from 'cesium';

/**
 * Converts geodetic latitude (deg), longitude (deg), and altitude (km) to a Cesium Cartesian3 coordinate (meters).
 */
export function cartesianFromGeodetic(latDeg: number, lonDeg: number, altKm: number): Cartesian3 {
  return Cartesian3.fromDegrees(lonDeg, latDeg, altKm * 1000);
}

/**
 * Converts ECEF coordinates from kilometers to meters in a Cesium Cartesian3.
 */
export function cartesianFromECEFKm(xKm: number, yKm: number, zKm: number): Cartesian3 {
  return new Cartesian3(xKm * 1000, yKm * 1000, zKm * 1000);
}

/**
 * Converts geodetic coordinates to ground-clamped surface coordinates (altitude = 0 or custom low offset).
 */
export function groundTrackCartesian(latDeg: number, lonDeg: number, altOffsetM: number = 0): Cartesian3 {
  return Cartesian3.fromDegrees(lonDeg, latDeg, altOffsetM);
}
