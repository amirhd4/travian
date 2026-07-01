from django.urls import path
from .views import UpgradeWWView

urlpatterns = [
    path('upgrade/', UpgradeWWView.as_view(), name='upgrade_ww'),
]