import React, { useState, useRef, useEffect } from 'react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { sendAssistantMessage } from '../../api/client';
import { useTranslation } from '../../i18n/useTranslation';

const AssistantPanelInner: React.FC = () => {
  const activeObject = useConsoleStore(s => s.activeObject);
  const activeState = useConsoleStore(s => s.activeState);
  const observer = useConsoleStore(s => s.observer);
  const activeConjunctionResult = useConsoleStore(s => s.activeConjunctionResult);
  const visibilityResults = useConsoleStore(s => s.visibilityResults);
  const { t } = useTranslation();

  const [input, setInput] = useState('');
  const [history, setHistory] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [providerMode, setProviderMode] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, loading]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMsg = text.trim();
    setInput('');
    setHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const context = {
        activeObject,
        activeState,
        observer,
        activeConjunctionResult,
        visibilityResults: visibilityResults.slice(0, 5)
      };

      const response = await sendAssistantMessage({
        message: userMsg,
        context,
        language: 'en'
      });
      setProviderMode(response.mode);
      setHistory(prev => [...prev, { role: 'assistant', content: response.answer }]);
    } catch (err: any) {
      setProviderMode('local_fallback');
      setHistory(prev => [...prev, { role: 'assistant', content: `${t('assistant.error')} ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "Explain the active object state.",
    "What does TLE reliability mean?",
    "Is live tracking direct telemetry?",
    "Explain this conjunction screening result.",
    "Why is this object visible from my ground station?",
    "What should I export for a technical report?"
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        
        {/* Chat History */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '8px', 
          backgroundColor: 'rgba(0,0,0,0.2)', 
          borderRadius: '4px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          minHeight: '150px'
        }}>
          {history.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', margin: 'auto' }}>
              {t('assistant.greeting')}
            </div>
          )}
          {history.map((msg, i) => (
            <div key={i} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              backgroundColor: msg.role === 'user' ? 'rgba(34, 211, 238, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: msg.role === 'user' ? '1px solid rgba(34, 211, 238, 0.3)' : '1px solid var(--border-color)',
              padding: '6px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              maxWidth: '85%',
              color: 'var(--text-bright)',
              whiteSpace: 'pre-wrap'
            }}>
              {msg.content}
            </div>
          ))}
          {loading && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {t('assistant.thinking')}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Suggestions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {suggestions.map((sg, i) => (
            <button
              key={i}
              onClick={() => handleSend(sg)}
              disabled={loading}
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '9px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {sg}
            </button>
          ))}
        </div>

        {providerMode && (
          <div style={{ 
            fontSize: '10px', 
            color: providerMode === 'local_fallback' ? '#fbbf24' : '#4ade80',
            backgroundColor: 'rgba(0,0,0,0.3)',
            padding: '4px 8px',
            borderRadius: '4px',
            border: `1px solid ${providerMode === 'local_fallback' ? 'rgba(251,191,36,0.3)' : 'rgba(74,222,128,0.3)'}`
          }}>
            {providerMode === 'local_fallback' 
              ? '⚠️ Assistant provider unavailable. Using local fallback.' 
              : '✅ AI Provider Active'}
          </div>
        )}

        {/* Input */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend(input);
            }}
            placeholder={t('assistant.placeholder')}
            disabled={loading}
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-bright)',
              padding: '6px 8px',
              borderRadius: '4px',
              fontSize: '11px'
            }}
          />
          <button
            onClick={() => handleSend(input)}
            disabled={loading || !input.trim()}
            style={{
              backgroundColor: 'rgba(34, 211, 238, 0.2)',
              color: 'var(--accent-cyan)',
              border: '1px solid rgba(34, 211, 238, 0.4)',
              padding: '0 12px',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: (loading || !input.trim()) ? 'not-allowed' : 'pointer',
              fontWeight: 600
            }}
          >
            {t('assistant.ask')}
          </button>
        </div>

    </div>
  );
};

export const AssistantPanel = React.memo(AssistantPanelInner);
