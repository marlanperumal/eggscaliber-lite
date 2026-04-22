import { UserProfile } from "@clerk/nextjs"
import { ApiTokensSection } from "../components/ApiTokensSection"

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <UserProfile />
      <ApiTokensSection />
    </div>
  )
}
