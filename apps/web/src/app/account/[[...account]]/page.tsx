import { UserProfile } from "@clerk/nextjs"

export default function AccountPage() {
  return (
    <div className="flex min-h-screen items-center justify-center py-8">
      <UserProfile />
    </div>
  )
}
