from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.authentication.urls')),
    path('api/game/', include('apps.game_engine.urls')),
    path('api/ww/', include('apps.world_wonder.urls')),
    path('api/combat/', include('apps.combat.urls')),
]