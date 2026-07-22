export default function PrivacyPage() {
    return (
        <main className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
            <div className="prose prose-slate prose-indigo max-w-none">
                Privacy Policy
                Effective Date: July 2026

                1. Data We Collect

                Account Information: When you sign in via Magic Link or Google OAuth, we collect your email address and basic profile information provided by the authentication provider.

                User Content: We collect the images you upload solely for the purpose of processing them through our AI upscaling models.

                Usage Data: We collect basic, anonymized analytics regarding how you interact with our website to help us improve the service.

                2. How We Use Your Data

                To provide, maintain, and improve the SuperResAI service.

                To process your images. We do not use your uploaded images to train our AI models.

                To communicate with you regarding account security or service updates.

                3. Data Storage and Third Parties
                We use secure third-party services to operate SuperResAI:

                Supabase: Used for secure authentication, database management, and temporary image storage.

                GPU Hosting Providers: Your images are temporarily sent to secure cloud GPUs for processing.
                Images are stored only as long as necessary to provide the service and are not shared with unauthorized third parties or sold to advertisers.

                4. Cookies
                We use essential cookies strictly to manage user sessions and authentication status. We do not use intrusive tracking or advertising cookies.

                5. Your Rights
                You have the right to request access to, correction of, or deletion of your personal data. You can delete your account and associated data by contacting us.
            </div>
        </main>
    );
}