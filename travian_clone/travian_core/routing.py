from django.urls import re_path
from apps.game_engine.consumers import GameConsumer

# دیگر نیازی به پاس دادن user_id در آدرس نیست
websocket_urlpatterns = [
    re_path(r'ws/game/$', GameConsumer.as_asgi()),
]