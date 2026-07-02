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
            }
        }


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={'input_type': 'password'}
    )

    class Meta:
        model = Player
        fields = (
            "username",
            "email",
            "phone_number",
            "password",
            "tribe",
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

    def create(self, validated_data):
        return Player.objects.create_user(**validated_data)