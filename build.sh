#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt

# Si usas base de datos SQLite dejarlo comentado, pero si usas PostgreSQL debes habilitar migraciones
python manage.py collectstatic --no-input
python manage.py migrate
