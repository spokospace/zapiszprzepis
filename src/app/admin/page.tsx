import { notFound, redirect } from 'next/navigation'
import { getStaff } from '@/lib/staff/context'
import { visibleResources } from '@/lib/staff/registry'

// The panel's front door: straight to the first screen this role may open.
export default async function AdminHome() {
  const staff = await getStaff()
  if (!staff) notFound()
  const [first] = visibleResources(staff.permissions)
  if (!first) notFound()
  redirect(first.path)
}
