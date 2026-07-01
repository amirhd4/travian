from django.urls import re_path
from apps.game_engine.consumers import GameConsumer

websocket_urlpatterns = [
    re_path(r'ws/game/(?P<user_id>\w+)/$', GameConsumer.as_asgi()),
]