import json
from channels.generic.websocket import AsyncWebsocketConsumer

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        # اگر کاربر لاگین نکرده بود اتصال قطع می‌شود
        if self.user.is_anonymous:
            await self.close()
        else:
            # ساخت یک اتاق اختصاصی برای هر کاربر بر اساس ID
            self.room_group_name = f"player_{self.user.id}"
            await self.channel_layer.group_add(self.room_group_name, self.channel_name)
            await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    # تابعی برای ارسال دیتا از طرف بک‌اند به فرانت‌اند
    async def send_game_update(self, event):
        message = event['message']
        await self.send(text_data=json.dumps(message))