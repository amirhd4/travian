from django.urls import path

from .views import RegisterView, MeView, MyTokenView, CookieTokenRefreshView, LogoutView

urlpatterns = [
    path("register/", RegisterView.as_view()),
    path("login/", MyTokenView.as_view()),
    path("me/", MeView.as_view()),
    path("token/refresh/", CookieTokenRefreshView.as_view()),
    path("logout/", LogoutView.as_view()),
]