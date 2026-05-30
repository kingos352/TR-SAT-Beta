import { describe, it, expect, beforeEach } from 'vitest';
import { useConsoleStore } from '../../store/useConsoleStore';

describe('systemSlice', () => {
  beforeEach(() => {
    useConsoleStore.setState({
      logs: [],
      language: 'en',
      apiStatus: 'checking',
    });
  });

  it('addLog appends to logs array', () => {
    useConsoleStore.getState().addLog('Test log entry');
    expect(useConsoleStore.getState().logs).toContain('Test log entry');
  });

  it('setLanguage changes language', () => {
    useConsoleStore.getState().setLanguage('tr');
    expect(useConsoleStore.getState().language).toBe('tr');
  });

  it('setApiStatus updates status', () => {
    useConsoleStore.getState().setApiStatus('connected');
    expect(useConsoleStore.getState().apiStatus).toBe('connected');
  });

  it('setApiStatus with error logs the error', () => {
    useConsoleStore.getState().setApiStatus('disconnected', 'Connection refused');
    const logs = useConsoleStore.getState().logs;
    expect(logs.some(l => l.includes('Connection refused'))).toBe(true);
  });
});
