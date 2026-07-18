export default function PageShell({ children, maxWidth = 'max-w-4xl', bg = '' }) {
    return (
        <div className={bg}>
            <div className={`w-full ${maxWidth} mx-auto`}>
                {children}
            </div>
        </div>
    );
}
