import { redirect } from "next/navigation";

export default async function FirmIndexPage({
  params
}: {
  params: Promise<{ firmSlug: string }>;
}) {
  const { firmSlug } = await params;
  redirect(`/${firmSlug}/dashboard`);
}
