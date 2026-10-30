import { SignInForm } from "@/components/dashboard/identity-forms";
import { Brand } from "@/components/dashboard/brand";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <section className="grid min-h-screen w-full grid-cols-1 overflow-hidden bg-white md:grid-cols-[43%_57%]">
        <aside className="relative flex min-h-[250px] flex-col justify-between bg-[#1d3f2e] p-7 text-white sm:p-9 md:min-h-0 md:p-10">
          <Brand compact masthead inverse />
          <div className="max-w-[420px] py-8 md:py-0">
            <h2 className="text-2xl font-bold leading-tight sm:text-3xl">
              One trusted record for every village society.
            </h2>
            <p className="mt-3 text-sm text-[#d6e2d9]">
              HQ dashboard for the Sarvodaya Shramadana Movement.
            </p>
          </div>
          <p className="text-[11px] text-[#bdcec2]">
            Sarvodaya Shramadana Movement · Moratuwa, Sri Lanka
          </p>
        </aside>
        <div className="flex min-h-[540px] items-center justify-center px-6 py-8 sm:px-10 md:px-12 lg:px-16">
          <SignInForm />
        </div>
      </section>
    </main>
  );
}
