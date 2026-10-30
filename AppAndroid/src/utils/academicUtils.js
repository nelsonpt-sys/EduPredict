/**
 * EduPredict Academic Calculation Engine
 * Mirrors the logic defined in the Django Ramo model (models.py)
 */

export const redondearInacap = (valor) => {
  if (valor === null || valor === undefined) return 0.0;
  // Rounds to 1 decimal place using standard mathematical rounding (HALF_UP approximation in JS)
  return Math.round(valor * 10) / 10;
};

export const calcularAcademicos = (notas, examen, meta_promedio) => {
  // 1. Filtrar evaluaciones con nota
  const conjNotas = (notas || []).filter(n => n.nota !== null && n.nota !== '' && n.nota !== 0);
  const conjPendientes = (notas || []).filter(n => n.nota === null || n.nota === '' || n.nota === 0);
  
  // 2. Promedio Parcial
  let sumaPuntos = 0;
  let sumaPorc = 0;
  conjNotas.forEach(n => {
    sumaPuntos += parseFloat(n.nota) * parseFloat(n.porcentaje || 0);
    sumaPorc += parseFloat(n.porcentaje || 0);
  });
  
  const parcialReal = sumaPorc > 0 ? (sumaPuntos / sumaPorc) : 0.0;
  const promedioParcial = redondearInacap(parcialReal);
  
  // 3. Promedio Final (Aplicando examen)
  let finalReal = parcialReal;
  const exNota = (examen && examen.nota !== '' && examen.nota !== null) ? parseFloat(examen.nota) : 0;
  const exPorc = (examen && examen.porcentaje !== '' && examen.porcentaje !== null) ? parseFloat(examen.porcentaje) : 0;
  
  if (exNota > 0 && exPorc > 0) {
    const factorEx = exPorc / 100;
    finalReal = parcialReal * (1 - factorEx) + exNota * factorEx;
  }
  const promedioFinal = redondearInacap(finalReal);
  
  // 4. Simulación para Nivel
  const simulatingNivel = () => {
    const totalPorcNotas = (notas || []).reduce((acc, n) => acc + (parseFloat(n.porcentaje) || 0), 0);
    const totalPorcEx = exPorc;
    const totalPorc = totalPorcNotas + totalPorcEx;

    if (conjNotas.length === 0) return 1; // Sin datos = Reprobado/Gris inicial

    // Peor caso (pendientes = 1.0)
    const simular = (notaSim) => {
      let sP = 0;
      let sWeighted = 0;
      (notas || []).forEach(n => {
        const hasNota = n.nota !== null && n.nota !== '' && n.nota !== 0;
        sP += (hasNota ? parseFloat(n.nota) : notaSim) * (parseFloat(n.porcentaje) || 0);
        sWeighted += (parseFloat(n.porcentaje) || 0);
      });
      const pParcial = sWeighted > 0 ? (sP / sWeighted) : 0;
      if (exNota > 0 && exPorc > 0) {
        return pParcial * (1 - (exPorc / 100)) + exNota * (exPorc / 100);
      }
      return pParcial;
    };

    const maxPosible = redondearInacap(simular(7.0));
    if (maxPosible < 4.0) return 1;

    if (conjPendientes.length === 0) {
      return promedioFinal >= 4.0 ? 5 : 1;
    }

    const peorCaso = redondearInacap(simular(1.0));
    if (peorCaso >= 4.0) return 4;

    // Calcular nota necesaria para 4.0
    // Simplified needed calculation
    const puntosActuales = conjNotas.reduce((acc, n) => acc + (n.nota * n.porcentaje), 0);
    const porcTotalNotas = (notas || []).reduce((acc, n) => acc + (parseFloat(n.porcentaje) || 0), 0);
    const porcPendiente = conjPendientes.reduce((acc, n) => acc + (parseFloat(n.porcentaje) || 0), 0);
    
    if (porcPendiente === 0) return (promedioFinal >= 4.0 ? 5 : 1);

    const objParcial = (exNota > 0 && exPorc > 0) ? (4.0 - (exNota * (exPorc / 100))) / (1 - (exPorc / 100)) : 4.0;
    const notaNecesaria = (objParcial * porcTotalNotas - puntosActuales) / porcPendiente;

    if (notaNecesaria > 7.0) return 1;
    if (notaNecesaria <= 5.9) return 3;
    return 2;
  };

  const nivel = simulatingNivel();
  
  const niveles = {
    5: { label: 'Aprobado', color: '#06b6d4', bg: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25), rgba(30, 64, 175, 0.15))', border: 'rgba(6, 182, 212, 0.4)' },
    4: { label: 'Bien encaminado', color: '#10b981', bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(6, 95, 70, 0.15))', border: 'rgba(16, 185, 129, 0.4)' },
    3: { label: 'Ajustado', color: '#f59e0b', bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(146, 64, 14, 0.15))', border: 'rgba(245, 158, 11, 0.4)' },
    2: { label: 'En riesgo', color: '#ef4444', bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(153, 27, 27, 0.15))', border: 'rgba(239, 68, 68, 0.45)' },
    1: { label: 'Reprobado / Sin datos', color: '#94a3b8', bg: 'linear-gradient(135deg, rgba(148, 163, 184, 0.15), rgba(31, 41, 55, 0.12))', border: 'rgba(148, 163, 184, 0.25)' }
  };

  return {
    promedioParcial,
    promedioFinal,
    nivel,
    nivelInfo: niveles[nivel]
  };
};
