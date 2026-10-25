from decimal import Decimal

from rest_framework import serializers
from .models import Player, Badge, PlayerBadge
from .elo_service import get_elo_tier, get_elo_progress
from .rankings import elo_calibration, season_match_count
from .signup import SignupSerializer
from .identity import (
    CPF_TAKEN, CPF_UNAVAILABLE, PHONE_TAKEN, CpfUnavailable, canonical_phone, cpf_owner, masked_cpf, phone_owner, set_cpf, valid_cpf,
)
from apps.core.permissions import is_staff_profile


class EloCalibrationMixin:
    """
    Faixa de Elo só depois da calibração (10 partidas na temporada), igual ao ranking de Elo.
    Antes disso a faixa vem como 'calibrating' e sem barra de progresso, em todas as telas.
    """

    def _season_games(self, obj):
        games = self.context.get('season_matches')  # a lista calcula de uma vez para todos
        if games is not None:
            return games.get(obj.id, 0)
        cache = self.__dict__.setdefault('_season_games_cache', {})
        if obj.id not in cache:
            cache[obj.id] = season_match_count(obj.id)
        return cache[obj.id]

    def get_elo_calibration(self, obj):
        return elo_calibration(self._season_games(obj))

    def get_elo_tier(self, obj):
        return 'calibrating' if self.get_elo_calibration(obj)['calibrating'] else obj.elo_tier

    def get_elo_tier_data(self, obj):
        return None if self.get_elo_calibration(obj)['calibrating'] else get_elo_progress(obj.elo)


class PrivateFieldsMixin:
    """Telefone, observações da staff, Elo e a nota (overall): só a staff e o próprio atleta veem. Para os outros vêm vazios."""
    PRIVATE_FIELDS = (
        'phone', 'notes', 'elo', 'elo_tier', 'elo_tier_data', 'elo_calibration', 'latest_overall', 'cpf_masked', 'missing_data',
    )

    def to_representation(self, obj):
        data = super().to_representation(obj)
        user = getattr(self.context.get('request'), 'user', None)
        if not is_staff_profile(user) and not (obj.user_id and obj.user_id == getattr(user, 'id', None)):
            for field in self.PRIVATE_FIELDS:
                if field in data:
                    data[field] = None
        return data


