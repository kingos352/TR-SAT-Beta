import React, { useState } from 'react';
import { API_BASE_URL } from '../../api/client';

export const FirstBootSetup: React.FC = () => {
  const [formData, setFormData] = useState({
    cesium_token: '',
    spacetrack_user: '',
    spacetrack_password: '',
    ai_key: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/config/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration. Please check your inputs.');
      }

      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 100%)',
      position: 'relative',
      overflow: 'hidden',
      color: 'var(--text-bright)'
    }}>
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '30px 30px',
        opacity: 0.5,
      }} />

      <div style={{
        background: 'rgba(20, 20, 40, 0.7)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        position: 'relative',
        zIndex: 1,
        padding: '40px',
        width: '100%',
        maxWidth: '500px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{
            background: 'var(--accent-primary, #1976d2)',
            padding: '16px',
            borderRadius: '50%',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            🚀
          </div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 'bold' }}>
            TR-SAT Mission Control V3
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted, #aaa)' }}>
            Initial Setup & Configuration
          </p>
        </div>

        {error && (
          <div style={{ 
            background: 'rgba(211, 47, 47, 0.1)', 
            border: '1px solid #d32f2f', 
            color: '#ffb4ab', 
            padding: '12px', 
            borderRadius: '8px', 
            marginBottom: '24px' 
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>Cesium ION Token *</label>
            <input
              name="cesium_token"
              value={formData.cesium_token}
              onChange={handleChange}
              required
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '12px',
                color: 'white',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>SpaceTrack Username *</label>
            <input
              name="spacetrack_user"
              value={formData.spacetrack_user}
              onChange={handleChange}
              required
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '12px',
                color: 'white',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>SpaceTrack Password *</label>
            <input
              name="spacetrack_password"
              type="password"
              value={formData.spacetrack_password}
              onChange={handleChange}
              required
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '12px',
                color: 'white',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>AI Key (Gemini - Optional)</label>
            <input
              name="ai_key"
              type="password"
              value={formData.ai_key}
              onChange={handleChange}
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '12px',
                color: 'white',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '16px',
              padding: '16px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(90deg, #1976d2 0%, #9c27b0 100%)',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Initializing...' : 'Initialize Platform'}
          </button>
        </form>
      </div>
    </div>
  );
};
