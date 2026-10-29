import { SignInForm } from "@/components/dashboard/identity-forms";
import { Brand } from "@/components/dashboard/brand";
export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#edf3ed] p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <Brand compact />
        <div className="mt-8">
          <SignInForm />
        </div>
      </div>
    </main>
  );
}
