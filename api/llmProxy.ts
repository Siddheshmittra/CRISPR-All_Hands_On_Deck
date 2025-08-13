// Redirect root to docs
export const config = { runtime: 'edge' } as const;
export default async function handler(): Promise<Response> {
  return Response.redirect('https://siddheshmittra.github.io/gene-craft-lab/', 302);
}
