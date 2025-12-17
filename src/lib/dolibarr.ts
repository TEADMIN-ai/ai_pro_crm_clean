export async function loginDolibarr() {
  const res = await fetch(${process.env.NEXT_PUBLIC_DOLIBARR_API_URL}/login, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      login: process.env.NEXT_PUBLIC_DOLIBARR_LOGIN,
      password: process.env.NEXT_PUBLIC_DOLIBARR_PASSWORD,
    }),
  });

  const data = await res.json();
  if (data.success) {
    localStorage.setItem("dolibarr_token", data.token);
    return data.token;
  } else {
    throw new Error("Dolibarr login failed");
  }
}

export async function getContacts(token: string) {
  const res = await fetch(${process.env.NEXT_PUBLIC_DOLIBARR_API_URL}/contacts, {
    headers: {
      DOLAPIKEY: token,
    },
  });

  const data = await res.json();
  return data;
}
