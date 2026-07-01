from rest_framework import serializers
from .models import GameLog


class GameLogSerializer(serializers.ModelSerializer):
    # برای نمایش خواناتر نوع لاگ
    log_type_display = serializers.CharField(source='get_log_type_display', read_only=True)

    class Meta:
        model = GameLog
        fields = ['id', 'log_type', 'log_type_display', 'description', 'created_at']


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.email', read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'sender_name', 'subject', 'body', 'created_at', 'is_read']