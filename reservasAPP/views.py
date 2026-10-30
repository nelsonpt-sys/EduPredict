import os
# ============================================================
#  views.py — EduPredict
#  Orden: helpers → auth/setup → vistas principales →
#         ramos CRUD → semestres/períodos → CRUD legacy →
#         IA (helpers, resumen, chat, agregar/eliminar)
# ============================================================

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.contrib.messages.views import SuccessMessageMixin
from django.contrib import messages
from django.http import HttpResponseRedirect, JsonResponse
from django.urls import reverse
from django.views.generic import CreateView
from django.views.decorators.http import require_POST
from django.db.models import Count
from rest_framework.reverse import reverse_lazy
from rest_framework.decorators import api_view
from rest_framework.response import Response
import math
from rest_framework import status
from reservasAPP.models import *
from reservasAPP.serializers import ReservaSerializer
from reservasAPP.forms import *
from .models import Ramo, Semestre, LIMITES_PERIODO
import json
import ssl
import statistics
import urllib.request
import urllib.error


# ──────────────────────────────────────────────────────────────
#  CONSTANTES IA
# ──────────────────────────────────────────────────────────────

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


# ──────────────────────────────────────────────────────────────
#  HELPERS GENERALES
# ──────────────────────────────────────────────────────────────

def _obtener_tipo_usuario(user):
    """Retorna el tipo de período del usuario (semestre, bimestre, etc.)."""
    semestre = Semestre.objects.filter(user=user).first()
    if semestre:
        return semestre.tipo_periodo
    return 'semestre'


def _obtener_label_usuario(user):
    """Retorna el label legible del tipo de período del usuario."""
    tipo = _obtener_tipo_usuario(user)
    return LIMITES_PERIODO.get(tipo, {}).get('label', 'Semestre')


def _extraer_evaluaciones_del_formulario(post_data):
    """Parsea los campos nota_N y porc_N del POST y retorna lista de dicts."""
    evaluaciones = []
    indices_vistos = set()
    for campo in post_data:
        if campo.startswith("nota_"):
            indice = campo[5:]
            if indice in indices_vistos:
                continue
            indices_vistos.add(indice)
            raw_nota = post_data.get(campo, "").strip()
            raw_porc = post_data.get(f"porc_{indice}", "").strip()
            valor_nota = float(raw_nota) if raw_nota else 0.0
            valor_porc = float(raw_porc) if raw_porc else 0.0
            evaluaciones.append({"nota": valor_nota, "porcentaje": valor_porc})
    return evaluaciones


def _extraer_examen_del_formulario(post_data):
    """Parsea examen_nota y examen_porcentaje del POST. Retorna {} si vacío."""
    if not post_data.get("examen_nota", "").strip():
        return {}
    raw_nota_ex = post_data.get("examen_nota", "").strip()
    raw_porc_ex = post_data.get("examen_porcentaje", "").strip()
    return {
        "nota": float(raw_nota_ex) if raw_nota_ex else 0.0,
        "porcentaje": float(raw_porc_ex) if raw_porc_ex else 0.0,
    }


def calculate_radar_metrics(ramos):
    """
    Calcula las 5 métricas del Perfil Comparativo (Radar Chart).
    Unificado para Web y Android (Standard Deviation Logic).
    """
    # Regla de Oro: solo ramos con notas reales (ignorar 0.0 o nulos)
    active_grades = [float(r.promedio_final) for r in ramos if r.promedio_final and r.promedio_final > 0]
    
    if not active_grades:
        return {
            "promedio": 1.0, "max": 1.0, "min": 1.0, 
            "aprobados": 0.0, "consistencia": 7.0,
            "count": 0
        }
    
    n = len(active_grades)
    mean = sum(active_grades) / n
    max_v = max(active_grades)
    min_v = min(active_grades)
    aprob_count = len([g for g in active_grades if g >= 4.0])
    
    # 1. % Aprobados (Escala 1.0 - 7.0)
    pct_aprob = (aprob_count / n) * 7
    
    # 2. Consistencia (Uso de Desviación Estándar)
    variance = sum((val - mean) ** 2 for val in active_grades) / n
    std_dev = math.sqrt(variance)
    # Fórmula Senior: 7 - (StdDev * 1.5), min 1.0
    consistencia = max(1.0, 7 - (std_dev * 1.5))
    
    return {
        "promedio": round(mean, 2),
        "max": round(max_v, 2),
        "min": round(min_v, 2),
        "aprobados": round(pct_aprob, 2),
        "consistencia": round(consistencia, 2),
        "count": n
    }


def _construir_analisis_comparativo(s1_nombre, s2_nombre, ramos1, ramos2, prom1, prom2):
    """Genera texto pre-calculado de comparación entre dos períodos para la IA."""
    lineas = []

    if prom1 > prom2:
        diff = round(prom1 - prom2, 1)
        lineas.append(f"GANADOR GENERAL: {s1_nombre} con promedio {prom1} vs {prom2} ({diff} puntos más alto).")
    elif prom2 > prom1:
        diff = round(prom2 - prom1, 1)
        lineas.append(f"GANADOR GENERAL: {s2_nombre} con promedio {prom2} vs {prom1} ({diff} puntos más alto).")
    else:
        lineas.append(f"EMPATE GENERAL: ambos períodos tienen promedio {prom1}.")

    max1 = max((r.promedio_final for r in ramos1), default=0)
    max2 = max((r.promedio_final for r in ramos2), default=0)
    ramo_max1 = max(ramos1, key=lambda r: r.promedio_final, default=None)
    ramo_max2 = max(ramos2, key=lambda r: r.promedio_final, default=None)
    if ramo_max1:
        lineas.append(f"MEJOR RAMO de {s1_nombre}: '{ramo_max1.nombre}' con {max1}.")
    if ramo_max2:
        lineas.append(f"MEJOR RAMO de {s2_nombre}: '{ramo_max2.nombre}' con {max2}.")
    if max1 > max2:
        lineas.append(f"NOTA MÁXIMA: gana {s1_nombre} ({max1} vs {max2}).")
    elif max2 > max1:
        lineas.append(f"NOTA MÁXIMA: gana {s2_nombre} ({max2} vs {max1}).")
    else:
        lineas.append(f"NOTA MÁXIMA: empate en {max1}.")

    min1 = min((r.promedio_final for r in ramos1), default=0)
    min2 = min((r.promedio_final for r in ramos2), default=0)
    ramo_min1 = min(ramos1, key=lambda r: r.promedio_final, default=None)
    ramo_min2 = min(ramos2, key=lambda r: r.promedio_final, default=None)
    if ramo_min1:
        lineas.append(f"PEOR RAMO de {s1_nombre}: '{ramo_min1.nombre}' con {min1}.")
    if ramo_min2:
        lineas.append(f"PEOR RAMO de {s2_nombre}: '{ramo_min2.nombre}' con {min2}.")
    if min1 > min2:
        lineas.append(f"NOTA MÍNIMA: {s1_nombre} tiene el piso más alto ({min1} vs {min2}).")
    elif min2 > min1:
        lineas.append(f"NOTA MÍNIMA: {s2_nombre} tiene el piso más alto ({min2} vs {min1}).")
    else:
        lineas.append(f"NOTA MÍNIMA: empate en {min1}.")

    aprobados1 = sum(1 for r in ramos1 if r.promedio_final >= 4.0)
    aprobados2 = sum(1 for r in ramos2 if r.promedio_final >= 4.0)
    total1 = len(ramos1)
    total2 = len(ramos2)
    pct1 = round(aprobados1 / total1 * 100) if total1 > 0 else 0
    pct2 = round(aprobados2 / total2 * 100) if total2 > 0 else 0
    lineas.append(
        f"RAMOS APROBADOS: {s1_nombre} aprobó {aprobados1}/{total1} ({pct1}%), "
        f"{s2_nombre} aprobó {aprobados2}/{total2} ({pct2}%)."
    )
    if pct1 > pct2:
        lineas.append(f"TASA DE APROBACIÓN: gana {s1_nombre} ({pct1}% vs {pct2}%).")
    elif pct2 > pct1:
        lineas.append(f"TASA DE APROBACIÓN: gana {s2_nombre} ({pct2}% vs {pct1}%).")
    else:
        lineas.append(f"TASA DE APROBACIÓN: empate en {pct1}%.")

    notas1 = [r.promedio_final for r in ramos1]
    notas2 = [r.promedio_final for r in ramos2]
    desv1 = round(statistics.stdev(notas1), 2) if len(notas1) >= 2 else 0
    desv2 = round(statistics.stdev(notas2), 2) if len(notas2) >= 2 else 0
    if desv1 < desv2:
        lineas.append(f"CONSISTENCIA: {s1_nombre} fue más consistente (variación {desv1} vs {desv2}).")
    elif desv2 < desv1:
        lineas.append(f"CONSISTENCIA: {s2_nombre} fue más consistente (variación {desv2} vs {desv1}).")
    else:
        lineas.append(f"CONSISTENCIA: empate en variación ({desv1}).")

    rango1 = round(max1 - min1, 1)
    rango2 = round(max2 - min2, 1)
    lineas.append(f"PATRÓN {s1_nombre}: rango notas {'alto' if rango1 > 2.5 else 'bajo'} ({rango1} puntos).")
    lineas.append(f"PATRÓN {s2_nombre}: rango notas {'alto' if rango2 > 2.5 else 'bajo'} ({rango2} puntos).")

    lineas.append("\nCOMPARACIÓN POR POSICIÓN DE RAMO:")
    for i, (r1, r2) in enumerate(zip(ramos1, ramos2)):
        if r1.promedio_final > r2.promedio_final:
            diff = round(r1.promedio_final - r2.promedio_final, 1)
            lineas.append(
                f"  Pos.{i+1}: '{r1.nombre}'({s1_nombre})={r1.promedio_final} "
                f"GANA a '{r2.nombre}'({s2_nombre})={r2.promedio_final} por {diff} pts."
            )
        elif r2.promedio_final > r1.promedio_final:
            diff = round(r2.promedio_final - r1.promedio_final, 1)
            lineas.append(
                f"  Pos.{i+1}: '{r2.nombre}'({s2_nombre})={r2.promedio_final} "
                f"GANA a '{r1.nombre}'({s1_nombre})={r1.promedio_final} por {diff} pts."
            )
        else:
            lineas.append(f"  Pos.{i+1}: EMPATE en {r1.promedio_final}.")

    return "\n".join(lineas)


# ──────────────────────────────────────────────────────────────
#  AUTENTICACIÓN Y PÁGINAS GENERALES
# ──────────────────────────────────────────────────────────────

class SignUpView(SuccessMessageMixin, CreateView):
    """Vista de registro de usuario."""
    form_class = UserCreationForm
    success_url = reverse_lazy("login")
    template_name = "registration/signup.html"
    success_message = "¡Usuario creado exitosamente!"


@login_required
def index(request):
    """Dashboard principal: muestra estadísticas resumen de todos los ramos."""
    semestres = Semestre.objects.filter(user=request.user)
    tiene_semestres = semestres.exists()
    todos_los_ramos = list(Ramo.objects.filter(user=request.user)) if tiene_semestres else []
    tiene_ramos = len(todos_los_ramos) > 0

    conteo = {
        'total': 0, 'aprobados': 0, 'encaminados': 0,
        'ajustados': 0, 'en_riesgo': 0, 'criticos': 0,
    }
    if tiene_ramos:
        for asignatura in todos_los_ramos:
            conteo['total'] += 1
            nivel = asignatura.nivel
            if nivel == 5:
                conteo['aprobados'] += 1
            elif nivel == 4:
                conteo['encaminados'] += 1
            elif nivel == 3:
                conteo['ajustados'] += 1
            elif nivel == 2:
                conteo['en_riesgo'] += 1
            elif nivel == 1:
                conteo['criticos'] += 1

    return render(request, "index.html", {
        "tiene_semestres": tiene_semestres,
        "tiene_ramos": tiene_ramos,
        "stats": conteo,
    })


def enviar_comentario(request):
    """Guarda un comentario del formulario de contacto en la landing."""
    if request.method == 'POST':
        form = ComentarioForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, '¡Comentario enviado exitosamente! Gracias por contactarnos.')
            return redirect('landing')
        else:
            for field, errors in form.errors.items():
                for error in errors:
                    messages.error(request, f'{error}')
            return redirect('landing')
    return redirect('landing')


