import logging
from apps.players.models import RankingLeader
from apps.players.rankings import fire_shark_ranking, stars_ranking, wins_ranking
from apps.notifications.models import Notification
from apps.notifications.services import notify
from apps.core.models import User

logger = logging.getLogger(__name__)

RANKING_URL = '/athlete'   # o painel do atleta, onde ficam as abas dos rankings


def _leader_changed(ranking, player_id):
    """
    Grava o líder atual e diz se ele mudou. Na primeira vez só grava: não há troca para avisar.
    A troca é um UPDATE condicional: com dois containers checando juntos, só um consegue gravar e avisar.
    """
    _, created = RankingLeader.objects.get_or_create(ranking=ranking, defaults={'player_id': player_id})
    if created:
        return False
    return RankingLeader.objects.filter(ranking=ranking).exclude(player_id=player_id).update(player_id=player_id) == 1


def _previous_leader(ranking):
    return RankingLeader.objects.filter(ranking=ranking).select_related('player__user').values_list('player__user', flat=True).first()


def check_rank_changes():
    """
    Verifica se houve mudança de liderança nos rankings principais.
    Deve ser chamado após uma partida ser salva ou estrelas serem adicionadas.
    O celular só apita para quem está envolvido; os demais veem o aviso na lista do app.
    """
    try:
        personal, broadcast = [], []
        all_players_qs = User.objects.filter(profile='player', is_active=True)

        def announce(leader_user_id, title, message):
            for u in all_players_qs:
                (personal if u.id == leader_user_id else broadcast).append(
                    Notification(user=u, title=title, message=message, type='alert', url=RANKING_URL)
                )

        # 1. Ranking de Vitórias (Gladiadores) — mesma regra das telas
        top_winner = wins_ranking().first()
        if top_winner and _leader_changed('wins', top_winner.id):
            msg = f"Temos um novo líder! O atleta {top_winner.display_name} assumiu o 1º lugar no Ranking de Vitórias ({top_winner.wins} vitórias)."
            announce(top_winner.user_id, '🏆 Mudança no Top 1: Vitórias', msg)

        # 2. Ranking de Estrelas
        top_star = stars_ranking().first()
        if top_star and _leader_changed('stars', top_star.id):
            msg = f"O atleta {top_star.display_name} agora é o maior detentor de Estrelas do Hellcife ({top_star.big_stars or 0} Grandes e {top_star.mini_stars or 0} Mini)."
            announce(top_star.user_id, '🏆 Mudança no Top 1: Estrelas', msg)

        # 3. Fire Shark: só o novo líder e quem perdeu a liderança recebem
        fire = fire_shark_ranking()
        if fire:
            leader = fire[0]
            previous_user_id = _previous_leader('fire_shark')
            if _leader_changed('fire_shark', leader.id):
                if leader.user_id:
                    personal.append(Notification(
                        user_id=leader.user_id, title='Você é o novo Tubarão da Quadra! 🦈', type='prize', url=RANKING_URL,
                        message=f'Você assumiu o 1º lugar no Fire Shark com {leader.fire_score} pontos.',
                    ))
                if previous_user_id and previous_user_id != leader.user_id and all_players_qs.filter(id=previous_user_id).exists():
                    personal.append(Notification(
                        user_id=previous_user_id, title=f'{leader.display_name} passou você no Fire Shark', type='alert',
                        url=RANKING_URL, message='Você perdeu o 1º lugar no Fire Shark. Bora recuperar na quadra!',
                    ))

        # Grava todos os alertas de uma vez; push só para os envolvidos
        notify(personal)
        notify(broadcast, push=False)

    except Exception as e:
        logger.error(f"Erro ao checar mudança de ranks: {e}")
