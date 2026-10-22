import logging
from apps.players.models import RankingLeader
from apps.players.rankings import stars_ranking, wins_ranking
from apps.notifications.models import Notification
from apps.notifications.services import notify
from apps.core.models import User

logger = logging.getLogger(__name__)


def _leader_changed(ranking, player_id):
    """
    Grava o líder atual e diz se ele mudou. Na primeira vez só grava: não há troca para avisar.
    A troca é um UPDATE condicional: com dois containers checando juntos, só um consegue gravar e avisar.
    """
    _, created = RankingLeader.objects.get_or_create(ranking=ranking, defaults={'player_id': player_id})
    if created:
        return False
    return RankingLeader.objects.filter(ranking=ranking).exclude(player_id=player_id).update(player_id=player_id) == 1


def check_rank_changes():
    """
    Verifica se houve mudança de liderança nos rankings principais.
    Deve ser chamado após uma partida ser salva ou estrelas serem adicionadas.
    """
    try:
        notifications_to_create = []
        all_players_qs = User.objects.filter(profile='player', is_active=True)

        # 1. Ranking de Vitórias (Gladiadores) — mesma regra das telas
        top_winner = wins_ranking().first()
        if top_winner and _leader_changed('wins', top_winner.id):
            msg = f"Temos um novo líder! O atleta {top_winner.display_name} assumiu o 1º lugar no Ranking de Vitórias ({top_winner.wins} vitórias)."
            for u in all_players_qs:
                notifications_to_create.append(Notification(
                    user=u,
                    title='🏆 Mudança no Top 1: Vitórias',
                    message=msg,
                    type='alert'
                ))

        # 2. Ranking de Estrelas
        top_star = stars_ranking().first()
        if top_star and _leader_changed('stars', top_star.id):
            msg = f"O atleta {top_star.display_name} agora é o maior detentor de Estrelas do Hellcife ({top_star.big_stars or 0} Grandes e {top_star.mini_stars or 0} Mini)."
            for u in all_players_qs:
                notifications_to_create.append(Notification(
                    user=u,
                    title='🏆 Mudança no Top 1: Estrelas',
                    message=msg,
                    type='alert'
                ))

        # Grava todos os alertas gerados de uma vez (e manda o push)
        notify(notifications_to_create)

    except Exception as e:
        logger.error(f"Erro ao checar mudança de ranks: {e}")
