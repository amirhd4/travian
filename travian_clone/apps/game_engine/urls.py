from django.urls import path
from .views import (
    UpgradeBuildingView, PaymentWebhookView, GameLogListView, LeaderboardView, MarketplaceView,
    InboxView, MessageReadView, EmbassyView, VillageListView, VillageDetailView, WorldMapView,
    FoundVillageView,
)

urlpatterns = [
    path('villages/', VillageListView.as_view(), name='village_list'),
    path('villages/<int:village_id>/', VillageDetailView.as_view(), name='village_detail'),
    path('world-map/', WorldMapView.as_view(), name='world_map'),
    path('found-village/', FoundVillageView.as_view(), name='found_village'),
    path('upgrade-building/', UpgradeBuildingView.as_view(), name='upgrade_building'),
    path('webhook/', PaymentWebhookView.as_view()),
    path('logs/', GameLogListView.as_view(), name='game_logs'),
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
    path('marketplace/send/', MarketplaceView.as_view(), name='send_resources'),
    path('messages/', InboxView.as_view(), name='inbox'),
    path('messages/<int:pk>/read/', MessageReadView.as_view(), name='read_message'),
    path('embassy/', EmbassyView.as_view(), name='embassy'),
]