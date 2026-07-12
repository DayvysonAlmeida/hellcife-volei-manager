import django_filters
from .models import Player


class PlayerFilter(django_filters.FilterSet):
    main_position = django_filters.MultipleChoiceFilter(choices=Player.POSITION_CHOICES)
    status = django_filters.MultipleChoiceFilter(choices=Player.STATUS_CHOICES)
    min_overall = django_filters.NumberFilter(method='filter_min_overall')
    max_overall = django_filters.NumberFilter(method='filter_max_overall')

    class Meta:
        model = Player
        fields = ['main_position', 'status', 'dominant_hand', 'is_guest']

    def filter_min_overall(self, queryset, name, value):
        ids = []
        for p in queryset:
            if p.latest_overall is not None and p.latest_overall >= float(value):
                ids.append(p.id)
        return queryset.filter(id__in=ids)

    def filter_max_overall(self, queryset, name, value):
        ids = []
        for p in queryset:
            if p.latest_overall is not None and p.latest_overall <= float(value):
                ids.append(p.id)
        return queryset.filter(id__in=ids)