# ──────────────────────────────────────────────────────────────
#  SETUP INICIAL DE PERÍODOS
# ──────────────────────────────────────────────────────────────

@login_required
def setup_periodos(request):
    """Primera configuración: crea todos los períodos de la carrera del usuario."""
    if Semestre.objects.filter(user=request.user).exists():
        return redirect("miPeriodo")

    if request.method == "POST":
        tipo = request.POST.get("tipo_periodo", "semestre")
        cantidad_str = request.POST.get("cantidad_periodos", "0")
        periodo_actual_str = request.POST.get("periodo_actual", "1")

        try:
            cantidad = int(cantidad_str)
            periodo_actual = int(periodo_actual_str)
        except ValueError:
            messages.error(request, "Por favor ingresa valores numéricos válidos.")
            return redirect("setup-periodos")

        limites = LIMITES_PERIODO.get(tipo, LIMITES_PERIODO['semestre'])
        max_p = limites['max_periodos']
        label = limites['label']

        if cantidad < 1 or cantidad > max_p:
            messages.error(request, f"La cantidad de {label.lower()}s debe estar entre 1 y {max_p}.")
            return redirect("setup-periodos")

        if periodo_actual < 1 or periodo_actual > cantidad:
            messages.error(request, f"El {label.lower()} actual debe estar entre 1 y {cantidad}.")
            return redirect("setup-periodos")

        for i in range(1, cantidad + 1):
            Semestre.objects.create(
                user=request.user,
                nombre=f"{i}° {label}",
                orden=i,
                tipo_periodo=tipo,
                es_actual=(i == periodo_actual),
                completado_periodo=False,
                limite_ramos=None,
            )

        request.session.pop('resumen_ia_cache', None)
        messages.success(request, f'¡Configuración completada! Se crearon {cantidad} {label.lower()}s.')
        periodo_activo = Semestre.objects.filter(user=request.user, es_actual=True).first()
        if periodo_activo:
            return redirect(f"/mi_periodo/?semestre={periodo_activo.id}")
        return redirect("miPeriodo")

    return render(request, "setup_periodos.html")


@login_required
def crear_semestres(request):
    """Recrear todos los períodos del usuario (borrar y volver a crear)."""
    if request.method == "POST":
        tipo = _obtener_tipo_usuario(request.user)
        label = LIMITES_PERIODO.get(tipo, {}).get('label', 'Semestre')
        cantidad = int(request.POST.get("cantidad_semestres", 0))
        max_p = LIMITES_PERIODO.get(tipo, {}).get('max_periodos', 10)
        if cantidad > 0 and cantidad <= max_p:
            Semestre.objects.filter(user=request.user).delete()
            for i in range(1, cantidad + 1):
                Semestre.objects.create(
                    user=request.user,
                    nombre=f"{i}° {label}",
                    orden=i,
                    tipo_periodo=tipo,
                    es_actual=(i == 1),
                )
            messages.success(request, f'Se crearon {cantidad} {label.lower()}s.')
            request.session.pop('resumen_ia_cache', None)
            primer = Semestre.objects.filter(user=request.user).first()
            if primer:
                return redirect(f"/mi_periodo/?semestre={primer.id}")
        else:
            messages.error(request, f'Cantidad inválida (1-{max_p}).')
    return redirect("miPeriodo")


# ──────────────────────────────────────────────────────────────
#  VISTAS PRINCIPALES
# ──────────────────────────────────────────────────────────────

@login_required
def mi_semestre(request):
    """Vista principal de período académico: muestra períodos y ramos del usuario."""
    semestres = list(Semestre.objects.filter(user=request.user))
    if not semestres:
        return redirect("setup-periodos")

    tipo_usuario = _obtener_tipo_usuario(request.user)
    label_usuario = LIMITES_PERIODO.get(tipo_usuario, {}).get('label', 'Semestre')
    max_ramos_tipo = LIMITES_PERIODO.get(tipo_usuario, {}).get('max_ramos', 12)

    semestre_actual_id = request.GET.get('semestre')
    semestre_viendo = None
    if semestre_actual_id:
        semestre_viendo = next(
            (s for s in semestres if str(s.id) == str(semestre_actual_id)), None
        )

    semestre_real_actual = next((s for s in semestres if s.es_actual), None)
    if not semestre_viendo:
        semestre_viendo = semestre_real_actual
    if not semestre_viendo:
        semestre_viendo = semestres[0]

    orden_actual = semestre_real_actual.orden if semestre_real_actual else semestres[-1].orden
    semestres_visibles = [s for s in semestres if s.orden <= orden_actual]

    todos_ramos = list(Ramo.objects.filter(user=request.user).select_related('semestre'))
    ramos_por_semestre = {}
    for semestre in semestres:
        ramos_por_semestre[semestre.id] = [
            r for r in todos_ramos if r.semestre_id == semestre.id
        ]

    ramos_semestre_viendo = ramos_por_semestre.get(semestre_viendo.id, [])
    todos_completados = (
        len(ramos_semestre_viendo) > 0
        and all(r.completado for r in ramos_semestre_viendo)
    )
    hay_siguiente = any(s.orden == semestre_viendo.orden + 1 for s in semestres)

    # Calcular si cada período puede cerrarse
    puede_cerrar_por_semestre = {}
    for s in semestres_visibles:
        r_s = ramos_por_semestre.get(s.id, [])
        tiene_limite = s.limite_ramos is not None
        limite_lleno = tiene_limite and len(r_s) >= s.limite_ramos
        todos_comp_s = len(r_s) > 0 and all(r.completado for r in r_s)
        puede_cerrar_por_semestre[s.id] = tiene_limite and limite_lleno and todos_comp_s

    puede_cerrar_actual = (
        puede_cerrar_por_semestre.get(semestre_real_actual.id, False)
        if semestre_real_actual else False
    )

    return render(request, "mi_semestre.html", {
        "semestres": semestres_visibles,
        "semestres_todos": semestres,
        "semestre_actual": semestre_viendo,
        "semestre_real_actual": semestre_real_actual,
        "ramos_por_semestre": ramos_por_semestre,
        "puede_cerrar_por_semestre": puede_cerrar_por_semestre,
        "puede_cerrar_actual": puede_cerrar_actual,
        "todos_completados": todos_completados,
        "hay_siguiente_periodo": hay_siguiente,
        "tipo_label": label_usuario,
        "max_ramos_tipo": max_ramos_tipo,
        "chat_disponible": True,
        "chat_pagina": "mi_semestre",
        "chat_semestre": semestre_viendo.nombre if semestre_viendo else "",
        "chat_tiene_semestres": len(semestres) > 0,
        "chat_tiene_ramos": len(ramos_semestre_viendo) > 0,
    })


@login_required
def estadisticas(request):
    """Vista de estadísticas comparativas entre dos períodos."""
    semestres_con_ramos = (
        Semestre.objects.filter(user=request.user, ramo__isnull=False)
        .distinct()
        .order_by('orden')
    )
    if semestres_con_ramos.count() < 2:
        return render(request, "estadisticas.html", {
            "error": "Necesitas tener ramos en al menos 2 períodos diferentes para ver las estadísticas.",
            "semestres_con_ramos": semestres_con_ramos,
            "chat_disponible": True,
            "chat_pagina": "estadisticas",
            "chat_comparando": False,
        })

    semestre1_id = request.GET.get('semestre1')
    semestre2_id = request.GET.get('semestre2')
    semestre1 = semestre2 = None
    ramos_semestre1 = ramos_semestre2 = []

    if semestre1_id and semestre2_id and semestre1_id != semestre2_id:
        semestre1 = get_object_or_404(Semestre, id=semestre1_id, user=request.user)
        semestre2 = get_object_or_404(Semestre, id=semestre2_id, user=request.user)
        ramos_semestre1 = list(
            Ramo.objects.filter(user=request.user, semestre=semestre1).order_by('id')
        )
        ramos_semestre2 = list(
            Ramo.objects.filter(user=request.user, semestre=semestre2).order_by('id')
        )

    metrics1 = calculate_radar_metrics(ramos_semestre1)
    metrics2 = calculate_radar_metrics(ramos_semestre2)

    promedio_general1 = metrics1["promedio"]
    promedio_general2 = metrics2["promedio"]

    chat_info_comparacion = ""
    if semestre1 and semestre2 and ramos_semestre1 and ramos_semestre2:
        chat_info_comparacion = _construir_analisis_comparativo(
            semestre1.nombre, semestre2.nombre,
            ramos_semestre1, ramos_semestre2,
            promedio_general1, promedio_general2,
        )

    return render(request, "estadisticas.html", {
        "semestres_con_ramos": semestres_con_ramos,
        "semestre1": semestre1,
        "semestre2": semestre2,
        "ramos_semestre1": ramos_semestre1,
        "ramos_semestre2": ramos_semestre2,
        "promedio_general1": promedio_general1,
        "promedio_general2": promedio_general2,
        "metrics1": metrics1,
        "metrics2": metrics2,
        "chat_disponible": True,
        "chat_pagina": "estadisticas",
        "chat_comparando": bool(semestre1 and semestre2),
        "chat_info_comparacion": chat_info_comparacion,
        "chat_semestre1_nombre": semestre1.nombre if semestre1 else "",
        "chat_semestre2_nombre": semestre2.nombre if semestre2 else "",
    })


@login_required
def filtrar_ramos(request):
    """Vista de filtrado de ramos por rango de notas."""
    rango = request.GET.get('rango')
    ramos_filtrados = {}
    nombre_rango = ''

    if rango:
        rangos = {
            'reprobados':       (0.0, 3.9, 'Reprobados (0.0 - 3.9)'),
            'aprobados_bajos':  (4.0, 4.9, 'Aprobados Bajos (4.0 - 4.9)'),
            'aprobados_medios': (5.0, 6.9, 'Aprobados Medios (5.0 - 6.9)'),
            'excelencia':       (7.0, 7.0, 'Excelencia (7.0)'),
        }
        if rango in rangos:
            min_nota, max_nota, nombre_rango = rangos[rango]
            semestres = Semestre.objects.filter(user=request.user).order_by('orden')
            for semestre in semestres:
                ramos = Ramo.objects.filter(
                    user=request.user, semestre=semestre
                ).order_by('nombre')
                if rango == 'excelencia':
                    ramos = [r for r in ramos if r.promedio_final == 7.0]
                else:
                    ramos = [r for r in ramos if min_nota <= r.promedio_final <= max_nota]
                if ramos:
                    ramos_filtrados[semestre] = ramos

    chat_info_filtro = ""
    if ramos_filtrados:
        lineas = [f"El usuario filtró por: {nombre_rango}. Resultados:"]
        for sem, ramos in ramos_filtrados.items():
            lineas.append(f"{sem.nombre}:")
            for r in ramos:
                lineas.append(f"  - {r.nombre}: promedio {r.promedio_final}")
        chat_info_filtro = "\n".join(lineas)

    return render(request, "filtrar_ramos.html", {
        "ramos_filtrados": ramos_filtrados,
        "nombre_rango": nombre_rango,
        "rango_seleccionado": rango,
        "chat_disponible": True,
        "chat_pagina": "filtrar_ramos",
        "chat_rango": nombre_rango,
        "chat_info_filtro": chat_info_filtro,
        "chat_filtro_activo": bool(ramos_filtrados),
    })


# ──────────────────────────────────────────────────────────────
#  RAMOS — CRUD
# ──────────────────────────────────────────────────────────────

class RamoForm(forms.ModelForm):
    """Formulario básico de ramo (solo usado internamente)."""
    class Meta:
        model = Ramo
        fields = ["nombre", "notas", "examen"]


