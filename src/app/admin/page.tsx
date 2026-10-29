import type { Metadata } from 'next'
import AdminApp from '@/components/admin/AdminApp'

export const metadata: Metadata = {
  title: 'Admin',
  description: 'Private administration area.',
  robots: { index: false, follow: false },
}

export default function AdminPage() {
  return (
    <section className="pt-28 pb-16 bg-surface min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminApp />
      </div>
    </section>
  )
}
