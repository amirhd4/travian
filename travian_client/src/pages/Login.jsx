import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const setUser = useGameStore((state) => state.setUser);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('auth/login/', { email, password });
            localStorage.setItem('token', response.data.token);
            // فرض می‌کنیم دیتای یوزر هم برمی‌گردد، در غیر این صورت یک رکوئست جدا میزنیم
            setUser({ email });
            navigate('/village'); // انتقال به نقشه دهکده
        } catch (err) {
            setError('ایمیل یا رمز عبور اشتباه است!');
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-gray-200">
            <div className="w-96 bg-white p-8 rounded-lg shadow-md border-t-4 border-travian-green">
                <h1 className="text-2xl font-bold mb-6 text-center text-gray-700">ورود به تراوین</h1>
                {error && <p className="text-red-500 mb-4 text-sm text-center">{error}</p>}

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    <input
                        type="email"
                        placeholder="ایمیل"
                        className="p-2 border rounded focus:outline-none focus:border-travian-green"
                        value={email} onChange={(e) => setEmail(e.target.value)} required
                    />
                    <input
                        type="password"
                        placeholder="رمز عبور"
                        className="p-2 border rounded focus:outline-none focus:border-travian-green"
                        value={password} onChange={(e) => setPassword(e.target.value)} required
                    />
                    <button type="submit" className="bg-travian-green text-white p-2 rounded hover:bg-green-700 transition">
                        ورود به بازی
                    </button>
                </form>
            </div>
        </div>
    );
}