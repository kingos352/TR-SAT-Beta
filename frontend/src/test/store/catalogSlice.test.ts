import { describe, it, expect, beforeEach } from 'vitest';
import { useConsoleStore } from '../../store/useConsoleStore';

const mockObject = {
  norad_id: 25544,
  name: 'ISS (ZARYA)',
  object_type: 'PAYLOAD',
  category: 'stations',
  source: 'CelesTrak',
  source_group: 'stations',
  latest_tle: null
};

describe('catalogSlice', () => {
  beforeEach(() => {
    // Reset store state before each test
    useConsoleStore.setState({
      selectedObjects: [],
      activeObject: null,
      catalogResults: [],
      catalogSearchQuery: '',
      lastApiError: null,
    });
  });

  it('selectObject adds object to selectedObjects', () => {
    const { selectObject } = useConsoleStore.getState();
    selectObject(mockObject);
    expect(useConsoleStore.getState().selectedObjects).toHaveLength(1);
    expect(useConsoleStore.getState().selectedObjects[0].norad_id).toBe(25544);
  });

  it('selectObject does not add duplicate', () => {
    const { selectObject } = useConsoleStore.getState();
    selectObject(mockObject);
    selectObject(mockObject);
    expect(useConsoleStore.getState().selectedObjects).toHaveLength(1);
  });

  it('removeSelectedObject removes object', () => {
    useConsoleStore.setState({ selectedObjects: [mockObject] });
    const { removeSelectedObject } = useConsoleStore.getState();
    removeSelectedObject(25544);
    expect(useConsoleStore.getState().selectedObjects).toHaveLength(0);
  });

  it('setCatalogSearchQuery updates query', () => {
    const { setCatalogSearchQuery } = useConsoleStore.getState();
    setCatalogSearchQuery('ISS');
    expect(useConsoleStore.getState().catalogSearchQuery).toBe('ISS');
  });

  it('selectObject respects maxSelectedObjects limit', () => {
    // Fill up to max
    const objects = Array.from({ length: 20 }, (_, i) => ({ ...mockObject, norad_id: i + 1 }));
    useConsoleStore.setState({ selectedObjects: objects });
    const { selectObject } = useConsoleStore.getState();
    selectObject({ ...mockObject, norad_id: 99999 });
    // Should not exceed 20
    expect(useConsoleStore.getState().selectedObjects).toHaveLength(20);
  });
});
