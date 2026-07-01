from django.urls import path
from .views import SimpleRegisterView, LoginView

urlpatterns = [
    path('register/', SimpleRegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
]