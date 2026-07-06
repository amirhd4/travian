from django.urls import path
from .views import (
    SendTroopsView, BarracksTrainView,
    HeroView, HeroEquipItemView,
    AnimalCatalogView, VillageAnimalBuyView,
    TroopTypeCatalogView, VillageTroopListView, TrainingQueueView,
)

urlpatterns = [
    path('send-troops/', SendTroopsView.as_view(), name='send_troops'),
    path('barracks/train/', BarracksTrainView.as_view(), name='train_troops'),
    path('barracks/queue/', TrainingQueueView.as_view(), name='training_queue'),
    path('troop-types/', TroopTypeCatalogView.as_view(), name='troop_type_catalog'),
    path('village-troops/', VillageTroopListView.as_view(), name='village_troops'),
    path('hero/', HeroView.as_view(), name='hero_detail'),
    path('hero/equip/', HeroEquipItemView.as_view(), name='hero_equip'),
    path('animals/', AnimalCatalogView.as_view(), name='animal_catalog'),
    path('animals/buy/', VillageAnimalBuyView.as_view(), name='animal_buy'),
]