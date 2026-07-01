from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from .models import Player


class SimpleRegisterView(APIView):
    def post(self, request):
        email = request.data.get('email')
        phone = request.data.get('phone')
        password = request.data.get('password')
        tribe = request.data.get('tribe')
        username = request.data.get('username')

        if email and Player.objects.filter(email=email).exists():
            return Response({"error": "این ایمیل قبلا ثبت شده است"}, status=400)

        user = Player.objects.create_user(
            username=username,
            email=email,
            phone_number=phone,
            password=password,
            tribe=tribe
        )
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"message": "ثبت‌نام موفقیت‌آمیز بود"})


class LoginView(APIView):
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        # از آنجایی که در مدل Player، فیلد USERNAME_FIELD را email قرار دادیم:
        user = authenticate(request, username=email, password=password)

        if user is not None:
            token, created = Token.objects.get_or_create(user=user)
            return Response({"token": token.key, "message": "ورود موفقیت آمیز بود"})
        else:
            return Response({"error": "ایمیل یا رمز عبور اشتباه است"}, status=400)