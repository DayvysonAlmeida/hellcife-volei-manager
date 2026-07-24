import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.players.views import PlayerViewSet
from apps.core.models import User
from rest_framework.test import APIRequestFactory, force_authenticate

factory = APIRequestFactory()
request = factory.get('/api/players/')

user = User.objects.first()
force_authenticate(request, user=user)

view = PlayerViewSet.as_view({'get': 'list'})
response = view(request)

if response.status_code == 200:
    for p in response.data['results'][:20]:
        print(f"{p['name']} - Rank: {p['stats'].get('win_rank')} - Wins: {p['stats'].get('wins')}")
else:
    print('Failed:', response.status_code)
