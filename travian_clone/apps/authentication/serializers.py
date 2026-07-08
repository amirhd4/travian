from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate

from .models import Player


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        login = attrs.get("username")
        password = attrs.get("password")

        user = authenticate(username=login, password=password)

        if not user:
            raise serializers.ValidationError("ایمیل، نام کاربری یا رمز عبور اشتباه است.")

        refresh = self.get_token(user)

        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "tribe": user.tribe,
                "gold_coins": user.gold_coins,
            }
        }


from .captcha import verify_captcha


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={'input_type': 'password'}
    )
    phone_number = serializers.CharField(required=True, max_length=15)

    # فیلدهای غیرمدلی مخصوص فرآیند ثبت‌نام
    starting_location = serializers.ChoiceField(
        choices=['RANDOM', 'NE', 'NW', 'SE', 'SW'],
        default='RANDOM',
        write_only=True,
    )
    accept_terms = serializers.BooleanField(write_only=True)
    captcha_token = serializers.CharField(write_only=True)
    captcha_answer = serializers.CharField(write_only=True)

    class Meta:
        model = Player
        fields = (
            "username",
            "email",
            "phone_number",
            "password",
            "tribe",
            "starting_location",
            "accept_terms",
            "captcha_token",
            "captcha_answer",
        )

    def validate_username(self, value):
        if Player.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("این نام کاربری قبلاً ثبت شده است.")
        return value

    def validate_email(self, value):
        if Player.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("این ایمیل قبلاً ثبت شده است.")
        return value

    def validate_phone_number(self, value):
        if value and Player.objects.filter(phone_number=value).exists():
            raise serializers.ValidationError("این شماره قبلاً ثبت شده است.")
        return value

    def validate_accept_terms(self, value):
        if not value:
            raise serializers.ValidationError("برای ثبت‌نام باید قوانین بازی را بپذیرید.")
        return value

    def validate(self, attrs):
        token = attrs.get('captcha_token')
        answer = attrs.get('captcha_answer')
        if not verify_captcha(token, answer):
            raise serializers.ValidationError({"captcha_answer": "کد امنیتی وارد شده صحیح نیست یا منقضی شده است."})
        return attrs

    def create(self, validated_data):
        starting_location = validated_data.pop('starting_location', 'RANDOM')
        validated_data.pop('accept_terms', None)
        validated_data.pop('captcha_token', None)
        validated_data.pop('captcha_answer', None)
        return Player.objects.create_user(starting_quadrant=starting_location, **validated_data)