import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import PageShell from '../components/PageShell';
import LoadingState from '../components/LoadingState';

export default function AdminMessages() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [replyBody, setReplyBody] = useState('');
    const [filterPlayerId, setFilterPlayerId] = useState('');

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const url = filterPlayerId
                ? `game/messages/admin-all/?player_id=${filterPlayerId}`
                : 'game/messages/admin-all/';
            const { data } = await api.get(url);
            setMessages(data);
        } catch (err) {
            if (err.response?.status === 403) navigate('/messages');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchMessages(); }, [filterPlayerId]);

    const handleReadMessage = async (msg) => {
        setSelectedMessage(msg);
        if (!msg.is_read) {
            try { await api.post(`game/messages/${msg.id}/read/`); } catch { /* silent */ }
        }
    };

    const handleReply = async (e) => {
        e.preventDefault();
        if (!selectedMessage || !replyBody.trim()) return;
        try {
            await api.post('game/messages/', {
                receiver_username: selectedMessage.sender_name,
                subject: selectedMessage.subject.startsWith('Re:') ? selectedMessage.subject : `Re: ${selectedMessage.subject}`,
                body: replyBody,
                parent_message: selectedMessage.id,
            });
            setReplyBody('');
            setSelectedMessage(null);
            fetchMessages();
        } catch (err) {
            alert(err.response?.data?.error || 'خطا در ارسال پاسخ');
        }
    };

    return (
        <PageShell maxWidth="max-w-5xl">
            <div className="panel">
                <div className="panel-body">
                    <h2 className="text-lg font-bold text-ink-800 mb-4">مدیریت پیام‌ها (پنل ادمین)</h2>

                    <div className="mb-4 flex gap-3 items-center">
                        <label className="text-sm font-bold">فیلتر بر اساس شناسه بازیکن:</label>
                        <input type="number" className="field" style={{ width: '120px' }}
                            value={filterPlayerId} onChange={e => setFilterPlayerId(e.target.value)} placeholder="ID" />
                        <button onClick={fetchMessages} className="btn-primary text-sm">جستجو</button>
                    </div>

                    {loading ? <LoadingState label="در حال بارگذاری..." /> : (
                        <table className="w-full text-right border-collapse text-sm">
                            <thead>
                                <tr className="bg-parchment-200">
                                    <th className="p-2">شناسه</th>
                                    <th className="p-2">فرستنده</th>
                                    <th className="p-2">گیرنده</th>
                                    <th className="p-2">موضوع</th>
                                    <th className="p-2">تاریخ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {messages.map(msg => (
                                    <tr key={msg.id} onClick={() => handleReadMessage(msg)}
                                        className="cursor-pointer hover:bg-parchment-100 border-b border-parchment-200">
                                        <td className="p-2">{msg.id}</td>
                                        <td className="p-2 text-blue-700">{msg.sender_name}</td>
                                        <td className="p-2 text-blue-700">{msg.receiver_name}</td>
                                        <td className="p-2">{msg.subject}</td>
                                        <td className="p-2" dir="ltr">{new Date(msg.created_at).toLocaleString('fa-IR')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {selectedMessage && (
                        <div className="mt-4 bg-parchment-100 rounded border border-parchment-300 p-4">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-ink-800">{selectedMessage.subject}</h3>
                                <button onClick={() => setSelectedMessage(null)} className="text-blue-600 text-sm hover:underline">
                                    بستن
                                </button>
                            </div>
                            <p className="text-sm text-ink-500 mb-2">
                                از: <span className="text-blue-700 font-bold">{selectedMessage.sender_name}</span> →
                                به: <span className="text-blue-700 font-bold">{selectedMessage.receiver_name}</span>
                            </p>
                            <div className="whitespace-pre-wrap text-ink-800 mb-4">{selectedMessage.body}</div>

                            <form onSubmit={handleReply} className="flex gap-2">
                                <textarea className="field flex-1" rows="2" placeholder="پاسخ..."
                                    value={replyBody} onChange={e => setReplyBody(e.target.value)} required />
                                <button type="submit" className="btn-primary">ارسال پاسخ</button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </PageShell>
    );
}
