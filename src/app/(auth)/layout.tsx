import DashboardLayout from '@/components/layouts/DashboardLayout';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
} 