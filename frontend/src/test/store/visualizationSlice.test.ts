import { describe, it, expect, beforeEach } from 'vitest';
import { useConsoleStore } from '../../store/useConsoleStore';

describe('visualizationSlice', () => {
  beforeEach(() => {
    useConsoleStore.setState({
      showOrbitPath: true,
      showGroundTrack: true,
      showObserver: true,
      followActiveObject: false,
      enableEarthLighting: false,
      enableEarthRotation: false,
    });
  });

  it('setShowOrbitPath toggles orbit path', () => {
    useConsoleStore.getState().setShowOrbitPath(false);
    expect(useConsoleStore.getState().showOrbitPath).toBe(false);
  });

  it('setFollowActiveObject enables camera follow', () => {
    useConsoleStore.getState().setFollowActiveObject(true);
    expect(useConsoleStore.getState().followActiveObject).toBe(true);
  });

  it('setEnableEarthLighting toggles lighting', () => {
    useConsoleStore.getState().setEnableEarthLighting(true);
    expect(useConsoleStore.getState().enableEarthLighting).toBe(true);
  });
});
