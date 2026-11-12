"""
Login do admin do Django (/admin/login/) com o mesmo limite de tentativas do login do app.

O login padrão do admin aceita tentativas sem parar, e quem entra nele como superusuário pode tudo.
Aqui as tentativas somam com as do app: pela mesma conta (10 por hora) e pelo mesmo IP (60 por hora).
"""
import math

from django.contrib import admin
from django.http import HttpResponse

from .exceptions import too_many_attempts
from .throttles import AdminLoginAccountThrottle, AdminLoginIpThrottle


def limited_admin_login(request, extra_context=None):
    if request.method == 'POST':
        throttles = [AdminLoginAccountThrottle(), AdminLoginIpThrottle()]
        waits = [throttle.wait() for throttle in throttles if not throttle.allow_request(request, None)]
        if waits:
            wait = max(w or 60 for w in waits)
            return HttpResponse(too_many_attempts(wait), status=429, content_type='text/plain; charset=utf-8',
                                headers={'Retry-After': str(math.ceil(wait))})
    return admin.site.login(request, extra_context)
