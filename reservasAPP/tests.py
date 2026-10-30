from django.test import TestCase

# Create your tests here.
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from reservasAPP.models import Semestre, Ramo, Estado, Reserva, Comentario
from decimal import Decimal
import json

class SemestreModelTest(TestCase):
    """Pruebas para el modelo Semestre"""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass123')

    def test_crear_semestre(self):
        """Prueba crear un semestre"""
        semestre = Semestre.objects.create(
            user=self.user,
            nombre="1° Semestre",
            orden=1
        )
        self.assertEqual(semestre.nombre, "1° Semestre")
        self.assertEqual(semestre.orden, 1)
        self.assertEqual(str(semestre), "1° Semestre")

    def test_orden_semestres(self):
        """Prueba que los semestres se ordenen correctamente"""
        Semestre.objects.create(user=self.user, nombre="3° Semestre", orden=3)
        Semestre.objects.create(user=self.user, nombre="1° Semestre", orden=1)
        Semestre.objects.create(user=self.user, nombre="2° Semestre", orden=2)

        semestres = list(Semestre.objects.filter(user=self.user))
        self.assertEqual(semestres[0].orden, 1)
        self.assertEqual(semestres[1].orden, 2)
        self.assertEqual(semestres[2].orden, 3)


class RamoModelTest(TestCase):
    """Pruebas para el modelo Ramo y cálculos de promedios"""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass123')
        self.semestre = Semestre.objects.create(
            user=self.user,
            nombre="1° Semestre",
            orden=1
        )

    def test_crear_ramo(self):
        """Prueba crear un ramo básico"""
        ramo = Ramo.objects.create(
            user=self.user,
            semestre=self.semestre,
            nombre="Matemáticas",
            notas=[{"nota": 5.5, "porcentaje": 50}, {"nota": 6.0, "porcentaje": 50}],
            examen={}
        )
        self.assertEqual(ramo.nombre, "Matemáticas")
        self.assertEqual(str(ramo), "Matemáticas")

    def test_promedio_parcial_simple(self):
        """Prueba cálculo de promedio parcial sin examen"""
        ramo = Ramo.objects.create(
            user=self.user,
            semestre=self.semestre,
            nombre="Test",
            notas=[
                {"nota": 6.0, "porcentaje": 50},
                {"nota": 4.0, "porcentaje": 50}
            ],
            examen={}
        )
        self.assertEqual(ramo.promedio_parcial, 5.0)

    def test_promedio_parcial_con_ceros(self):
        """Prueba que las notas en 0 no se consideren en el promedio parcial"""
        ramo = Ramo.objects.create(
            user=self.user,
            semestre=self.semestre,
            nombre="Test",
            notas=[
                {"nota": 6.0, "porcentaje": 50},
                {"nota": 0.0, "porcentaje": 50}
            ],
            examen={}
        )
        self.assertEqual(ramo.promedio_parcial, 6.0)

    def test_promedio_final_sin_examen(self):
        """Prueba promedio final cuando no hay examen"""
        ramo = Ramo.objects.create(
            user=self.user,
            semestre=self.semestre,
            nombre="Test",
            notas=[
                {"nota": 5.0, "porcentaje": 60},
                {"nota": 6.0, "porcentaje": 40}
            ],
            examen={}
        )
        self.assertEqual(ramo.promedio_final, 5.4)

    def test_promedio_final_con_examen(self):
        """Prueba promedio final con examen"""
        ramo = Ramo.objects.create(
            user=self.user,
            semestre=self.semestre,
            nombre="Test",
            notas=[
                {"nota": 5.0, "porcentaje": 50},
                {"nota": 5.0, "porcentaje": 50}
            ],
            examen={"nota": 6.0, "porcentaje": 30}
        )
        self.assertEqual(ramo.promedio_final, 5.3)

    def test_nivel_5_aprobado(self):
        """Prueba Nivel 5: todas las evaluaciones completadas y aprobado"""
        ramo = Ramo.objects.create(
            user=self.user,
            semestre=self.semestre,
            nombre="Test",
            notas=[
                {"nota": 6.0, "porcentaje": 50},
                {"nota": 5.0, "porcentaje": 50}
            ],
            examen={"nota": 6.0, "porcentaje": 20}
        )
        self.assertEqual(ramo.nivel, 5)

    def test_nivel_1_reprobado(self):
        """Prueba Nivel 1: todas las evaluaciones completadas pero reprobado"""
        ramo = Ramo.objects.create(
            user=self.user,
            semestre=self.semestre,
            nombre="Test",
            notas=[
                {"nota": 3.0, "porcentaje": 50},
                {"nota": 3.0, "porcentaje": 50}
            ],
            examen={"nota": 3.5, "porcentaje": 20}
        )
        self.assertEqual(ramo.nivel, 1)

    def test_nivel_4_pendientes_pero_seguro(self):
        """Prueba Nivel 4: tiene pendientes pero incluso con 1.0 aprueba"""
        ramo = Ramo.objects.create(
            user=self.user,
            semestre=self.semestre,
            nombre="Test",
            notas=[
                {"nota": 7.0, "porcentaje": 80},
                {"nota": 0.0, "porcentaje": 20}
            ],
            examen={}
        )
        self.assertEqual(ramo.nivel, 4)

    def test_promedio_display_formato(self):
        """Prueba que el formato de display tenga 1 decimal"""
        ramo = Ramo.objects.create(
            user=self.user,
            semestre=self.semestre,
            nombre="Test",
            notas=[{"nota": 5.5, "porcentaje": 100}],
            examen={}
        )
        self.assertIn('.', ramo.promedio_final_display)


