from django.urls import path
from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("registro/", views.registro, name="registro"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"), # Descartado / para que pase por usuarios deslogeandose
    path("miperfil/", views.miperfil, name="miperfil"),
    path("calculadora-sinregistrar/", views.calculadora_sin_registro, name="calc-sinreg"),
    path("calculadora/", views.index, name="calculadora"),
    path("mi-semestre/", views.mi_semestre, name="mi-semestre"),
    path("crear-ramo/", views.crear_ramo, name="crear-ramo"),
    path("editar-ramo/<int:ramo_id>/", views.editar_ramo, name="editar-ramo"),
    path("eliminar-ramo/<int:ramo_id>/", views.eliminar_ramo, name="eliminar-ramo"),

]
