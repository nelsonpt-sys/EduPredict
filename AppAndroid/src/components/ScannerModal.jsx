import React, { useState, useEffect } from 'react';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';
import { scanHorario, crearRamosMasivo, getSemestres } from '../services/api';
import { Camera as CameraIcon, X, Loader2, ImagePlus, Check, Trash2, Image, Camera as CameraSourceIcon } from 'lucide-react';

export default function ScannerModal({ isOpen, onClose, onRamosCreated, currentSemestreId }) {
  const [semestres, setSemestres] = useState([]);
  const [selectedSemestreId, setSelectedSemestreId] = useState(currentSemestreId || '');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detectedRamos, setDetectedRamos] = useState([]);
  const [errorText, setErrorText] = useState('');
  
  // States: 'idle', 'scanning', 'reviewing'
  const [step, setStep] = useState('idle');

  useEffect(() => {
    if (isOpen) {
      setStep('idle');
      setDetectedRamos([]);
      setErrorText('');
      loadSemestres();
    }
  }, [isOpen]);

  const loadSemestres = async () => {
    try {
      const data = await getSemestres();
      setSemestres(data.semestres || []);
      if (!selectedSemestreId && data.semestres && data.semestres.length > 0) {
        setSelectedSemestreId(data.semestres[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCapture = async (sourceType) => {
    try {
      setErrorText('');
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: sourceType,
        width: 1200,
        direction: CameraDirection.Rear
      });

      if (image.base64String) {
        processImage(image.base64String);
      }
    } catch (err) {
      console.warn("User cancelled or error", err);
    }
  };

  const processImage = async (base64) => {
    setLoading(true);
    setStep('scanning');
    try {
      const res = await scanHorario(base64);
      if (res.ok && res.ramos) {
        if (res.ramos.length > 0) {
           setDetectedRamos(res.ramos);
           setStep('reviewing');
        } else {
           setErrorText("No se detectaron asignaturas legibles en la imagen.");
           setStep('idle');
        }
      }
    } catch (err) {
      setErrorText(err.message || 'Error analizando imagen');
      setStep('idle');
    } finally {
      setLoading(false);
    }
  };

  const removeRamo = (index) => {
    setDetectedRamos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!selectedSemestreId) {
      setErrorText("Debes seleccionar un período para los ramos.");
      return;
    }
    setSaving(true);
    setErrorText('');
    try {
      const data = await crearRamosMasivo(selectedSemestreId, detectedRamos);
      if (data.ok) {
        onRamosCreated();
        onClose();
      }
    } catch (err) {
      setErrorText(err.message || 'Error guardando ramos.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="overlay-blur" style={{ padding: '20px' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', padding: '25px' }}>
        <button 
          onClick={onClose} 
          style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'var(--text-secondary)' }}
        >
          <X size={24} />
        </button>

        <div className="text-center" style={{ marginBottom: '20px' }}>
          <div style={{ width: '50px', height: '50px', background: 'rgba(99,102,241,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
            <ImagePlus size={24} color="var(--primary-color)" />
          </div>
          <h2 style={{ margin: 0 }}>AI Vision Scanner</h2>
          <p style={{ margin: '5px 0 0' }}>Sube tu horario y deja que la IA lo transcriba.</p>
        </div>

        {errorText && (
          <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', color: '#f87171', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>
            {errorText}
          </div>
        )}

        {step === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button className="btn-primary" onClick={() => handleCapture(CameraSource.Camera)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <CameraSourceIcon size={20} /> Tomar Foto
            </button>
            <button className="btn-secondary" onClick={() => handleCapture(CameraSource.Photos)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <Image size={20} /> Escoger de Galería
            </button>
          </div>
        )}

        {step === 'scanning' && (
          <div className="text-center" style={{ padding: '30px 0' }}>
            <Loader2 size={40} className="animate-spin" style={{ color: 'var(--primary-color)', margin: '0 auto 15px' }} />
            <p>Analizando imagen con IA...</p>
          </div>
        )}

        {step === 'reviewing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Periodo de destino:</label>
              <select 
                value={selectedSemestreId} 
                onChange={(e) => setSelectedSemestreId(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--card-border)' }}
              >
                <option value="" disabled>Selecciona un periodo</option>
                {semestres.map(s => <option key={s.id} value={s.id}>{s.user_identifier || s.nombre}</option>)}
              </select>
            </div>

            <div>
              <h3 style={{ marginBottom: '10px' }}>Ramos Detectados ({detectedRamos.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                {detectedRamos.map((ramo, index) => (
                  <div key={index} style={{ padding: '10px 15px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px' }}>{ramo}</span>
                    <button onClick={() => removeRamo(index)} style={{ background: 'none', border: 'none', color: '#ef4444' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', paddingTop: '10px' }}>
              <button className="btn-secondary" onClick={() => setStep('idle')} style={{ flex: 1 }}>Reintentar</button>
              <button className="btn-primary" onClick={handleCreate} disabled={saving || detectedRamos.length === 0} style={{ flex: 2 }}>
                {saving ? 'Guardando...' : 'Confirmar Todo'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
