export default function UserProfilePage({
  params,
}: {
  params: { uid: string };
}) {
  return (
    <div style={{ padding: 40 }}>
      <h1>User Profile</h1>
      <p>User ID: {params.uid}</p>
    </div>
  );
}