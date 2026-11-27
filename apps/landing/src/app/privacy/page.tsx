import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

const privacyEmail = "info@sarvodayaconnect.com";

export const metadata: Metadata = {
  title: "Privacy Policy | Sarvodaya Connect",
  description: "How Sarvodaya Connect handles information in its mobile apps and web dashboard.",
  alternates: { canonical: "https://sarvodayaconnect.com/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-ink md:px-6 md:py-16">
      <header className="flex items-center justify-between gap-4">
        <Image
          alt="Sarvodaya Connect"
          className="h-10 w-auto md:h-12"
          height={453}
          priority
          src="/brand/sarvodaya-connect-wordmark.png"
          width={1178}
        />
        <Link className="text-right text-sm font-semibold text-green-pine underline underline-offset-4" href="/">
          Back to Sarvodaya Connect
        </Link>
      </header>

      <article className="mt-6 rounded-card border border-line bg-surface p-5 sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Sarvodaya Connect Privacy Policy</h1>
        <div className="mt-4 space-y-7 leading-relaxed text-ink-soft">
          <p>
            Sarvodaya Connect helps authorised Sarvodaya staff and society officers manage
            society records, reports, documents and requests. This policy covers the mobile
            apps and web dashboard.
          </p>

          <section aria-labelledby="information">
            <h2 id="information" className="mb-2 text-xl font-bold text-ink">Information we handle</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Account information.</strong> We use account identifiers, assigned roles
                and society or district assignments to sign users in and determine what they can
                access. Amazon Cognito processes sign-in credentials.
              </li>
              <li>
                <strong>Society and programme records.</strong> Depending on the user&apos;s role,
                the service handles society profiles, committee members&apos; names and contact
                details, membership figures, annual financial totals, activities, disaster
                assessments, and records of reviews or requests. National identity numbers in
                applicable records are stored encrypted, with access restricted by role.
              </li>
              <li>
                <strong>Uploaded files and maps.</strong> Users can submit documents or photos
                they select. Files are stored privately and made available according to access
                permissions. Maps use the coordinates recorded for a society.
              </li>
              <li>
                <strong>Activity and service records.</strong> We use operational logs and
                audit records to troubleshoot the service, protect accounts and track
                authorised changes.
              </li>
            </ul>
          </section>

          <section aria-labelledby="use">
            <h2 id="use" className="mb-2 text-xl font-bold text-ink">How we use and share information</h2>
            <p>
              We use this information to provide sign-in, enforce permissions, maintain society
              records, support reviews and reporting, and operate the service. Authorised users
              can access records according to their assigned role and scope. We use Amazon Web
              Services to host the service, authenticate users, store files and run SarvoAI.
            </p>
          </section>

          <section aria-labelledby="sarvoai">
            <h2 id="sarvoai" className="mb-2 text-xl font-bold text-ink">SarvoAI</h2>
            <p>
              SarvoAI is available to authorised headquarters users. When a user asks a question,
              the service may send the question and limited information from eligible records to
              an AI model through Amazon Bedrock. Depending on the question, this may include
              society names, committee member names or reported financial totals. Global
              inference may process these requests outside Singapore. Keep passwords, national
              identity numbers and other sensitive details out of your questions.
            </p>
          </section>

          <section aria-labelledby="requests">
            <h2 id="requests" className="mb-2 text-xl font-bold text-ink">Retention and privacy requests</h2>
            <p>
              To request access to, correction of or deletion of your personal information,
              or to withdraw consent where applicable, email{" "}
              <a className="break-words font-semibold text-green-pine underline underline-offset-4" href={`mailto:${privacyEmail}`}>
                {privacyEmail}
              </a>.
              We verify your identity before acting on a request.
            </p>
            <p className="mt-3">
              When Sarvodaya removes an account, its sign-in details and active sessions are
              removed or revoked. Sarvodaya may retain society records and audit history where
              needed for recordkeeping, security or legal obligations. We will explain what we
              can delete and what needs to be retained when responding to your request.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
