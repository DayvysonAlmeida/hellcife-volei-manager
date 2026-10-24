"""Sessões (tokens de login): encerrar todas as de uma conta quando a senha muda ou o acesso é desativado."""
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken


def end_all_sessions(user):
    """
    Bloqueia todos os tokens de renovação da conta: os outros aparelhos saem quando o acesso atual vencer
    (até 8h) e não conseguem renovar. Usado ao trocar ou redefinir a senha e ao desativar o usuário.
    """
    pending = OutstandingToken.objects.filter(user=user).exclude(blacklistedtoken__isnull=False)
    BlacklistedToken.objects.bulk_create([BlacklistedToken(token=token) for token in pending], ignore_conflicts=True)


def fresh_tokens(user):
    """Login novo para o aparelho que acabou de trocar a senha continuar entrando."""
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}