class PlayerListSerializer(PrivateFieldsMixin, EloCalibrationMixin, serializers.ModelSerializer):
    latest_overall = serializers.SerializerMethodField()
    display_name = serializers.ReadOnlyField()
    main_position_display = serializers.CharField(source='get_main_position_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    avatar_url = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()
    elo_tier = serializers.SerializerMethodField()
    elo_tier_data = serializers.SerializerMethodField()
    elo_calibration = serializers.SerializerMethodField()

    class Meta:
        model = Player
        fields = [
            'id', 'name', 'nickname', 'display_name', 'shirt_number',
            'main_position', 'main_position_display', 'secondary_position',
            'avatar_url', 'status', 'status_display', 'latest_overall',
            'mini_stars', 'big_stars', 'mvp_stars', 'attack_stars', 'defense_stars',
            'setter_stars', 'pass_stars', 'block_stars',
            'created_at', 'is_guest', 'invited_by', 'guest_overall', 'consecutive_absences', 'stats',
            'gender',
            'elo', 'elo_tier', 'elo_tier_data', 'elo_calibration',
        ]

    def get_latest_overall(self, obj):
        """Usa a annotation do queryset se disponível, senão faz fallback para a property."""
        if hasattr(obj, 'annotated_overall'):
            return obj.annotated_overall if obj.annotated_overall else None
        # Fallback: usa evaluations já prefetchados se existirem
        if hasattr(obj, '_prefetched_objects_cache') and 'evaluations' in obj._prefetched_objects_cache:
            evals = list(obj.evaluations.all())
            if evals:
                evals.sort(key=lambda e: e.date, reverse=True)
                return evals[0].overall
            return None
        # Último fallback: query individual
        eval_ = obj.evaluations.order_by('-date').first()
        return eval_.overall if eval_ else None

    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get('request')
            if request is not None:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None

    def get_stats(self, obj):
        if hasattr(obj, 'total_matches'):
            win_rate = (obj.wins / obj.total_matches * 100) if obj.total_matches > 0 else 0
            
            # Calcular win_streak a partir dos match_appearances prefetchados
            streak = 0
            if hasattr(obj, '_prefetched_objects_cache') and 'match_appearances' in obj._prefetched_objects_cache:
                appearances = list(obj.match_appearances.all())
                # Filtra apenas os que tem match_team e match associados, e ordena por data decrescente
                valid_apps = [app for app in appearances if app.match_team and app.match_team.match]
                valid_apps.sort(key=lambda a: a.match_team.match.date, reverse=True)
                
                for app in valid_apps:
                    if app.match_team.winner:
                        streak += 1
                    else:
                        break

            return {
                'matches': obj.total_matches,
                'win_rate': round(win_rate, 1),
                'wins': obj.wins,
                'win_rank': self.context.get('global_win_ranks', {}).get(obj.id, None),
                'fire_shark_rank': self.context.get('global_fire_sharks', {}).get(obj.id, None),
                'win_streak': streak,
                'mvp': obj.mvps,
                'best_attacker': obj.best_attackers,
                'best_server': obj.best_servers,
                'best_defender': obj.best_defenders,
            }
        return None


class BadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Badge
        fields = '__all__'


class PlayerBadgeSerializer(serializers.ModelSerializer):
    badge = BadgeSerializer(read_only=True)

    class Meta:
        model = PlayerBadge
        fields = ['id', 'badge', 'awarded_at']


class PlayerDetailSerializer(PrivateFieldsMixin, EloCalibrationMixin, serializers.ModelSerializer):
    latest_overall = serializers.SerializerMethodField()
    display_name = serializers.ReadOnlyField()
    main_position_display = serializers.CharField(source='get_main_position_display', read_only=True)
    secondary_position_display = serializers.CharField(source='get_secondary_position_display', read_only=True)
    dominant_hand_display = serializers.CharField(source='get_dominant_hand_display', read_only=True)
    gender_display = serializers.CharField(source='get_gender_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    avatar_url = serializers.SerializerMethodField()
    badges = PlayerBadgeSerializer(many=True, read_only=True)
    elo_tier = serializers.SerializerMethodField()
    elo_tier_data = serializers.SerializerMethodField()
    elo_calibration = serializers.SerializerMethodField()
    legal_name = serializers.SerializerMethodField()
    cpf_masked = serializers.SerializerMethodField()
    missing_data = serializers.SerializerMethodField()

    class Meta:
        model = Player
        fields = [
            'id', 'name', 'nickname', 'display_name', 'shirt_number',
            'age', 'height', 'weight',
            'main_position', 'main_position_display',
            'secondary_position', 'secondary_position_display',
            'dominant_hand', 'dominant_hand_display',
            'gender', 'gender_display',
            'phone', 'instagram', 'avatar', 'avatar_url', 'notes',
            'status', 'status_display',
            'user', 'latest_overall',
            'mini_stars', 'big_stars',
            'mvp_stars', 'attack_stars', 'defense_stars',
            'setter_stars', 'pass_stars', 'block_stars',
            'created_at', 'updated_at',
            'is_guest', 'invited_by', 'guest_overall', 'consecutive_absences', 'badges', 'legal_name',
            'cpf_masked', 'missing_data',
            'elo', 'elo_tier', 'elo_tier_data', 'elo_calibration',
        ]

    def get_latest_overall(self, obj):
        """Usa evaluations prefetchados quando disponível."""
        if hasattr(obj, '_prefetched_objects_cache') and 'evaluations' in obj._prefetched_objects_cache:
            evals = list(obj.evaluations.all())
            if evals:
                evals.sort(key=lambda e: e.date, reverse=True)
                return evals[0].overall
            return None
        eval_ = obj.evaluations.order_by('-date').first()
        return eval_.overall if eval_ else None

    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get('request')
            if request is not None:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None

    def get_cpf_masked(self, obj):
        return masked_cpf(obj.cpf_last2) if obj.cpf_hash else ''

    def get_missing_data(self, obj):
        """O que falta no cadastro (o app mostra o alerta "Atualize seus dados"). Convidado não precisa."""
        if obj.is_guest:
            return []
        return [field for field, ok in (('cpf', bool(obj.cpf_hash)), ('phone', bool(obj.phone))) if not ok]

    def get_legal_name(self, obj):
        """Nome civil: só a staff e o próprio atleta veem (no app aparece o nome social)."""
        user = getattr(self.context.get('request'), 'user', None)
        if is_staff_profile(user) or (obj.user_id and obj.user_id == getattr(user, 'id', None)):
            return obj.legal_name
        return None


class CpfFieldMixin:
    """CPF digitado: confere os dígitos, se já tem dono e guarda só a impressão digital e os 2 últimos dígitos."""

    def validate_cpf(self, value):
        if not value:
            return ''
        digits = valid_cpf(value)
        if not digits:
            raise serializers.ValidationError('CPF inválido. Confira os números.')
        try:
            if cpf_owner(digits, exclude_id=getattr(self.instance, 'pk', None)):
                raise serializers.ValidationError(CPF_TAKEN)
        except CpfUnavailable:
            raise serializers.ValidationError(CPF_UNAVAILABLE)
        return digits

    def validate_phone(self, value):
        value = SignupSerializer.validate_phone(self, value) if self.check_phone_format else value
        # Só vale ao trocar o número: quem já divide o WhatsApp com um cadastro antigo continua salvando o resto
        unchanged = self.instance is not None and canonical_phone(value) == canonical_phone(self.instance.phone)
        if value and self.unique_phone and not unchanged and phone_owner(value, exclude_id=getattr(self.instance, 'pk', None)):
            raise serializers.ValidationError(PHONE_TAKEN)
        return value

    def pop_cpf(self, validated_data, player):
        digits = validated_data.pop('cpf', '')
        if digits:
            set_cpf(player, digits)


class MyProfileSerializer(CpfFieldMixin, serializers.ModelSerializer):
    """
    O que o atleta edita no próprio perfil. Campos fora desta lista são ignorados:
    e-mail, posições, camisa, status, plano, estrelas, Elo e avaliações ficam com a staff.
    """
    legal_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False)
    instagram = serializers.CharField(max_length=100, required=False, allow_blank=True)
    age = serializers.IntegerField(min_value=10, max_value=99, required=False, allow_null=True)
    height = serializers.DecimalField(
        max_digits=4, decimal_places=2, min_value=Decimal('1'), max_value=Decimal('2.5'), required=False, allow_null=True,
    )
    weight = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal('30'), max_value=Decimal('250'), required=False, allow_null=True,
    )
    remove_avatar = serializers.BooleanField(required=False, write_only=True)
    cpf = serializers.CharField(max_length=20, required=False, allow_blank=True, write_only=True)

    check_phone_format = True
    unique_phone = True  # o mesmo WhatsApp não fica em dois cadastros

    class Meta:
        model = Player
        fields = [
            'name', 'legal_name', 'nickname', 'gender', 'phone', 'instagram',
            'age', 'height', 'weight', 'dominant_hand', 'avatar', 'remove_avatar', 'cpf',
        ]

    # Mesmas regras do cadastro
    validate_name = SignupSerializer.validate_name
    validate_instagram = SignupSerializer.validate_instagram
    validate_avatar = SignupSerializer.validate_avatar

    def validate_cpf(self, value):
        # O atleta informa o CPF uma vez; para trocar depois, só a staff
        if value and self.instance and self.instance.cpf_hash:
            raise serializers.ValidationError('O seu CPF já está cadastrado. Para trocar, fale com a organização.')
        return super().validate_cpf(value)

    def update(self, instance, validated_data):
        if validated_data.pop('remove_avatar', False) and not validated_data.get('avatar'):
            validated_data['avatar'] = None
        self.pop_cpf(validated_data, instance)
        player = super().update(instance, validated_data)
        # O nome do login acompanha o nome social
        if player.user and player.user.name != player.name:
            player.user.name = player.name
            player.user.save(update_fields=['name'])
        return player