@login_required
def crear_ramo(request):
    """Crea un nuevo ramo en el período seleccionado."""
    tipo_usuario = _obtener_tipo_usuario(request.user)
    limites = LIMITES_PERIODO.get(tipo_usuario, LIMITES_PERIODO['semestre'])

    todos_semestres = list(Semestre.objects.filter(user=request.user).order_by('orden'))
    if not todos_semestres:
        return redirect("setup-periodos")

    semestre_real_actual = next((s for s in todos_semestres if s.es_actual), None)
    orden_actual = semestre_real_actual.orden if semestre_real_actual else 0
    semestres = [s for s in todos_semestres if s.orden <= orden_actual]
    semestre_preseleccionado = request.GET.get('semestre_id', '')

    limites_semestres_json = json.dumps({str(s.id): s.limite_ramos for s in semestres})

    contexto_base = {
        "semestres": semestres,
        "semestre_preseleccionado": semestre_preseleccionado,
        "chat_disponible": True,
        "chat_pagina": "crear_ramo",
        "max_evaluaciones": limites['max_evaluaciones'],
        "max_ramos_tipo": limites['max_ramos'],
        "limites_semestres_json": limites_semestres_json,
    }

    if request.method == "POST":
        nombre_asignatura = request.POST.get("nombre", "").strip()
        id_semestre = request.POST.get("semestre", "").strip()

        if not id_semestre:
            messages.warning(request, "Debes seleccionar un período.")
            return render(request, "crear_ramo.html", contexto_base)

        semestre_destino = get_object_or_404(Semestre, id=id_semestre, user=request.user)

        if semestre_destino.orden > orden_actual:
            messages.error(request, "No puedes crear ramos en un período que aún no has desbloqueado.")
            return render(request, "crear_ramo.html", contexto_base)

        if semestre_destino.limite_ramos is None:
            messages.error(
                request,
                f"Debes configurar el límite de ramos para {semestre_destino.nombre} antes de crear ramos."
            )
            return render(request, "crear_ramo.html", contexto_base)

        ramos_existentes = Ramo.objects.filter(
            user=request.user, semestre=semestre_destino
        ).count()
        if ramos_existentes >= semestre_destino.max_ramos:
            messages.error(
                request,
                f"Ya alcanzaste el límite de {semestre_destino.max_ramos} ramos para {semestre_destino.nombre}."
            )
            return render(request, "crear_ramo.html", contexto_base)

        evaluaciones = _extraer_evaluaciones_del_formulario(request.POST)
        if len(evaluaciones) > semestre_destino.max_evaluaciones:
            messages.error(request, f"Máximo {semestre_destino.max_evaluaciones} evaluaciones por ramo.")
            return render(request, "crear_ramo.html", contexto_base)

        datos_examen = _extraer_examen_del_formulario(request.POST)
        raw_meta = request.POST.get("meta_promedio", "").strip()
        objetivo_personal = float(raw_meta) if raw_meta else None

        Ramo.objects.create(
            user=request.user,
            semestre=semestre_destino,
            nombre=nombre_asignatura,
            notas=evaluaciones,
            examen=datos_examen,
            meta_promedio=objetivo_personal,
        )
        messages.success(request, f'El ramo "{nombre_asignatura}" fue creado en {semestre_destino.nombre}.')
        request.session.pop('resumen_ia_cache', None)
        return render(request, "crear_ramo.html", contexto_base)

    return render(request, "crear_ramo.html", contexto_base)


@login_required
def editar_ramo(request, ramo_id):
    """Edita las evaluaciones y datos de un ramo existente."""
    asignatura = get_object_or_404(Ramo, id=ramo_id, user=request.user)
    tipo_usuario = _obtener_tipo_usuario(request.user)
    limites = LIMITES_PERIODO.get(tipo_usuario, LIMITES_PERIODO['semestre'])
    semestre_id = asignatura.semestre.id if asignatura.semestre else None

    if asignatura.bloqueado:
        return render(request, "editar_ramo.html", {
            "ramo": asignatura,
            "solo_lectura": True,
            "chat_disponible": True,
            "chat_pagina": "editar_ramo",
            "chat_ramo_nombre": asignatura.nombre,
            "chat_ramo_id": asignatura.id,
        })

    if request.method == "POST":
        evaluaciones = _extraer_evaluaciones_del_formulario(request.POST)
        if len(evaluaciones) > limites['max_evaluaciones']:
            messages.error(request, f"Máximo {limites['max_evaluaciones']} evaluaciones por ramo.")
        else:
            asignatura.nombre = request.POST.get("nombre", "").strip()
            asignatura.notas = evaluaciones
            asignatura.examen = _extraer_examen_del_formulario(request.POST)
            raw_meta = request.POST.get("meta_promedio", "").strip()
            asignatura.meta_promedio = float(raw_meta) if raw_meta else None
            asignatura.save()
            request.session.pop('resumen_ia_cache', None)
            if semestre_id:
                return redirect(f"/mi_periodo/?semestre={semestre_id}")
            return redirect("/mi_periodo/")

    return render(request, "editar_ramo.html", {
        "ramo": asignatura,
        "solo_lectura": False,
        "semestre_id": semestre_id,
        "max_evaluaciones": limites['max_evaluaciones'],
        "chat_disponible": True,
        "chat_pagina": "editar_ramo",
        "chat_ramo_nombre": asignatura.nombre,
        "chat_ramo_id": asignatura.id,
    })


@login_required
def eliminar_ramo(request, ramo_id):
    """Elimina un ramo (solo si no está bloqueado)."""
    try:
        asignatura = Ramo.objects.get(id=ramo_id, user=request.user)
        if asignatura.bloqueado:
            messages.error(request, "Este ramo está bloqueado y no puede eliminarse.")
            return redirect(f"/mi_periodo/?semestre={asignatura.semestre.id}")
        id_semestre_origen = asignatura.semestre.id if asignatura.semestre else None
        asignatura.delete()
        request.session.pop('resumen_ia_cache', None)
        if id_semestre_origen:
            return redirect(f"/mi_periodo/?semestre={id_semestre_origen}")
    except Ramo.DoesNotExist:
        pass
    return redirect("/mi_periodo/")


# ──────────────────────────────────────────────────────────────
#  RAMOS — ESTADO (completar / bloquear)
# ──────────────────────────────────────────────────────────────

@login_required
@require_POST
def marcar_completado_ramo(request, ramo_id):
    """Alterna el estado completado de un ramo (toggle)."""
    try:
        asignatura = Ramo.objects.get(id=ramo_id, user=request.user)
        if asignatura.bloqueado:
            return JsonResponse({"error": "El ramo está bloqueado y no puede modificarse."})
        asignatura.completado = not asignatura.completado
        asignatura.save()
        request.session.pop('resumen_ia_cache', None)
        return JsonResponse({"ok": True, "completado": asignatura.completado})
    except Ramo.DoesNotExist:
        return JsonResponse({"error": "Ramo no encontrado."})


@login_required
@require_POST
def toggle_bloqueo_ramo(request, ramo_id):
    """Bloquea un ramo completado (acción irreversible)."""
    try:
        asignatura = Ramo.objects.get(id=ramo_id, user=request.user)
        if not asignatura.completado:
            return JsonResponse({"error": "Solo puedes bloquear ramos marcados como completados."})
        if asignatura.bloqueado:
            return JsonResponse({"error": "El ramo ya está bloqueado."})
        asignatura.bloqueado = True
        asignatura.save()
        request.session.pop('resumen_ia_cache', None)
        return JsonResponse({"ok": True})
    except Ramo.DoesNotExist:
        return JsonResponse({"error": "Ramo no encontrado."})


# ──────────────────────────────────────────────────────────────
#  PERÍODOS — PROGRESO (avanzar / cerrar / límite)
# ──────────────────────────────────────────────────────────────

@login_required
@require_POST
def avanzar_periodo(request):
    """Cierra el período actual y activa el siguiente."""
    semestre_actual = Semestre.objects.filter(user=request.user, es_actual=True).first()
    if not semestre_actual:
        return JsonResponse({"error": "No se encontró el período actual."})

    ramos_actuales = Ramo.objects.filter(user=request.user, semestre=semestre_actual)
    if ramos_actuales.exists() and not all(r.completado for r in ramos_actuales):
        return JsonResponse({"error": "Debes completar todos los ramos antes de avanzar."})

    siguiente = Semestre.objects.filter(
        user=request.user, orden=semestre_actual.orden + 1
    ).first()
    if not siguiente:
        return JsonResponse({"error": "No hay siguiente período disponible."})

    semestre_actual.es_actual = False
    semestre_actual.completado_periodo = True
    semestre_actual.save()
    siguiente.es_actual = True
    siguiente.save()

    request.session.pop('resumen_ia_cache', None)
    return JsonResponse({"ok": True, "nuevo_periodo": siguiente.nombre, "nuevo_id": siguiente.id})


@login_required
@require_POST
def cerrar_periodo_anterior(request):
    """Marca un período pasado (pendiente) como completado."""
    try:
        data = json.loads(request.body)
        semestre_id = data.get("semestre_id")
        semestre = Semestre.objects.get(id=semestre_id, user=request.user)

        if semestre.es_actual:
            return JsonResponse({
                "error": "Para cerrar el período actual usa 'Avanzar al siguiente período'."
            })
        if semestre.completado_periodo:
            return JsonResponse({"error": "Este período ya está marcado como completado."})

        semestre.completado_periodo = True
        semestre.save()
        request.session.pop('resumen_ia_cache', None)
        return JsonResponse({"ok": True, "nombre": semestre.nombre})
    except Semestre.DoesNotExist:
        return JsonResponse({"error": "Período no encontrado."})
    except Exception as e:
        return JsonResponse({"error": str(e)})


@login_required
@require_POST
def set_limite_periodo(request):
    """Guarda el límite de ramos configurado para un período específico."""
    try:
        data = json.loads(request.body)
        semestre_id = data.get("semestre_id")
        limite = data.get("limite")
        if not semestre_id or not limite:
            return JsonResponse({"error": "Datos incompletos."})
        semestre = get_object_or_404(Semestre, id=semestre_id, user=request.user)
        semestre.limite_ramos = int(limite)
        semestre.save()
        return JsonResponse({"ok": True, "limite": int(limite), "nombre": semestre.nombre})
    except Exception as e:
        return JsonResponse({"error": str(e)})


# ──────────────────────────────────────────────────────────────
#  CRUD LEGACY (Reservas / Estados)
# ──────────────────────────────────────────────────────────────

def reservasData(request):
    """Lista todas las reservas."""
    reservas = Reserva.objects.all()
    return render(request, 'reservas.html', {'reservas': reservas})


def registroReservas(request):
    """Crea una nueva reserva."""
    form = ReservaForm()
    if request.method == 'POST':
        form = ReservaForm(request.POST)
        if form.is_valid():
            form.save()
            return HttpResponseRedirect(reverse('reservas'))
    return render(request, 'registroReservas.html', {'form': form})


def eliminarReservas(request, id):
    """Elimina una reserva por ID."""
    reserva = Reserva.objects.get(id=id)
    reserva.delete()
    return HttpResponseRedirect(reverse('reservas'))


def editarReservas(request, id):
    """Edita una reserva existente."""
    reserva = Reserva.objects.get(id=id)
    form = ReservaForm(instance=reserva)
    if request.method == 'POST':
        form = ReservaForm(request.POST, instance=reserva)
        if form.is_valid():
            form.save()
            return HttpResponseRedirect(reverse('reservas'))
    return render(request, 'registroReservas.html', {'form': form})


def estadosData(request):
    """Lista todos los estados."""
    estados = Estado.objects.all()
    return render(request, 'estados.html', {'estados': estados})


def registroEstados(request):
    """Crea un nuevo estado."""
    form = EstadoForm()
    if request.method == 'POST':
        form = EstadoForm(request.POST)
        if form.is_valid():
            form.save()
            return HttpResponseRedirect(reverse('estados'))
    return render(request, 'registroEstados.html', {'form': form})


def eliminarEstados(request, id):
    """Elimina un estado por ID."""
    estado = Estado.objects.get(id=id)
    estado.delete()
    return HttpResponseRedirect(reverse('estados'))


def editarEstados(request, id):
    """Edita un estado existente."""
    estado = Estado.objects.get(id=id)
    form = EstadoForm(instance=estado)
    if request.method == 'POST':
        form = EstadoForm(request.POST, instance=estado)
        if form.is_valid():
            form.save()
            return HttpResponseRedirect(reverse('estados'))
    return render(request, 'registroEstados.html', {'form': form})


@api_view(['GET', 'POST'])
def lista_reservas(request):
    """API REST: lista o crea reservas."""
    if request.method == 'GET':
        reservas = Reserva.objects.all().order_by('fecha')
        serializer = ReservaSerializer(reservas, many=True)
        return Response(serializer.data)
    elif request.method == 'POST':
        serializer = ReservaSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
