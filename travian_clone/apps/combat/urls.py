from django.urls import path
from .views import SendTroopsView

urlpatterns = [
    path('send-troops/', SendTroopsView.as_view(), name='send_troops'),
]