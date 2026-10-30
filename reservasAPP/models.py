from django.db import models
from django.contrib.auth.models import User
from django.core.validators import RegexValidator
import decimal


TIPO_PERIODO_CHOICES = [
    ('semestre', 'Semestre'),
    ('trimestre', 'Trimestre'),
    ('bimestre', 'Bimestre'),
    ('cuatrimestre', 'Cuatrimestre'),
]

LIMITES_PERIODO = {
    'semestre':     {'max_periodos': 10, 'max_ramos': 8,  'max_evaluaciones': 10, 'label': 'Semestre'},
    'trimestre':    {'max_periodos': 15, 'max_ramos': 6,  'max_evaluaciones': 8,  'label': 'Trimestre'},
    'bimestre':     {'max_periodos': 24, 'max_ramos': 5,  'max_evaluaciones': 6,  'label': 'Bimestre'},
    'cuatrimestre': {'max_periodos': 12, 'max_ramos': 7,  'max_evaluaciones': 10, 'label': 'Cuatrimestre'},
}

TIPO_FEEDBACK_CHOICES = [
    ('bug',        '🐛 Reporte de bug'),
    ('mejora',     '💡 Sugerencia'),
    ('comentario', '💬 Comentario general'),
]


def redondear_inacap(valor):
    if valor is None:
        return 0.0
    try:
        d = decimal.Decimal(str(round(valor, 6))).quantize(
            decimal.Decimal('0.1'),
            rounding=decimal.ROUND_HALF_UP
        )
        return float(d)
    except Exception:
        return float(valor) if valor is not None else 0.0


class Estado(models.Model):
    estado = models.CharField(max_length=20)
    def __str__(self):
        return self.estado


class Reserva(models.Model):
    nombre      = models.CharField(max_length=50)
    telefono    = models.CharField(max_length=20)
    fecha       = models.DateField()
    hora        = models.TimeField()
    cantidad    = models.IntegerField()
    estado      = models.ForeignKey(Estado, on_delete=models.CASCADE)
    observacion = models.CharField(max_length=200, null=True, blank=True)
    def __str__(self):
        return self.nombre


