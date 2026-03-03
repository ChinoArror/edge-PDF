import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Loader2, AlertCircle } from 'lucide-react';

export default function SsoCallback({ setAuth }: { setAuth: (val: boolean) => void }) {
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [status, setStatus] = useState('Processing login...');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');

        if (!token) {
            setError('No authentication token received. Please try logging in again.');
            return;
        }

        const handleCallback = async () => {
            try {
                setStatus('Verifying your identity...');

                // Send token to our backend to verify and store user info
                const res = await fetch('/api/sso-callback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    setStatus('Login successful! Redirecting...');
                    // Store the session token locally
                    localStorage.setItem('auth', 'true');
                    localStorage.setItem('sso_token', token);
                    if (data.user) {
                        localStorage.setItem('user_name', data.user.name || '');
                        localStorage.setItem('user_uuid', data.user.uuid || '');
                    }
                    setAuth(true);
                    // Brief pause so user sees success state
                    setTimeout(() => navigate('/'), 600);
                } else {
                    setError(data.message || 'Verification failed. You may not have permission to access this app.');
                }
            } catch (err: any) {
                setError('Connection error during login. Please try again.');
            }
        };

        handleCallback();
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500 via-purple-600 to-red-500 p-4">
            <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl w-full max-w-md transform transition-all duration-300 border border-white/20 dark:border-zinc-800/50 text-center">

                <div className="flex justify-center mb-8">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-purple-500 rounded-full blur opacity-70 group-hover:opacity-100 transition duration-300"></div>
                        <div className="relative bg-gradient-to-br from-zinc-900 to-zinc-800 p-4 rounded-full text-white shadow-xl flex items-center justify-center">
                            <FileText className="w-10 h-10 text-green-400" />
                        </div>
                    </div>
                </div>

                <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-purple-600 dark:from-green-400 dark:to-purple-400 mb-2">
                    EdgePDF
                </h2>

                {!error ? (
                    <div className="mt-8 space-y-4">
                        <Loader2 className="w-12 h-12 mx-auto text-purple-500 animate-spin" />
                        <p className="text-zinc-600 dark:text-zinc-300 font-medium text-lg">{status}</p>
                    </div>
                ) : (
                    <div className="mt-8 space-y-6">
                        <div className="flex items-center justify-center gap-3 text-red-500">
                            <AlertCircle className="w-10 h-10 flex-shrink-0" />
                            <p className="text-sm font-medium text-left">{error}</p>
                        </div>
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-purple-600 hover:from-green-400 hover:to-purple-500 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-500/30 active:scale-95"
                        >
                            Back to Login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