def detalle_reservas(request, pk):
    """API REST: detalle, edición o eliminación de una reserva."""
    try:
        reserva = Reserva.objects.get(pk=pk)
    except Reserva.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        serializer = ReservaSerializer(reserva)
        return Response(serializer.data)
    if request.method == 'PUT':
        serializer = ReservaSerializer(reserva, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    if request.method == 'DELETE':
        reserva.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ──────────────────────────────────────────────────────────────
#  IA — HELPERS
# ──────────────────────────────────────────────────────────────

def calcular_analisis_ramo(ramo):
    """
    Genera texto pre-calculado para la IA con análisis de notas pendientes,
    promedio máximo posible y notas necesarias para aprobar / llegar a la meta.
    Retorna '' si no hay evaluaciones pendientes.
    """
    notas = ramo.notas
    examen = ramo.examen or {}
    examen_nota = examen.get("nota")
    examen_porc = examen.get("porcentaje") or 0

    pendientes = [
        (i, n) for i, n in enumerate(notas)
        if n.get("nota") is None or n["nota"] == 0.0
    ]
    if not pendientes:
        return ""

    puntos_ingresados = sum(
        (n.get("nota") or 0.0) * (n.get("porcentaje") or 0.0)
        for n in notas
        if n.get("nota") is not None and n["nota"] != 0.0
    )
    porc_pendiente = sum((n.get("porcentaje") or 0.0) for _, n in pendientes)
    porc_total = sum((n.get("porcentaje") or 0.0) for n in notas)
    nombres_pendientes = ", ".join([f"Evaluación {i+1}" for i, _ in pendientes])

    lineas = [f"  [ANÁLISIS PRE-CALCULADO para {ramo.nombre}]"]
    lineas.append(f"  Evaluaciones pendientes: {nombres_pendientes}")

    promedio_max = 0
    if porc_total > 0:
        puntos_max = puntos_ingresados + 7.0 * porc_pendiente
        parcial_max = puntos_max / porc_total
        if examen_nota is not None and examen_nota != 0.0 and examen_porc > 0:
            factor = examen_porc / 100
            promedio_max = parcial_max * (1 - factor) + examen_nota * factor
        else:
            promedio_max = parcial_max
        promedio_max = round(promedio_max, 1)
        lineas.append(f"  Promedio máximo posible: {promedio_max}")

    objetivos = []
    if ramo.meta_promedio:
        objetivos.append(("meta del estudiante", ramo.meta_promedio))
    objetivos.append(("mínimo para aprobar", 4.0))

    for nombre_obj, objetivo in objetivos:
        if examen_nota is not None and examen_nota != 0.0 and examen_porc > 0:
            denom = 1 - examen_porc / 100
            if denom == 0:
                continue
            objetivo_parcial = (objetivo - examen_nota * examen_porc / 100) / denom
        else:
            objetivo_parcial = objetivo

        if porc_pendiente > 0 and porc_total > 0:
            nota_x = (objetivo_parcial * porc_total - puntos_ingresados) / porc_pendiente
            nota_x = round(nota_x, 2)
            if nota_x > 7.0:
                lineas.append(
                    f"  Para {nombre_obj} ({objetivo}): IMPOSIBLE. Máximo posible: {promedio_max}."
                )
            elif nota_x < 1.0:
                lineas.append(f"  Para {nombre_obj} ({objetivo}): Ya asegurado.")
            else:
                lineas.append(
                    f"  Para {nombre_obj} ({objetivo}): Necesita {nota_x} en {nombres_pendientes}."
                )

    return "\n".join(lineas)


def obtener_contexto_usuario(user):
    """
    Construye un resumen textual del estado académico del usuario
    para incluir en el system prompt de la IA.
    """
    semestres = Semestre.objects.filter(user=user).order_by('orden')
    if not semestres.exists():
        return "El usuario no tiene períodos registrados."

    nivel_desc = {
        5: "APROBADO",
        4: "Bien encaminado",
        3: "Ajustado",
        2: "En riesgo",
        1: "REPROBADO DEFINITIVO",
    }

    lineas = []
    for semestre in semestres:
        ramos = Ramo.objects.filter(user=user, semestre=semestre)
        if not ramos.exists():
            continue
        estado_periodo = (
            "ACTUAL" if semestre.es_actual
            else ("COMPLETADO" if semestre.completado_periodo else "PENDIENTE")
        )
        lineas.append(f"\n=== {semestre.nombre} {estado_periodo} ===")

        for ramo in ramos:
            estado_ramo = ""
            if ramo.bloqueado:
                estado_ramo = "[BLOQUEADO/ARCHIVADO]"
            elif ramo.completado:
                estado_ramo = "[COMPLETADO]"
            lineas.append(f"\nRamo: {ramo.nombre} {estado_ramo}")

            if ramo.meta_promedio:
                lineas.append(f"  -> Meta de promedio: {ramo.meta_promedio}")

            if ramo.notas:
                for i, n in enumerate(ramo.notas, 1):
                    nota_val = n.get('nota')
                    porc = n.get('porcentaje', 0)
                    if nota_val and nota_val != 0.0:
                        lineas.append(f"  - Evaluacion {i}: {nota_val} ({porc}%)")
                    else:
                        lineas.append(f"  - Evaluacion {i}: Pendiente ({porc}%)")
            else:
                lineas.append("  - Sin evaluaciones registradas")

            if ramo.examen and (ramo.examen.get('porcentaje') or 0) > 0:
                ex_nota = ramo.examen.get('nota')
                ex_porc = ramo.examen.get('porcentaje') or 0
                if ex_nota is not None and ex_nota != 0.0:
                    lineas.append(f"  - Examen: {ex_nota} ({ex_porc}%)")
                else:
                    lineas.append(f"  - Examen: Pendiente ({ex_porc}%)")
            else:
                lineas.append("  - Sin examen")

            lineas.append(f"  -> Promedio parcial: {ramo.promedio_parcial}")
            lineas.append(f"  -> Promedio final: {ramo.promedio_final}")
            lineas.append(f"  -> Nivel {ramo.nivel}: {nivel_desc.get(ramo.nivel, '')}")
            analisis = calcular_analisis_ramo(ramo)
            if analisis:
                lineas.append(analisis)

    return "\n".join(lineas)


def llamar_groq(system_prompt=None, user_message=None, messages=None, max_tokens=600):
    """Llama a la API de Groq y retorna el texto de respuesta. Soporta prompt simple o lista de mensajes."""
    if messages is None:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]
    
    payload = json.dumps({
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": max_tokens,
    }).encode("utf-8")

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(
        GROQ_API_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "User-Agent": "Mozilla/5.0",
        },
    )
    with urllib.request.urlopen(req, timeout=15, context=ctx) as response:
        result = json.loads(response.read().decode("utf-8"))
        return result["choices"][0]["message"]["content"]


# ──────────────────────────────────────────────────────────────
#  IA — VISTAS
# ──────────────────────────────────────────────────────────────

@login_required
def resumen_ia(request):
    """Genera (o retorna desde caché) el resumen IA del estado académico del usuario."""
    try:
        resumen_en_cache = request.session.get('resumen_ia_cache')
        if resumen_en_cache:
            return JsonResponse({"resumen": resumen_en_cache, "desde_cache": True})

        semestres = Semestre.objects.filter(user=request.user)
        tiene_semestres = semestres.exists()
        todos_los_ramos = list(Ramo.objects.filter(user=request.user)) if tiene_semestres else []
        tiene_ramos = len(todos_los_ramos) > 0
        tipo_label = _obtener_label_usuario(request.user)

        if not tiene_semestres:
            resumen = (
                f"¡Bienvenido a EduPredict, {request.user.username}! 🎓\n\n"
                "Para comenzar, ve a 'Periodo Académico' en el menú lateral y configura tu sistema académico."
            )
            request.session['resumen_ia_cache'] = resumen
            return JsonResponse({"resumen": resumen})

        if not tiene_ramos:
            resumen = (
                f"¡Hola {request.user.username}! Ya tienes tus {tipo_label.lower()}s creados. 👍\n\n"
                "El siguiente paso es registrar tus ramos en 'Periodo Académico'."
            )
            request.session['resumen_ia_cache'] = resumen
            return JsonResponse({"resumen": resumen})

        contexto = obtener_contexto_usuario(request.user)
        system_prompt = f"""Eres el asistente académico de EduPredict. Genera un resumen del estado académico de {request.user.username}.

DATOS ACADÉMICOS:
{contexto}

SISTEMA DE NIVELES:
- Nivel 5 ✅: Aprobado (promedio final >= 4.0 asegurado)
- Nivel 4 📈: Bien encaminado (puede aprobar con las notas que restan)
- Nivel 3 ⚠️: Ajustado (necesita notas altas para aprobar)
- Nivel 2 🚨: En riesgo (muy difícil aprobar)
- Nivel 1 ❌: Reprobado definitivo (matemáticamente imposible aprobar)

REGLAS:
- Escala 1.0-7.0, mínimo para aprobar: 4.0
- Ramos Nivel 1: YA REPROBADOS, no des consejos de recuperación
- USA SIEMPRE los valores del ANÁLISIS PRE-CALCULADO

INSTRUCCIONES:
- Saluda por nombre brevemente con emoji
- Nivel 1: indica como REPROBADO, sin consejos
- Nivel 2: menciona con urgencia
- Nivel 4-5: menciona brevemente los que van bien
- Da 1 recomendación concreta solo para ramos Nivel 2-3
- Máximo 4 párrafos cortos, tono amigable, honesto y con emojis apropiados"""

        resumen = llamar_groq(system_prompt, "Genera mi resumen académico.", max_tokens=500)
        request.session['resumen_ia_cache'] = resumen
        return JsonResponse({"resumen": resumen})

    except urllib.error.HTTPError as e:
        return JsonResponse({"error": f"Error: {e.code}"}, status=500)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@require_POST
