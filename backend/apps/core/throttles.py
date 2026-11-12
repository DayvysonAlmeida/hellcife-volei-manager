"""
Limite de tentativas pelas rotas sensíveis.

Conta principalmente pelo alvo (o e-mail do login, o atleta do link público): na quadra muita gente sai pelo mesmo
IP da operadora, então o limite por IP é só uma segunda barreira, folgada. O IP é o último do X-Forwarded-For, o que
o Cloud Run acrescenta (NUM_PROXIES em REST_FRAMEWORK): o que o cliente escreve nesse cabeçalho não conta.
As taxas ficam em REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].
"""
from rest_framework.throttling import ScopedRateThrottle, SimpleRateThrottle


class FieldRateThrottle(SimpleRateThrottle):
    """Conta as tentativas por um campo do pedido (ex.: o e-mail), seja qual for o aparelho ou a rede."""
    fields = ()

    def get_cache_key(self, request, view):
        values = [str(request.data.get(field, '') or '').strip().lower() for field in self.fields]
        if not all(values):
            return None  # sem o campo a própria view recusa o pedido
        return self.cache_format % {'scope': self.scope, 'ident': ':'.join(values)}


class LoginAccountThrottle(FieldRateThrottle):
    scope = 'login-account'
    fields = ('email',)


class PasswordResetEmailThrottle(FieldRateThrottle):
    scope = 'password-reset-email'
    fields = ('email',)


class PublicCheckinPlayerThrottle(FieldRateThrottle):
    """Link público: limita as tentativas em nome de cada atleta (cobre também o chute dos dígitos do WhatsApp)."""
    scope = 'public-checkin-player'
    fields = ('player_id',)

    def get_cache_key(self, request, view):
        key = super().get_cache_key(request, view)
        return key and f"{key}:{view.kwargs.get('pk')}"


class AdminLoginAccountThrottle(SimpleRateThrottle):
    """Login do admin do Django: soma com o login do app na mesma conta (o formulário chama o e-mail de username)."""
    scope = 'login-account'

    def get_cache_key(self, request, view):
        email = (request.POST.get('username') or '').strip().lower()
        return self.cache_format % {'scope': self.scope, 'ident': email} if email else None


class AdminLoginIpThrottle(SimpleRateThrottle):
    """Login do admin do Django: soma com o login do app no mesmo IP."""
    scope = 'login-ip'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


class ScopedThrottle(ScopedRateThrottle):
    """Segunda barreira, folgada: por conta logada ou por IP, com a taxa do escopo informado."""

    def __init__(self, scope):
        self.throttle_scope = scope
        super().__init__()

    def allow_request(self, request, view):
        self.scope = self.throttle_scope
        self.rate = self.get_rate()
        self.num_requests, self.duration = self.parse_rate(self.rate)
        return SimpleRateThrottle.allow_request(self, request, view)
