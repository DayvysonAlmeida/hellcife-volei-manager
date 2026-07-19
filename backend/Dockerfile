# Use uma imagem base oficial e leve do Python
FROM python:3.11-slim

# Evita a geração de arquivos .pyc e permite logs instantâneos no console do GCP
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Configura o diretório de trabalho no container
WORKDIR /app

# Instala as dependências do sistema operacional necessárias
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copia os requerimentos primeiro para usar cache de build do Docker
COPY requirements.txt /app/

# Instala as dependências do Python
RUN pip install --no-cache-dir -r requirements.txt

# Copia todo o código do projeto para o container
COPY . /app/

# Coleta os arquivos estáticos
RUN python manage.py collectstatic --noinput

# Expõe a porta que o Cloud Run usa (8000 por padrão do Cloud Run)
EXPOSE 8000

# Comando para iniciar a aplicação: primeiro roda as migrações e depois sobe o Gunicorn
CMD python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --threads 4 --timeout 0
