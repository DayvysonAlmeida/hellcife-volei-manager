from .models import Player, Badge, PlayerBadge
from apps.matches.models import MatchPlayer

def check_and_award_badges(player: Player):
    """
    Motor que verifica o histórico do jogador contra todas as regras de Badges e destrava as conquistas.
    """
    unlocked_badges = []
    
    # Todos os badges que o jogador ainda não tem
    owned_badge_ids = player.badges.values_list('badge_id', flat=True)
    available_badges = Badge.objects.exclude(id__in=owned_badge_ids)
    
    if not available_badges.exists():
        return unlocked_badges
        
    # Calcular stats
    match_players = MatchPlayer.objects.filter(player=player).select_related('match', 'match_team')
    total_matches = match_players.count()
    
    # Calcular vitórias consecutivas e invencibilidade
    ordered_match_players = match_players.order_by('match__date', 'match__created_at')
    
    consecutive_wins = 0
    max_consecutive_wins = 0
    consecutive_matches_no_loss = 0
    max_consecutive_no_loss = 0
    last_date = None
    
    for mp in ordered_match_players:
        won = mp.match_team and mp.match_team.winner
        
        # Vitórias seguidas globais
        if won:
            consecutive_wins += 1
            max_consecutive_wins = max(max_consecutive_wins, consecutive_wins)
        else:
            consecutive_wins = 0
            
        # Invicto no mesmo dia
        if last_date != mp.match.date:
            consecutive_matches_no_loss = 0
            
        if won:
            consecutive_matches_no_loss += 1
            max_consecutive_no_loss = max(max_consecutive_no_loss, consecutive_matches_no_loss)
        else:
            consecutive_matches_no_loss = 0
            
        last_date = mp.match.date
        
    stats = {
        'total_matches': total_matches,
        'total_mvp': player.total_mvp,
        'total_big_stars': player.big_stars,
        'consecutive_wins': max_consecutive_wins,
        'consecutive_matches_no_loss': max_consecutive_no_loss,
    }

    new_awards = []
    for badge in available_badges:
        stat_value = stats.get(badge.condition_type, 0)
        
        if stat_value >= badge.condition_value:
            new_awards.append(PlayerBadge(player=player, badge=badge))
            unlocked_badges.append(badge)
            
    if new_awards:
        PlayerBadge.objects.bulk_create(new_awards)
        
    return unlocked_badges
