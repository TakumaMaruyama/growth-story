import LoginForm from '@/components/LoginForm';

export default function AdminLogin() {
    return <LoginForm adminOnly returnTo="/admin/users" />;
}