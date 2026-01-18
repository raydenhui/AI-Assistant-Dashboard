import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store';

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, checkAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      // Check for token in URL params (set by backend after OAuth)
      const token = searchParams.get('token');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setError(errorParam);
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      if (token) {
        login(token);
        // Wait for auth check to complete
        await checkAuth();
        navigate('/');
      } else {
        // No token, try to check auth status (cookie-based auth)
        await checkAuth();
        navigate('/');
      }
    };

    handleCallback();
  }, [searchParams, login, checkAuth, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="widget max-w-md w-full mx-4 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-danger rounded-full mb-4">
            <i className="fas fa-exclamation-triangle text-white text-2xl"></i>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Authentication Failed
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="widget max-w-md w-full mx-4 p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
          <div className="spinner !w-8 !h-8 !border-white !border-t-transparent"></div>
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Completing Sign In
        </h2>
        <p className="text-gray-600">
          Please wait while we set up your account...
        </p>
      </div>
    </div>
  );
}

export default AuthCallbackPage;
