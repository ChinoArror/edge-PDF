import { FileText, LogIn } from 'lucide-react';

const SSO_URL = 'https://accounts.aryuki.com';
const APP_ID = 'edge-pdf';

export default function Login({ setAuth }: { setAuth: (val: boolean) => void }) {
  const handleSSOLogin = () => {
    const returnUrl = window.location.origin + '/sso-callback';
    window.location.href = `${SSO_URL}/?client_id=${APP_ID}&redirect=${encodeURIComponent(returnUrl)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500 via-purple-600 to-red-500 p-4">
      <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl w-full max-w-md transform transition-all hover:scale-[1.02] duration-300 border border-white/20 dark:border-zinc-800/50">

        <div className="flex justify-center mb-8">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-purple-500 rounded-full blur opacity-70 group-hover:opacity-100 transition duration-300"></div>
            <div className="relative bg-gradient-to-br from-zinc-900 to-zinc-800 p-4 rounded-full text-white shadow-xl flex items-center justify-center">
              <FileText className="w-10 h-10 text-green-400" />
            </div>
          </div>
        </div>

        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-purple-600 dark:from-green-400 dark:to-purple-400 mb-2">
            EdgePDF
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">Sign in with your centralized account to continue</p>
        </div>

        <button
          id="sso-login-btn"
          onClick={handleSSOLogin}
          className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-purple-600 hover:from-green-400 hover:to-purple-500 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-500/30 active:scale-95"
        >
          <LogIn className="w-6 h-6" />
          Login with SSO
        </button>
      </div>
    </div>
  );
}
