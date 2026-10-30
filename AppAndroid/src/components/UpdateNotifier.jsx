import { useState, useEffect } from 'react';
import { Download, X, Rocket } from 'lucide-react';

const CURRENT_VERSION = '1.0.0'; // Versión local de esta compilación
const GITHUB_USER = 'eduPredictSpA';
const GITHUB_REPO = 'EduPredict-App';
const VERSION_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/version.json`;

export default function UpdateNotifier() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const response = await fetch(`${VERSION_URL}?t=${Date.now()}`); // Evitar cache
        const data = await response.json();
        
        if (data.version && data.version !== CURRENT_VERSION) {
          setUpdateInfo(data);
          setIsVisible(true);
        }
      } catch (error) {
        console.error('Error al verificar actualizaciones:', error);
      }
    };

    // Verificar al iniciar y cada vez que la app tome el foco (opcional)
    checkUpdate();
  }, []);

  if (!isVisible || !updateInfo) return null;

  return (
    <div className="overlay-blur" style={{ zIndex: 9999 }}>
      <div className="modal-premium" style={{ maxWidth: '340px', padding: '32px' }}>
        <button 
          onClick={() => setIsVisible(false)}
          style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)' }}
        >
          <X size={20} />
        </button>

        <div style={{ width: '64px', height: '64px', background: 'linear-gradient(135deg, #10b981, #34d399)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)' }}>
          <Rocket size={32} color="white" />
        </div>

        <h3 style={{ color: 'white', fontWeight: '900', fontSize: '20px', marginBottom: '8px', textAlign: 'center' }}>
          ¡Nueva versión disponible!
        </h3>
        
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '700' }}>
            v{updateInfo.version}
          </span>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', lineHeight: '1.6', textAlign: 'center', marginBottom: '24px' }}>
          {updateInfo.notes || 'Hemos realizado mejoras para optimizar tu experiencia académica.'}
        </p>

        <button 
          className="btn-primary"
          style={{ width: '100%', padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
          onClick={() => window.open(updateInfo.url || `https://github.com/${GITHUB_USER}/${GITHUB_REPO}/releases`, '_blank')}
        >
          <Download size={20} />
          Descargar ahora
        </button>

        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', textAlign: 'center', marginTop: '16px' }}>
          EduPredict Public Distribution System
        </p>
      </div>
    </div>
  );
}
