from django.contrib import admin
from reservasAPP.models import *

# Register your models here.

class ComentarioAdmin(admin.ModelAdmin):
    list_display = ('id', 'nombre', 'email', 'telefono', 'mensaje', 'fecha_creacion')
    list_filter = ('fecha_creacion',)
    search_fields = ('nombre', 'email', 'telefono', 'mensaje')
    readonly_fields = ('fecha_creacion',)
    ordering = ('-fecha_creacion',)
    
    fieldsets = (
        ('Información del Usuario', {
            'fields': ('nombre', 'email', 'telefono')
        }),
        ('Comentario', {
            'fields': ('mensaje',)
        }),
        ('Fecha', {
            'fields': ('fecha_creacion',)
        }),
    )

admin.site.register(Comentario, ComentarioAdmin)