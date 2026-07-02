import json
from channels.generic.websocket import AsyncWebsocketConsumer

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')

        # فقط در صورتی که توکن معتبر بود و کاربر پیدا شد اجازه اتصال بده
        if user and user.is_authenticated:
            self.user_id = user.id
            self.room_group_name = f'player_{self.user_id}'

            # عضویت کاربر در گروه اختصاصی خودش
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            await self.accept()
        else:
            # توکن نامعتبر است یا وجود ندارد؛ اتصال را قطع کن
            await self.close(code=4001)

    async def disconnect(self, close_code):
        # بررسی می‌کنیم که آیا اصلاً گروهی برای این کلاینت ثبت شده بود یا نه
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def send_game_update(self, event):
        await self.send(text_data=json.dumps({
            'type': event['update_type'],
            'data': event['payload']
        }))