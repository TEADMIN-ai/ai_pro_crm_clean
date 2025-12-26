export async function loginDolibarr() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_DOLIBARR_API_URL}/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // credentials here
      }),
    }
  );

  return res.json();
}
