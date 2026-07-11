import ResourceBar from './ResourceBar';
import Navbar from './Navbar';
import Footer from './Footer';

/**
 * قالب استاندارد صفحات بازی: ResourceBar + Navbar بالا، Footer پایین،
 * محتوا وسط با عرض ثابت. همه صفحات باید از این استفاده کنند تا حس
 * یکپارچه‌ی «یک بازی واحد» داشته باشند (نه هر صفحه یه ظاهر جدا).
 */
export default function PageShell({ children, maxWidth = 'max-w-4xl', bg = 'game-bg' }) {
    return (
        <div className={`${bg} pt-24 pb-20 flex flex-col items-center`}>
            <ResourceBar />
            <Navbar />
            <div className={`w-full ${maxWidth} px-4 flex flex-col gap-6 mt-2`}>
                {children}
            </div>
            <Footer />
        </div>
    );
}