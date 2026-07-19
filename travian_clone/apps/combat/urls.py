from django.urls import path
from .views import (
    SendTroopsView, BarracksTrainView,
    HeroView, HeroEquipItemView,
    AnimalCatalogView, VillageAnimalBuyView,
    TroopTypeCatalogView, VillageTroopListView, TrainingQueueView,
    VillageMovementsView, AdventureListView, StartAdventureView,
    FarmListView, FarmListEntryDetailView, FarmListRunView, BlacksmithView,
    HeroAllocatePointsView, HeroSettingsView, HeroReviveView, HeroAppearanceView, HeroImageView,
    CombatReportListView, CombatReportUnreadCountView, CombatReportDetailView,
    TrappedTroopsListView, ReleaseTrappedTroopsView,
    TroopEvasionView, FarmListManageView, ReinforcementReportDetailView, ReinforcementReportListView,
)

urlpatterns = [
    path('send-troops/', SendTroopsView.as_view(), name='send_troops'),
    path('barracks/train/', BarracksTrainView.as_view(), name='train_troops'),
    path('barracks/queue/', TrainingQueueView.as_view(), name='training_queue'),
    path('troop-types/', TroopTypeCatalogView.as_view(), name='troop_type_catalog'),
    path('village-troops/', VillageTroopListView.as_view(), name='village_troops'),
    path('movements/', VillageMovementsView.as_view(), name='movements'),
    path('hero/', HeroView.as_view(), name='hero_detail'),
    path('hero/equip/', HeroEquipItemView.as_view(), name='hero_equip'),
    path('hero/adventures/', AdventureListView.as_view(), name='adventure_list'),
    path('hero/adventures/start/', StartAdventureView.as_view(), name='start_adventure'),
    path('animals/', AnimalCatalogView.as_view(), name='animal_catalog'),
    path('animals/buy/', VillageAnimalBuyView.as_view(), name='animal_buy'),
    path('farm-list/', FarmListView.as_view(), name='farm_list'),
    path('farm-list/<int:entry_id>/', FarmListEntryDetailView.as_view(), name='farm_list_entry_detail'),
    path('farm-list/run/', FarmListRunView.as_view(), name='farm_list_run'),
    path('farm-list/manage/', FarmListManageView.as_view(), name='farm_list_manage'),
    path('blacksmith/', BlacksmithView.as_view(), name='blacksmith'),
    path('hero/allocate-points/', HeroAllocatePointsView.as_view(), name='hero_allocate_points'),
    path('hero/settings/', HeroSettingsView.as_view(), name='hero_settings'),
    path('hero/revive/', HeroReviveView.as_view(), name='hero_revive'),
    path('hero/appearance/', HeroAppearanceView.as_view(), name='hero_appearance'),
    path('hero/image/', HeroImageView.as_view(), name='hero_image'),
    path('reports/', CombatReportListView.as_view(), name='combat_reports'),  # âœ… Ø¬Ø¯ÛŒØ¯
    path('reports/unread-count/', CombatReportUnreadCountView.as_view(), name='combat_reports_unread'),  # âœ… Ø¬Ø¯ÛŒØ¯
    path('reports/<int:report_id>/', CombatReportDetailView.as_view(), name='combat_report_detail'),  # âœ… Ø¬Ø¯ÛŒØ¯
    path('trapped-troops/', TrappedTroopsListView.as_view(), name='trapped_troops'),  # âœ… Ø¬Ø¯ÛŒØ¯
    path('trapped-troops/<int:entry_id>/release/', ReleaseTrappedTroopsView.as_view(), name='release_trapped_troops'),
    path('troop-evasion/', TroopEvasionView.as_view(), name='troop_evasion'),
    path('reports/reinforcements/', ReinforcementReportListView.as_view(), name='reinforcement_reports'),
    path('reports/reinforcements/<int:report_id>/', ReinforcementReportDetailView.as_view(), name='reinforcement_report_detail'),
]
