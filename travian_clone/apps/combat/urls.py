from django.urls import path
from .views import SendTroopsView, BarracksTrainView

urlpatterns = [
    path('send-troops/', SendTroopsView.as_view(), name='send_troops'),
    path('barracks/train/', BarracksTrainView.as_view(), name='train_troops'),
]