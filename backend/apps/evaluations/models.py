from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class EvaluationConfig(models.Model):
    """Configuração de pesos para cada fundamento."""
    name = models.CharField(max_length=100, default='Padrão', verbose_name='Nome da configuração')
    is_active = models.BooleanField(default=True, verbose_name='Configuração ativa')

    # Pesos (somam 100 idealmente)
    w_serve = models.FloatField(default=7.0, verbose_name='Peso - Saque')
    w_reception = models.FloatField(default=8.0, verbose_name='Peso - Recepção')
    w_pass = models.FloatField(default=8.0, verbose_name='Peso - Passe')
    w_setting = models.FloatField(default=7.0, verbose_name='Peso - Levantamento')
    w_attack = models.FloatField(default=10.0, verbose_name='Peso - Ataque')
    w_block = models.FloatField(default=8.0, verbose_name='Peso - Bloqueio')
    w_defense = models.FloatField(default=9.0, verbose_name='Peso - Defesa')
    w_recovery = models.FloatField(default=7.0, verbose_name='Peso - Recuperação de bola')
    w_positioning = models.FloatField(default=8.0, verbose_name='Peso - Posicionamento')
    w_communication = models.FloatField(default=7.0, verbose_name='Peso - Comunicação')
    w_tactical = models.FloatField(default=8.0, verbose_name='Peso - Inteligência tática')
    w_conditioning = models.FloatField(default=7.0, verbose_name='Peso - Condicionamento físico')
    w_consistency = models.FloatField(default=6.0, verbose_name='Peso - Regularidade')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Configuração de avaliação'
        verbose_name_plural = 'Configurações de avaliação'

    def __str__(self):
        return f'{self.name} ({"ativa" if self.is_active else "inativa"})'

    @classmethod
    def get_active(cls):
        return cls.objects.filter(is_active=True).first()


def calculate_overall(evaluation, config=None):
    """Calcula o overall ponderado com base nos pesos da configuração."""
    if config is None:
        config = EvaluationConfig.get_active()
    if config is None:
        # Média simples se não houver config
        fields = [
            evaluation.serve, evaluation.reception, evaluation.passing,
            evaluation.setting, evaluation.attack, evaluation.block,
            evaluation.defense, evaluation.recovery, evaluation.positioning,
            evaluation.communication, evaluation.tactical_iq,
            evaluation.conditioning, evaluation.consistency,
        ]
        return round(sum(fields) / len(fields), 2)

    total_weight = (
        config.w_serve + config.w_reception + config.w_pass + config.w_setting +
        config.w_attack + config.w_block + config.w_defense + config.w_recovery +
        config.w_positioning + config.w_communication + config.w_tactical +
        config.w_conditioning + config.w_consistency
    )

    weighted_sum = (
        evaluation.serve * config.w_serve +
        evaluation.reception * config.w_reception +
        evaluation.passing * config.w_pass +
        evaluation.setting * config.w_setting +
        evaluation.attack * config.w_attack +
        evaluation.block * config.w_block +
        evaluation.defense * config.w_defense +
        evaluation.recovery * config.w_recovery +
        evaluation.positioning * config.w_positioning +
        evaluation.communication * config.w_communication +
        evaluation.tactical_iq * config.w_tactical +
        evaluation.conditioning * config.w_conditioning +
        evaluation.consistency * config.w_consistency
    )

    return round(weighted_sum / total_weight, 2)


SCORE_VALIDATOR = [MinValueValidator(0), MaxValueValidator(10)]


class Evaluation(models.Model):
    player = models.ForeignKey(
        'players.Player', on_delete=models.CASCADE,
        related_name='evaluations', verbose_name='Jogador'
    )
    evaluator = models.ForeignKey(
        'core.User', on_delete=models.SET_NULL, null=True,
        related_name='evaluations_made', verbose_name='Avaliador'
    )
    date = models.DateField(verbose_name='Data da avaliação')
    notes = models.TextField(blank=True, null=True, verbose_name='Observações')

    # Fundamentos (0-10)
    serve = models.FloatField(validators=SCORE_VALIDATOR, default=5.0, verbose_name='Saque')
    reception = models.FloatField(validators=SCORE_VALIDATOR, default=5.0, verbose_name='Recepção')
    passing = models.FloatField(validators=SCORE_VALIDATOR, default=5.0, verbose_name='Passe')
    setting = models.FloatField(validators=SCORE_VALIDATOR, default=5.0, verbose_name='Levantamento')
    attack = models.FloatField(validators=SCORE_VALIDATOR, default=5.0, verbose_name='Ataque')
    block = models.FloatField(validators=SCORE_VALIDATOR, default=5.0, verbose_name='Bloqueio')
    defense = models.FloatField(validators=SCORE_VALIDATOR, default=5.0, verbose_name='Defesa')
    recovery = models.FloatField(validators=SCORE_VALIDATOR, default=5.0, verbose_name='Recuperação de bola')
    positioning = models.FloatField(validators=SCORE_VALIDATOR, default=5.0, verbose_name='Posicionamento')
    communication = models.FloatField(validators=SCORE_VALIDATOR, default=5.0, verbose_name='Comunicação')
    tactical_iq = models.FloatField(validators=SCORE_VALIDATOR, default=5.0, verbose_name='Inteligência tática')
    conditioning = models.FloatField(validators=SCORE_VALIDATOR, default=5.0, verbose_name='Condicionamento físico')
    consistency = models.FloatField(validators=SCORE_VALIDATOR, default=5.0, verbose_name='Regularidade')

    # Overall calculado automaticamente
    overall = models.FloatField(default=0, verbose_name='Overall')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Avaliação'
        verbose_name_plural = 'Avaliações'
        ordering = ['-date']

    def save(self, *args, **kwargs):
        self.overall = calculate_overall(self)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'Avaliação de {self.player} em {self.date}'


class EvaluationHistory(models.Model):
    """Histórico de alterações em avaliações."""
    evaluation = models.ForeignKey(
        Evaluation, on_delete=models.CASCADE,
        related_name='history', verbose_name='Avaliação'
    )
    changed_by = models.ForeignKey(
        'core.User', on_delete=models.SET_NULL, null=True,
        verbose_name='Alterado por'
    )
    changed_at = models.DateTimeField(auto_now_add=True, verbose_name='Alterado em')
    previous_data = models.JSONField(verbose_name='Dados anteriores')
    new_data = models.JSONField(verbose_name='Dados novos')

    class Meta:
        verbose_name = 'Histórico de avaliação'
        verbose_name_plural = 'Histórico de avaliações'
        ordering = ['-changed_at']
