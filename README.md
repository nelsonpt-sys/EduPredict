# EduPredict

Plataforma web y app móvil para que estudiantes gestionen su avance académico: ramos, semestres/períodos, notas, calculadora de notas, estadísticas y un **escáner con IA** que lee documentos y extrae información académica.

## Stack
- **Backend:** Django 5 + Django REST Framework, Whitenoise, Gunicorn
- **Base de datos:** PostgreSQL (Supabase, plan gratuito); SQLite en desarrollo local
- **IA:** Google Gemini (visión) y Groq
- **App móvil:** Capacitor + Vite (`AppAndroid/`)
- **Despliegue:** Render (plan gratuito)

## Ejecución local
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # completa las variables; sin DATABASE_URL usa SQLite
python manage.py migrate
python manage.py runserver
```

## Variables de entorno
Ver `.env.example`. Los valores reales no se versionan: `.env` está excluido del repositorio.

| Variable | Descripción |
|---|---|
| `SECRET_KEY` | Clave secreta de Django |
| `DEBUG` | `True` solo en desarrollo |
| `ALLOWED_HOSTS` | Hosts permitidos, separados por coma |
| `DATABASE_URL` | Cadena de conexión de Supabase (Session pooler) |
| `GEMINI_API_KEY` | Clave de Google AI Studio |
| `GROQ_API_KEY` | Clave de Groq |

## Despliegue
El backend se despliega como *Web Service* en Render y se conecta a una base PostgreSQL en Supabase, ambos en su plan gratuito. La configuración del servicio está en `render.yaml`; el build (`build.sh`) ejecuta `collectstatic` y `migrate`, y las variables de entorno de la tabla anterior se definen en el panel de Render. Para la base se usa la cadena de conexión *Session pooler* de Supabase.

### Consideraciones del plan gratuito
- Render suspende el servicio tras un período sin tráfico, por lo que la primera petición puede tardar entre 15 y 60 segundos en responder.
- Supabase pausa los proyectos gratuitos tras unos 7 días de inactividad. Mientras la base está pausada, los endpoints que la usan responden con error 500 hasta que el proyecto se reactiva.

## App móvil
`AppAndroid/` contiene el cliente móvil (Capacitor + Vite). La URL del backend se define en `AppAndroid/src/services/api.js` (`PRODUCTION_URL`). El APK firmado está disponible en la [sección Releases](https://github.com/nelsonpt-sys/EduPredict/releases).

## Seguridad
Las claves de API y la base de datos se configuran solo mediante variables de entorno.