def chat_ia(request):
    """
    Endpoint principal del chat IA.
    - SOLO puede agregar/eliminar períodos desde mi_semestre con doble confirmación.
    - NUNCA crea ni ofrece crear ramos u otras acciones del formulario.
    - Conoce en detalle cómo funciona EduPredict para responder dudas del estudiante.
    - Es amigable, usa emojis y responde de forma corta y directa a lo que se pregunta.
    """
    try:
        data = json.loads(request.body)
        mensaje_usuario = data.get("mensaje", "").strip()
        pagina = data.get("pagina", "")
        contexto_pagina = data.get("contexto_pagina", "")
        historial = data.get("historial", [])

        if not mensaje_usuario:
            return JsonResponse({"error": "Mensaje vacío"}, status=400)

        tipo_usuario = _obtener_tipo_usuario(request.user)
        label_usuario = LIMITES_PERIODO.get(tipo_usuario, {}).get('label', 'Semestre')

        semestres = Semestre.objects.filter(user=request.user).order_by('orden')
        total_semestres = semestres.count()
        ultimo_semestre = semestres.last()
        ultimo_semestre_nombre = ultimo_semestre.nombre if ultimo_semestre else ""
        ultimo_semestre_ramos = (
            list(Ramo.objects.filter(user=request.user, semestre=ultimo_semestre)
                 .values_list('nombre', flat=True))
            if ultimo_semestre else []
        )
        max_p = LIMITES_PERIODO.get(tipo_usuario, {}).get('max_periodos', 10)

        contexto_academico = obtener_contexto_usuario(request.user)
        es_pregunta_estadisticas = (pagina == "estadisticas" and data.get("comparando", False))

        # Instrucción contextual según la página activa
        if pagina == "mi_semestre":
            semestre_actual = data.get("semestre_actual", "")
            tiene_semestres_data = data.get("tiene_semestres", True)
            tiene_ramos_data = data.get("tiene_ramos", True)
            if not tiene_semestres_data:
                instruccion_pagina = f"El usuario en 'Mi {label_usuario}' aún no configuró su sistema."
            elif not tiene_ramos_data:
                instruccion_pagina = f"El usuario está viendo '{semestre_actual}' que aún no tiene ramos."
            else:
                instruccion_pagina = (
                    f"El usuario está en 'Mi {label_usuario}' viendo: '{semestre_actual}'. "
                    f"Responde SOLO sobre los ramos de '{semestre_actual}' salvo que pregunte algo general de la app."
                )
        elif pagina == "crear_ramo":
            instruccion_pagina = (
                "El usuario está en la página Crear Ramo. "
                "Puede preguntarte dudas sobre cómo funciona el formulario, los porcentajes, el examen, etc."
            )
        elif pagina == "editar_ramo":
            ramo_nombre = data.get("ramo_nombre", "")
            instruccion_pagina = (
                f"El usuario está editando el ramo '{ramo_nombre}'. "
                "Puede preguntarte dudas sobre evaluaciones, porcentajes o notas."
            )
        elif pagina == "estadisticas":
            comparando = data.get("comparando", False)
            s1 = data.get("semestre1_nombre", "")
            s2 = data.get("semestre2_nombre", "")
            if not comparando:
                instruccion_pagina = (
                    f"El usuario está en 'Estadísticas'. "
                    f"Debe seleccionar dos {label_usuario.lower()}s para comparar."
                )
            else:
                instruccion_pagina = (
                    f"El usuario compara '{s1}' vs '{s2}'.\n\n"
                    f"ANÁLISIS COMPARATIVO PRE-CALCULADO:\n{contexto_pagina}"
                )
        elif pagina == "filtrar_ramos":
            filtro_activo = data.get("filtro_activo", False)
            rango = data.get("rango", "")
            if not filtro_activo:
                instruccion_pagina = "El usuario está en 'Filtrar Ramos' sin filtro activo aún."
            else:
                instruccion_pagina = f"El usuario filtró ramos por '{rango}'.\nRESULTADOS:\n{contexto_pagina}"
        else:
            instruccion_pagina = f"El usuario está usando EduPredict ({label_usuario}s)."

        if es_pregunta_estadisticas:
            limite_respuesta = "Usa hasta 6-8 líneas con análisis de patrones de estudio y recomendación accionable. Incluye emojis apropiados."
            max_tokens_respuesta = 1000
        else:
            limite_respuesta = "Máximo 3 líneas cortas y directas. Usa al menos 1 emoji."
            max_tokens_respuesta = 700

        # Gestión de períodos: SOLO desde mi_semestre, con doble confirmación
        if pagina == "mi_semestre":
            gestion_periodos = f"""
ÚNICA ACCIÓN DISPONIBLE — AGREGAR/ELIMINAR {label_usuario.upper()}S:
Solo si el usuario pide EXPLÍCITAMENTE agregar o eliminar un {label_usuario.lower()}.
- AGREGAR: (1) pregunta "¿Confirmas que quieres agregar un nuevo {label_usuario.lower()}? 📅" → (2) espera "sí" → (3) emite [ACCION:AGREGAR].
- ELIMINAR: mismo flujo → [ACCION:ELIMINAR].
- NUNCA emitas la acción sin confirmación explícita del usuario."""
        else:
            gestion_periodos = f"""
GESTIÓN DE PERÍODOS: PROHIBIDA EN ESTA PÁGINA.
- NUNCA emitas [ACCION:AGREGAR] ni [ACCION:ELIMINAR] aquí.
- Si el usuario pregunta cómo agregar o eliminar un {label_usuario.lower()}, dile que eso se hace desde 'Periodo Académico' 😊."""

        # ── BASE DE CONOCIMIENTO DE EDUPREDICT ────────────────────────────
        # La IA usa esto para responder preguntas de funcionamiento de la app.
        # REGLA CLAVE: responde SOLO lo que se pregunta, sin soltar todo el manual.
        conocimiento_app = f"""
════════════════════════════════════════════════════
MANUAL INTERNO DE EDUPREDICT — ÚSALO SOLO SI TE PREGUNTAN
Responde SOLO lo que se pregunta. Nunca expliques todo esto de golpe.
════════════════════════════════════════════════════

▸ QUÉ ES EDUPREDICT
  App para estudiantes chilenos que registran sus ramos, notas y porcentajes
  para que el sistema calcule su promedio y les diga si van a aprobar o reprobar.

▸ SISTEMA DE NIVELES (responde si preguntan qué es "Nivel X" o "el sistema de niveles")
  Nivel 5 ✅ Aprobado: el promedio final ya es >= 4.0 con las notas actuales.
  Nivel 4 📈 Bien encaminado: aún puede aprobar sacando notas razonables en lo que queda.
  Nivel 3 ⚠️ Ajustado: necesita notas altas (cerca de 6-7) en las evaluaciones pendientes.
  Nivel 2 🚨 En riesgo: matemáticamente muy difícil aprobar, pero no imposible.
  Nivel 1 ❌ Reprobado definitivo: ya es imposible matemáticamente llegar a 4.0.
  → El nivel se calcula automáticamente con las notas ingresadas. No lo elige el usuario.

▸ PERÍODOS ACADÉMICOS (semestres / bimestres / trimestres / cuatrimestres)
  El tipo de período lo elige el usuario al configurar por primera vez la app.
  Cada estudiante puede tener hasta el límite máximo de períodos según su tipo
  (ej: semestral hasta 10, bimestral hasta 24, etc.).

  Estados de un período:
  - ACTUAL 🟢: el período en que el estudiante está inscrito ahora.
  - PENDIENTE 🟡: período pasado que aún no fue marcado como completado.
  - COMPLETADO 🟣: período cerrado oficialmente.
  - BLOQUEADO 🔒: período futuro, aún no disponible.

  ¿Cómo se avanza al siguiente período? (pregunta muy común ⚡)
  Para avanzar al siguiente período, se deben cumplir 3 condiciones en el período ACTUAL:
    1. Haber configurado el límite de ramos de ese período.
    2. Haber agregado exactamente esa cantidad de ramos (igual al límite).
    3. Haber marcado TODOS esos ramos como completados.
  Cuando se cumplen las 3, aparece el botón "Cerrar y avanzar al siguiente período".

  ¿Cómo se cierra un período PENDIENTE?
  Igual que avanzar: límite configurado + cantidad de ramos = límite + todos completados.
  Cuando se cumplen las 3, aparece el botón para cerrarlo.

  ¿Qué es el límite de ramos?
  Es la cantidad de ramos que el estudiante tuvo en ese período. Se configura la primera
  vez que visita cada período (aparece un modal preguntando cuántos ramos tuvo).
  Si se salta ese paso, no podrá agregar ramos en ese período hasta configurarlo.
  Se puede configurar yendo al período en 'Periodo Académico' y el modal aparecerá al
  intentar agregar el primer ramo.

▸ RAMOS
  Un ramo = una asignatura o materia. Cada ramo tiene:
  - Nombre
  - Evaluaciones (nota + porcentaje cada una, deben sumar exactamente 100%)
  - Examen final (opcional, reemplaza parte del porcentaje de evaluaciones)
  - Meta de promedio (opcional, la IA calcula qué notas necesitas para alcanzarla)
  - Promedio parcial: calculado solo con las evaluaciones (sin examen)
  - Promedio final: calculado incluyendo el examen si existe

  ¿Cómo crear un ramo?
  Desde el menú lateral → "Crear Ramo", o desde el botón en 'Periodo Académico'.
  El período debe tener límite configurado antes de poder crear ramos.

  ¿Qué es "Marcar como completado"?
  Indica que ese ramo ya terminó (pasó el semestre). Es necesario para poder
  cerrar o avanzar el período.

  ¿Qué es "Bloquear" un ramo?
  Archiva el ramo en modo solo lectura. Es IRREVERSIBLE. Solo se puede bloquear
  si el ramo ya está marcado como completado.

  ¿Se puede editar un ramo bloqueado? No, solo se puede ver.
  ¿Se puede eliminar un ramo bloqueado? No.

▸ PROMEDIO PARCIAL vs PROMEDIO FINAL
  Parcial: promedio calculado SOLO con las evaluaciones (sin incluir el examen).
  Final: promedio calculado con evaluaciones + examen (si existe).
  Si no hay examen, parcial y final son iguales.

▸ EXAMEN FINAL
  Es opcional. Si el ramo tiene examen, se ingresa la nota y el porcentaje que vale.
  El examen reemplaza ese porcentaje del promedio de evaluaciones.
  Ejemplo: si el examen vale 30%, las evaluaciones pasan a valer el 70% restante.

▸ PORCENTAJES DE EVALUACIONES
  Deben sumar exactamente 100%. Si no suman 100%, el promedio no se calcula correctamente.
  Cada evaluación tiene una nota (1.0 a 7.0) y un porcentaje de ponderación.

▸ META DE PROMEDIO
  Es opcional. Si el estudiante quiere llegar a cierta nota (ej: 5.5), la ingresa
  y el sistema IA calcula qué notas necesita en las evaluaciones pendientes para lograrlo.

▸ PÁGINA ESTADÍSTICAS
  Permite comparar el rendimiento entre dos períodos diferentes.
  Se necesitan al menos 2 períodos con ramos para usar esta función.
  Se eligen los dos períodos a comparar y el sistema muestra análisis detallado.

▸ PÁGINA FILTRAR RAMOS
  Permite ver todos los ramos filtrados por rango de notas:
  - Reprobados (0.0 - 3.9)
  - Aprobados bajos (4.0 - 4.9)
  - Aprobados medios (5.0 - 6.9)
  - Excelencia (7.0)

▸ INICIO (DASHBOARD)
  Muestra un resumen general con conteo de ramos por nivel y un análisis IA
  del estado académico actual del estudiante.

════════════════════════════════════════════════════
INSTRUCCIÓN IMPORTANTE: responde SOLO lo que pregunta el estudiante.
Si pregunta "¿cómo avanzo al siguiente semestre?" → explica las 3 condiciones brevemente.
Si pregunta "¿qué es el nivel 3?" → explica solo ese nivel.
No des todo el manual de golpe. Sé breve, claro y amigable 😊.
════════════════════════════════════════════════════"""

        system_prompt = f"""Eres EduBot, el asistente académico de EduPredict para estudiantes chilenos. 🤖✨
Tienes personalidad amigable, cálida y motivadora. Usas emojis de forma natural (al menos 1 por mensaje).
Hablas en español chileno informal pero respetuoso. Eres conciso: respondes SOLO lo que se pregunta.

Estudiante: {request.user.username} | Sistema: {label_usuario}s
PÁGINA ACTUAL: {pagina}

CONTEXTO DE LA PÁGINA:
{instruccion_pagina}

DATOS ACADÉMICOS DEL ESTUDIANTE:
{contexto_academico}

PERÍODOS: total={total_semestres}, último={ultimo_semestre_nombre}, ramos último={ultimo_semestre_ramos if ultimo_semestre_ramos else "ninguno"}, máx={max_p}

{conocimiento_app}

REGLAS ACADÉMICAS:
- Escala 1.0-7.0 | Mínimo para aprobar: 4.0
- NUNCA calcules promedios tú mismo. Usa el ANÁLISIS PRE-CALCULADO.
- Nivel 1 = reprobado definitivo. No des consejos de recuperación.

LO QUE PUEDES Y NO PUEDES HACER:
✅ Responder cualquier pregunta sobre cómo funciona EduPredict.
✅ Explicar niveles, promedios, períodos, ramos, estadísticas, etc.
✅ Dar consejos de estudio y motivar al estudiante.
✅ Ayudar con dudas del formulario actual (porcentajes, notas, etc.)
❌ Crear ramos, evaluaciones ni ningún elemento del formulario.
❌ Ofrecerte a hacer cosas que solo el usuario puede hacer desde los formularios.
❌ Calcular promedios matemáticamente por tu cuenta.
{gestion_periodos}

ESTILO DE RESPUESTA:
- {limite_respuesta}
- NO termines con preguntas (salvo confirmación de agregar/eliminar período).
- Responde SOLO lo que se pregunta. Si no sabes algo de EduPredict, dilo honestamente."""

        mensajes = [{"role": "system", "content": system_prompt}]
        for h in historial[:-1][-6:]:
            if h.get("rol") == "user":
                mensajes.append({"role": "user", "content": h["texto"]})
            elif h.get("rol") == "ia":
                mensajes.append({"role": "assistant", "content": h["texto"]})
        mensajes.append({"role": "user", "content": mensaje_usuario})

        payload = json.dumps({
            "model": "llama-3.3-70b-versatile",
            "messages": mensajes,
            "temperature": 0.4,
            "max_tokens": max_tokens_respuesta,
        }).encode("utf-8")

        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(
            GROQ_API_URL,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "User-Agent": "Mozilla/5.0",
            },
        )
        with urllib.request.urlopen(req, timeout=15, context=ctx) as response:
            result = json.loads(response.read().decode("utf-8"))
            respuesta = result["choices"][0]["message"]["content"]

        # Procesar acciones — SOLO si estamos en mi_semestre
        accion = None
        if "[ACCION:AGREGAR]" in respuesta:
            if pagina == "mi_semestre":
                respuesta = ""
                accion = "AGREGAR"
            else:
                respuesta = respuesta.replace("[ACCION:AGREGAR]", "").strip()
        elif "[ACCION:ELIMINAR]" in respuesta:
            if pagina == "mi_semestre":
                respuesta = ""
                accion = "ELIMINAR"
            else:
                respuesta = respuesta.replace("[ACCION:ELIMINAR]", "").strip()

        return JsonResponse({"respuesta": respuesta, "accion": accion})

    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        return JsonResponse({"error": f"Error Groq: {e.code} - {error_body}"}, status=500)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@require_POST
