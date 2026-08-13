import { redirect } from "next/navigation";

/**
 * There is one sign-in page for everyone, at /login.
 *
 * This route is kept as an alias so existing bookmarks and the proxy's
 * historical redirect target still land somewhere sensible.
 */
export default function AdminLoginRedirect() {
  redirect("/login?next=%2Fadmin");
}
