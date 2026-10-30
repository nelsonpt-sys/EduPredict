import { X, CheckCircle, XCircle, Info } from 'lucide-react';

const MessageBanner = ({ type = 'info', message, onClose }) => {
  if (!message) return null;

  const styles = {
    error: {
      bg: 'rgba(239, 68, 68, 0.15)',
      border: 'rgba(239, 68, 68, 0.4)',
      icon: <XCircle className="text-red-500" size={20} />,
      title: 'ERROR',
      color: '#ef4444'
    },
    success: {
      bg: 'rgba(34, 197, 94, 0.15)',
      border: 'rgba(34, 197, 94, 0.4)',
      icon: <CheckCircle className="text-green-500" size={20} />,
      title: 'ÉXITO',
      color: '#22c55e'
    },
    info: {
      bg: 'rgba(99, 102, 241, 0.15)',
      border: 'rgba(99, 102, 241, 0.4)',
      icon: <Info className="text-indigo-500" size={20} />,
      title: 'INFO',
      color: '#6366f1'
    }
  };

  const current = styles[type] || styles.info;

  return (
    <div style={{
      background: current.bg,
      border: `1px solid ${current.border}`,
      borderRadius: '16px',
      padding: '16px 20px',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      position: 'fixed',
      top: '20px',
      left: '16px',
      right: '16px',
      zIndex: 9999,
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      animation: 'slideDown 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {current.icon}
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '10px', fontWeight: '900', letterSpacing: '1.5px', color: current.color, marginBottom: '2px' }}>
          {current.title}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: '500', lineHeight: '1.4' }}>
          {message}
        </div>
      </div>

      {onClose && (
        <button 
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '5px' }}
        >
          <X size={18} />
        </button>
      )}

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default MessageBanner;
