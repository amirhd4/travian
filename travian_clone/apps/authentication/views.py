from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings

from .serializers import RegisterSerializer, MyTokenObtainPairSerializer
from .cookies import set_refresh_cookie, clear_refresh_cookie
from .captcha import generate_captcha
from .throttles import LoginIPThrottle, LoginUsernameThrottle, RegisterIPThrottle, CaptchaIPThrottle


class RegisterView(APIView):
    throttle_classes = [RegisterIPThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save()
            return Response({"message": "OK"}, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MyTokenView(TokenObtainPairView):
    """
    لاگین: access token در بدنه‌ی پاسخ برمی‌گرده و refresh token به صورت
    httpOnly cookie ست می‌شه. علاوه بر throttle سطح IP، بررسی قفل حساب و
    کپچا هم داخل MyTokenObtainPairSerializer انجام می‌شه.
    """
    serializer_class = MyTokenObtainPairSerializer
    throttle_classes = [LoginIPThrottle, LoginUsernameThrottle]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        refresh_token = data.pop("refresh")

        response = Response(data, status=status.HTTP_200_OK)
        set_refresh_cookie(response, refresh_token)
        return response


class CookieTokenRefreshView(APIView):
    """
    گرفتن access token جدید با استفاده از refresh token که در httpOnly cookie
    ذخیره شده. هیچ توکنی از بدنه‌ی درخواست خونده نمی‌شه.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.AUTH_COOKIE_NAME)

        if not raw_refresh:
            return Response({"error": "نشست شما منقضی شده، دوباره وارد شوید."}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = TokenRefreshSerializer(data={"refresh": raw_refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            response = Response({"error": "نشست نامعتبر است، دوباره وارد شوید."}, status=status.HTTP_401_UNAUTHORIZED)
            clear_refresh_cookie(response)
            return response

        validated = serializer.validated_data
        response = Response({"access": validated["access"]}, status=status.HTTP_200_OK)

        # وقتی ROTATE_REFRESH_TOKENS فعاله، یک refresh token جدید هم صادر می‌شه
        new_refresh = validated.get("refresh")
        if new_refresh:
            set_refresh_cookie(response, new_refresh)

        return response


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.AUTH_COOKIE_NAME)

        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()
            except TokenError:
                pass  # توکن از قبل نامعتبر بوده، مشکلی نیست

        response = Response({"message": "با موفقیت خارج شدید."}, status=status.HTTP_200_OK)
        clear_refresh_cookie(response)
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "tribe": user.tribe,
            "gold_coins": user.gold_coins,
        }, status=status.HTTP_200_OK)


class CaptchaImageView(APIView):
    """تولید یک کپچای تصویری جدید (برای فرم ثبت‌نام یا ورود)."""
    permission_classes = [AllowAny]
    throttle_classes = [CaptchaIPThrottle]

    def get(self, request):
        token, image_data_url = generate_captcha()
        return Response({"token": token, "image": image_data_url})