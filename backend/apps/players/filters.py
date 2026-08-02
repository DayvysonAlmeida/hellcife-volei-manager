import django_filters
from django.db.models import Subquery, OuterRef, FloatField
from django.db.models.functions import Coalesce
from .models import Player
from apps.evaluations.models import Evaluation


def _latest_overall_subquery():
    return Subquery(
        Evaluation.objects.filter(
            player=OuterRef('pk')
        ).order_by('-date', '-id').values('overall')[:1],
        output_field=FloatField()
    )


class PlayerFilter(django_filters.FilterSet):
    main_position = django_filters.MultipleChoiceFilter(choices=Player.POSITION_CHOICES)
    status = django_filters.MultipleChoiceFilter(choices=Player.STATUS_CHOICES)
    min_overall = django_filters.NumberFilter(method='filter_min_overall')
    max_overall = django_filters.NumberFilter(method='filter_max_overall')

    class Meta:
        model = Player
        fields = ['main_position', 'status', 'dominant_hand', 'is_guest']

    def filter_min_overall(self, queryset, name, value):
        return queryset.annotate(
            _overall=Coalesce(_latest_overall_subquery(), 0.0)
        ).filter(_overall__gte=float(value))

    def filter_max_overall(self, queryset, name, value):
        return queryset.annotate(
            _overall=Coalesce(_latest_overall_subquery(), 0.0)
        ).filter(_overall__lte=float(value))

