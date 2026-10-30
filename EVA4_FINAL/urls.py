from django.contrib import admin
from django.urls import path, include
from django.views.generic.base import TemplateView
from reservasAPP.views import crear_ramo
from reservasAPP.views import *

urlpatterns = [
    path('admin/', admin.site.urls),
    path("usuarios/", include("reservasAPP.urls")),
    path("", TemplateView.as_view(template_name="landing.html"), name="landing"),
    path("index/", index, name="home"),
    path("calculadora_sin_registro/", TemplateView.as_view(template_name="calculadora_sin_registro.html"), name="calculoRapido"),
    path("crear_ramo/", crear_ramo, name="crearRamo"),

    path("mi_periodo/", mi_semestre, name="miPeriodo"),
    path("mi_semestre/", mi_semestre, name="miSemestre"),

    path("setup-periodos/", setup_periodos, name="setup-periodos"),
    path("estadisticas/", estadisticas, name="estadisticas"),
    path("filtrar_ramos/", filtrar_ramos, name="filtrarRamos"),
    path("crear-semestres/", crear_semestres, name="crear-semestres"),
    path("editar-ramo/<int:ramo_id>/", editar_ramo, name="editar-ramo"),
    path("eliminar-ramo/<int:ramo_id>/", eliminar_ramo, name="eliminar-ramo"),
    path("enviar-comentario/", enviar_comentario, name="enviar-comentario"),

    path("marcar-completado-ramo/<int:ramo_id>/", marcar_completado_ramo, name="marcar-completado-ramo"),
    path("bloquear-ramo/<int:ramo_id>/", toggle_bloqueo_ramo, name="bloquear-ramo"),
    path("avanzar-periodo/", avanzar_periodo, name="avanzar-periodo"),
    path("cerrar-periodo-anterior/", cerrar_periodo_anterior, name="cerrar-periodo-anterior"),
    path("set-limite-periodo/", set_limite_periodo, name="set-limite-periodo"),  # NUEVO

    path('reservas/', reservasData, name='reservas'),
    path('registroReservas', registroReservas, name="registroReservas"),
    path('eliminarReservas/<int:id>', eliminarReservas, name="eliminarReservas"),
    path('editarReservas/<int:id>', editarReservas, name="editarReservas"),
    path('estados/', estadosData, name='estados'),
    path('registroEstados', registroEstados, name="registroEstados"),
    path('eliminarEstados/<int:id>', eliminarEstados, name="eliminarEstados"),
    path('editarEstados/<int:id>', editarEstados, name="editarEstados"),
    path('reservasAPI/', lista_reservas),
    path('reservasAPI/<int:pk>/', detalle_reservas),

    path("accounts/", include("django.contrib.auth.urls")),
    path("chat/", chat_ia, name="chat-ia"),
    path("agregar-semestre/", agregar_semestre_ia, name="agregar-semestre-ia"),
    path("eliminar-semestre-ia/", eliminar_semestre_ia, name="eliminar-semestre-ia"),
    path("resumen-ia/", resumen_ia, name="resumen-ia"),
    path("api/movil_chat/", api_movil_chat, name="api_movil_chat"),
    
    # Nuevas rutas API Móvil
    path("api/movil/login/", api_movil_login, name="api_movil_login"),
    path("api/movil/registro/", api_movil_registro, name="api_movil_registro"),
    path("api/movil/logout/", api_movil_logout, name="api_movil_logout"),
    path("api/movil/session_status/", api_movil_session_status, name="api_movil_session_status"),
    
    path("api/movil/semestres/", api_movil_semestres, name="api_movil_semestres"),
    path("api/movil/setup_periodos/", api_movil_setup_periodos, name="api_movil_setup_periodos"),
    path("api/movil/periodo_actual/", api_movil_periodo_actual, name="api_movil_periodo_actual"),
    path("api/movil/avanzar_periodo/", api_movil_avanzar_periodo, name="api_movil_avanzar_periodo"),
    path("api/movil/cerrar_periodo_anterior/", api_movil_cerrar_periodo_anterior, name="api_movil_cerrar_periodo_anterior"),
    path("api/movil/set_limite_periodo/", api_movil_set_limite_periodo, name="api_movil_set_limite_periodo"),
    
    path("api/movil/crear_ramo/", api_movil_crear_ramo, name="api_movil_crear_ramo"),
    path("api/movil/editar_ramo/<int:ramo_id>/", api_movil_editar_ramo, name="api_movil_editar_ramo"),
    path("api/movil/eliminar_ramo/<int:ramo_id>/", api_movil_eliminar_ramo, name="api_movil_eliminar_ramo"),
    path("api/movil/marcar_completado_ramo/<int:ramo_id>/", api_movil_marcar_completado_ramo, name="api_movil_marcar_completado_ramo"),
    
    path("api/movil/resumen_ia/", api_movil_resumen_ia, name="api_movil_resumen_ia"),
    path("api/movil/filtrar_ramos/", api_movil_filtrar_ramos, name="api_movil_filtrar_ramos"),
    path("api/movil/estadisticas/", api_movil_estadisticas, name="api_movil_estadisticas"),
    
    # Nuevas rutas de Identidad Social
    path("api/movil/google_auth/", api_movil_google_auth, name="api_movil_google_auth"),
    path("api/movil/actualizar_perfil/", api_movil_actualizar_perfil, name="api_movil_actualizar_perfil"),
    
    # Nuevas rutas de IA Vision
    path("api/movil/scan_horario/", api_movil_scan_horario, name="api_movil_scan_horario"),
    path("api/movil/crear_ramos_masivo/", api_movil_crear_ramos_masivo, name="api_movil_crear_ramos_masivo"),
]