class CrearSemestresViewTest(TestCase):
    """Pruebas para la vista de crear semestres"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username='testuser', password='testpass123')
        self.client.login(username='testuser', password='testpass123')

    def test_crear_5_semestres(self):
        """Prueba crear 5 semestres"""
        response = self.client.post(reverse('crear-semestres'), {
            'cantidad_semestres': 5
        })
        semestres = Semestre.objects.filter(user=self.user)
        self.assertEqual(semestres.count(), 5)
        self.assertEqual(semestres.first().nombre, "1° Semestre")
        self.assertEqual(semestres.last().nombre, "5° Semestre")

    def test_limite_maximo_semestres(self):
        """Prueba que no se puedan crear más de 10 semestres"""
        response = self.client.post(reverse('crear-semestres'), {
            'cantidad_semestres': 15
        })
        semestres = Semestre.objects.filter(user=self.user)
        self.assertEqual(semestres.count(), 0)

    def test_reemplazar_semestres_existentes(self):
        """Prueba que al crear nuevos semestres se eliminen los anteriores"""
        self.client.post(reverse('crear-semestres'), {'cantidad_semestres': 3})
        self.assertEqual(Semestre.objects.filter(user=self.user).count(), 3)
        self.client.post(reverse('crear-semestres'), {'cantidad_semestres': 5})
        self.assertEqual(Semestre.objects.filter(user=self.user).count(), 5)


class EliminarRamoViewTest(TestCase):
    """Pruebas para la vista de eliminar ramo"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username='testuser', password='testpass123')
        self.client.login(username='testuser', password='testpass123')
        self.semestre = Semestre.objects.create(
            user=self.user,
            nombre="1° Semestre",
            orden=1
        )
        self.ramo = Ramo.objects.create(
            user=self.user,
            semestre=self.semestre,
            nombre="Biología",
            notas=[{"nota": 5.0, "porcentaje": 100}],
            examen={}
        )

    def test_eliminar_ramo(self):
        """Prueba eliminar un ramo"""
        ramo_id = self.ramo.id
        response = self.client.get(reverse('eliminar-ramo', args=[ramo_id]))
        self.assertFalse(Ramo.objects.filter(id=ramo_id).exists())


