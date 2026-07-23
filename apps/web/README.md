# GetHiredASAP Web

The web application is built with Next.js and runs as a standard Node.js service. It is designed to be self-hosted alongside the Express API on a VPS or another Node-compatible host.

## Development

From the repository root:

```bash
npm --workspace web run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production Build

```bash
npm --workspace web run build
npm --workspace web run start
```

Set `SERVER_API_URL` to the internal Express API address. Set `NEXT_PUBLIC_API_URL` only when browsers must call the API through a public URL.

On a VPS, run the web process behind a reverse proxy such as Nginx or Caddy and terminate TLS at the proxy.