class PlayerWriteSerializer(CpfFieldMixin, serializers.ModelSerializer):
    # A staff informa ou troca o CPF (o número não volta: fica só a impressão digital)
    cpf = serializers.CharField(max_length=20, required=False, allow_blank=True, write_only=True)
    check_phone_format = False
    unique_phone = False  # a staff pode repetir o número de propósito (ex.: pai e filho no mesmo WhatsApp)

    class Meta:
        model = Player
        fields = [
            'id', 'name', 'nickname', 'shirt_number', 'age', 'height', 'weight',
            'main_position', 'secondary_position', 'dominant_hand', 'gender',
            'phone', 'instagram', 'avatar', 'notes', 'status', 'user',
            'mini_stars', 'big_stars', 'mvp_stars', 'attack_stars', 'defense_stars',
            'setter_stars', 'pass_stars', 'block_stars',
            'is_guest', 'guest_overall', 'legal_name', 'cpf',
        ]
        read_only_fields = ['id']

    # Foto enviada pela staff passa pela mesma checagem do cadastro (imagem de verdade, até 5 MB)
    validate_avatar = SignupSerializer.validate_avatar

    def create(self, validated_data):
        digits = validated_data.pop('cpf', '')
        player = super().create(validated_data)
        if digits:
            set_cpf(player, digits)
            player.save(update_fields=['cpf_hash', 'cpf_last2'])
        return player

    def update(self, instance, validated_data):
        self.pop_cpf(validated_data, instance)
        return super().update(instance, validated_data)
