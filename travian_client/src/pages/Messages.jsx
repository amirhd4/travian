import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';

export default function Messages() {
    const [activeTab, setActiveTab] = useState('inbox');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState(null);

    // فرم ارسال پیام
    const [receiverId, setReceiverId] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const response = await api.get('game/messages/');
            setMessages(response.data);
        } catch (error) {
            console.error("خطا در دریافت پیام‌ها", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'inbox') {
            fetchMessages();
            setSelectedMessage(null); // بستن پیام باز شده هنگام تغییر تب
        }
    }, [activeTab]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('game/messages/', {
                receiver_id: receiverId,
                subject: subject,
                body: body
            });
            alert(response.data.message);
            setReceiverId(''); setSubject(''); setBody('');
            setActiveTab('inbox');
        } catch (error) {
            alert(error.response?.data?.error || "خطا در ارسال پیام");
        }
    };

    const handleReadMessage = async (msg) => {
        setSelectedMessage(msg);
        if (!msg.is_read) {
            try {
                await api.post(`game/messages/${msg.id}/read/`);
                // آپدیت کردن وضعیت استیت پیام‌ها
                setMessages(messages.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
            } catch (error) {
                console.error("خطا در تغییر وضعیت پیام", error);
            }
        }
    };

    return (
        <div className="w-full min-h-screen bg-stone-200 pt-28 flex flex-col items-center pb-10">
            <ResourceBar />
            <Navbar />

            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-300 max-w-3xl w-full">
                <div className="flex gap-4 mb-6 border-b-2 border-gray-200 pb-2">
                    <button
                        onClick={() => setActiveTab('inbox')}
                        className={`text-lg font-bold px-4 py-2 rounded-t-lg transition ${activeTab === 'inbox' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        📥 صندوق ورودی
                    </button>
                    <button
                        onClick={() => setActiveTab('compose')}
                        className={`text-lg font-bold px-4 py-2 rounded-t-lg transition ${activeTab === 'compose' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        ✍️ نوشتن پیام
                    </button>
                </div>

                {/* تب صندوق ورودی */}
                {activeTab === 'inbox' && !selectedMessage && (
                    <div>
                        {loading ? <p className="text-center py-4">در حال بارگذاری نامه‌ها...</p> :
                         messages.length === 0 ? <p className="text-center text-gray-500 py-4">صندوق ورودی شما خالی است.</p> : (
                            <table className="w-full text-right border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 text-gray-700">
                                        <th className="p-3 border">وضعیت</th>
                                        <th className="p-3 border">موضوع</th>
                                        <th className="p-3 border">فرستنده</th>
                                        <th className="p-3 border text-left">تاریخ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {messages.map((msg) => (
                                        <tr
                                            key={msg.id}
                                            onClick={() => handleReadMessage(msg)}
                                            className={`cursor-pointer transition border-b ${msg.is_read ? 'bg-white hover:bg-gray-50 text-gray-600' : 'bg-amber-50 hover:bg-amber-100 font-bold text-black'}`}
                                        >
                                            <td className="p-3 text-center">{msg.is_read ? '📖' : '💌'}</td>
                                            <td className="p-3">{msg.subject}</td>
                                            <td className="p-3 text-sm text-blue-700">{msg.sender_name}</td>
                                            <td className="p-3 text-xs text-left" dir="ltr">
                                                {new Date(msg.created_at).toLocaleString('fa-IR')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* نمایش جزئیات یک پیام خاص */}
                {activeTab === 'inbox' && selectedMessage && (
                    <div className="bg-gray-50 p-6 rounded border">
                        <button onClick={() => setSelectedMessage(null)} className="text-blue-600 hover:underline mb-4 text-sm">
                            🔙 بازگشت به لیست
                        </button>
                        <h3 className="text-xl font-bold mb-2">{selectedMessage.subject}</h3>
                        <p className="text-sm text-gray-500 mb-6 border-b pb-2">فرستنده: {selectedMessage.sender_name}</p>
                        <div className="whitespace-pre-wrap leading-relaxed text-gray-800">
                            {selectedMessage.body}
                        </div>
                    </div>
                )}

                {/* تب ارسال پیام */}
                {activeTab === 'compose' && (
                    <form onSubmit={handleSendMessage} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">شناسه گیرنده:</label>
                            <input
                                type="number" required
                                className="w-full p-2 border rounded focus:border-amber-500 outline-none"
                                value={receiverId} onChange={(e) => setReceiverId(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">موضوع:</label>
                            <input
                                type="text" required
                                className="w-full p-2 border rounded focus:border-amber-500 outline-none"
                                value={subject} onChange={(e) => setSubject(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">متن پیام:</label>
                            <textarea
                                required rows="6"
                                className="w-full p-2 border rounded focus:border-amber-500 outline-none resize-y"
                                value={body} onChange={(e) => setBody(e.target.value)}
                            ></textarea>
                        </div>
                        <button type="submit" className="bg-green-700 text-white px-6 py-2 rounded font-bold hover:bg-green-800 transition">
                            ارسال پیام 🕊️
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}