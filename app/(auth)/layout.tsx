import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <Link
            href="/"
            className="font-semibold text-base sm:text-lg tracking-tight"
          >
            Sistema de Eventos
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        {children}
      </main>
    </div>
  );
}
