import LoginForm from '@/components/LoginForm';

export default function Login() {
    // If you had a useAuth hook you could redirect here if already logged in.
    // For now we just render the form.
    return <LoginForm returnTo="/" />;
}