import UserProfileClient from "./UserProfileClient";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;

  return <UserProfileClient uid={uid} />;
}