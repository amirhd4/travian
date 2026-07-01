import json
from channels.generic.websocket import AsyncWebsocketConsumer

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # بررسی احراز هویت اولیه (می‌توان توکن را از کوئری‌استرینگ خواند)
        self.user_id = self.scope['url_route']['kwargs'].get('user_id', 'global')
        self.room_group_name = f'player_{self.user_id}'

        # عضویت کاربر در گروه اختصاصی خودش برای دریافت نوتیفیکیشن‌ها
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # متد دریافت پیام از تک‌های سلری و ارسال آن به فرانت‌اند
    async def send_game_update(self, event):
        await self.send(text_data=json.dumps({
            'type': event['update_type'],
            'data': event['payload']
        }))