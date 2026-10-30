import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';
import { sendChatMessage } from '../services/api';
import { useLocation } from 'react-router-dom';

export default function FloatingChat({ pageContext = {} }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const location = useLocation();

  // Determinar el nombre de página actual para enviar al backend
  const getCurrentPage = () => {
    const path = location.pathname;
    if (path === '/' || path === '') return 'home';
    if (path === '/period') return 'period';
    if (path.startsWith('/create-course')) return 'create-course';
    if (path.startsWith('/edit-course')) return 'edit-course';
    if (path === '/stats') return 'stats';
    if (path === '/filter') return 'filter';
    return 'home';
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [messages, isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    const newMessages = [...messages, { rol: 'user', texto: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await sendChatMessage(userMsg, newMessages, {
        pagina: getCurrentPage(),
        ...pageContext,
      });
      setMessages([...newMessages, { rol: 'ia', texto: response.respuesta }]);
    } catch (e) {
      console.error('Error en Asistente EduPredict:', e);
      setMessages([...newMessages, {
        rol: 'ia',
        texto: `⚠️ No pude conectarme con el asistente. ${e.message || 'Verifica tu conexión.'}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botón flotante */}
      {!isOpen && (
        <button
          id="chat-fab-button"
          onClick={handleOpen}
          style={{
            position: 'fixed',
            bottom: '85px',
            right: '16px',
            background: 'linear-gradient(135deg, #a855f7, #6366f1)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '54px',
            height: '54px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 4px 20px rgba(124, 58, 237, 0.5)',
            zIndex: 999,
            cursor: 'pointer',
            transition: 'transform 0.2s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          aria-label="Abrir Asistente EduPredict"
        >
          <Sparkles size={24} />
        </button>
      )}

      {/* Panel del chat */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '72vh',
          background: 'var(--bg-color)',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -12px 50px rgba(0,0,0,0.6)',
          borderTop: '1px solid rgba(99, 102, 241, 0.4)',
          animation: 'slideUp 0.3s ease',
        }}>
          {/* Handle bar */}
          <div style={{
            width: '40px',
            height: '4px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '2px',
            margin: '12px auto 0',
            flexShrink: 0,
          }} />

          {/* Header */}
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--card-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Sparkles size={18} color="white" />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '15px' }}>Asistente EduPredict</div>
                <div style={{ fontSize: '11px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: '#22c55e', display: 'inline-block'
                  }} />
                  En línea
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            {messages.length === 0 && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: '12px',
                color: 'var(--text-secondary)',
                textAlign: 'center',
                padding: '0 20px',
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(99,102,241,0.2))',
                  border: '1px solid rgba(168,85,247,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Sparkles size={28} color="#a855f7" />
                </div>
                <div>
                  <p style={{ margin: '0 0 6px', fontWeight: '600', color: 'white', fontSize: '15px' }}>
                    ¡Hola! Soy el Asistente EduPredict
                  </p>
                  <p style={{ margin: 0, fontSize: '13px' }}>
                    Puedo ayudarte con tu situación académica, explicarte cómo funciona la app, o darte consejos de estudio ✨
                  </p>
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  width: '100%',
                  marginTop: '8px',
                }}>
                  {['¿Cómo va mi rendimiento?', '¿Cómo avanzo al siguiente período?', '¿Qué significa el nivel 3?'].map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                        setTimeout(() => inputRef.current?.focus(), 100);
                      }}
                      style={{
                        background: 'rgba(99,102,241,0.1)',
                        border: '1px solid rgba(99,102,241,0.25)',
                        borderRadius: '12px',
                        padding: '10px 14px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.rol === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                {m.rol === 'ia' && (
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', paddingLeft: '4px' }}>
                    Asistente EduPredict
                  </span>
                )}
                <div style={{
                  background: m.rol === 'user'
                    ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                    : 'var(--card-bg)',
                  border: m.rol === 'ia' ? '1px solid var(--card-border)' : 'none',
                  padding: '12px 16px',
                  borderRadius: '18px',
                  borderBottomRightRadius: m.rol === 'user' ? '4px' : '18px',
                  borderBottomLeftRadius: m.rol === 'ia' ? '4px' : '18px',
                  lineHeight: '1.5',
                  fontSize: '14px',
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.texto}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', paddingLeft: '4px' }}>
                  Asistente EduPredict
                </span>
                <div style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  padding: '14px 18px',
                  borderRadius: '18px',
                  borderBottomLeftRadius: '4px',
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center',
                }}>
                  {[0, 1, 2].map(dot => (
                    <div
                      key={dot}
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: '#a855f7',
                        animation: `pulse 1.2s ease-in-out ${dot * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--card-border)',
            display: 'flex',
            gap: '10px',
            flexShrink: 0,
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          }}>
            <input
              ref={inputRef}
              id="chat-input"
              type="text"
              className="input-base"
              style={{ margin: 0, flex: 1, borderRadius: '14px', fontSize: '14px' }}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Escribe un mensaje..."
              disabled={loading}
            />
            <button
              id="chat-send-button"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                background: input.trim() && !loading
                  ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                  : 'rgba(255,255,255,0.08)',
                color: 'white',
                border: 'none',
                borderRadius: '14px',
                width: '46px',
                height: '46px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </>
  );
}