def agregar_semestre_ia(request):
    """Agrega un período nuevo al final de la lista del usuario (acción desde IA)."""
    try:
        semestres = Semestre.objects.filter(user=request.user).order_by('orden')
        total = semestres.count()
        tipo = _obtener_tipo_usuario(request.user)
        label = LIMITES_PERIODO.get(tipo, {}).get('label', 'Semestre')
        max_p = LIMITES_PERIODO.get(tipo, {}).get('max_periodos', 10)

        if total >= max_p:
            return JsonResponse({"error": f"Ya tienes el máximo de {max_p} {label.lower()}s."})

        nuevo_orden = total + 1
        Semestre.objects.create(
            user=request.user,
            nombre=f"{nuevo_orden}° {label}",
            orden=nuevo_orden,
            tipo_periodo=tipo,
        )
        request.session.pop('resumen_ia_cache', None)
        return JsonResponse({
            "ok": True,
            "total": nuevo_orden,
            "nombre": f"{nuevo_orden}° {label}",
        })
    except Exception as e:
        return JsonResponse({"error": str(e)})


@login_required
@require_POST
def eliminar_semestre_ia(request):
    """Elimina el último período del usuario (acción desde IA, no puede ser el actual)."""
    try:
        semestres = Semestre.objects.filter(user=request.user).order_by('orden')
        total = semestres.count()

        if total == 0:
            return JsonResponse({"error": "No tienes períodos para eliminar."})

        ultimo = semestres.last()
        if ultimo.es_actual:
            return JsonResponse({"error": "No puedes eliminar tu período actual."})

        semestre_anterior = semestres.filter(orden__lt=ultimo.orden).last()
        semestre_anterior_id = semestre_anterior.id if semestre_anterior else None
        ramos = list(
            Ramo.objects.filter(user=request.user, semestre=ultimo)
            .values_list('nombre', flat=True)
        )
        nombre_eliminado = ultimo.nombre
        ultimo.delete()
        request.session.pop('resumen_ia_cache', None)

        return JsonResponse({
            "ok": True,
            "eliminado": nombre_eliminado,
            "ramos_eliminados": ramos,
            "total": total - 1,
            "semestre_anterior_id": semestre_anterior_id,
        })
    except Exception as e:
        return JsonResponse({"error": str(e)})

from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def api_movil_chat(request):
    """
    Endpoint principal del chat IA para la App Móvil Android.
    Dinamiza CORS para desarrollo y usa el sistema de prompts completo.
    """
    origin = request.META.get('HTTP_ORIGIN')
    
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=origin)

    if request.method == "POST":
        try:
            data = json.loads(request.body)
            mensaje_usuario = data.get("mensaje", "").strip()
            historial = data.get("historial", [])

            if not mensaje_usuario:
                return api_movil_cors_response({"error": "Mensaje vacío"}, status=400, origin=origin)

            if request.user.is_authenticated:
                contexto_academico = obtener_contexto_usuario(request.user)
                usuario_nombre = request.user.username
                tipo_usuario = _obtener_tipo_usuario(request.user)
                label_usuario = LIMITES_PERIODO.get(tipo_usuario, {}).get('label', 'Semestre')
            else:
                contexto_academico = "El usuario se encuentra desde la App Móvil sin sesión vinculada actual."
                usuario_nombre = "Usuario Móvil"
                label_usuario = "Semestre"

            conocimiento_app = f"""
════════════════════════════════════════════════════
MANUAL INTERNO DE EDUPREDICT — ÚSALO SOLO SI TE PREGUNTAN
Responde SOLO lo que se pregunta. Nunca expliques todo esto de golpe.
════════════════════════════════════════════════════

▸ QUÉ ES EDUPREDICT
  App para estudiantes chilenos que registran sus ramos, notas y porcentajes
  para que el sistema calcule su promedio y les diga si van a aprobar o reprobar.

▸ SISTEMA DE NIVELES
  Nivel 5 ✅ Aprobado: el promedio final ya es >= 4.0 con las notas actuales.
  Nivel 4 📈 Bien encaminado: aún puede aprobar sacando notas razonables en lo que queda.
  Nivel 3 ⚠️ Ajustado: necesita notas altas (cerca de 6-7) en las evaluaciones pendientes.
  Nivel 2 🚨 En riesgo: matemáticamente muy difícil aprobar, pero no imposible.
  Nivel 1 ❌ Reprobado definitivo: ya es imposible matemáticamente llegar a 4.0.
  → El nivel se calcula automáticamente con las notas ingresadas. No lo elige el usuario.

▸ NAVEGACIÓN DE LA APP MÓVIL
  La app tiene una barra de navegación inferior con 5 secciones:
  🏠 Inicio: Dashboard principal con resumen y análisis IA del período actual.
  📚 Mi Período: Ver períodos académicos y sus ramos. Toca los círculos del timeline para cambiar de período.
  ➕ Crear: Crear un nuevo ramo (asignatura) con sus evaluaciones y notas.
  📊 Estadísticas: Comparar rendimiento entre dos períodos diferentes.
  🔍 Filtrar: Ver todos los ramos filtrados por rango de notas.
  Además hay un botón de chat flotante (🤖) para abrir este asistente desde cualquier pantalla.

▸ PERÍODOS ACADÉMICOS
  El tipo de período lo elige el usuario al configurar por primera vez la app.
  Estados de un período: ACTUAL 🟢, PENDIENTE 🟡, COMPLETADO 🟣, BLOQUEADO 🔒.

  ¿Cómo se avanza al siguiente período?
  Para avanzar, se deben cumplir 3 condiciones en el período ACTUAL:
    1. Haber configurado el límite de ramos de ese período (ícono ⚙️ en Mi Período).
    2. Haber agregado exactamente esa cantidad de ramos (igual al límite).
    3. Haber marcado TODOS esos ramos como completados (ícono ✓ en cada ramo).
  Cuando se cumplen las 3, aparece el botón para avanzar al siguiente período.

  ¿Qué es el límite de ramos?
  Se configura tocando el ícono ⚙️ en Mi Período. Sin límite no se pueden agregar ramos.

▸ RAMOS
  Un ramo = una asignatura o materia. Cada ramo tiene:
  - Nombre, Evaluaciones (nota + porcentaje, deben sumar 100%), Examen final (opcional),
    Meta de promedio (opcional), Promedio parcial y Promedio final.
  ¿Cómo crear un ramo? Toca el botón ➕ en la barra inferior, o dentro de Mi Período.
  Marcar como completado: Toca el ícono ✓ en el ramo. Necesario para cerrar el período.
  Bloquear: Archiva el ramo (IRREVERSIBLE). Solo disponible si el ramo ya está completado.
  Ramo bloqueado → No se puede editar ni eliminar.

▸ PROMEDIO PARCIAL vs PROMEDIO FINAL
  Parcial: solo evaluaciones. Final: evaluaciones + examen (si existe). Sin examen son iguales.

▸ PANTALLA ESTADÍSTICAS
  Compara el rendimiento entre dos períodos. Necesitas al menos 2 períodos con ramos.

▸ PANTALLA FILTRAR
  Filtra ramos por rango: Reprobados (0-3.9), Bajos (4-4.9), Medios (5-6.9), Excelencia (7.0).

▸ PANTALLA INICIO (DASHBOARD)
  Resumen general con conteo de ramos por nivel y análisis IA del período actual.

════════════════════════════════════════════════════
INSTRUCCIÓN: responde SOLO lo que se pregunta. Sé breve, claro y amigable 😊.
════════════════════════════════════════════════════"""

            pagina = data.get("pagina", "")
            contexto_pagina_extra = data.get("contexto_pagina", "")

            if pagina == "period":
                semestre_actual = data.get("semestre_actual", "")
                tiene_ramos_data = data.get("tiene_ramos", True)
                if not tiene_ramos_data:
                    instruccion_pagina = f"El usuario está en 'Mi Período' viendo '{semestre_actual}' que aún no tiene ramos. Sugiere crear ramos con el botón ➕."
                else:
                    instruccion_pagina = (
                        f"El usuario está en 'Mi Período' viendo: '{semestre_actual}'. "
                        f"Responde SOLO sobre los ramos de '{semestre_actual}' salvo que pregunte algo general de la app."
                    )
            elif pagina in ("create-course", "edit-course"):
                ramo_nombre = data.get("ramo_nombre", "")
                if ramo_nombre:
                    instruccion_pagina = f"El usuario está editando el ramo '{ramo_nombre}'. Puede preguntarte sobre evaluaciones, porcentajes o notas."
                else:
                    instruccion_pagina = "El usuario está en la pantalla Crear Ramo. Puede preguntarte cómo funciona el formulario, los porcentajes, el examen, etc."
            elif pagina == "stats":
                comparando = data.get("comparando", False)
                if not comparando:
                    instruccion_pagina = "El usuario está en 'Estadísticas'. Debe seleccionar dos períodos para comparar."
                else:
                    instruccion_pagina = f"El usuario compara períodos.\nANÁLISIS COMPARATIVO:\n{contexto_pagina_extra}"
            else:
                instruccion_pagina = "El usuario está en el Dashboard inicial de la App Móvil EduPredict."

            system_prompt = f"""Eres el Asistente EduPredict, asistente académico de EduPredict para estudiantes chilenos. 🤖✨
            Hablas en español chileno informal pero respetuoso. Eres conciso. Estás en la App Móvil.
            Estudiante: {usuario_nombre} | PANTALLA: {pagina}
            {conocimiento_app}
            {instruccion_pagina}
            DATOS: {contexto_academico}
            """
            
            mensajes = [{"role": "system", "content": system_prompt}]
            for h in historial[-6:]:
                if h.get("rol") == "user": mensajes.append({"role": "user", "content": h["texto"]})
                elif h.get("rol") == "ia": mensajes.append({"role": "assistant", "content": h["texto"]})
            # Agregar el mensaje actual del usuario
            mensajes.append({"role": "user", "content": mensaje_usuario})
            
            respuesta = llamar_groq(messages=mensajes)
            return api_movil_cors_response({"respuesta": respuesta}, origin=origin)

        except Exception as e:
            return api_movil_cors_response({"error": str(e)}, status=500, origin=origin)

    return api_movil_cors_response({"error": "Método no permitido"}, status=405, origin=origin)# =========================================================
# ENDPOINTS API MOVIL (JSON)
# =========================================================
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
import json

def api_movil_cors_response(data, status=200, origin=None):
    response = JsonResponse(data, status=status)
    allowed_origin = origin if origin else "http://localhost:5173"
    response["Access-Control-Allow-Origin"] = allowed_origin
    response["Access-Control-Allow-Credentials"] = "true"
    response["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS, DELETE"
    response["Access-Control-Allow-Headers"] = "Content-Type, X-CSRFToken, Authorization"
    return response

def get_movil_user(request):
    """
    Retorna el usuario autenticado para endpoints moviles.
    Soporta dos metodos:
      1. Sesion Django (navegador web via Vite proxy - mismo origen)
      2. Token 'Authorization: Token <key>' (Capacitor Android nativo)
    """
    if request.user.is_authenticated:
        return request.user
    auth = request.META.get('HTTP_AUTHORIZATION', '')
    if auth.startswith('Token '):
        try:
            from rest_framework.authtoken.models import Token as AuthToken
            tok = AuthToken.objects.select_related('user').get(key=auth[6:].strip())
            return tok.user
        except Exception:
            pass
    return None

@csrf_exempt
def api_movil_login(request):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            username = data.get("username")
            password = data.get("password")
            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)
                from rest_framework.authtoken.models import Token as AuthToken
                token, _ = AuthToken.objects.get_or_create(user=user)
                return api_movil_cors_response({
                    "ok": True,
                    "token": token.key,
                    "user": {"id": user.id, "username": user.username}
                }, origin=request.META.get("HTTP_ORIGIN"))
            return api_movil_cors_response({"error": "Credenciales invalidas"}, status=401, origin=request.META.get("HTTP_ORIGIN"))
        except Exception as e:
            return api_movil_cors_response({"error": str(e)}, status=500, origin=request.META.get("HTTP_ORIGIN"))
    return api_movil_cors_response({"error": "Metodo no permitido"}, status=405, origin=request.META.get("HTTP_ORIGIN"))

