import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, FileText } from 'lucide-react';

export default function Login({ setAuth }: { setAuth: (val: boolean) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('auth', 'true');
        setAuth(true);
        navigate('/');
      } else {
        setError(data.message || 'Incorrect password');
      }
    } catch (err) {
      setError('Connection error. Please try again later.');
    } finally {
      setIsLoading(false);
    }
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
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">Please enter your password to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-zinc-400 group-focus-within:text-purple-500 transition-colors" />
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Password"
              className={`w-full pl-12 pr-4 py-4 rounded-2xl border-2 ${error ? 'border-red-500' : 'border-zinc-200 dark:border-zinc-800'} bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white focus:ring-0 focus:border-purple-500 dark:focus:border-purple-500 outline-none transition-all duration-300 font-medium`}
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm font-medium text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-purple-600 hover:from-green-400 hover:to-purple-500 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-500/30 active:scale-95 disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {isLoading ? 'Verifying...' : 'Access EdgePDF'} {!isLoading && <ArrowRight className="w-6 h-6" />}
          </button>
        </form>
      </div>
    </div>
  );
}
