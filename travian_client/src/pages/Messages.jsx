import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import PageShell from '../components/PageShell';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import { AlertModal } from '../components/Modal';

const TABS = [
    { key: 'inbox', label: '📥 صندوق ورودی' },
    { key: 'compose', label: '✍️ نوشتن پیام' },
];

export default function Messages() {
    const [activeTab, setActiveTab] = useState('inbox');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState(null);

    const [receiverId, setReceiverId] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [alertMsg, setAlertMsg] = useState(null);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const response = await api.get('game/messages/');
            setMessages(response.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'inbox') { fetchMessages(); setSelectedMessage(null); }
    }, [activeTab]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('game/messages/', { receiver_id: receiverId, subject, body });
            setAlertMsg({ tone: 'success', text: response.data.message });
            setReceiverId(''); setSubject(''); setBody('');
            setActiveTab('inbox');
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || "خطا در ارسال پیام" });
        }
    };

    const handleReadMessage = async (msg) => {
        setSelectedMessage(msg);
        if (!msg.is_read) {
            try {
                await api.post(`game/messages/${msg.id}/read/`);
                setMessages(messages.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
            } catch (error) {
                console.error(error);
            }
        }
    };

    return (
        <PageShell maxWidth="max-w-3xl">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="پیام‌ها" />

            <div className="panel overflow-hidden">
                <div className="flex border-b border-parchment-300">
                    {TABS.map((tab) => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 py-3 text-sm font-bold transition ${activeTab === tab.key ? 'bg-gold-500 text-ink-900' : 'bg-parchment-100 text-ink-600 hover:bg-parchment-200'}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="panel-body">
                    {activeTab === 'inbox' && !selectedMessage && (
                        loading ? <LoadingState label="در حال بارگذاری نامه‌ها..." /> :
                        messages.length === 0 ? <EmptyState icon="📪" title="صندوق ورودی شما خالی است." /> : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-right border-collapse">
                                    <thead>
                                        <tr className="bg-parchment-100 text-ink-700 text-sm">
                                            <th className="p-3 rounded-r-lg">وضعیت</th>
                                            <th className="p-3">موضوع</th>
                                            <th className="p-3">فرستنده</th>
                                            <th className="p-3 text-left rounded-l-lg">تاریخ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {messages.map((msg) => (
                                            <tr key={msg.id} onClick={() => handleReadMessage(msg)}
                                                className={`cursor-pointer transition border-b border-parchment-200 ${msg.is_read ? 'hover:bg-parchment-50 text-ink-600' : 'bg-gold-50 hover:bg-gold-100 font-bold text-ink-900'}`}>
                                                <td className="p-3 text-center">{msg.is_read ? '📖' : '💌'}</td>
                                                <td className="p-3">{msg.subject}</td>
                                                <td className="p-3 text-sm text-blue-700">{msg.sender_name}</td>
                                                <td className="p-3 text-xs text-left" dir="ltr">{new Date(msg.created_at).toLocaleString('fa-IR')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}

                    {activeTab === 'inbox' && selectedMessage && (
                        <div className="bg-parchment-100 rounded-xl border border-parchment-300 p-6">
                            <button onClick={() => setSelectedMessage(null)} className="text-blue-600 hover:underline mb-4 text-sm font-bold">
                                🔙 بازگشت به لیست
                            </button>
                            <h3 className="text-xl font-bold text-ink-800 mb-2">{selectedMessage.subject}</h3>
                            <p className="text-sm text-ink-500 mb-6 border-b border-parchment-300 pb-2">فرستنده: {selectedMessage.sender_name}</p>
                            <div className="whitespace-pre-wrap leading-relaxed text-ink-800">{selectedMessage.body}</div>
                        </div>
                    )}

                    {activeTab === 'compose' && (
                        <form onSubmit={handleSendMessage} className="space-y-4">
                            <div>
                                <label className="field-label">شناسه گیرنده</label>
                                <input type="number" required className="field" value={receiverId} onChange={(e) => setReceiverId(e.target.value)} />
                            </div>
                            <div>
                                <label className="field-label">موضوع</label>
                                <input type="text" required className="field" value={subject} onChange={(e) => setSubject(e.target.value)} />
                            </div>
                            <div>
                                <label className="field-label">متن پیام</label>
                                <textarea required rows="6" className="field resize-y" value={body} onChange={(e) => setBody(e.target.value)} />
                            </div>
                            <button type="submit" className="btn-primary">ارسال پیام 🕊️</button>
                        </form>
                    )}
                </div>
            </div>
        </PageShell>
    );
}