@csrf_exempt
def api_movil_registro(request):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            username = data.get("username", "").strip()
            password = data.get("password")
            if not username or len(username) < 3:
                return api_movil_cors_response({"error": "El nombre de usuario debe tener al menos 3 caracteres"}, status=400, origin=request.META.get("HTTP_ORIGIN"))
            if User.objects.filter(username=username).exists():
                return api_movil_cors_response({"error": "Ya existe un usuario con ese nombre"}, status=400, origin=request.META.get("HTTP_ORIGIN"))
            user = User.objects.create_user(username=username, password=password)
            user.save()
            login(request, user)
            from rest_framework.authtoken.models import Token as AuthToken
            token, _ = AuthToken.objects.get_or_create(user=user)
            return api_movil_cors_response({
                "ok": True,
                "token": token.key,
                "user": {"id": user.id, "username": user.username}
            }, origin=request.META.get("HTTP_ORIGIN"))
        except Exception as e:
            return api_movil_cors_response({"error": str(e)}, status=500, origin=request.META.get("HTTP_ORIGIN"))
    return api_movil_cors_response({"error": "Metodo no permitido"}, status=405, origin=request.META.get("HTTP_ORIGIN"))

@csrf_exempt
def api_movil_logout(request):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    if request.method == "POST":
        auth = request.META.get('HTTP_AUTHORIZATION', '')
        if auth.startswith('Token '):
            try:
                from rest_framework.authtoken.models import Token as AuthToken
                AuthToken.objects.filter(key=auth[6:].strip()).delete()
            except Exception:
                pass
        logout(request)
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    return api_movil_cors_response({"error": "Metodo no permitido"}, status=405, origin=request.META.get("HTTP_ORIGIN"))

@csrf_exempt
def api_movil_session_status(request):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    user = get_movil_user(request)
    if user:
        profile, _ = UserProfile.objects.get_or_create(user=user)
        return api_movil_cors_response({
            "authenticated": True,
            "user": {
                "id": user.id,
                "username": user.username,
                "display_name": profile.display_name or user.username,
                "avatar": profile.avatar_url
            }
        }, origin=request.META.get("HTTP_ORIGIN"))
    return api_movil_cors_response({"authenticated": False}, origin=request.META.get("HTTP_ORIGIN"))

@csrf_exempt
def api_movil_semestres(request):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    user = get_movil_user(request)
    if not user:
        return api_movil_cors_response({"error": "No autenticado"}, status=401, origin=request.META.get("HTTP_ORIGIN"))
    semestres = Semestre.objects.filter(user=user).order_by("orden")
    data = []
    for s in semestres:
        ramos_count = Ramo.objects.filter(semestre=s).count()
        data.append({
            "id": s.id, "nombre": s.nombre, "orden": s.orden,
            "tipo_periodo": s.tipo_periodo, "es_actual": s.es_actual,
            "completado_periodo": s.completado_periodo, "limite_ramos": s.limite_ramos,
            "max_ramos": s.max_ramos, "ramos_count": ramos_count
        })
    return api_movil_cors_response({"semestres": data}, origin=request.META.get("HTTP_ORIGIN"))

# Mapa de labels para los tipos de periodo
LABEL_PERIODO = {
    'semestre':     'Semestre',
    'trimestre':    'Trimestre',
    'bimestre':     'Bimestre',
    'cuatrimestre': 'Cuatrimestre',
}

@csrf_exempt
def api_movil_setup_periodos(request):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    user = get_movil_user(request)
    if not user:
        return api_movil_cors_response({"error": "No autenticado"}, status=401, origin=request.META.get("HTTP_ORIGIN"))
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            tipo_periodo = data.get("tipo_periodo", "semestre")
            cantidad = int(data.get("cantidad", 1))
            periodo_actual = int(data.get("periodo_actual", 1))
            label = LABEL_PERIODO.get(tipo_periodo, 'Semestre')
            for i in range(1, cantidad + 1):
                Semestre.objects.create(
                    user=user,
                    nombre=f"{i}° {label}",
                    orden=i,
                    tipo_periodo=tipo_periodo,
                    es_actual=(i == periodo_actual)
                )
            return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
        except Exception as e:
            return api_movil_cors_response({"error": str(e)}, status=500, origin=request.META.get("HTTP_ORIGIN"))
    return api_movil_cors_response({"error": "Metodo no permitido"}, status=405, origin=request.META.get("HTTP_ORIGIN"))

@csrf_exempt
def api_movil_periodo_actual(request):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    user = get_movil_user(request)
    if not user:
        return api_movil_cors_response({"error": "No autenticado"}, status=401, origin=request.META.get("HTTP_ORIGIN"))
    semestre_id = request.GET.get("semestre_id")
    if semestre_id:
        semestre = Semestre.objects.filter(user=user, id=semestre_id).first()
    else:
        semestre = Semestre.objects.filter(user=user, es_actual=True).first()
        if not semestre:
            semestre = Semestre.objects.filter(user=user).order_by('-orden').first()
    if not semestre:
        return api_movil_cors_response({"error": "No hay periodos"}, status=404, origin=request.META.get("HTTP_ORIGIN"))
    ramos_qs = Ramo.objects.filter(user=user, semestre=semestre)
    profile, _ = UserProfile.objects.get_or_create(user=user)
    ramos_data = [{"id": r.id, "nombre": r.nombre, "notas": r.notas, "examen": r.examen,
        "meta_promedio": r.meta_promedio, "completado": r.completado, "bloqueado": r.bloqueado,
        "promedio_parcial": r.promedio_parcial_display, "promedio_final": r.promedio_final_display,
        "nivel": r.nivel} for r in ramos_qs]
    return api_movil_cors_response({
        "semestre": {"id": semestre.id, "nombre": semestre.nombre, "orden": semestre.orden,
            "es_actual": semestre.es_actual, "completado_periodo": semestre.completado_periodo,
            "limite_ramos": semestre.limite_ramos, "max_ramos": semestre.max_ramos},
        "ramos": ramos_data,
        "display_name": profile.display_name or user.username
    }, origin=request.META.get("HTTP_ORIGIN"))

@csrf_exempt
def api_movil_avanzar_periodo(request):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    user = get_movil_user(request)
    if not user:
        return api_movil_cors_response({"error": "No autenticado"}, status=401, origin=request.META.get("HTTP_ORIGIN"))
    if request.method == "POST":
        actual = Semestre.objects.filter(user=user, es_actual=True).first()
        if actual:
            actual.es_actual = False
            actual.save()
            siguiente = Semestre.objects.filter(user=user, orden__gt=actual.orden).order_by('orden').first()
            if siguiente:
                siguiente.es_actual = True
                siguiente.save()
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))

@csrf_exempt
def api_movil_crear_ramo(request):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    user = get_movil_user(request)
    if not user:
        return api_movil_cors_response({"error": "No autenticado"}, status=401, origin=request.META.get("HTTP_ORIGIN"))
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            semestre_id = data.get("semestre_id")
            nombre = data.get("nombre")
            notas = data.get("notas", [])
            examen = data.get("examen", {})
            meta = data.get("meta_promedio")
            semestre = Semestre.objects.filter(id=semestre_id, user=user).first()
            if not semestre:
                return api_movil_cors_response({"error": "Semestre no encontrado"}, status=404, origin=request.META.get("HTTP_ORIGIN"))
            ramo = Ramo.objects.create(
                user=user, semestre=semestre, nombre=nombre,
                notas=notas, examen=examen, meta_promedio=meta
            )
            return api_movil_cors_response({"ok": True, "ramo_id": ramo.id}, origin=request.META.get("HTTP_ORIGIN"))
        except Exception as e:
            return api_movil_cors_response({"error": str(e)}, status=500, origin=request.META.get("HTTP_ORIGIN"))

@csrf_exempt
def api_movil_editar_ramo(request, ramo_id):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    user = get_movil_user(request)
    if not user:
        return api_movil_cors_response({"error": "No autenticado"}, status=401, origin=request.META.get("HTTP_ORIGIN"))
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            ramo = Ramo.objects.filter(id=ramo_id, user=user).first()
            if not ramo:
                return api_movil_cors_response({"error": "Ramo no encontrado"}, status=404, origin=request.META.get("HTTP_ORIGIN"))
            if ramo.bloqueado:
                return api_movil_cors_response({"error": "Ramo bloqueado"}, status=400, origin=request.META.get("HTTP_ORIGIN"))
            ramo.nombre = data.get("nombre", ramo.nombre)
            ramo.notas = data.get("notas", ramo.notas)
            ramo.examen = data.get("examen", ramo.examen)
            ramo.meta_promedio = data.get("meta_promedio", ramo.meta_promedio)
            ramo.save()
            return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
        except Exception as e:
            return api_movil_cors_response({"error": str(e)}, status=500, origin=request.META.get("HTTP_ORIGIN"))

@csrf_exempt
def api_movil_eliminar_ramo(request, ramo_id):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    user = get_movil_user(request)
    if not user:
        return api_movil_cors_response({"error": "No autenticado"}, status=401, origin=request.META.get("HTTP_ORIGIN"))
    ramo = Ramo.objects.filter(id=ramo_id, user=user).first()
    if ramo:
        ramo.delete()
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    return api_movil_cors_response({"error": "No encontrado"}, status=404, origin=request.META.get("HTTP_ORIGIN"))

@csrf_exempt
def api_movil_marcar_completado_ramo(request, ramo_id):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    user = get_movil_user(request)
    if not user:
        return api_movil_cors_response({"error": "No autenticado"}, status=401, origin=request.META.get("HTTP_ORIGIN"))
    if request.method == "POST":
        ramo = Ramo.objects.filter(id=ramo_id, user=user).first()
        if ramo:
            ramo.completado = not ramo.completado
            ramo.save()
            return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    return api_movil_cors_response({"error": "No encontrado"}, status=404, origin=request.META.get("HTTP_ORIGIN"))

@csrf_exempt
def api_movil_set_limite_periodo(request):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    user = get_movil_user(request)
    if not user:
        return api_movil_cors_response({"error": "No autenticado"}, status=401, origin=request.META.get("HTTP_ORIGIN"))
    if request.method == "POST":
        data = json.loads(request.body)
        semestre_id = data.get("semestre_id")
        limite = data.get("limite")
        semestre = Semestre.objects.filter(id=semestre_id, user=user).first()
        if semestre:
            semestre.limite_ramos = limite
            semestre.save()
            return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    return api_movil_cors_response({"error": "Error setting limite"}, status=400, origin=request.META.get("HTTP_ORIGIN"))

@csrf_exempt
def api_movil_cerrar_periodo_anterior(request):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    user = get_movil_user(request)
    if not user:
        return api_movil_cors_response({"error": "No autenticado"}, status=401, origin=request.META.get("HTTP_ORIGIN"))
    if request.method == "POST":
        data = json.loads(request.body)
        semestre_id = data.get("semestre_id")
        semestre = Semestre.objects.filter(id=semestre_id, user=user).first()
        if semestre:
            semestre.completado_periodo = True
            semestre.save()
            for r in Ramo.objects.filter(semestre=semestre):
                r.bloqueado = True
                r.save()
            return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    return api_movil_cors_response({"error": "Error cerrando"}, status=400, origin=request.META.get("HTTP_ORIGIN"))

