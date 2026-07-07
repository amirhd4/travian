from django.urls import path
from .views import (
    SendTroopsView, BarracksTrainView,
    HeroView, HeroEquipItemView,
    AnimalCatalogView, VillageAnimalBuyView,
    TroopTypeCatalogView, VillageTroopListView, TrainingQueueView,
    VillageMovementsView, AdventureListView, StartAdventureView,
    FarmListView, FarmListEntryDetailView, FarmListRunView,
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
]