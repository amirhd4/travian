from rest_framework import serializers
from .models import GameLog, Message


class GameLogSerializer(serializers.ModelSerializer):
    log_type_display = serializers.CharField(source='get_log_type_display', read_only=True)

    class Meta:
        model = GameLog
        fields = ['id', 'log_type', 'log_type_display', 'description', 'created_at']


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.username', read_only=True)
    receiver_name = serializers.CharField(source='receiver.username', read_only=True)
    is_from_me = serializers.SerializerMethodField()
    parent_subject = serializers.CharField(source='parent_message.subject', read_only=True, default=None)
    parent_body = serializers.CharField(source='parent_message.body', read_only=True, default=None)
    parent_sender_name = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'sender', 'receiver', 'sender_name', 'receiver_name',
            'subject', 'body', 'created_at', 'is_read',
            'is_deleted_sender', 'is_deleted_receiver',
            'parent_message', 'parent_subject', 'parent_body', 'parent_sender_name',
            'is_from_me',
        ]
        read_only_fields = ['sender', 'created_at', 'is_read', 'is_deleted_sender', 'is_deleted_receiver']

    def get_is_from_me(self, obj):
        request = self.context.get('request')
        return request.user.id == obj.sender_id if request else False

    def get_parent_sender_name(self, obj):
        if obj.parent_message:
            return obj.parent_message.sender.username
        return None


class UsernameSearchSerializer(serializers.ModelSerializer):
    class Meta:
        model = None
        fields = ['id', 'username']


def get_username_search_serializer():
    from django.contrib.auth import get_user_model
    Player = get_user_model()

    class _Serializer(serializers.ModelSerializer):
        class Meta:
            model = Player
            fields = ['id', 'username']

    return _Serializer
