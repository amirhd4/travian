from django.urls import path
from .views import (
    SendTroopsView, BarracksTrainView,
    HeroView, HeroEquipItemView,
    AnimalCatalogView, VillageAnimalBuyView,
)

urlpatterns = [
    path('send-troops/', SendTroopsView.as_view(), name='send_troops'),
    path('barracks/train/', BarracksTrainView.as_view(), name='train_troops'),
    path('hero/', HeroView.as_view(), name='hero_detail'),
    path('hero/equip/', HeroEquipItemView.as_view(), name='hero_equip'),
    path('animals/', AnimalCatalogView.as_view(), name='animal_catalog'),
    path('animals/buy/', VillageAnimalBuyView.as_view(), name='animal_buy'),
]