@csrf_exempt
def api_movil_resumen_ia(request):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    user = get_movil_user(request)
    if not user:
        return api_movil_cors_response({"error": "No autenticado"}, status=401, origin=request.META.get("HTTP_ORIGIN"))

    try:
        force = request.GET.get('force') == '1'
        if force:
            request.session.pop('resumen_ia_cache', None)
        else:
            cache = request.session.get('resumen_ia_cache')
            if cache:
                return api_movil_cors_response({"resumen_ia": cache, "desde_cache": True}, origin=request.META.get("HTTP_ORIGIN"))

        semestres = Semestre.objects.filter(user=user)
        tiene_semestres = semestres.exists()
        todos_los_ramos = list(Ramo.objects.filter(user=user)) if tiene_semestres else []
        tiene_ramos = len(todos_los_ramos) > 0
        tipo_label = _obtener_label_usuario(user)
        username = user.username

        # Casos especiales sin ramos
        if not tiene_semestres:
            resumen = (
                f"¡Bienvenido a EduPredict, {username}! 🎓\n\n"
                f"Para comenzar, ve a '⚙️ Configurar' en la app y configura tu sistema académico "
                f"(tipo de período, cantidad de semestres, etc.)."
            )
            request.session['resumen_ia_cache'] = resumen
            return api_movil_cors_response({"resumen_ia": resumen}, origin=request.META.get("HTTP_ORIGIN"))

        if not tiene_ramos:
            resumen = (
                f"¡Hola {username}! Ya tienes tus {tipo_label.lower()}s creados. 👍\n\n"
                f"El siguiente paso es registrar tus ramos en '📚 Mi Período'. "
                f"Toca el botón + en la pantalla Mi Período para agregar tu primer ramo."
            )
            request.session['resumen_ia_cache'] = resumen
            return api_movil_cors_response({"resumen_ia": resumen}, origin=request.META.get("HTTP_ORIGIN"))

        # Construir contexto académico completo
        contexto = obtener_contexto_usuario(user)

        system_prompt = f"""Eres el Asistente EduPredict, asistente académico de la App Móvil EduPredict. Genera un resumen del estado académico de {username}.

DATOS ACADÉMICOS:
{contexto}

SISTEMA DE NIVELES:
- Nivel 5 ✅: Aprobado (promedio final >= 4.0 asegurado)
- Nivel 4 📈: Bien encaminado (puede aprobar con las notas que restan)
- Nivel 3 ⚠️: Ajustado (necesita notas altas para aprobar)
- Nivel 2 🚨: En riesgo (muy difícil aprobar)
- Nivel 1 ❌: Reprobado definitivo (matemáticamente imposible aprobar)

REGLAS:
- Escala 1.0-7.0, mínimo para aprobar: 4.0
- Ramos Nivel 1: YA REPROBADOS, no des consejos de recuperación
- USA SIEMPRE los valores del ANÁLISIS PRE-CALCULADO

INSTRUCCIONES:
- Saluda por nombre brevemente con emoji
- Nivel 1: indica como REPROBADO, sin consejos
- Nivel 2: menciona con urgencia
- Nivel 4-5: menciona brevemente los que van bien
- Da 1 recomendación concreta solo para ramos Nivel 2-3
- Menciona brevemente que puede tocar un ramo en 'Mi Período' para ver detalles o editar
- Máximo 4 párrafos cortos, tono amigable, honesto y con emojis apropiados
- Estás en la App Móvil Android, así que orienta al usuario usando la navegación inferior de la app"""

        resumen = llamar_groq(system_prompt, "Genera mi resumen académico.", max_tokens=550)
        request.session['resumen_ia_cache'] = resumen
        return api_movil_cors_response({"resumen_ia": resumen}, origin=request.META.get("HTTP_ORIGIN"))

    except Exception as e:
        return api_movil_cors_response({"error": str(e, origin=request.META.get("HTTP_ORIGIN"))}, status=500)
    
@csrf_exempt
def api_movil_filtrar_ramos(request):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    
    user = get_movil_user(request)
    if not user:
        return api_movil_cors_response({"error": "No autenticado"}, status=401, origin=request.META.get("HTTP_ORIGIN"))
    
    rango = request.GET.get('rango', 'excelencia')
    
    # Obtener el orden del semestre actual para no mostrar periodos futuros (bloqueados)
    semestre_actual = Semestre.objects.filter(user=user, es_actual=True).first()
    orden_max = semestre_actual.orden if semestre_actual else 999
    
    # Obtener todos los semestres hasta el actual
    semestres = Semestre.objects.filter(user=user, orden__lte=orden_max).order_by('orden')
    
    resultado_agrupado = []
    
    for sem in semestres:
        ramos_qs = Ramo.objects.filter(user=user, semestre=sem)
        ramos_filtrados = []
        
        for r in ramos_qs:
            pf = float(r.promedio_final or 0)
            match = False
            
            if rango == 'excelencia' and pf >= 7.0:
                match = True
            elif rango == 'aprobados_medios' and 5.0 <= pf < 7.0:
                match = True
            elif rango == 'aprobados_bajos' and 4.0 <= pf < 5.0:
                match = True
            elif rango == 'reprobados' and pf < 4.0:
                match = True
            
            if match:
                ramos_filtrados.append({
                    "id": r.id, 
                    "nombre": r.nombre, 
                    "promedio_parcial": r.promedio_parcial_display,
                    "promedio_final": r.promedio_final_display, 
                    "meta_promedio": float(r.meta_promedio or 0),
                    "nivel": r.nivel
                })
        
        if ramos_filtrados:
            resultado_agrupado.append({
                "semestre_id": sem.id,
                "semestre_nombre": sem.nombre,
                "es_actual": sem.es_actual,
                "ramos": ramos_filtrados
            })
    
    # Priorizar el periodo actual si tiene ramos en el rango
    # Se ordena poniendo es_actual=True primero, y luego manteniendo el orden original para el resto
    resultado_agrupado.sort(key=lambda x: not x["es_actual"])
            
    return api_movil_cors_response({"ramos_por_periodo": resultado_agrupado})

@csrf_exempt
def api_movil_estadisticas(request):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    user = get_movil_user(request)
    if not user:
        return api_movil_cors_response({"error": "No autenticado"}, status=401, origin=request.META.get("HTTP_ORIGIN"))
    try:
        sem1_id = request.GET.get('semestre1')
        sem2_id = request.GET.get('semestre2')
        if not sem1_id or not sem2_id:
            return api_movil_cors_response({"error": "Faltan periodos"}, status=400, origin=request.META.get("HTTP_ORIGIN"))
        s1 = Semestre.objects.filter(user=user, id=sem1_id).first()
        s2 = Semestre.objects.filter(user=user, id=sem2_id).first()
        if not s1 or not s2:
            return api_movil_cors_response({"error": f"Periodos no encontrados"}, status=404, origin=request.META.get("HTTP_ORIGIN"))
        ramos1 = Ramo.objects.filter(user=user, semestre=s1).order_by('id')
        ramos2 = Ramo.objects.filter(user=user, semestre=s2).order_by('id')
        
        def serialize_ramos(ramos):
            return [
                {
                    "id": r.id,
                    "nombre": r.nombre,
                    "promedio_final": float(r.promedio_final or 0),
                    "completado": r.completado
                } for r in ramos
            ]
            
        return api_movil_cors_response({
            "ramos_semestre1": serialize_ramos(ramos1),
            "ramos_semestre2": serialize_ramos(ramos2),
            "metrics_s1": calculate_radar_metrics(ramos1),
            "metrics_s2": calculate_radar_metrics(ramos2)
        })
    except Exception as e:
        print(f"Error en api_movil_estadisticas: {str(e)}")
        return api_movil_cors_response({"error": f"Server Error: {str(e)}"}, status=500)

@csrf_exempt
def api_movil_google_auth(request):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True})
    
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            token = data.get("token")
            
            idinfo = id_token.verify_oauth2_token(
                token, 
                google_requests.Request(), 
                settings.GOOGLE_CLIENT_ID
            )
            
            email = idinfo['email']
            google_id = idinfo['sub']
            name = idinfo.get('name', '')
            picture = idinfo.get('picture', '')
            
            profile = UserProfile.objects.filter(google_id=google_id).first()
            is_new = False
            
            if not profile:
                user = User.objects.filter(email=email).first()
                if not user:
                    is_new = True
                    base_username = email.split('@')[0]
                    # Generar un username único interno
                    unique_username = f"{base_username}_{''.join(random.choices(string.ascii_lowercase + string.digits, k=5))}"
                    user = User.objects.create_user(username=unique_username, email=email)
                
                profile, created = UserProfile.objects.get_or_create(user=user)
                profile.google_id = google_id
                profile.avatar_url = picture
                if not profile.display_name:
                    profile.display_name = name
                profile.save()
            else:
                user = profile.user
            
            login(request, user)
            from rest_framework.authtoken.models import Token as AuthToken
            token_obj, _ = AuthToken.objects.get_or_create(user=user)
            
            return api_movil_cors_response({
                "ok": True,
                "token": token_obj.key,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "display_name": profile.display_name,
                    "avatar": profile.avatar_url
                },
                "is_new": is_new
            }, origin=request.META.get("HTTP_ORIGIN"))
            
        except ValueError:
            return api_movil_cors_response({"error": "Token de Google inválido"}, status=400)
        except Exception as e:
            return api_movil_cors_response({"error": str(e)}, status=500)
            
    return api_movil_cors_response({"error": "Método no permitido"}, status=405)

@csrf_exempt
def api_movil_actualizar_perfil(request):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    user = get_movil_user(request)
    if not user:
        return api_movil_cors_response({"error": "No autenticado"}, status=401, origin=request.META.get("HTTP_ORIGIN"))
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            new_name = data.get("display_name")
            if not new_name:
                return api_movil_cors_response({"error": "Nombre es requerido"}, status=400, origin=request.META.get("HTTP_ORIGIN"))
            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.display_name = new_name
            profile.save()
            return api_movil_cors_response({
                "ok": True,
                "display_name": profile.display_name
            }, origin=request.META.get("HTTP_ORIGIN"))
        except Exception as e:
            return api_movil_cors_response({"error": str(e)}, status=500)
            
    return api_movil_cors_response({"error": "Método no permitido"}, status=405)

from .api_vision import extraer_ramos_de_imagen

@csrf_exempt
def api_movil_scan_horario(request):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    user = get_movil_user(request)
    if not user:
        return api_movil_cors_response({"error": "No autenticado"}, status=401, origin=request.META.get("HTTP_ORIGIN"))
        
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            base64_img = data.get("image_base64")
            
            if not base64_img:
                return api_movil_cors_response({"error": "Falta la imagen base64"}, status=400, origin=request.META.get("HTTP_ORIGIN"))
                
            res = extraer_ramos_de_imagen(base64_img)
            
            if res.get("ok"):
                return api_movil_cors_response({"ok": True, "ramos": res["ramos"]}, origin=request.META.get("HTTP_ORIGIN"))
            else:
                return api_movil_cors_response({"error": res.get("error", "Error desconocido de IA")}, status=500, origin=request.META.get("HTTP_ORIGIN"))
                
        except Exception as e:
            return api_movil_cors_response({"error": str(e)}, status=500, origin=request.META.get("HTTP_ORIGIN"))
            
    return api_movil_cors_response({"error": "Método no permitido"}, status=405)

@csrf_exempt
def api_movil_crear_ramos_masivo(request):
    if request.method == "OPTIONS":
        return api_movil_cors_response({"ok": True}, origin=request.META.get("HTTP_ORIGIN"))
    user = get_movil_user(request)
    if not user:
        return api_movil_cors_response({"error": "No autenticado"}, status=401, origin=request.META.get("HTTP_ORIGIN"))
        
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            semestre_id = data.get("semestre_id")
            ramos_names = data.get("ramos_names", [])
            
            semestre = Semestre.objects.filter(id=semestre_id, user=user).first()
            if not semestre:
                return api_movil_cors_response({"error": "Semestre no encontrado"}, status=404, origin=request.META.get("HTTP_ORIGIN"))
                
            if semestre.limite_ramos is None:
                return api_movil_cors_response({"error": "Debes establecer el límite de ramos primero para este período"}, status=400, origin=request.META.get("HTTP_ORIGIN"))
                
            actuales = Ramo.objects.filter(user=user, semestre=semestre).count()
            
            if actuales + len(ramos_names) > semestre.max_ramos:
                return api_movil_cors_response({"error": f"Superarías el límite de {semestre.max_ramos} ramos (tienes {actuales} creados)."}, status=400, origin=request.META.get("HTTP_ORIGIN"))
                
            nuevos = []
            for name in ramos_names:
                r = Ramo.objects.create(
                    user=user, semestre=semestre, nombre=name,
                    notas=[], examen={}, meta_promedio=None
                )
                nuevos.append({"id": r.id, "nombre": r.nombre})
                
            return api_movil_cors_response({"ok": True, "creados": nuevos}, origin=request.META.get("HTTP_ORIGIN"))
            
        except Exception as e:
            return api_movil_cors_response({"error": str(e)}, status=500, origin=request.META.get("HTTP_ORIGIN"))
            
    return api_movil_cors_response({"error": "Método no permitido"}, status=405)
