from django.urls import path

from .views import (
    UpgradeBuildingView, PaymentWebhookView, GameLogListView, LeaderboardView, MarketplaceView,
    InboxView, MessageReadView, EmbassyView, VillageListView, VillageDetailView, WorldMapView,
    FoundVillageView, VillageBuildingsView, ServerStatusView, QuestListView, ClaimQuestRewardView,
    GoldPackageListView, CreatePaymentRequestView, MockCompletePaymentView, BuyPlusView,
    FarmVillagesListView,
    CulturePointsView, VillageRenameView, NpcTradeView, OasisMapView, OasisAttackView,
    OasisReleaseView, VillagesOverviewView,
    ArtifactListView,
    LatestDailyMedalsView, MyMedalsView, ToggleMedalVisibilityView, PlayerPublicMedalsView,  # ✅ جدید
    HeroAuctionListView, HeroAuctionBidView, GoldBankDepositView, GoldBankWithdrawView, MyGoldBankDepositsView
)

urlpatterns = [
    path('villages/', VillageListView.as_view(), name='village_list'),
    path('villages/<int:village_id>/', VillageDetailView.as_view(), name='village_detail'),
    path('villages/<int:village_id>/buildings/', VillageBuildingsView.as_view(), name='village_buildings'),
    path('villages/rename/', VillageRenameView.as_view(), name='village_rename'),  # ✅ جدید
    path('world-map/', WorldMapView.as_view(), name='world_map'),
    path('oases/', OasisMapView.as_view(), name='oasis_map'),  # ✅ جدید
    path('oases/attack/', OasisAttackView.as_view(), name='oasis_attack'),  # ✅ جدید
    path('farm-villages/', FarmVillagesListView.as_view(), name='farm_villages'),
    path('found-village/', FoundVillageView.as_view(), name='found_village'),
    path('culture-points/', CulturePointsView.as_view(), name='culture_points'),  # ✅ جدید
    path('npc-trade/', NpcTradeView.as_view(), name='npc_trade'),  # ✅ جدید
    path('upgrade-building/', UpgradeBuildingView.as_view(), name='upgrade_building'),
    path('webhook/', PaymentWebhookView.as_view()),
    path('logs/', GameLogListView.as_view(), name='game_logs'),
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
    path('marketplace/send/', MarketplaceView.as_view(), name='send_resources'),
    path('messages/', InboxView.as_view(), name='inbox'),
    path('messages/<int:pk>/read/', MessageReadView.as_view(), name='read_message'),
    path('embassy/', EmbassyView.as_view(), name='embassy'),
    path('server-status/', ServerStatusView.as_view(), name='server_status'),
    path('quests/', QuestListView.as_view(), name='quest_list'),
    path('quests/claim/', ClaimQuestRewardView.as_view(), name='claim_quest_reward'),
    path('gold-packages/', GoldPackageListView.as_view(), name='gold_packages'),
    path('payment/create/', CreatePaymentRequestView.as_view(), name='create_payment'),
    path('payment/mock-complete/', MockCompletePaymentView.as_view(), name='mock_complete_payment'),
    path('plus/', BuyPlusView.as_view(), name='plus'),
    path('villages-overview/', VillagesOverviewView.as_view(), name='villages_overview'),
    path('hero/auction/', HeroAuctionListView.as_view(), name='hero_auction_list'),
    path('hero/auction/bid/', HeroAuctionBidView.as_view(), name='hero_auction_bid'),
    path('oases/release/', OasisReleaseView.as_view(), name='oasis_release'),
    path('artifacts/', ArtifactListView.as_view(), name='artifact_list'),
    path('artifacts/', ArtifactListView.as_view(), name='artifact_list'),
    path('medals/daily-latest/', LatestDailyMedalsView.as_view(), name='latest_daily_medals'),
    path('medals/mine/', MyMedalsView.as_view(), name='my_medals'),
    path('medals/toggle/', ToggleMedalVisibilityView.as_view(), name='toggle_medal'),
    path('medals/player/<int:player_id>/', PlayerPublicMedalsView.as_view(), name='player_medals'),
    path('gold-bank/deposit/', GoldBankDepositView.as_view(), name='gold_bank_deposit'),
    path('gold-bank/withdraw/', GoldBankWithdrawView.as_view(), name='gold_bank_withdraw'),
    path('gold-bank/mine/', MyGoldBankDepositsView.as_view(), name='gold_bank_mine'),
]