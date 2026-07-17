import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosConfig.js";
import { AlertModal } from "../components/Modal";

const TRIBES = [
    { value: "ROMAN", label: "رومی‌ها", image: "/assets/tribes/roman-splash.gif", fallback: "/assets/tribes/roman.png" },
    { value: "TEUTON", label: "توتون‌ها", image: "/assets/tribes/teuton-splash.gif", fallback: "/assets/tribes/teuton.png" },
    { value: "GAUL", label: "گل‌ها", image: "/assets/tribes/gaul-splash.gif", fallback: "/assets/tribes/gaul.png" },
];

const STARTING_LOCATIONS = [
    { value: "RANDOM", label: "انتخاب تصادفی" },
    { value: "NW", label: "شمال غرب" },
    { value: "NE", label: "شمال شرق" },
    { value: "SW", label: "جنوب غرب" },
    { value: "SE", label: "جنوب شرق" },
];

export default function Register() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: "", email: "", password: "",
        tribe: "ROMAN", starting_location: "RANDOM",
    });
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [captchaAnswer, setCaptchaAnswer] = useState("");
    const [captcha, setCaptcha] = useState({ token: "", image: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [captchaLoading, setCaptchaLoading] = useState(true);
    const [successMsg, setSuccessMsg] = useState(null);

    useEffect(() => {
        document.body.className = "signup";
        return () => { document.body.className = ""; };
    }, []);

    const fetchCaptcha = useCallback(async () => {
        setCaptchaLoading(true);
        setCaptchaAnswer("");
        try {
            const { data } = await api.get("auth/captcha/");
            setCaptcha(data);
        } catch (err) { console.error(err); }
        finally { setCaptchaLoading(false); }
    }, []);

    useEffect(() => { fetchCaptcha(); }, [fetchCaptcha]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleRegister = async (e) => {
        e.preventDefault();
        setError("");
        if (!acceptTerms) { setError("برای ثبت‌نام باید قوانین بازی را بپذیرید."); return; }
        if (!captchaAnswer) { setError("لطفا کد امنیتی تصویر را وارد کنید."); return; }
        setLoading(true);
        try {
            const { data } = await api.post("auth/register/", {
                ...formData, phone_number: "0",
                accept_terms: acceptTerms,
                captcha_token: captcha.token, captcha_answer: captchaAnswer,
            });
            setSuccessMsg(data.message || "ثبت‌نام موفق");
        } catch (err) {
            if (err.response?.status === 429) {
                setError("تعداد درخواست‌های شما زیاد بوده؛ لطفا کمی صبر کنید.");
            } else {
                setError(
                    err.response?.data?.username?.[0] || err.response?.data?.email?.[0] ||
                    err.response?.data?.password?.[0] ||
                    err.response?.data?.captcha_answer?.[0] || err.response?.data?.accept_terms?.[0] ||
                    err.response?.data?.non_field_errors?.[0] || "خطا در ثبت‌نام"
                );
            }
            fetchCaptcha();
        } finally { setLoading(false); }
    };

    return (
        <div>
            <AlertModal open={!!successMsg} tone="success" title="ثبت‌نام موفق" message={successMsg} onClose={() => navigate("/login")} />

            <div id="wrapper">
                <div className="bodyWrapper">
                    <div id="header">
                        <div id="mtop">
                            <a id="logo" href="/" title="Travian"></a>
                            <div className="clear"></div>
                        </div>
                    </div>
                    <div id="mid">

                        <div id="side_navi">
                            <ul>
                                <li><a href="/">صفحه اصلی</a></li>
                                <li><a href="/login">ورود</a></li>
                                <li className="active"><a href="/register">ثبت نام</a></li>
                                <li><a href="#">پشتیبانی</a></li>
                            </ul>
                        </div>
                        <div className="clear"></div>

                        <div id="contentOuterContainer">
                            <div className="contentTitle">&nbsp;</div>
                            <div className="contentContainer">
                                <div id="content" className="signup">

                                    <h1>ثبت نام</h1>

                                    {error && (
                                        <div className="error" style={{ marginBottom: '10px', textAlign: 'right' }}>{error}</div>
                                    )}

                                    <form onSubmit={handleRegister}>
                                        <h4 className="round">اطلاعات کاربری</h4>
                                        <table id="sign_input">
                                            <tbody>
                                                <tr className="top">
                                                    <th><label htmlFor="userName">نام کاربری</label></th>
                                                    <td>
                                                        <input id="userName" className="text" type="text" name="username" value={formData.username} onChange={handleChange} maxLength={15} />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <th><label htmlFor="userEmail">پست الکترونیک</label></th>
                                                    <td>
                                                        <input id="userEmail" className="text" type="email" name="email" value={formData.email} onChange={handleChange} maxLength={40} />
                                                    </td>
                                                </tr>
                                                <tr className="btm">
                                                    <th><label htmlFor="userPassword">رمز عبور</label></th>
                                                    <td>
                                                        <input id="userPassword" className="text" type="password" name="password" value={formData.password} onChange={handleChange} maxLength={20} minLength={8} />
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        <h4 className="round">یک نژاد انتخاب کنید</h4>
                                        <p className="tribeInfo">اگر از این بابت دلهره دارید، <span style={{ color: '#99C01A', fontWeight: 'bold' }}>راهنمای بازی</span> را مطالعه کنید یا از دوستان و خانواده‌ی خود بپرسید.
                                            <br /><br />اگر در عاقبت نژاده وارد شدید، گل‌ها بهترین گزینه برای شما محسوب می‌شوند!
                                        </p>
                                        <div className="tribeSelect">
                                            {TRIBES.map((t) => (
                                                <div key={t.value} className={`tribe ${t.value.toLowerCase()}`}>
                                                    <div className="selection">
                                                        <input
                                                            id={`tribe${t.value}`}
                                                            className="radio"
                                                            type="radio"
                                                            name="tribe"
                                                            value={t.value}
                                                            checked={formData.tribe === t.value}
                                                            onChange={handleChange}
                                                        />
                                                        &nbsp;
                                                        <label htmlFor={`tribe${t.value}`}>{t.label}</label>
                                                    </div>
                                                    <label htmlFor={`tribe${t.value}`}>
                                                        <img
                                                            src={t.image}
                                                            alt={t.label}
                                                            title={t.label}
                                                            className={`tribeImage ${t.value.toLowerCase()}`}
                                                            onError={(e) => { e.target.src = t.fallback; }}
                                                        />
                                                    </label>
                                                </div>
                                            ))}
                                            <div className="clear"></div>
                                        </div>

                                        <h4 className="round">محل شروع</h4>
                                        <table id="sign_select">
                                            <tbody>
                                                <tr>
                                                    <td>
                                                        <input className="radio" type="radio" id="positionRandom" name="starting_location" value="RANDOM" checked={formData.starting_location === "RANDOM"} onChange={handleChange} />
                                                        &nbsp;<label htmlFor="positionRandom">انتخاب تصادفی</label>
                                                    </td>
                                                    <td>
                                                        <input className="radio" type="radio" id="positionNW" name="starting_location" value="NW" checked={formData.starting_location === "NW"} onChange={handleChange} />
                                                        &nbsp;<label htmlFor="positionNW">شمال غرب</label>
                                                    </td>
                                                    <td>
                                                        <input className="radio" type="radio" id="positionNE" name="starting_location" value="NE" checked={formData.starting_location === "NE"} onChange={handleChange} />
                                                        &nbsp;<label htmlFor="positionNE">شمال شرق</label>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="pos2">&nbsp;</td>
                                                    <td>
                                                        <input className="radio" type="radio" id="positionSW" name="starting_location" value="SW" checked={formData.starting_location === "SW"} onChange={handleChange} />
                                                        &nbsp;<label htmlFor="positionSW">جنوب غرب</label>
                                                    </td>
                                                    <td>
                                                        <input className="radio" type="radio" id="positionSE" name="starting_location" value="SE" checked={formData.starting_location === "SE"} onChange={handleChange} />
                                                        &nbsp;<label htmlFor="positionSE">جنوب شرق</label>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        <h4 className="round">اطلاعات بیشتر</h4>
                                        <ul className="important">
                                            <li>۱ - در صورت مشاهده‌ی هرگونه توهین یا الفاظ نامناسب، اکانت بازیکن خاطی بدون اخطار مسدود خواهد شد.</li>
                                            <li>۲ - رمز اکانت خود را هرگز در اختیار هیچ‌کس قرار ندهید حتماً قواعد را رعایت کنید تا آن احتمالی دارید.</li>
                                        </ul>

                                        <div className="checks" style={{ marginTop: '15px' }}>
                                            <input className="check" type="checkbox" id="agb" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
                                            <label htmlFor="agb">من قوانین را خوانده و قبول دارم.</label>
                                        </div>

                                        <div style={{ marginTop: '15px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                                {captchaLoading ? (
                                                    <div style={{ width: '128px', height: '52px', background: '#E5E5E5' }} />
                                                ) : (
                                                    <img src={captcha.image} alt="کپچا" style={{ border: '1px solid #CCC' }} />
                                                )}
                                                <input type="text" required value={captchaAnswer} onChange={(e) => setCaptchaAnswer(e.target.value)} placeholder="کد داخل تصویر" className="text" style={{ width: '113px', textAlign: 'center', letterSpacing: '2px', fontWeight: 'bold' }} />
                                            </div>
                                        </div>

                                        <div className="btn" style={{ textAlign: 'center', marginTop: '15px' }}>
                                            <button type="submit" disabled={loading} className="btn-primary">
                                                {loading ? "در حال ثبت‌نام..." : "ثبت نام"}
                                            </button>
                                        </div>
                                    </form>

                                    <div className="clear">&nbsp;</div>
                                </div>
                            </div>
                            <div className="contentFooter">&nbsp;</div>
                        </div>

                    </div>
                    <div className="clear"></div>
                </div>

                <div id="ce"></div>
            </div>
        </div>
    );
}
