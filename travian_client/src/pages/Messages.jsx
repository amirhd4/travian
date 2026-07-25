import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axiosConfig';
import PageShell from '../components/PageShell';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import { AlertModal, ConfirmModal } from '../components/Modal';

const TABS = [
    { key: 'inbox', label: 'صندوق ورودی', image: '/assets/ui/friends-icon.gif' },
    { key: 'sent', label: 'پیام‌های ارسالی', image: '/assets/ui/car-icon.gif' },
    { key: 'compose', label: 'نوشتن پیام', image: '/assets/ui/bb-buttons.png' },
];

export default function Messages() {
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'inbox');
    const [messages, setMessages] = useState([]);
    const [sentMessages, setSentMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState(null);

    const [receiverUsername, setReceiverUsername] = useState(searchParams.get('to') || '');
    const [subject, setSubject] = useState(searchParams.get('subject') || '');
    const [body, setBody] = useState('');
    const [usernameSuggestions, setUsernameSuggestions] = useState([]);

    const [alertMsg, setAlertMsg] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const [offset, setOffset] = useState(0);
    const LIMIT = 15;

    const fetchMessages = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`game/messages/?offset=${offset}&limit=${LIMIT}`);
            setMessages(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [offset]);

    const fetchSentMessages = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`game/messages/sent/?offset=${offset}&limit=${LIMIT}`);
            setSentMessages(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [offset]);

    useEffect(() => {
        setOffset(0);
        setSelectedMessage(null);
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'inbox') fetchMessages();
        if (activeTab === 'sent') fetchSentMessages();
    }, [activeTab, offset, fetchMessages, fetchSentMessages]);

    const searchUsernames = async (q) => {
        if (q.length < 2) { setUsernameSuggestions([]); return; }
        try {
            const { data } = await api.get(`game/messages/username-search/?q=${encodeURIComponent(q)}`);
            setUsernameSuggestions(data);
        } catch { /* silent */ }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        try {
            await api.post('game/messages/', {
                receiver_username: receiverUsername,
                subject,
                body,
            });
            setAlertMsg({ tone: 'success', text: 'پیام با موفقیت ارسال شد.' });
            setReceiverUsername('');
            setSubject('');
            setBody('');
            setActiveTab('inbox');
        } catch (err) {
            setAlertMsg({ tone: 'error', text: err.response?.data?.error || 'خطا در ارسال پیام' });
        }
    };

    const handleReply = (msg) => {
        const replyBody = `\n\n--- پیام اصلی ---\nاز: ${msg.sender_name}\nتاریخ: ${new Date(msg.created_at).toLocaleString('fa-IR')}\n\n${msg.body}`;
        setReceiverUsername(msg.sender_name);
        setSubject(msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`);
        setBody(replyBody);
        setActiveTab('compose');
        setSelectedMessage(null);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await api.post(`game/messages/${deleteTarget.id}/delete/`);
            setAlertMsg({ tone: 'success', text: 'پیام حذف شد.' });
            setDeleteTarget(null);
            setSelectedMessage(null);
            if (activeTab === 'inbox') fetchMessages();
            if (activeTab === 'sent') fetchSentMessages();
        } catch (err) {
            setAlertMsg({ tone: 'error', text: err.response?.data?.error || 'خطا در حذف پیام' });
        }
    };

    const handleReadMessage = async (msg) => {
        setSelectedMessage(msg);
        if (!msg.is_read && !msg.is_from_me) {
            try {
                await api.post(`game/messages/${msg.id}/read/`);
                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
            } catch { /* silent */ }
        }
    };

    const handleSupport = () => {
        setReceiverUsername('majditravian');
        setSubject('درخواست پشتیبانی');
        setBody('');
        setActiveTab('compose');
    };

    return (
        <PageShell maxWidth="max-w-3xl">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone}
                message={alertMsg?.text} title="پیام‌ها" />
            <ConfirmModal open={!!deleteTarget} onCancel={() => setDeleteTarget(null)}
                onConfirm={handleDelete} title="حذف پیام"
                message="آیا از حذف این پیام مطمئن هستید؟" danger confirmLabel="حذف" />

            <div className="panel overflow-hidden">
                <div className="flex border-b border-parchment-300">
                    {TABS.map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 py-3 text-sm font-bold transition flex items-center justify-center gap-1.5
                                ${activeTab === tab.key ? 'bg-gold-500 text-ink-900' : 'bg-parchment-100 text-ink-600 hover:bg-parchment-200'}`}>
                            <img src={tab.image} alt="" className="w-4 h-4" onError={e => e.target.style.display='none'} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="panel-body">
                    {activeTab === 'inbox' && !selectedMessage && (
                        loading ? <LoadingState label="در حال بارگذاری نامه‌ها..." /> :
                        messages.length === 0 ? <EmptyState icon="📪" title="صندوق ورودی شما خالی است." /> : (
                            <>
                                <div style={{ marginBottom: '8px', textAlign: 'left' }}>
                                    <button onClick={handleSupport} className="text-sm text-blue-600 hover:underline font-bold">
                                        ارسال پیام به پشتیبانی
                                    </button>
                                </div>
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
                                        {messages.map(msg => (
                                            <tr key={msg.id} onClick={() => handleReadMessage(msg)}
                                                className={`cursor-pointer transition border-b border-parchment-200
                                                    ${msg.is_read ? 'hover:bg-parchment-50 text-ink-600' : 'bg-gold-50 hover:bg-gold-100 font-bold text-ink-900'}`}>
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
                            </>
                        )
                    )}

                    {activeTab === 'inbox' && selectedMessage && (
                        <div className="bg-parchment-100 rounded-xl border border-parchment-300 p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <button onClick={() => setSelectedMessage(null)}
                                    className="text-blue-600 hover:underline text-sm font-bold">
                                    بازگشت به لیست
                                </button>
                                <button onClick={() => handleReply(selectedMessage)}
                                    className="text-sm bg-gold-500 hover:bg-gold-600 text-ink-900 font-bold px-3 py-1 rounded">
                                    پاسخ
                                </button>
                                <button onClick={() => setDeleteTarget(selectedMessage)}
                                    className="text-sm bg-red-500 hover:bg-red-600 text-white font-bold px-3 py-1 rounded">
                                    حذف
                                </button>
                            </div>
                            <h3 className="text-xl font-bold text-ink-800 mb-2">{selectedMessage.subject}</h3>
                            <p className="text-sm text-ink-500 mb-1 border-b border-parchment-300 pb-2">
                                فرستنده: <span className="text-blue-700 font-bold">{selectedMessage.sender_name}</span>
                            </p>
                            <p className="text-xs text-ink-400 mb-4" dir="ltr">
                                {new Date(selectedMessage.created_at).toLocaleString('fa-IR')}
                            </p>
                            <div className="whitespace-pre-wrap leading-relaxed text-ink-800">{selectedMessage.body}</div>
                        </div>
                    )}

                    {activeTab === 'sent' && !selectedMessage && (
                        loading ? <LoadingState label="در حال بارگذاری پیام‌های ارسالی..." /> :
                        sentMessages.length === 0 ? <EmptyState icon="📤" title="هیچ پیام ارسالی‌ای ندارید." /> : (
                            <table className="w-full text-right border-collapse">
                                <thead>
                                    <tr className="bg-parchment-100 text-ink-700 text-sm">
                                        <th className="p-3 rounded-r-lg">موضوع</th>
                                        <th className="p-3">گیرنده</th>
                                        <th className="p-3 text-left rounded-l-lg">تاریخ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sentMessages.map(msg => (
                                        <tr key={msg.id} onClick={() => setSelectedMessage(msg)}
                                            className="cursor-pointer transition border-b border-parchment-200 hover:bg-parchment-50 text-ink-600">
                                            <td className="p-3">{msg.subject}</td>
                                            <td className="p-3 text-sm text-blue-700">{msg.receiver_name}</td>
                                            <td className="p-3 text-xs text-left" dir="ltr">
                                                {new Date(msg.created_at).toLocaleString('fa-IR')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    )}

                    {activeTab === 'sent' && selectedMessage && (
                        <div className="bg-parchment-100 rounded-xl border border-parchment-300 p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <button onClick={() => setSelectedMessage(null)}
                                    className="text-blue-600 hover:underline text-sm font-bold">
                                    بازگشت به لیست
                                </button>
                                <button onClick={() => setDeleteTarget(selectedMessage)}
                                    className="text-sm bg-red-500 hover:bg-red-600 text-white font-bold px-3 py-1 rounded">
                                    حذف
                                </button>
                            </div>
                            <h3 className="text-xl font-bold text-ink-800 mb-2">{selectedMessage.subject}</h3>
                            <p className="text-sm text-ink-500 mb-1 border-b border-parchment-300 pb-2">
                                گیرنده: <span className="text-blue-700 font-bold">{selectedMessage.receiver_name}</span>
                            </p>
                            <p className="text-xs text-ink-400 mb-4" dir="ltr">
                                {new Date(selectedMessage.created_at).toLocaleString('fa-IR')}
                            </p>
                            <div className="whitespace-pre-wrap leading-relaxed text-ink-800">{selectedMessage.body}</div>
                        </div>
                    )}

                    {activeTab === 'compose' && (
                        <form onSubmit={handleSendMessage} className="space-y-4">
                            <div className="relative">
                                <label className="field-label">نام کاربری گیرنده</label>
                                <input type="text" required className="field" value={receiverUsername}
                                    onChange={(e) => {
                                        setReceiverUsername(e.target.value);
                                        searchUsernames(e.target.value);
                                    }} />
                                {usernameSuggestions.length > 0 && (
                                    <ul className="absolute z-10 bg-white border border-parchment-300 rounded shadow-lg w-full mt-1">
                                        {usernameSuggestions.map(u => (
                                            <li key={u.id}
                                                className="px-3 py-2 hover:bg-gold-100 cursor-pointer text-sm text-blue-700"
                                                onClick={() => {
                                                    setReceiverUsername(u.username);
                                                    setUsernameSuggestions([]);
                                                }}>
                                                {u.username}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div>
                                <label className="field-label">موضوع</label>
                                <input type="text" required className="field" value={subject}
                                    onChange={(e) => setSubject(e.target.value)} />
                            </div>
                            <div>
                                <label className="field-label">متن پیام</label>
                                <textarea required rows="6" className="field resize-y" value={body}
                                    onChange={(e) => setBody(e.target.value)} />
                            </div>
                            <div className="flex gap-3">
                                <button type="submit" className="btn-primary">ارسال پیام</button>
                                <button type="button" className="btn-ghost" onClick={handleSupport}
                                    style={{ border: '1px solid #BEA659' }}>
                                    پشتیبانی
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </PageShell>
    );
}
