from django.conf import settings
from .models import Semestre, LIMITES_PERIODO


def periodo_context(request):
    if not request.user.is_authenticated:
        return {'TIPO_PERIODO': 'semestre', 'TIPO_LABEL': 'Semestre', 'NUM_PERIODO': None}
    
    semestre = Semestre.objects.filter(user=request.user).first()
    if semestre:
        tipo = semestre.tipo_periodo
        label = LIMITES_PERIODO.get(tipo, {}).get('label', 'Semestre')
    else:
        tipo = 'semestre'
        label = 'Semestre'
    
    # Obtener el período actual del usuario
    semestre_actual = Semestre.objects.filter(user=request.user, es_actual=True).first()
    num_periodo = semestre_actual.orden if semestre_actual else None
    
    return {
        'TIPO_PERIODO': tipo,
        'TIPO_LABEL': label,
        'NUM_PERIODO': num_periodo,
        'GOOGLE_CLIENT_ID': getattr(settings, 'GOOGLE_CLIENT_ID', None)
    }