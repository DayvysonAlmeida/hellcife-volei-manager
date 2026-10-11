"""
Django settings for HellLife Vôlei Manager
"""
import os
from pathlib import Path
from datetime import timedelta
from decouple import config
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-me')
DEBUG = config('DEBUG', default=True, cast=bool)

# Segurança: em produção a SECRET_KEY padrão (insegura) nunca pode ser usada
if not DEBUG and SECRET_KEY == 'django-insecure-change-me':
    from django.core.exceptions import ImproperlyConfigured
    raise ImproperlyConfigured('Defina a variável de ambiente SECRET_KEY quando DEBUG=False.')

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',')

# Google Cloud Run: adiciona o hostname do serviço automaticamente
CLOUDRUN_SERVICE_URL = config('CLOUDRUN_SERVICE_URL', default='')
if CLOUDRUN_SERVICE_URL:
    from urllib.parse import urlparse
    parsed = urlparse(CLOUDRUN_SERVICE_URL)
    if parsed.hostname:
        ALLOWED_HOSTS.append(parsed.hostname)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'cloudinary',
    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'drf_spectacular',
    # Local apps
    'apps.core',
    'apps.players',
    'apps.evaluations',
    'apps.attendance',
    'apps.teams',
    'apps.matches',
    'apps.halloffame',
    'apps.notifications',
    'apps.subscriptions',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Serve static files em produção
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database — usa DATABASE_URL se disponível (PostgreSQL no Neon), senão SQLite local
DATABASES = {
    'default': dj_database_url.config(
        default=config('DATABASE_URL', default=f'sqlite:///{BASE_DIR / "db.sqlite3"}'),
        conn_max_age=600,
        conn_health_checks=True,
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Cloudinary Config
CLOUDINARY_CLOUD_NAME = config('CLOUDINARY_CLOUD_NAME', default='')
CLOUDINARY_URL = config('CLOUDINARY_URL', default='')

if CLOUDINARY_CLOUD_NAME or CLOUDINARY_URL:
    if CLOUDINARY_CLOUD_NAME:
        CLOUDINARY_STORAGE = {
            'CLOUD_NAME': CLOUDINARY_CLOUD_NAME,
            'API_KEY': config('CLOUDINARY_API_KEY', default=''),
            'API_SECRET': config('CLOUDINARY_API_SECRET', default=''),
        }
    DEFAULT_FILE_STORAGE_BACKEND = 'cloudinary_storage.storage.MediaCloudinaryStorage'
else:
    DEFAULT_FILE_STORAGE_BACKEND = 'django.core.files.storage.FileSystemStorage'

STORAGES = {
    'default': {
        'BACKEND': DEFAULT_FILE_STORAGE_BACKEND,
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
    },
}

# Fix para o bug do django-cloudinary-storage que ainda busca a variável antiga
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'
DEFAULT_FILE_STORAGE = DEFAULT_FILE_STORAGE_BACKEND

# Desabilita o erro estrito do Whitenoise caso algum CSS do Admin do Django tente referenciar imagens/arquivos que não existem
WHITENOISE_MANIFEST_STRICT = False

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Asaas Integration
ASAAS_API_KEY = config('ASAAS_API_KEY', default='')
ASAAS_API_URL = config('ASAAS_API_URL', default='https://sandbox.asaas.com/api/v3')
ASAAS_WEBHOOK_TOKEN = config('ASAAS_WEBHOOK_TOKEN', default='')

# Preço unitário do crédito avulso (calculado no servidor, nunca vindo do cliente)
EXTRA_CREDIT_UNIT_PRICE = config('EXTRA_CREDIT_UNIT_PRICE', default='10.00')

# Email Backend
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='Hellcife Vôlei <nao-responda@hellcife.com.br>')
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:5173')

AUTH_USER_MODEL = 'core.User'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    # Classe customizada que respeita ?page_size= na query string (max 1000)
    'DEFAULT_PAGINATION_CLASS': 'apps.core.pagination.StandardPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# JWT
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'UPDATE_LAST_LOGIN': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173'
).split(',')
CORS_ALLOW_CREDENTIALS = True

# DRF Spectacular (OpenAPI)
SPECTACULAR_SETTINGS = {
    'TITLE': 'HellLife Vôlei Manager API',
    'DESCRIPTION': 'API completa para gerenciamento de grupos de vôlei recreativo e competitivo.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
}

# Segurança em produção
if not DEBUG:
    SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Monkey patch para corrigir erro do Django 5.1 no Python 3.14 (BaseContext.__copy__)
from django.template.context import BaseContext
def base_context_copy(self):
    duplicate = type(self).__new__(type(self))
    duplicate.__dict__.update(self.__dict__)
    duplicate.dicts = self.dicts[:]
    return duplicate
BaseContext.__copy__ = base_context_copy
