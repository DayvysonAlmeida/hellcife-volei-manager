import re

import django_filters
from django.db.models import Q, Subquery, OuterRef, FloatField
from django.db.models.functions import Coalesce
from .identity import canonical_phone, only_digits, plain_name
from .models import Player
from apps.core.permissions import is_staff_profile
from apps.evaluations.models import Evaluation

PHONE_LIKE = re.compile(r'^[\d\s()+\-.]+$')  # "(81) 99999-1234", "+55 81 9..."


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
    # "Dados incompletos": sem CPF ou sem WhatsApp (a staff completa quem não tem conta no app)
    incomplete = django_filters.BooleanFilter(method='filter_incomplete')
    has_account = django_filters.BooleanFilter(method='filter_has_account')
    search = django_filters.CharFilter(method='filter_search')

    class Meta:
        model = Player
        fields = ['main_position', 'status', 'dominant_hand', 'is_guest', 'gender']

    def filter_has_account(self, queryset, name, value):
        return queryset.filter(user__isnull=not value)

    def filter_search(self, queryset, name, value):
        """
        Sem acento e sem maiúsculas; cada palavra precisa aparecer em algum campo.
        Todos: nome social, apelido e quem convidou. Staff: também nome civil, e-mail e WhatsApp.
        Número: até 3 dígitos é a camisa exata ("12" ou "#12"); 4 ou mais, o WhatsApp (só a staff).
        Compara no Python (como o phone_owner): igual no SQLite e no Postgres, sem extensão no banco.
        """
        value = value.strip()
        if PHONE_LIKE.match(value) and len(only_digits(value)) >= 4:
            terms = [canonical_phone(value)]  # WhatsApp escrito de qualquer jeito vira um termo só
        else:
            terms = plain_name(value).split()
        if not terms:
            return queryset

        staff = is_staff_profile(getattr(self.request, 'user', None))
        text_fields = ['name', 'nickname', 'invited_by'] + (['legal_name', 'user__email'] if staff else [])

        def matches(row, term):
            number = term.lstrip('#')
            if number.isdigit() and len(number) <= 3:
                return row['shirt_number'] is not None and str(row['shirt_number']) == str(int(number))
            if number.isdigit():
                return staff and number in canonical_phone(row['phone'])
            return any(term in plain_name(row[field]) for field in text_fields)

        rows = Player.objects.values('id', 'shirt_number', 'phone', *text_fields)
        ids = [row['id'] for row in rows if all(matches(row, term) for term in terms)]
        return queryset.filter(pk__in=ids)

    def filter_incomplete(self, queryset, name, value):
        missing = Q(cpf_hash__isnull=True) | Q(phone__isnull=True) | Q(phone='')
        queryset = queryset.filter(is_guest=False)
        return queryset.filter(missing) if value else queryset.exclude(missing)

    def filter_min_overall(self, queryset, name, value):
        return queryset.annotate(
            _overall=Coalesce(_latest_overall_subquery(), 0.0)
        ).filter(_overall__gte=float(value))

    def filter_max_overall(self, queryset, name, value):
        return queryset.annotate(
            _overall=Coalesce(_latest_overall_subquery(), 0.0)
        ).filter(_overall__lte=float(value))