class Comentario(models.Model):
    nombre    = models.CharField(max_length=100)
    email     = models.EmailField()
    telefono  = models.CharField(
        max_length=20,
        validators=[RegexValidator(regex=r'^\+?\d{8,13}$', message='Ingrese un número de teléfono válido')]
    )
    mensaje   = models.TextField(max_length=200)
    tipo_feedback = models.CharField(
        max_length=20,
        choices=TIPO_FEEDBACK_CHOICES,
        default='comentario',
        verbose_name='Tipo de feedback'
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_creacion']
        verbose_name = 'Comentario'
        verbose_name_plural = 'Comentarios'

    def __str__(self):
        return f"[{self.get_tipo_feedback_display()}] {self.nombre} — {self.email}"


class Semestre(models.Model):
    user               = models.ForeignKey(User, on_delete=models.CASCADE)
    nombre             = models.CharField(max_length=50)
    orden              = models.IntegerField(default=1)
    tipo_periodo       = models.CharField(max_length=20, choices=TIPO_PERIODO_CHOICES, default='semestre')
    es_actual          = models.BooleanField(default=False)
    completado_periodo = models.BooleanField(default=False)
    limite_ramos       = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ['orden']
        unique_together = ['user', 'orden']

    @property
    def tipo_label(self):
        return LIMITES_PERIODO.get(self.tipo_periodo, {}).get('label', 'Semestre')

    @property
    def max_ramos(self):
        if self.limite_ramos:
            return self.limite_ramos
        return LIMITES_PERIODO.get(self.tipo_periodo, {}).get('max_ramos', 8)

    @property
    def max_evaluaciones(self):
        return LIMITES_PERIODO.get(self.tipo_periodo, {}).get('max_evaluaciones', 10)

    def __str__(self):
        return self.nombre


class Ramo(models.Model):
    user          = models.ForeignKey(User, on_delete=models.CASCADE)
    semestre      = models.ForeignKey(Semestre, on_delete=models.CASCADE, null=True, blank=True)
    nombre        = models.CharField(max_length=100)
    notas         = models.JSONField(default=list)
    examen        = models.JSONField(default=dict)
    meta_promedio = models.FloatField(null=True, blank=True, default=None)
    completado    = models.BooleanField(default=False)
    bloqueado     = models.BooleanField(default=False)

    def _evaluaciones_con_nota(self):
        return [e for e in self.notas if e.get('nota') is not None and e['nota'] != 0.0]

    def _evaluaciones_pendientes(self):
        return [e for e in self.notas if e.get('nota') is None or e['nota'] == 0.0]

    def _promedio_ponderado_base(self, lista_evaluaciones):
        suma_puntos      = sum((e.get('nota') or 0.0) * (e.get('porcentaje') or 0.0) for e in lista_evaluaciones)
        suma_porcentajes = sum(e.get('porcentaje') or 0.0 for e in lista_evaluaciones)
        if suma_porcentajes == 0:
            return 0.0
        return suma_puntos / suma_porcentajes

    def _aplicar_examen(self, promedio_parcial):
        if not self.examen:
            return promedio_parcial
        nota_ex = self.examen.get('nota')
        porc_ex = self.examen.get('porcentaje') or 0
        if nota_ex is not None and nota_ex != 0.0 and porc_ex > 0:
            factor = porc_ex / 100
            return promedio_parcial * (1 - factor) + nota_ex * factor
        return promedio_parcial

    def _simular_final_con_nota(self, nota_simulada):
        evaluaciones_simuladas = []
        for e in self.notas:
            tiene_nota = e.get('nota') is not None and e['nota'] != 0.0
            evaluaciones_simuladas.append({
                'nota':       e['nota'] if tiene_nota else nota_simulada,
                'porcentaje': e.get('porcentaje') or 0
            })
        parcial = self._promedio_ponderado_base(evaluaciones_simuladas)
        return self._aplicar_examen(parcial)

    @property
    def promedio_parcial(self):
        con_nota = self._evaluaciones_con_nota()
        if not con_nota:
            return 0.0
        return redondear_inacap(self._promedio_ponderado_base(con_nota))

    @property
    def promedio_final(self):
        con_nota = self._evaluaciones_con_nota()
        if not con_nota:
            return 0.0
        parcial = self._promedio_ponderado_base(con_nota)
        return redondear_inacap(self._aplicar_examen(parcial))

    @property
    def promedio_maximo_posible(self):
        return redondear_inacap(self._simular_final_con_nota(7.0))

    @property
    def cantidad_pendientes(self):
        return len(self._evaluaciones_pendientes())

    @property
    def nota_necesaria_para_aprobar(self):
        return self._calcular_nota_necesaria(4.0)

    @property
    def nota_necesaria_para_meta(self):
        if not self.meta_promedio:
            return None
        return self._calcular_nota_necesaria(self.meta_promedio)

    def _calcular_nota_necesaria(self, objetivo):
        pendientes = self._evaluaciones_pendientes()
        if not pendientes:
            return None
        puntos_actuales = sum((e.get('nota') or 0.0) * (e.get('porcentaje') or 0.0) for e in self._evaluaciones_con_nota())
        porc_total      = sum(e.get('porcentaje') or 0.0 for e in self.notas)
        porc_pendiente  = sum(e.get('porcentaje') or 0.0 for e in pendientes)
        if porc_pendiente == 0 or porc_total == 0:
            return None
        nota_ex     = self.examen.get('nota') if self.examen else None
        porc_ex_pct = (self.examen.get('porcentaje') or 0) if self.examen else 0
        factor_ex   = porc_ex_pct / 100
        if nota_ex is not None and nota_ex != 0.0 and factor_ex > 0:
            if (1 - factor_ex) == 0:
                return None
            objetivo_parcial = (objetivo - nota_ex * factor_ex) / (1 - factor_ex)
        else:
            objetivo_parcial = objetivo
        nota_x = (objetivo_parcial * porc_total - puntos_actuales) / porc_pendiente
        return round(nota_x, 1)

    @property
    def promedio_parcial_display(self):
        return f"{self.promedio_parcial:.1f}"

    @property
    def promedio_final_display(self):
        return f"{self.promedio_final:.1f}"

    @property
    def nivel(self):
        """
        Sistema de Niveles EduPredict (1-5):
        5 = Aprobado definitivo
        4 = Bien encaminado
        3 = Ajustado
        2 = En riesgo
        1 = Reprobado matemáticamente
        """
        pendientes   = self.cantidad_pendientes
        final_actual = self.promedio_final
        if pendientes == 0:
            return 5 if final_actual >= 4.0 else 1
        maximo = self.promedio_maximo_posible
        if maximo < 4.0:
            return 1
        peor_caso = redondear_inacap(self._simular_final_con_nota(1.0))
        if peor_caso >= 4.0:
            return 4
        nota_necesaria = self._calcular_nota_necesaria(4.0)
        if nota_necesaria is None or nota_necesaria > 7.0:
            return 1
        if nota_necesaria <= 5.9:
            return 3
        return 2

    def __str__(self):
        return self.nombre

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    display_name = models.CharField(max_length=150, null=True, blank=True)
    google_id = models.CharField(max_length=255, null=True, blank=True, unique=True)
    avatar_url = models.URLField(max_length=500, null=True, blank=True)

    def __str__(self):
        return f'Perfil de {self.user.username}'

from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance, defaults={'display_name': instance.username})

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if not hasattr(instance, 'profile'):
        UserProfile.objects.get_or_create(user=instance, defaults={'display_name': instance.username})
    instance.profile.save()