class EstadisticasViewTest(TestCase):
    """Pruebas para la vista de estadísticas"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username='testuser', password='testpass123')
        self.client.login(username='testuser', password='testpass123')

        self.semestre1 = Semestre.objects.create(user=self.user, nombre="1° Semestre", orden=1)
        self.semestre2 = Semestre.objects.create(user=self.user, nombre="2° Semestre", orden=2)

        Ramo.objects.create(
            user=self.user, semestre=self.semestre1,
            nombre="Matemáticas",
            notas=[{"nota": 6.0, "porcentaje": 100}], examen={}
        )
        Ramo.objects.create(
            user=self.user, semestre=self.semestre2,
            nombre="Física",
            notas=[{"nota": 5.0, "porcentaje": 100}], examen={}
        )

    def test_vista_estadisticas_sin_datos_suficientes(self):
        """Prueba que muestre error cuando hay menos de 2 semestres con ramos"""
        Ramo.objects.filter(semestre=self.semestre2).delete()
        response = self.client.get(reverse('estadisticas'))
        self.assertContains(response, "Necesitas tener ramos en al menos 2")

    def test_vista_estadisticas_con_datos(self):
        """Prueba que muestre la vista correctamente con 2 semestres"""
        response = self.client.get(reverse('estadisticas'), {
            'semestre1': self.semestre1.id,
            'semestre2': self.semestre2.id
        })
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "1° Semestre")
        self.assertContains(response, "2° Semestre")


class ComentarioModelTest(TestCase):
    """Pruebas para el modelo Comentario"""

    def test_crear_comentario(self):
        """Prueba crear un comentario"""
        comentario = Comentario.objects.create(
            nombre="Juan Pérez",
            email="juan@example.com",
            telefono="949079105",
            mensaje="Excelente aplicación"
        )
        self.assertEqual(comentario.nombre, "Juan Pérez")
        self.assertEqual(comentario.email, "juan@example.com")
        self.assertIn("Juan Pérez", str(comentario))

    def test_validacion_telefono(self):
        """Prueba que se valide el formato del teléfono"""
        from django.core.exceptions import ValidationError
        comentario = Comentario(
            nombre="Test",
            email="test@example.com",
            telefono="123",
            mensaje="Test"
        )
        with self.assertRaises(ValidationError):
            comentario.full_clean()


class AutenticacionTest(TestCase):
    """Pruebas para el sistema de autenticación"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username='testuser', password='testpass123')

    def test_login_exitoso(self):
        """Prueba login con credenciales correctas"""
        response = self.client.post(reverse('login'), {
            'username': 'testuser',
            'password': 'testpass123'
        })
        self.assertEqual(response.status_code, 302)

    def test_login_fallido(self):
        """Prueba login con credenciales incorrectas"""
        response = self.client.post(reverse('login'), {
            'username': 'testuser',
            'password': 'wrongpassword'
        })
        self.assertEqual(response.status_code, 200)

    def test_acceso_sin_login(self):
        """Prueba que las vistas protegidas redirijan al login"""
        response = self.client.get(reverse('miSemestre'))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith('/accounts/login'))

    def test_logout(self):
        """Prueba cerrar sesión"""
        self.client.login(username='testuser', password='testpass123')
        response = self.client.post(reverse('logout'))
        self.assertEqual(response.status_code, 302)


class FiltrarRamosTest(TestCase):
    """Pruebas para el filtro de ramos por rango de notas"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username='testuser', password='testpass123')
        self.client.login(username='testuser', password='testpass123')
        self.semestre = Semestre.objects.create(user=self.user, nombre="1° Semestre", orden=1)

        Ramo.objects.create(user=self.user, semestre=self.semestre, nombre="Reprobado",
                            notas=[{"nota": 3.0, "porcentaje": 100}], examen={})
        Ramo.objects.create(user=self.user, semestre=self.semestre, nombre="Aprobado Bajo",
                            notas=[{"nota": 4.5, "porcentaje": 100}], examen={})
        Ramo.objects.create(user=self.user, semestre=self.semestre, nombre="Aprobado Medio",
                            notas=[{"nota": 5.5, "porcentaje": 100}], examen={})
        Ramo.objects.create(user=self.user, semestre=self.semestre, nombre="Excelencia",
                            notas=[{"nota": 7.0, "porcentaje": 100}], examen={})

    def test_filtrar_reprobados(self):
        """Prueba filtrar ramos reprobados"""
        response = self.client.get(reverse('filtrarRamos'), {'rango': 'reprobados'})
        self.assertContains(response, "Reprobado")
        self.assertNotContains(response, "Aprobado Bajo")

    def test_filtrar_excelencia(self):
        """Prueba filtrar ramos con nota 7.0"""
        response = self.client.get(reverse('filtrarRamos'), {'rango': 'excelencia'})
        self.assertContains(response, "Excelencia")
        self.assertNotContains(response, "Aprobado Medio")


# Comando para ejecutar las pruebas:
# python manage.py test reservasAPP
#
# Para ver más detalle:
# python manage.py test reservasAPP --verbosity=2
#
# Para ejecutar una clase específica de pruebas:
# python manage.py test reservasAPP.tests.RamoModelTest