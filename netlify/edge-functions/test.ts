export default async (request: Request) => {
  return new Response("✅ Netlify Edge Functions ARE WORKING!", {
    headers: {
      "Content-Type": "text/plain",
      "X-Edge-Test": "true",
    },
  });
};
