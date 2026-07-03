import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "travian_core.settings")

from django.core.asgi import get_asgi_application

# اول Django را کامل initialize کن
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from .middleware import JWTAuthMiddleware
from .routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddleware(
        URLRouter(
            websocket_urlpatterns
        )
    ),
})