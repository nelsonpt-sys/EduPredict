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
Ver `.env.example`. **Nunca** subas valores reales al repositorio.

| Variable | Descripción |
|---|---|
| `SECRET_KEY` | Clave secreta de Django |
| `DEBUG` | `True` solo en desarrollo |
| `ALLOWED_HOSTS` | Hosts permitidos, separados por coma |
| `DATABASE_URL` | Cadena de conexión de Supabase (Session pooler) |
| `GEMINI_API_KEY` | Clave de Google AI Studio |
| `GROQ_API_KEY` | Clave de Groq |

## Despliegue gratuito
1. Crea un proyecto en [Supabase](https://supabase.com) (plan Free) y copia la cadena de conexión *Session pooler*.
2. En [Render](https://render.com) crea un *Web Service* desde este repo con la instancia **Free** (puedes usar `render.yaml`).
3. Define las variables de entorno de la tabla anterior en el panel de Render. El build (`build.sh`) ejecuta `collectstatic` y `migrate`.

## Despertar la base de datos (Supabase gratis)
El plan gratuito de Supabase **pausa el proyecto tras ~7 días de inactividad**. Si la app responde con errores 500 al iniciar sesión:
1. Entra a [supabase.com](https://supabase.com) e inicia sesión.
2. Abre tu proyecto.
3. Pulsa el botón **Restore project** y espera unos minutos.

Además, el plan gratuito de Render duerme el servicio sin tráfico: la primera petición puede tardar entre 15 y 60 segundos.

## App móvil
En `AppAndroid/` está el proyecto Capacitor. La URL del backend se define en `AppAndroid/src/services/api.js` (`PRODUCTION_URL`).

## Seguridad
Las claves de API y la base de datos se configuran solo mediante variables de entorno.
