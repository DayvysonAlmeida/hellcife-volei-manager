import logging
from django.core.cache import cache
from django.db.models import Count, Q
from apps.players.models import Player
from apps.notifications.models import Notification
from apps.core.models import User

logger = logging.getLogger(__name__)

def check_rank_changes():
    """
    Verifica se houve mudança de liderança nos rankings principais.
    Deve ser chamado após uma partida ser salva ou estrelas serem adicionadas.
    """
    try:
        notifications_to_create = []
        all_players_qs = User.objects.filter(profile='player', is_active=True)
        
        # 1. Ranking de Vitórias (Win Rate)
        qs_wins = Player.objects.filter(is_guest=False).annotate(
            wins=Count('match_appearances', filter=Q(match_appearances__match_team__winner=True), distinct=True),
            total_matches=Count('match_appearances', distinct=True),
        ).filter(total_matches__gte=1).order_by('-wins', '-total_matches')
        
        if qs_wins.exists():
            top_winner = qs_wins.first()
            previous_top_winner_id = cache.get('leader_win_rate')
            
            if previous_top_winner_id != top_winner.id:
                # Mudou o líder!
                if previous_top_winner_id is not None:
                    # Avisar geral se não for a primeira vez que o ranking roda
                    msg = f"Temos um novo líder! O atleta {top_winner.display_name} assumiu o 1º lugar no Ranking de Vitórias ({top_winner.wins} vitórias)."
                    for u in all_players_qs:
                        notifications_to_create.append(Notification(
                            user=u,
                            title='🏆 Mudança no Top 1: Vitórias',
                            message=msg,
                            type='alert'
                        ))
                # Atualiza cache
                cache.set('leader_win_rate', top_winner.id, timeout=None)

        # 2. Ranking de Estrelas
        qs_stars = Player.objects.filter(is_guest=False).exclude(big_stars=0, mini_stars=0).order_by('-big_stars', '-mini_stars')
        if qs_stars.exists():
            top_star = qs_stars.first()
            previous_top_star_id = cache.get('leader_stars')
            
            if previous_top_star_id != top_star.id:
                if previous_top_star_id is not None:
                    msg = f"O atleta {top_star.display_name} agora é o maior detentor de Estrelas do Hellcife ({top_star.big_stars or 0} Grandes e {top_star.mini_stars or 0} Mini)."
                    for u in all_players_qs:
                        notifications_to_create.append(Notification(
                            user=u,
                            title='🏆 Mudança no Top 1: Estrelas',
                            message=msg,
                            type='alert'
                        ))
                cache.set('leader_stars', top_star.id, timeout=None)
                
        # Bulk create de todos os alertas gerados
        if notifications_to_create:
            Notification.objects.bulk_create(notifications_to_create)

    except Exception as e:
        logger.error(f"Erro ao checar mudança de ranks: {e}")
