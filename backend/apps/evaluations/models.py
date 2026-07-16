from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
def calculate_overall(evaluation):
    """Calcula o overall como média simples dos 13 fundamentos."""
    fields = [
        evaluation.serve, evaluation.reception, evaluation.passing,
        evaluation.setting, evaluation.attack, evaluation.block,
        evaluation.defense, evaluation.recovery, evaluation.positioning,
        evaluation.communication, evaluation.tactical_iq,
        evaluation.conditioning, evaluation.consistency,
    ]
    return round(sum(fields) / len(fields), 2)


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
